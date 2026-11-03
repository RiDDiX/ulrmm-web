// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

import { onBeforeUnmount, ref, watch } from "vue";
import type { Ref, WatchStopHandle } from "vue";
import { Terminal } from "@xterm/xterm";
import type { ITerminalOptions, ITheme } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { uid } from "quasar";
import { useDebounceFn } from "@vueuse/core";
import { useTerminalWSConnection } from "@/websocket/websocket";

interface Frame {
  action?: string;
  error?: string;
  message?: string;
  data?: Partial<{
    output: string;
    messageId: string;
    done: boolean;
    error: string;
  }>;
}

interface Socket {
  data: Ref<Frame | null>;
  status: Ref<string>;
  send: (msg: string) => void;
  close: () => void;
}

export type SessionIssue = "connect-failed" | "no-response";

export interface SessionHooks {
  agentId: () => string;
  // value of run_as_user in the start message
  runAsUser: () => boolean;
  // the first output of a session arrived
  started: () => void;
  // the agent could not start `shell`
  refused: (text: string, shell: string) => void;
  // the agent started the shell, but not as the user
  noticed: (text?: string) => void;
  // the socket closed before the shell was started
  closed: () => void;
}

const POLL_MS = 50;
const START_WAIT_MS = 10000;

const afterPaint = () =>
  new Promise<void>((done) =>
    requestAnimationFrame(() => requestAnimationFrame(() => done())),
  );

// one xterm instance and the agent shell session behind it; both end when
// the calling component unmounts
export function useTerminalSession(hooks: SessionHooks) {
  const loading = ref(false);
  const issue = ref<SessionIssue | null>(null);
  const fit = new FitAddon();

  let xterm: Terminal | null = null;
  let socket: Socket | null = null;
  // id of the session that may write to the terminal
  let current: string | null = null;
  let starting = false;
  let streaming = false;
  let unwatch: WatchStopHandle | null = null;
  let keys: { dispose: () => void } | null = null;
  let poll: ReturnType<typeof setInterval> | null = null;
  let deadline: ReturnType<typeof setTimeout> | null = null;

  const send = (payload: Record<string, unknown>) =>
    socket?.send(JSON.stringify(payload));

  function clearDeadline() {
    if (deadline) clearTimeout(deadline);
    deadline = null;
  }

  function clearTimers() {
    if (poll) clearInterval(poll);
    poll = null;
    clearDeadline();
  }

  // ends the running session on the agent and closes its socket
  function drop() {
    clearTimers();
    unwatch?.();
    unwatch = null;
    keys?.dispose();
    keys = null;
    starting = false;
    streaming = false;
    try {
      socket?.send(JSON.stringify({ action: "kill" }));
    } catch {
      // the socket may already be gone
    }
    try {
      socket?.close();
    } catch {
      // same
    }
    current = null;
  }

  async function syncSize() {
    await afterPaint();
    if (!xterm || !streaming) return;
    fit.fit();
    send({ action: "resize", rows: xterm.rows, cols: xterm.cols });
  }

  const refit = useDebounceFn(async () => {
    if (xterm && streaming) await syncSize();
  }, 200);

  function goLive() {
    if (!xterm || !starting || streaming) return;
    clearDeadline();
    issue.value = null;
    streaming = true;
    loading.value = false;
    hooks.started();
    void syncSize().then(() => xterm?.focus());
  }

  function onFrame(frame: Frame | null, id: string, shell: string) {
    const out = xterm;
    if (!frame || !out || current !== id) return;

    if (frame.action === "terminal_error") {
      clearDeadline();
      loading.value = false;
      starting = false;
      streaming = false;
      const text =
        frame.error || frame.data?.error || "Failed to start terminal";
      hooks.refused(text, shell);
      return;
    }
    if (frame.action === "terminal_info") {
      hooks.noticed(frame.message);
      return;
    }

    const chunk = frame.data?.output;
    if (chunk) {
      out.write(chunk);
      if (!streaming) goLive();
    }
    if (frame.data?.done) {
      streaming = false;
      starting = false;
      loading.value = false;
      out.write("\r\n[Session Ended]\r\n");
    }
  }

  // waits for the socket of session `id`, then asks the agent for the shell
  async function handshake(id: string, shell: string, status: Ref<string>) {
    if (current !== id) return clearTimers();
    if (status.value === "CLOSED") {
      clearTimers();
      loading.value = false;
      issue.value = "connect-failed";
      // an expired step-up ends here as well, 4403 closes the handshake
      hooks.closed();
      return;
    }
    if (status.value !== "OPEN" || !xterm) return;
    clearTimers();

    await afterPaint();
    if (!xterm || current !== id) return;
    fit.fit();
    starting = true;
    streaming = false;
    loading.value = true;
    send({ action: "start", shell, run_as_user: hooks.runAsUser() });

    // the server has no reply timeout for an offline agent
    deadline = setTimeout(() => {
      if (current !== id || streaming) return;
      loading.value = false;
      issue.value = "no-response";
    }, START_WAIT_MS);
  }

  function open(shell: string) {
    drop();
    issue.value = null;
    const id = uid();
    current = id;
    const conn = useTerminalWSConnection(
      hooks.agentId(),
      id,
    ) as unknown as Socket;
    socket = conn;
    unwatch = watch(conn.data, (frame) => onFrame(frame, id, shell));
    keys = xterm!.onData((input) => {
      if (streaming && current === id) send({ action: "input", data: input });
    });
    poll = setInterval(() => void handshake(id, shell, conn.status), POLL_MS);
  }

  function restart(shell: string) {
    loading.value = true;
    starting = false;
    streaming = false;
    xterm?.reset();
    fit.fit();
    open(shell);
  }

  function mount(host: HTMLElement, options: ITerminalOptions) {
    xterm = new Terminal(options);
    xterm.loadAddon(fit);
    xterm.open(host);
    fit.fit();
    requestAnimationFrame(() => xterm?.focus());
  }

  const mounted = () => xterm !== null;

  function setTheme(theme: ITheme) {
    if (xterm) xterm.options.theme = theme;
  }

  // the whole scrollback as plain text
  function text() {
    const buffer = xterm?.buffer.active;
    if (!buffer) return "";
    const lines: string[] = [];
    for (let row = 0; row < buffer.length; row++) {
      const line = buffer.getLine(row);
      if (line) lines.push(line.translateToString(true));
    }
    return lines.join("\n").trimEnd();
  }

  onBeforeUnmount(() => {
    drop();
    xterm?.dispose();
    xterm = null;
  });

  return {
    loading,
    issue,
    mount,
    mounted,
    setTheme,
    open,
    restart,
    refit,
    text,
  };
}
