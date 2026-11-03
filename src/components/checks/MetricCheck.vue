<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-dialog
    ref="dialogRef"
    @hide="onDialogHide"
    aria-labelledby="metric-check-title"
  >
    <CheckCard
      title-id="metric-check-title"
      :title="
        check ? 'Edit metric threshold check' : 'Add metric threshold check'
      "
      subtitle="The server averages the last samples of a metric from the agent's reports and fails the check past a threshold"
      :loading="loading"
      @save="save"
    >
      <SchemaForm
        :model-value="formModel"
        :fields="fields"
        compact
        @update:model-value="setForm"
      />
      <CheckSchedule
        :state="state"
        :fail-options="failOptions"
        interval-hint="0 = on every report from the agent, about every 5 minutes; any other value is the least time between two evaluations"
        :interval-rules="[(val) => val >= 0 || 'Minimum is 0']"
      />
    </CheckCard>
  </q-dialog>
</template>

<script setup>
import { computed, onMounted, ref } from "vue";
import { fetchMetricSeries, METRICS, METRIC_LABEL_NAMES } from "@/api/metrics";
import { SILENT_REQUEST_CONFIG } from "@/constants/constants";
import { useCheckDialog } from "./useCheckDialog";
import CheckCard from "./CheckCard.vue";
import CheckSchedule from "./CheckSchedule.vue";
import SchemaForm from "../ui/SchemaForm.vue";

const props = defineProps({
  check: Object,
  parent: Object, // {agent: agent.agent_id} or {policy: policy.id}
});
defineEmits(["ok", "hide"]);

const { dialogRef, onDialogHide, state, loading, save, failOptions } =
  useCheckDialog(props, {
    check_type: "metric",
    ...{ metric: "cpu.pct", metric_labels: {}, metric_op: "above" },
    ...{ metric_warning: 80, metric_error: 95, metric_samples: 1 },
    ...{ fails_b4_alert: 1, run_interval: 0 },
  });

// label inputs live in the flat form model as "label.<key>"
const LABEL = "label.";
const NUMBER_KEYS = ["metric_warning", "metric_error", "metric_samples"];

// agent_id string from the Checks tab, unset for policy checks
const agentId = computed(() => props.parent?.agent);
// name -> label key -> values seen in the newest sample
const catalog = ref({});

const meta = computed(() => METRICS[state.value.metric] || null);
const unit = computed(() => (meta.value?.unit ? ` (${meta.value.unit})` : ""));

const metricOptions = Object.entries(METRICS).map(([value, m]) => ({
  value,
  label: `${m.label}${m.unit ? ` (${m.unit})` : ""}`,
}));

const formModel = computed(() => {
  const model = { ...state.value };
  for (const [k, v] of Object.entries(state.value.metric_labels || {}))
    model[LABEL + k] = v;
  return model;
});

function toNumber(v) {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function defaultLabels(metric) {
  const out = {};
  for (const key of METRICS[metric]?.labels || []) {
    out[key] = agentId.value ? catalog.value[metric]?.[key]?.[0] || "*" : "*";
  }
  return out;
}

function setForm(model) {
  const next = {};
  const labels = {};
  for (const [k, v] of Object.entries(model)) {
    if (k.startsWith(LABEL)) labels[k.slice(LABEL.length)] = v;
    else next[k] = v;
  }
  for (const k of NUMBER_KEYS) next[k] = toNumber(next[k]);
  const keys = METRICS[next.metric]?.labels || [];
  next.metric_labels =
    next.metric !== state.value.metric
      ? defaultLabels(next.metric)
      : Object.fromEntries(keys.map((k) => [k, labels[k] ?? ""]));
  state.value = next;
}

const required = (val) => (val !== "" && val != null) || "Required";

function thresholdsSet() {
  const { metric_warning: w, metric_error: e } = state.value;
  return w !== null || e !== null || "Set a warning or error threshold";
}

function thresholdsOrdered() {
  const { metric_warning: w, metric_error: e, metric_op: op } = state.value;
  if (w === null || e === null) return true;
  if (op === "below")
    return w > e || "Below: the warning threshold must be more than the error";
  return w < e || "Above: the warning threshold must be less than the error";
}

const thresholdRules = [thresholdsSet, thresholdsOrdered];

const labelFields = computed(() =>
  (meta.value?.labels || []).map((key) => {
    const values = catalog.value[state.value.metric]?.[key] || [];
    const base = {
      key: LABEL + key,
      label: METRIC_LABEL_NAMES[key] || key,
      rules: [
        required,
        (val) => String(val).length <= 64 || "At most 64 characters",
      ],
    };
    if (agentId.value && values.length)
      return {
        ...base,
        type: "select",
        options: ["*", ...values],
        hint: "* matches every value; the worst one counts",
        props: { "options-dense": true },
      };
    return {
      ...base,
      hint: "The exact value, or * for every value; the worst one counts",
      props: { maxlength: 64 },
    };
  }),
);

const fields = computed(() => [
  {
    key: "metric",
    type: "select",
    label: "Metric",
    options: metricOptions,
    rules: [required],
    props: { "options-dense": true },
  },
  ...labelFields.value,
  {
    key: "metric_op",
    type: "options",
    options: [
      { value: "above", label: "Fail above the thresholds" },
      { value: "below", label: "Fail below the thresholds" },
    ],
    props: { inline: true, dense: true, class: "q-mt-sm" },
  },
  ...["warning", "error"].map((level) => ({
    key: `metric_${level}`,
    type: "number",
    label: `${level === "warning" ? "Warning" : "Error"} threshold${unit.value}`,
    hint: `Fails as ${level === "warning" ? "a warning" : "an error"} past this average; leave empty to skip`,
    rules: thresholdRules,
    props: { step: "any", "reactive-rules": true },
  })),
  {
    key: "metric_samples",
    type: "number",
    label: "Samples to average",
    hint: "1 to 60; the agent reports about every 5 minutes",
    rules: [
      (val) =>
        (Number.isInteger(Number(val)) && val >= 1 && val <= 60) ||
        "A whole number from 1 to 60",
    ],
    props: { min: 1, max: 60 },
  },
]);

onMounted(async () => {
  if (!agentId.value) return;
  try {
    const { series } = await fetchMetricSeries(
      agentId.value,
      {},
      SILENT_REQUEST_CONFIG,
    );
    const out = {};
    for (const s of Array.isArray(series) ? series : []) {
      if (!Object.hasOwn(METRICS, s?.name)) continue;
      for (const [k, v] of Object.entries(s.labels || {})) {
        if (!METRICS[s.name].labels.includes(k)) continue;
        const byKey = (out[s.name] ??= {});
        (byKey[k] ??= new Set()).add(v);
      }
    }
    catalog.value = Object.fromEntries(
      Object.entries(out).map(([name, byKey]) => [
        name,
        Object.fromEntries(
          Object.entries(byKey).map(([k, set]) => [k, [...set].sort()]),
        ),
      ]),
    );
  } catch {
    // no samples yet: labels are typed in
  }
});
</script>
