// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

import { type UseWebSocketReturn, useWebSocket } from "@vueuse/core";
import { type Ref, ref, watch } from "vue";
import { getBaseUrl } from "@/boot/axios";
import { useAuthStore } from "@/stores/auth";

export function getWSUrl(path: string, token: string | null) {
  const host = getBaseUrl().split("://")[1];
  const secure = import.meta.env.QUASAR_PROD || import.meta.env.DOCKER_BUILD;
  return `${secure ? "wss" : "ws"}://${host}/ws/${path}/?access_token=${token}`;
}

interface WSReturn {
  action: string;
  data: unknown;
  error?: string;
}

const blankMessage = (): WSReturn => ({ action: "", data: {} });

// the latest frame, parsed. strict lets a malformed frame throw; otherwise
// it becomes a blank message carrying an error
function parsedFrames(raw: Ref<string | null>, strict: boolean) {
  const message = ref<WSReturn>(blankMessage());
  watch(raw, (frame) => {
    if (!frame) return;
    try {
      message.value = JSON.parse(frame);
    } catch (e) {
      if (strict) throw e;
      message.value = { ...blankMessage(), error: "Invalid websocket payload" };
    }
  });
  return message;
}

// one socket per path for the whole app until a caller closes it
const shared = new Map<string, UseWebSocketReturn<string>>();

function sharedConnection(
  path: string,
  options: Parameters<typeof useWebSocket>[1],
) {
  const auth = useAuthStore();
  let socket = shared.get(path);
  if (!socket) {
    socket = useWebSocket(getWSUrl(path, auth.token), options);
    shared.set(path, socket);
  }
  const { status, send, open, close } = socket;
  return {
    status,
    data: parsedFrames(socket.data, true),
    send,
    open,
    close() {
      shared.delete(path);
      close();
    },
  };
}

// sign-out: the next user opens fresh sockets with their own token
export function closeAllShared() {
  for (const socket of shared.values()) socket.close();
  shared.clear();
}

export function useDashWSConnection() {
  return sharedConnection("dashinfo", { autoReconnect: true });
}

// connect after step-up. handshake fails before that
export function useCliWSConnection() {
  return sharedConnection("rmmcli", { immediate: false });
}

export function useTerminalWSConnection(agentId: string, sessionId: string) {
  const auth = useAuthStore();
  const path = `agent/${agentId}/terminal/${sessionId}`;
  const { status, data, send, open, close } = useWebSocket(
    getWSUrl(path, auth.token),
  );
  return { status, data: parsedFrames(data, false), send, open, close };
}
