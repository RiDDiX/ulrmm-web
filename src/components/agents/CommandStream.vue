<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-card-section v-if="hasText" class="q-px-xs q-pb-md q-pt-xs">
    <ScriptOutputCopyClip label="Live Output" :data="outputText" />
    <q-separator class="q-my-sm" />
  </q-card-section>
  <div ref="streamContainer" class="command-stream">
    <div class="stream-status row items-center q-gutter-xs q-mb-xs">
      <span class="text-caption">{{ statusText }}</span>
      <span class="text-caption rmm-muted">{{ connectionText }}</span>
      <q-tooltip>
        Live output of the command; the stream ends when the command finishes or
        times out
      </q-tooltip>
    </div>
    <div class="terminal">
      <pre>{{ outputText }}</pre>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  watch,
  computed,
  nextTick,
  onMounted,
  onUnmounted,
  useTemplateRef,
} from "vue";
import { uid } from "quasar";
import ScriptOutputCopyClip from "../scripts/ScriptOutputCopyClip.vue";
import { useAgentCmdWSConnection } from "@/websocket/agent";

const props = withDefaults(
  defineProps<{
    agentId: string;
    cmd: string;
    shell: string;
    run_as_user: boolean;
    custom_shell?: string;
    timeout?: number;
  }>(),
  { timeout: 10 },
);
const emit = defineEmits(["updateOutput", "streamLoaded", "streamClosed"]);

// one id per run ties the socket messages to this component
const cmdId = uid();
const {
  status,
  output: outputText,
  received,
  done: finished,
  send,
  reset,
  close,
} = useAgentCmdWSConnection(props.agentId, cmdId);

const streamContainer = useTemplateRef<HTMLElement>("streamContainer");
const hasText = computed(() => /\S/.test(outputText.value));

const shellLabel = computed(() =>
  props.shell === "custom" && props.custom_shell
    ? props.custom_shell
    : props.shell,
);

const statusText = computed(() => {
  if (!finished.value)
    return `Running ${shellLabel.value} command… (timeout ${props.timeout}s)`;
  const code = finished.value.exit_code;
  return typeof code === "number" ? `Finished, exit code ${code}` : "Finished";
});

const connectionText = computed(() =>
  status.value === "OPEN" ? "Connected" : "Disconnected",
);

let loadedReported = false;
let closedReported = false;
function reportClosed(completed: boolean) {
  if (closedReported) return;
  closedReported = true;
  emit("streamClosed", completed);
}

watch(
  received,
  async (count) => {
    if (!count) return;
    emit("updateOutput", outputText.value);
    if (!loadedReported) {
      loadedReported = true;
      emit("streamLoaded");
    }
    await nextTick();
    const box = streamContainer.value;
    if (box) box.scrollTop = box.scrollHeight;
  },
  { immediate: true, flush: "sync" },
);

watch(finished, (msg) => msg && reportClosed(true), { immediate: true });
watch(status, (now) => now === "CLOSED" && reportClosed(false), {
  immediate: true,
});

onMounted(() => {
  reset();
  const { cmd, shell, timeout, run_as_user, custom_shell } = props;
  send(
    JSON.stringify({
      cmd_id: cmdId,
      stream: true,
      cmd,
      shell,
      custom_shell,
      run_as_user,
      timeout,
    }),
  );
});

onUnmounted(close);
</script>

<style scoped>
.command-stream {
  overflow-y: auto;
  block-size: 30vh;
  padding-inline: 10px;
  border: 1px solid var(--rmm-border);
  border-radius: var(--rmm-radius-sm);
  background: var(--rmm-surface-2);
  color: var(--rmm-text);
  font-family: var(--rmm-mono);
}

.stream-status {
  position: sticky;
  top: 0;
  padding: 6px 0 4px;
  background: var(--rmm-surface-2);
  border-bottom: 1px solid var(--rmm-border);
  font-family: inherit;
}

.terminal {
  white-space: pre-wrap;
}

.terminal pre {
  margin: 8px 0 0;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
  font-family: inherit;
}
</style>
