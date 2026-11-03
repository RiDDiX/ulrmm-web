<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <div class="term column no-wrap" :style="backdrop">
    <div v-if="shells.length" class="term__bar row items-center">
      <div class="term__group row items-center">
        <span class="term__caption">Shell</span>
        <HelpTip
          text="Switching the shell closes this session and starts a new one"
        />
        <q-option-group
          v-bind="radioRow"
          :model-value="pick.shell"
          :options="shells"
          @update:model-value="pickShell"
        />
        <q-btn
          v-for="action in barActions"
          :key="action.label"
          :label="action.label"
          :icon="action.icon"
          :color="action.color"
          flat
          dense
          no-caps
          @click="action.run"
        >
          <q-tooltip>{{ action.tip }}</q-tooltip>
        </q-btn>
      </div>

      <div v-if="onWindows" class="term__group row items-center">
        <span class="term__caption">Run as</span>
        <HelpTip
          text="User runs as the signed-in user, or SYSTEM if nobody is; switching restarts the session"
        />
        <q-option-group
          v-model="asUser"
          v-bind="radioRow"
          :options="RUN_AS"
          @update:model-value="restartCurrent"
        />
      </div>

      <q-space />
      <TerminalShortcuts />
    </div>

    <div class="term__body relative-position row no-wrap">
      <div ref="screen" class="term__screen full-height overflow-hidden"></div>
      <q-inner-loading color="primary" :showing="loading" />
      <div
        v-if="issue"
        class="absolute-full q-pa-md text-center column items-center justify-center q-gutter-sm"
        :style="backdrop"
      >
        <q-icon name="link_off" size="32px" class="term__issue-icon" />
        <div class="text-body2 text-white">{{ ISSUE_TEXT[issue] }}</div>
        <q-btn v-bind="reconnectButton" @click="reconnect" />
      </div>
    </div>
  </div>

  <CustomShellDialog
    v-model="askPath"
    v-model:path="pathInput"
    :windows="onWindows"
    @start="startCustom"
    @cancel="cancelCustom"
  />
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import type { ITerminalOptions } from "@xterm/xterm";
import { copyToClipboard } from "quasar";
import { useResizeObserver } from "@vueuse/core";
import { notifyError, notifySuccess, notifyWarning } from "@/utils/notify";
import HelpTip from "@/components/ui/HelpTip.vue";
import CustomShellDialog from "@/components/agents/remotebg/CustomShellDialog.vue";
import TerminalShortcuts from "@/components/agents/remotebg/TerminalShortcuts.vue";
import { useTerminalSession } from "@/components/agents/remotebg/useTerminalSession";
import {
  cmdTheme,
  powershellTheme,
  pwsh7Theme,
  unixTheme,
} from "./terminalThemes";
import "@xterm/xterm/css/xterm.css";

type TerminalDefaults = Record<
  | "agent_id"
  | "hostname"
  | "plat"
  | "default_shell"
  | "resolved_default_shell"
  | "effective_default_shell",
  string
> & { terminal_mode: "new" | "legacy" };

const props = defineProps<{
  terminalDefaults?: TerminalDefaults | null;
  agentPlatform: string;
  agent_id: string;
}>();

const emit = defineEmits<{ "connect-failed": [] }>();

const BUILT_IN = new Set(["cmd", "powershell", "bash", "sh"]);
const RUN_AS = [false, true].map((value) => ({
  label: value ? "User" : "System",
  value,
}));
const ISSUE_TEXT = {
  "connect-failed": "Could not connect to the agent terminal.",
  "no-response": "The agent did not respond.",
};
const PWSH7_PATH = /(?:^|[\\/])pwsh(?:-preview)?(?:\.exe)?$/i;

// built-in shells per platform, as [label, value]
const WINDOWS_SHELLS = [
  ["CMD", "cmd"],
  ["PowerShell", "powershell"],
];
const FREEBSD_SHELLS = [
  ["sh", "sh"],
  ["Bash", "bash"],
];
const OTHER_SHELLS = [["Bash", "bash"]];

const WINDOWS_FONT = "'Cascadia Mono', Consolas, 'Courier New', monospace";
const UNIX_FONT = "Menlo, Monaco, 'SF Mono', 'Courier New', monospace";
const XTERM_FIXED = { convertEol: true, cursorBlink: true, scrollback: 50000 };

const radioRow = {
  type: "radio",
  color: "primary",
  class: "q-gutter-md",
  inline: true,
  dense: true,
} as const;
const reconnectButton = {
  label: "Reconnect",
  icon: "refresh",
  color: "white",
  outline: true,
  noCaps: true,
};

const onWindows = computed(() => props.agentPlatform === "windows");
const onFreebsd = computed(() => props.agentPlatform === "freebsd");

// shell is the radio choice, path the custom shell that last started and
// pending the one being tried; fallback is the built-in shell a cancel
// returns to
const pick = reactive({
  shell: "",
  fallback: "",
  path: null as string | null,
  pending: null as string | null,
  bad: false,
});
const asUser = ref(false);
const askPath = ref(false);
const pathInput = ref("");
const screen = ref<HTMLElement | null>(null);

const session = useTerminalSession({
  agentId: () => props.agent_id,
  runAsUser: () => (onWindows.value ? asUser.value : false),
  started() {
    if (!pick.pending) return;
    pick.path = pick.pending;
    pick.shell = "custom";
    askPath.value = false;
    pick.pending = null;
    pick.bad = false;
  },
  refused(text, shell) {
    notifyError(text);
    if (!BUILT_IN.has(shell)) {
      pick.bad = true;
      askPath.value = true;
    }
    pick.pending = null;
  },
  noticed(text) {
    asUser.value = false;
    notifyWarning(text || "Run as user was not available..");
  },
  closed: () => emit("connect-failed"),
});
const { loading, issue } = session;

const customLabel = computed(() => {
  if (loading.value && pick.pending) return "Custom (Shell loading...)";
  if (pick.bad) return "Custom (Shell path doesn't exist)";
  return pick.path ? `Custom (${pick.path})` : "Custom Shell";
});

const shells = computed(() => {
  let builtIn = OTHER_SHELLS;
  if (onWindows.value) builtIn = WINDOWS_SHELLS;
  else if (onFreebsd.value) builtIn = FREEBSD_SHELLS;
  return [
    ...builtIn.map(([label, value]) => ({ label, value })),
    { label: customLabel.value, value: "custom" },
  ];
});

const theme = computed(() => {
  if (!onWindows.value) return unixTheme;
  if (pick.shell === "powershell") return powershellTheme;
  const pwsh7 =
    pick.shell === "custom" && !!pick.path && PWSH7_PATH.test(pick.path);
  return pwsh7 ? pwsh7Theme : cmdTheme;
});
const backdrop = computed(() => ({ background: theme.value.background }));

const barActions = [
  {
    label: "Edit path",
    icon: "edit",
    color: "primary",
    tip: "Set the path of the custom shell to start",
    run: editCustomPath,
  },
  {
    label: "Copy output",
    icon: "content_copy",
    tip: "Copy the whole terminal output to the clipboard",
    run: copyOutput,
  },
];

const activeShell = () => (pick.shell === "custom" ? pick.path! : pick.shell);

function pickShell(choice: string) {
  pick.shell = choice;
  if (!session.mounted()) return;
  if (choice !== "custom") {
    pick.fallback = choice;
    session.restart(choice);
  } else if (pick.path && !pick.bad) {
    session.restart(pick.path);
  } else {
    askPath.value = true;
    pathInput.value = "";
  }
}

function restartCurrent() {
  if (session.mounted()) session.restart(activeShell());
}

function editCustomPath() {
  askPath.value = true;
  pathInput.value = pick.path || "";
}

function startCustom() {
  if (!pathInput.value || !session.mounted()) return;
  pick.bad = false;
  pick.pending = pathInput.value;
  session.restart(pathInput.value);
}

function cancelCustom() {
  askPath.value = false;
  pick.shell = pick.fallback;
  session.restart(pick.fallback);
}

function reconnect() {
  if (!session.mounted()) return;
  const shell =
    pick.shell !== "custom" ? pick.shell : pick.path || pick.pending || "";
  if (shell) session.restart(shell);
}

async function copyOutput() {
  try {
    await copyToClipboard(session.text());
    notifySuccess("Terminal output copied to clipboard.");
  } catch {
    notifyError("Failed to copy terminal output.");
  }
}

// a custom default that resolved to a built-in shell means its path is
// missing on the agent
function applyDefaults(d: TerminalDefaults) {
  const shell = d.effective_default_shell;
  if (d.resolved_default_shell === "custom" && !BUILT_IN.has(shell)) {
    // FreeBSD base has no bash
    const base = onWindows.value ? "cmd" : onFreebsd.value ? "sh" : "bash";
    Object.assign(pick, { shell: "custom", fallback: base, path: shell });
    pick.bad = false;
    return;
  }
  Object.assign(pick, { shell, fallback: shell, path: null });
  pick.bad = d.resolved_default_shell === "custom";
}

function xtermOptions(): ITerminalOptions {
  const win = onWindows.value;
  return {
    ...XTERM_FIXED,
    theme: theme.value,
    fontFamily: win ? WINDOWS_FONT : UNIX_FONT,
    fontWeight: win ? 100 : 400,
    fontSize: 16,
  };
}

watch(theme, (next) => session.setTheme(next));
useResizeObserver(screen, session.refit);

onMounted(() => {
  session.mount(screen.value!, xtermOptions());
  if (props.terminalDefaults) applyDefaults(props.terminalDefaults);
  session.open(activeShell());
});
</script>

<style scoped>
.term {
  height: calc(100vh - 77px);
}
.term__bar {
  gap: 4px 20px;
  min-height: 44px;
  padding: 4px 12px;
  color: var(--rmm-text);
  background: var(--rmm-surface);
  border-bottom: 1px solid var(--rmm-border);
}
.term__group {
  gap: 8px;
}
.term__caption {
  color: var(--rmm-text-muted);
  font-size: var(--rmm-fs-xs);
  font-weight: 600;
}
.term__body {
  flex: 1 1 auto;
  min-height: 0;
  padding-block: 10px 4px;
  padding-inline: 6px;
}
.term__screen {
  flex: 1 1 auto;
}
.term__issue-icon {
  color: rgba(255, 255, 255, 0.7);
}
</style>
