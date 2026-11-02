<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-card flat class="rmm-card">
    <div class="rmm-card__header">
      <div class="rmm-card__title">Progress</div>
      <q-space />
      <span class="text-caption rmm-muted">{{ stepCounter }}</span>
    </div>
    <div class="rmm-card__body">
      <!-- screen readers hear each phase change once; the visual stepper stays silent -->
      <p class="sr-only" aria-live="polite" role="status">
        {{ announcement }}
      </p>

      <q-stepper
        :model-value="active"
        class="up-stepper"
        vertical
        flat
        color="primary"
        done-color="positive"
        error-color="negative"
        :animated="!reducedMotion"
      >
        <q-step
          v-for="(s, i) in steps"
          :key="s.phase"
          :name="s.phase"
          :title="s.title"
          :caption="caption(s.phase)"
          :prefix="i + 1"
          :done="isDone(s.phase)"
          :error="isError(s.phase)"
          :icon="s.icon"
          done-icon="check"
          error-icon="error"
        >
          <template v-if="s.phase === 'download'">
            <q-linear-progress
              rounded
              size="10px"
              color="primary"
              :value="(percent ?? 0) / 100"
              :indeterminate="percent === null && !idle"
              :animation-speed="reducedMotion ? 0 : 600"
              aria-label="Release download progress"
            />
            <div class="row q-gutter-x-md q-mt-xs text-caption rmm-muted">
              <span v-if="percent !== null">{{ Math.round(percent) }}%</span>
              <span
                >{{ mb(progress?.bytes) }} / {{ mb(progress?.total) }} MB</span
              >
              <span v-if="progress?.rate_bps"
                >{{ mbps(progress.rate_bps) }} MB/s</span
              >
              <span v-if="progress?.source">from {{ progress.source }}</span>
            </div>
          </template>
          <div
            v-else-if="s.phase === 'restart' && waiting !== null"
            class="up-wait"
          >
            <q-spinner size="18px" color="primary" />
            <span>Waiting for the server to come back ({{ waiting }} s)</span>
          </div>
          <div v-else class="text-caption">{{ progress?.message || "" }}</div>
        </q-step>
        <q-step
          v-if="phase === 'rollback'"
          name="rollback"
          title="Rollback"
          :caption="progress?.message || 'Restoring the previous version'"
          icon="undo"
          error
          error-icon="error"
        />
      </q-stepper>

      <q-expansion-item
        dense
        switch-toggle-side
        label="Log"
        header-class="up-log-header"
        :default-opened="false"
      >
        <pre ref="logEl" class="up-log" aria-label="Update log">{{ log }}</pre>
      </q-expansion-item>
    </div>
  </q-card>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import type { UpdatePhase, UpdateProgress } from "@/api/server";

const props = defineProps<{
  phase: UpdatePhase | null;
  // last real step reached; failed/rollback/done have none of their own
  lastStep: UpdatePhase | null;
  progress: UpdateProgress | null;
  // seconds spent in the reconnect poller, null when not reconnecting
  waiting: number | null;
  // a run without phases (legacy git mode) shows only the log
  active: boolean;
  log: string;
}>();

const steps: { phase: UpdatePhase; title: string; icon: string }[] = [
  { phase: "preflight", title: "Pre-flight", icon: "fact_check" },
  { phase: "download", title: "Download", icon: "download" },
  { phase: "verify", title: "Verify (Ed25519 + SHA-256)", icon: "verified" },
  { phase: "backup", title: "Backup", icon: "backup" },
  { phase: "apply", title: "Apply", icon: "system_update_alt" },
  { phase: "migrate", title: "Migration", icon: "storage" },
  { phase: "restart", title: "Restart", icon: "restart_alt" },
  { phase: "health", title: "Health", icon: "monitor_heart" },
];
const order = steps.map((s) => s.phase);

const reducedMotion =
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

const logEl = ref<HTMLElement | null>(null);

const idle = computed(() => props.phase === null);
const finished = computed(() => props.phase === "done");
const failed = computed(
  () => props.phase === "failed" || props.phase === "rollback",
);
const activeIdx = computed(() => {
  const p = props.lastStep ?? props.phase;
  const i = p ? order.indexOf(p) : -1;
  return finished.value ? order.length - 1 : i;
});
const active = computed(() =>
  props.phase === "rollback" ? "rollback" : (order[activeIdx.value] ?? ""),
);
const stepCounter = computed(() => {
  if (idle.value) return props.active ? "Running" : "Not running";
  if (finished.value) return "Finished";
  if (props.phase === "rollback") return "Rolling back";
  return `Step ${Math.max(activeIdx.value, 0) + 1} of ${order.length}`;
});
const percent = computed(() => {
  const p = props.progress;
  if (p?.percent != null) return Math.min(100, Math.max(0, p.percent));
  if (p?.total && p.bytes != null) return (100 * p.bytes) / p.total;
  return props.lastStep && order.indexOf(props.lastStep) > 1 ? 100 : null;
});

function isDone(phase: UpdatePhase) {
  const i = order.indexOf(phase);
  if (finished.value) return true;
  if (props.phase === "rollback") return false;
  return i < activeIdx.value;
}
function isError(phase: UpdatePhase) {
  return failed.value && props.phase !== "rollback" && phase === active.value;
}
function caption(phase: UpdatePhase) {
  if (phase !== active.value) return undefined;
  if (props.phase === "failed") return "Stopped with an error";
  return props.progress?.message || undefined;
}

const mb = (n?: number) => ((n || 0) / 1048576).toFixed(1);
const mbps = (bps: number) => (bps / 1048576).toFixed(2);

const announcement = computed(() => {
  if (idle.value) return props.active ? "Update running." : "";
  if (finished.value) return "Update finished.";
  if (props.phase === "failed") return `Update failed at ${stepCounter.value}.`;
  if (props.phase === "rollback") return "Update failed, rolling back.";
  const s = steps[activeIdx.value];
  return s ? `${stepCounter.value}: ${s.title}` : "";
});

watch(
  () => props.log,
  async () => {
    await nextTick();
    if (logEl.value) logEl.value.scrollTop = logEl.value.scrollHeight;
  },
);
</script>

<style scoped>
.up-stepper {
  background: transparent;
}
.up-stepper :deep(.q-stepper__tab) {
  padding: 8px 12px;
}
.up-stepper :deep(.q-stepper__step-inner) {
  padding: 0 12px 12px 48px;
}
.up-wait {
  display: flex;
  align-items: center;
  gap: 8px;
}
.up-log {
  max-height: 320px;
  overflow: auto;
  margin: 0;
  padding: 8px;
  font-family: var(--rmm-mono);
  font-size: 12px;
  white-space: pre-wrap;
  word-break: break-word;
  background: var(--rmm-surface-2);
  border-radius: var(--rmm-radius-sm);
}
@media (prefers-reduced-motion: reduce) {
  .up-stepper :deep(*) {
    transition: none !important;
  }
}
</style>
