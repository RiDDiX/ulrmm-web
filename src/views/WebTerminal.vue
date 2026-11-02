<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <div class="full-page-terminal">
    <div class="terminal-host-bar">
      <q-icon name="dns" size="16px" class="terminal-host-bar__icon" />
      <span class="terminal-host-bar__host">Shell on {{ apiHost }}</span>
      <span class="rmm-muted"
        >Commands run on the RMM server itself, not on an agent</span
      >
    </div>
    <div ref="xtermContainer" class="xterm-container"></div>
    <div
      v-if="disconnected"
      class="terminal-issue-overlay column items-center justify-center q-gutter-sm"
      :style="{ background: terminalTheme.background }"
    >
      <q-icon
        name="link_off"
        size="32px"
        class="terminal-issue-overlay__icon"
      />
      <div class="text-body2 text-white">
        Could not connect to the server terminal.
      </div>
      <q-btn
        outline
        no-caps
        color="white"
        icon="refresh"
        label="Reconnect"
        @click="reconnect"
      />
    </div>
  </div>
</template>

<style scoped>
.full-page-terminal {
  display: flex;
  flex-direction: column;
  block-size: 100vh;
  position: relative;
}

.terminal-host-bar {
  display: flex;
  flex-shrink: 0;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 10px;
  padding: 6px 12px;
  color: var(--rmm-text);
  background: var(--rmm-surface);
  font-size: var(--rmm-fs-xs);
  border-bottom: 1px solid var(--rmm-border);
}

.terminal-host-bar__icon {
  color: var(--rmm-text-subtle);
}

.terminal-host-bar__host {
  font-weight: 600;
}

.xterm-container {
  flex-grow: 1;
  overflow: hidden;
}

.terminal-issue-overlay {
  position: absolute;
  inset: 0;
  text-align: center;
  padding: 16px;
}

.terminal-issue-overlay__icon {
  color: rgba(255, 255, 255, 0.7);
}
</style>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { useDebounceFn, useResizeObserver } from "@vueuse/core";
import { useMeta, useQuasar } from "quasar";
import { ensureConsoleStepUp } from "@/composables/accounts";
import { useCliWSConnection } from "@/websocket/websocket";
import { getBaseUrl } from "@/boot/axios";
import { useBrandingStore } from "@/stores/branding";
import "@xterm/xterm/css/xterm.css";

interface WSRmmCliOutput {
  output: string;
  messageId: string;
}

const $q = useQuasar();
const branding = useBrandingStore();
const { data, send, close, open, status } = useCliWSConnection();

const xtermContainer = ref<HTMLElement | null>(null);
const disconnected = ref(false);
const fit = new FitAddon();
let term: Terminal;

// the API host, not a device: this is a shell on the RMM server itself
const apiHost = getBaseUrl()
  .replace(/^https?:\/\//, "")
  .replace(/\/$/, "");
useMeta({ title: `Server shell | ${branding.productName}` });

const ansiColors: Record<string, [string, string]> = {
  black: ["#1d1f21", "#666666"],
  red: ["#cc6666", "#d54e53"],
  green: ["#b5bd68", "#b9ca4a"],
  yellow: ["#f0c674", "#e7c547"],
  blue: ["#81a2be", "#7aa6da"],
  magenta: ["#b294bb", "#c397d8"],
  cyan: ["#8abeb7", "#70c0b1"],
  white: ["#c5c8c6", "#eaeaea"],
};

function buildTheme() {
  const [dark, light] = ["#1d1f21", "#c5c8c6"];
  const theme: Record<string, string> = {
    background: dark,
    foreground: light,
    cursor: light,
    cursorAccent: dark,
    selectionBackground: "rgba(255,255,255,0.18)",
  };
  for (const [name, [normal, bright]] of Object.entries(ansiColors)) {
    theme[name] = normal;
    theme[`bright${name[0].toUpperCase()}${name.slice(1)}`] = bright;
  }
  return theme;
}
const terminalTheme = buildTheme();

const sendAction = (action: string, payload?: unknown) =>
  send(
    JSON.stringify(
      payload === undefined ? { action } : { action, data: payload },
    ),
  );

function startTerminal() {
  const fontFamily = "Menlo, Monaco, 'SF Mono', 'Courier New', monospace";
  term = new Terminal({
    theme: terminalTheme,
    fontFamily,
    fontSize: 15,
    fontWeight: "normal",
    scrollback: 50000,
    convertEol: true,
    cursorBlink: true,
  });
  term.loadAddon(fit);
  term.open(xtermContainer.value as HTMLElement);
  fit.fit();
  requestAnimationFrame(() => term?.focus());
  term.onData((input) => sendAction("rmmcli.input", { input }));
}

const resizeWindow = useDebounceFn(() => {
  fit.fit();
  sendAction("rmmcli.resize", { cols: term.cols, rows: term.rows });
}, 300);

// step-up reject closes the handshake with no close code
async function reconnect() {
  disconnected.value = false;
  const unlocked = await ensureConsoleStepUp($q).catch(() => false);
  if (unlocked) open();
  else disconnected.value = true;
}

watch(status, (value) => {
  disconnected.value = value === "CLOSED";
});

watch(data, (msg) => {
  if (msg.action !== "rmmcli.output") return;
  term.write((msg.data as WSRmmCliOutput).output);
});

onMounted(() => {
  startTerminal();
  useResizeObserver(xtermContainer, () => resizeWindow());
  reconnect();
});

onBeforeUnmount(() => {
  term.dispose();
  close();
  sendAction("rmmcli.disconnect");
});
</script>
