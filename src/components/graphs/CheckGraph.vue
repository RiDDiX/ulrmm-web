<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-dialog ref="dialogRef" :aria-labelledby="titleId" @hide="emit('hide')">
    <q-card
      class="q-dialog-plugin"
      style="min-width: 80vw; min-height: 65vh; overflow-x: hidden"
    >
      <DialogHeader
        :title="title"
        :title-id="titleId"
        subtitle="Result of every run of this check in the chosen time range"
      >
        <template #actions>
          <q-btn
            icon="refresh"
            aria-label="Refresh chart data"
            flat
            dense
            @click="loadHistory"
          >
            <q-tooltip>Reload the run history</q-tooltip>
          </q-btn>
        </template>
      </DialogHeader>
      <div class="row items-center q-px-md q-pt-md">
        <q-space />
        <q-select
          v-model="timeFilter"
          label="Time range"
          style="width: 200px"
          outlined
          dense
          emit-value
          map-options
          :options="rangeOptions"
          @update:model-value="loadHistory"
        />
      </div>
      <apexchart
        v-if="showChart"
        class="q-pt-md"
        :options="chartOptions"
        :series="[{ data: history, name: seriesName }]"
        height="70%"
        type="line"
      />
      <EmptyState
        v-else-if="!$q.loading.isActive"
        icon="show_chart"
        title="No runs in this time range"
        text="Pick a longer time range, or wait for the check to run."
      />
    </q-card>
  </q-dialog>
</template>
<script setup>
import { computed, onMounted, ref } from "vue";
import axios from "axios";
import { colors, useQuasar } from "quasar";
import VueApexCharts from "vue3-apexcharts";
import DialogHeader from "@/components/ui/DialogHeader.vue";
import EmptyState from "@/components/ui/EmptyState.vue";
import { escapeHtml } from "@/utils/patchStatus";

const props = defineProps({ check: { type: Object } });
const emit = defineEmits(["hide", "ok", "cancel"]);

const apexchart = VueApexCharts;
const $q = useQuasar();

// SVG attributes can't see CSS variables. resolve theme colours once,
// when the dialog opens
function paletteColor(name) {
  try {
    return colors.getPaletteColor(name);
  } catch {
    return undefined;
  }
}

// status text tokens. they hold 4.5:1 in both themes
function statusToken(name) {
  const css = getComputedStyle(document.body)
    .getPropertyValue(`--rmm-status-${name}`)
    .trim();
  return css || paletteColor(name);
}

const rangeOptions = [
  { value: 1, label: "Last 24 hours" },
  { value: 7, label: "Last 7 days" },
  { value: 30, label: "Last 30 days" },
  { value: 0, label: "Everything" },
];

const seriesNames = {
  cpuload: "CPU Load",
  memory: "Memory Usage",
  diskspace: "Disk Space Remaining",
  script: "Script Results",
  eventlog: "Status",
  winsvc: "Status",
  ping: "Status",
  security: "Status",
  hwhealth: "Status",
  systemd: "Status",
  container: "Status",
  metric: "Status",
};

const percentChecks = ["cpuload", "memory", "diskspace"];

const dialogRef = ref(null);
const titleId = `check-graph-title-${props.check.id}`;
const history = ref([]);
const results = ref([]);
const timeFilter = ref(1);

const title = computed(() => `${props.check.readable_desc} run history`);
const showChart = computed(
  () => !$q.loading.isActive && history.value.length > 0,
);
const seriesName = computed(() => seriesNames[props.check.check_type] ?? "");

function thresholdLine(value, colorName, label) {
  return {
    y: value,
    strokeDashArray: 0,
    borderColor: paletteColor(colorName),
    label: {
      position: "left",
      offsetX: 100,
      borderColor: "transparent",
      style: { color: statusToken(colorName), background: "transparent" },
      text: label,
    },
  };
}

// chart renders this as HTML, and the values come from the agent
function describePoint(value, { dataPointIndex }) {
  const text = (v) => escapeHtml(String(v));
  const res = results.value[dataPointIndex].results;
  if (props.check.check_type !== "script") return text(res);
  return [
    ["Return code", res.retcode],
    ["Standard output", res.stdout],
    ["Error output", res.errout],
    ["Execution time", res.execution_time],
  ]
    .map(([label, v]) => `${label}: ${text(v)}<br/>`)
    .join("");
}

function makeChartOptions() {
  const opts = {
    chart: {
      id: "chart2",
      type: "line",
      toolbar: { show: true },
      animations: { enabled: false },
    },
    colors: [paletteColor("primary")],
    stroke: { width: 3 },
    dataLabels: { enabled: false },
    fill: { opacity: 1 },
    markers: { size: 1 },
    xaxis: { type: "datetime", labels: { datetimeUTC: false } },
    noData: { text: "No data" },
    theme: { mode: $q.dark.isActive ? "dark" : "light" },
    tooltip: { x: { format: "dd MMM h:mm:sst" } },
  };
  const {
    check_type: kind,
    error_threshold: err,
    warning_threshold: warn,
  } = props.check;

  if (percentChecks.includes(kind)) {
    const lines = [];
    if (err) lines.push(thresholdLine(err, "negative", "Error threshold"));
    if (warn) lines.push(thresholdLine(warn, "warning", "Warning threshold"));
    opts.annotations = { position: "front", yaxis: lines };
    opts.yaxis = {
      min: 0,
      max: 100,
      labels: { formatter: (val) => val + "%" },
    };
    if (kind === "diskspace") opts.yaxis.reversed = true;
    return opts;
  }

  const passFail = { 0: "Passing", 1: "Failing" };
  opts.yaxis = {
    min: -1,
    max: 2,
    tickAmount: 0,
    reversed: true,
    forceNiceScale: true,
    labels: { minWidth: 50, formatter: (val) => passFail[val] ?? "" },
  };
  opts.tooltip.y = {
    title: { formatter: () => "" },
    formatter: describePoint,
  };
  return opts;
}

const chartOptions = makeChartOptions();

function loadHistory() {
  $q.loading.show();
  axios
    .patch(`/checks/${props.check.check_result.id}/history/`, {
      timeFilter: timeFilter.value,
    })
    .then((r) => {
      history.value = Object.freeze(r.data);
      // keep a copy to look results up from the chart tooltip
      results.value = Object.freeze(r.data);
      $q.loading.hide();
    })
    .catch(() => $q.loading.hide());
}

onMounted(loadHistory);

defineExpose({
  show: () => dialogRef.value.show(),
  hide: () => dialogRef.value.hide(),
});
</script>
