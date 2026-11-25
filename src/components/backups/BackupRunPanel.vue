<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<script setup>
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useQuasar } from "quasar";
import { useStore } from "vuex";
import { endpoint } from "@/api/http";
import { serverErrors } from "@/components/vault/stepUp";
import { durationText, fmtBytes, NO_VALUE } from "@/utils/format";
import { notifyError, notifySuccess } from "@/utils/notify";
import {
  hookName,
  mergeLog,
  pollDecision,
  runActive,
  runProgress,
  runStatus,
  warningText,
} from "./backups";

const props = defineProps({
  agentId: { type: String, required: true },
  // a run object of the device answer
  run: { type: Object, required: true },
  canManage: Boolean,
});
const emit = defineEmits(["ended"]);
const $q = useQuasar();
const store = useStore();
const formatDate = computed(() => store.getters.formatDate);
const api = endpoint("/imaging");
const STEPS = {
  snapshot: "Snapshot",
  scan: "Scan",
  transfer: "Transfer",
  verify: "Verify",
  cleanup: "Cleanup",
};
const PAUSES = { network: "network lost", battery: "on battery" };

const detail = ref(props.run);
const log = ref({ lines: [], next: 0 });
const error = ref("");
const cancelling = ref(false);
let timer = null,
  current = props.run.id,
  inFlight = false,
  queued = false;

const counters = computed(() => detail.value.counters ?? {});
const progress = computed(() => runProgress(counters.value));
const permille = (v) => (v ? `${(v / 10).toFixed(1)} %` : NO_VALUE);

// one request at a time; a cancel, a new run or a timer during a request
// polls again right after it
async function poll() {
  clearTimeout(timer);
  if (inFlight) return void (queued = true);
  inFlight = true;
  const id = current;
  const from = log.value.next;
  const was = runActive(detail.value);
  let decision = "stop";
  try {
    const reply = await api.get(`/agents/${props.agentId}/runs/${id}/`, {
      params: { log_from: from },
      silent: true,
    });
    if (id === current) {
      detail.value = reply;
      log.value = mergeLog(log.value, reply, from);
      error.value = "";
      decision = pollDecision(was, reply);
    }
  } catch (e) {
    if (id === current) {
      error.value = serverErrors(e).message;
      decision = pollDecision(was, null, e?.response?.status ?? -1);
    }
  }
  inFlight = false;
  if (current === null) return;
  if (decision === "ended") emit("ended", detail.value);
  if (queued) {
    queued = false;
    poll();
  } else if (decision === "again") timer = setTimeout(poll, 3000);
}

watch(
  () => props.run.id,
  (id) => {
    current = id;
    detail.value = props.run;
    log.value = { lines: [], next: 0 };
    poll();
  },
  { immediate: true },
);
onBeforeUnmount(() => {
  current = null;
  clearTimeout(timer);
});

async function cancel() {
  cancelling.value = true;
  try {
    detail.value = {
      ...detail.value,
      ...(await api.post(
        `/agents/${props.agentId}/runs/${detail.value.id}/cancel/`,
        {},
        { silent: true },
      )),
    };
    notifySuccess("Cancel requested");
    // an offline device's run ends in this call, the poll would not say so
    if (!runActive(detail.value)) emit("ended", detail.value);
    poll();
  } catch (e) {
    notifyError(serverErrors(e).message);
  } finally {
    cancelling.value = false;
  }
}
function confirmCancel() {
  $q.dialog({
    title: "Cancel backup run?",
    message:
      "The run stops. Data already received from a device that is offline is discarded.",
    ok: { label: "Cancel run", color: "negative" },
    cancel: { label: "Keep running", flat: true },
  }).onOk(cancel);
}
</script>

<template>
  <section class="backup-run q-mt-md" :aria-labelledby="`run-${detail.id}`">
    <div class="row items-center q-gutter-sm">
      <h4 :id="`run-${detail.id}`" class="rmm-label q-my-none">
        Backup run {{ formatDate(detail.created_at) }}
      </h4>
      <span class="rmm-pill" :class="runStatus(detail.status).cls">{{
        runStatus(detail.status).label
      }}</span>
      <span v-if="detail.step" class="rmm-muted"
        >Step {{ STEPS[detail.step] ?? detail.step }}</span
      >
      <span v-if="detail.status === 'paused'" class="rmm-muted"
        >Paused, {{ PAUSES[detail.pause_reason] ?? detail.pause_reason }}</span
      >
      <q-space />
      <q-btn
        v-if="canManage && runActive(detail)"
        flat
        dense
        no-caps
        color="negative"
        label="Cancel run"
        :loading="cancelling"
        :disable="detail.cancel_requested"
        @click="confirmCancel"
      />
    </div>
    <p v-if="detail.cancel_requested && runActive(detail)" role="status">
      Cancel requested; the agent stops at its next report.
    </p>
    <p v-if="detail.reason" class="q-my-xs">{{ detail.reason }}</p>
    <p v-if="detail.cancelled_by" class="rmm-muted q-my-xs">
      Cancelled by {{ detail.cancelled_by }}.
    </p>
    <p v-if="error" class="text-negative" role="alert">{{ error }}</p>
    <q-linear-progress
      v-if="runActive(detail) && progress !== null"
      :value="progress"
      size="8px"
      class="q-my-xs"
      :aria-label="`${Math.round(progress * 100)} percent read`"
    />
    <div class="backup-run__counters">
      <span
        >Read {{ fmtBytes(counters.bytes_read) }}
        <template v-if="counters.expected_bytes"
          >of {{ fmtBytes(counters.expected_bytes) }}</template
        ></span
      >
      <span>Sent {{ fmtBytes(counters.bytes_sent) }}</span>
      <span
        >Rate
        {{ counters.rate ? `${fmtBytes(counters.rate)}/s` : NO_VALUE }}</span
      >
      <span>Remaining {{ durationText(counters.eta) }}</span>
      <span
        >Blocks {{ counters.blocks_new ?? 0 }} new of
        {{ counters.blocks_read ?? 0 }}</span
      >
      <span>Deduplicated {{ permille(counters.dedup_permille) }}</span>
      <span
        >Compression saved {{ permille(counters.compression_permille) }}</span
      >
    </div>
    <ul v-if="detail.warnings?.length" class="q-my-xs" aria-label="Warnings">
      <li v-for="(w, index) in detail.warnings" :key="index">
        <q-icon name="warning_amber" color="warning" aria-hidden="true" />
        <span class="sr-only">Warning:</span> {{ warningText(w) }}
      </li>
    </ul>
    <p v-if="detail.output_hidden && detail.hooks?.length" class="rmm-muted">
      Hook output hidden: your role cannot run scripts on this device.
    </p>
    <q-list
      v-if="detail.hooks?.length"
      dense
      separator
      bordered
      class="q-my-xs"
      aria-label="Hook results"
    >
      <q-expansion-item
        v-for="(h, index) in detail.hooks"
        :key="index"
        dense
        :label="`${h.phase} · ${hookName(h)} · ${h.status}`"
        :caption="`exit ${h.exit_code ?? NO_VALUE} · ${((h.duration_ms ?? 0) / 1000).toFixed(1)} s · ${h.sha256?.slice(0, 12) ?? ''}`"
      >
        <pre
          v-if="h.stdout"
          class="backup-run__log"
          aria-label="Hook output"
          tabindex="0"
          >{{ h.stdout }}</pre
        >
        <pre
          v-if="h.stderr"
          class="backup-run__log"
          aria-label="Hook error output"
          tabindex="0"
          >{{ h.stderr }}</pre
        >
      </q-expansion-item>
    </q-list>
    <pre
      v-if="log.lines.length"
      class="backup-run__log"
      aria-label="Run log"
      tabindex="0"
      >{{ log.lines.join("\n") }}</pre
    >
  </section>
</template>

<style scoped>
.backup-run__counters {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 16px;
  font-size: var(--rmm-fs-xs);
}

.backup-run__log {
  max-height: 240px;
  margin: 4px 0;
  padding: 8px;
  overflow: auto;
  font-size: var(--rmm-fs-xs);
  white-space: pre-wrap;
  background: var(--rmm-bg);
  border: 1px solid var(--rmm-border);
  border-radius: 6px;
}
</style>
