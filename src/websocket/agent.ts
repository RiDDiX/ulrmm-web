// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

import { useWebSocket } from "@vueuse/core";
import { ref } from "vue";
import { useAuthStore } from "@/stores/auth";
import { notifyError } from "@/utils/notify";
import { appendChunk, emptyTail, tailText } from "@/utils/outputTail";
import { getWSUrl } from "./websocket";

// one chunk of output; done and exit_code come with the last one
type CmdMessage = { cmd_id: string; output?: string } & {
  done?: boolean;
  exit_code?: number;
} & Record<string, unknown>;

const PARSE_ERROR = "[Error] Unable to parse server output";

export function useAgentCmdWSConnection(agentId: string, cmdId: string) {
  const auth = useAuthStore();
  let tail = emptyTail();
  const output = ref("");
  // kept frames since the last reset; the output stops growing at its cap
  const received = ref(0);
  // the server sends a done marker with the exit code instead of closing the
  // socket, so that message is what ends a command
  const done = ref<CmdMessage | null>(null);

  // a done marker gets through even without output, or a silent command never
  // finishes; only a blank leading chunk is dropped
  function keep(msg: CmdMessage) {
    const leading = received.value <= 1;
    const blank = (msg.output ?? "").trim() === "";
    return msg.done || !(leading && blank);
  }

  function add(msg: CmdMessage) {
    appendChunk(tail, msg.output ?? "");
    output.value = tailText(tail);
    if (msg.done && !done.value) done.value = msg;
    received.value++;
  }

  function receive(frame: string) {
    const msg = JSON.parse(frame);
    if (msg?.error) {
      const caption = msg.status ? `${msg.status}: Forbidden` : "Error";
      notifyError(`${caption}: ${msg.error}`);
      close();
      return;
    }
    if (msg?.cmd_id === cmdId && keep(msg)) add(msg);
  }

  const url = getWSUrl(`agent/${agentId}/cmd`, auth.token);
  const { status, send, open, close } = useWebSocket(url, {
    autoReconnect: false,
    onMessage(_, ev) {
      try {
        receive(ev.data);
      } catch {
        add({ cmd_id: cmdId, output: PARSE_ERROR });
      }
    },
  });

  function clear() {
    tail = emptyTail();
    output.value = "";
    received.value = 0;
    done.value = null;
  }
  return {
    status,
    output,
    received,
    done,
    send,
    open,
    reset: clear,
    close() {
      close();
      clear();
    },
  };
}
