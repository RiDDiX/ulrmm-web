<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-card flat class="rmm-card perf-card">
    <div class="rmm-card__header metric-history__header">
      <div class="rmm-card__title">Metrics</div>
      <HelpTip
        text="Any metric the agent reports, averaged per point with the peak in the tooltip. Lines show the thresholds of matching metric checks"
      />
      <q-space />
      <RmmSelect
        v-if="options.length"
        v-model="selected"
        :options="options"
        map-options
        filterable
        label="Metric"
        :display-value="selectedText"
        :title="selectedText"
        class="metric-history__picker"
        popup-content-class="metric-history__menu"
      />
    </div>
    <EmptyState
      v-if="!loading && !catalog.length"
      icon="show_chart"
      title="No metrics yet"
      text="Interfaces, mounts, sensors and containers are recorded from the agent's reports, about every 5 minutes. Older agents report none until they are updated."
    />
    <EmptyState
      v-else-if="!loading && !chartData.length"
      icon="show_chart"
      title="No samples in this range"
      text="Pick a longer range, or wait for the next report."
    />
    <VueApexCharts
      v-else-if="chartData.length"
      type="line"
      height="260"
      :options="chartOptions"
      :series="chartSeries"
    />
    <div v-else class="metric-history__placeholder" />
    <q-inner-loading :showing="loading" color="primary" />
  </q-card>
</template>

<script setup>
import { computed, onMounted, ref, watch } from "vue";
import { colors } from "quasar";
import VueApexCharts from "vue3-apexcharts";
import {
  fetchAgentMetricChecks,
  fetchMetricSeries,
  METRICS,
} from "@/api/metrics";
import { SILENT_REQUEST_CONFIG } from "@/constants/constants";
import { fmtNum, isNum } from "@/composables/agentState";
import { fmtBytes } from "@/utils/format";
import { escapeHtml } from "@/utils/patchStatus";
import EmptyState from "@/components/ui/EmptyState.vue";
import HelpTip from "@/components/ui/HelpTip.vue";
import RmmSelect from "@/components/ui/RmmSelect.vue";

// range, baseOptions and palette come from the Performance tab; refreshKey
// changes on every reload there, a new range included
const props = defineProps({
  agentId: { type: String, required: true },
  range: { type: String, required: true },
  baseOptions: { type: Object, required: true },
  palette: { type: Array, required: true },
  refreshKey: { type: Number, default: 0 },
});

const ORDER = Object.keys(METRICS);

const catalog = ref([]);
const checks = ref([]);
const selected = ref(null);
const data = ref(null);
const loading = ref(false);
let generation = 0;

const labelText = (labels) =>
  Object.entries(labels || {})
    .map(([k, v]) => `${k}: ${v}`)
    .join(", ");

const withUnit = (m) => `${m.label}${m.unit ? ` (${m.unit})` : ""}`;

// unlabelled series first under one heading, then grouped by metric and
// sorted by labels
const options = computed(() => {
  const out = [];
  let group = null;
  const plain = (s) => (Object.keys(s.labels || {}).length ? 1 : 0);
  const rows = catalog.value
    .filter((s) => Object.hasOwn(METRICS, s.name))
    .sort(
      (a, b) =>
        plain(a) - plain(b) ||
        ORDER.indexOf(a.name) - ORDER.indexOf(b.name) ||
        a.key.localeCompare(b.key, undefined, { numeric: true }),
    );
  for (const s of rows) {
    const meta = METRICS[s.name];
    const heading = plain(s) ? withUnit(meta) : "Device";
    if (heading !== group) {
      group = heading;
      out.push({ category: heading });
    }
    out.push({
      value: s.key,
      label: labelText(s.labels) || withUnit(meta),
      cat: meta.label,
    });
  }
  return out;
});

const series = computed(
  () => catalog.value.find((s) => s.key === selected.value) || null,
);
const meta = computed(() => METRICS[series.value?.name] || null);
const selectedText = computed(() => {
  if (!meta.value) return "";
  const labels = labelText(series.value.labels);
  return labels ? `${withUnit(meta.value)} · ${labels}` : withUnit(meta.value);
});

function format(v) {
  if (!isNum(v)) return "—";
  const unit = meta.value?.unit || "";
  if (unit === "B/s") return `${fmtBytes(v)}/s`;
  if (unit === "B") return fmtBytes(v);
  if (unit === "%") return `${fmtNum(v)}%`;
  return `${fmtNum(v, 2)}${unit ? ` ${unit}` : ""}`;
}

// a check matches when every label is equal or *
const matchingChecks = computed(() => {
  const s = series.value;
  if (!s) return [];
  return checks.value.filter(
    (c) =>
      c.metric === s.name &&
      Object.entries(c.metric_labels || {}).every(
        ([k, v]) => v === "*" || s.labels?.[k] === v,
      ),
  );
});

const thresholds = computed(() =>
  matchingChecks.value.flatMap((c) =>
    [
      [c.metric_warning, "warning", "Warning threshold"],
      [c.metric_error, "negative", "Error threshold"],
    ].filter(([v]) => isNum(v)),
  ),
);

// same gap rule as the Performance charts
const chartData = computed(() => {
  const points = Array.isArray(data.value?.points) ? data.value.points : [];
  const step = (data.value?.step_seconds || 300) * 1000;
  const out = [];
  let prev = null;
  for (const p of points) {
    const x = Date.parse(p.ts);
    if (Number.isNaN(x)) continue;
    if (prev !== null && x - prev > step * 2.5)
      out.push({ x: prev + step, y: null, max: null });
    out.push({ x, y: isNum(p.avg) ? p.avg : null, max: p.max });
    prev = x;
  }
  return out;
});

const chartSeries = computed(() => [
  { name: escapeHtml(meta.value?.label || "Value"), data: chartData.value },
]);

function paletteColor(name) {
  try {
    return colors.getPaletteColor(name);
  } catch {
    return undefined;
  }
}

function statusToken(name) {
  const css = getComputedStyle(document.body)
    .getPropertyValue(`--rmm-status-${name}`)
    .trim();
  return css || paletteColor(name);
}

function thresholdLine([value, colorName, label]) {
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

const chartOptions = computed(() => {
  const base = props.baseOptions;
  const values = [
    ...chartData.value.flatMap((p) => [p.y, p.max]),
    ...thresholds.value.map(([v]) => v),
  ].filter(isNum);
  const pct = meta.value?.unit === "%";
  const lo = Math.min(0, ...values);
  const hi = Math.max(...values, 0);
  return {
    ...base,
    colors: [props.palette[0]],
    annotations: {
      position: "front",
      yaxis: thresholds.value.map(thresholdLine),
    },
    yaxis: {
      min: pct ? 0 : lo,
      max: pct ? Math.max(100, hi) : hi > 0 ? hi * 1.1 : 1,
      tickAmount: 4,
      forceNiceScale: !pct,
      labels: { formatter: format },
    },
    tooltip: {
      ...base.tooltip,
      y: {
        formatter: (v, ctx) => {
          if (!isNum(v)) return "—";
          const d =
            ctx?.w?.config?.series?.[ctx.seriesIndex]?.data?.[
              ctx.dataPointIndex
            ];
          return isNum(d?.max)
            ? `${format(v)} (peak ${format(d.max)})`
            : format(v);
        },
      },
    },
  };
});

async function loadCatalog() {
  const agent = props.agentId;
  const request = ++generation;
  loading.value = true;
  try {
    const [cat, metricChecks] = await Promise.all([
      fetchMetricSeries(agent, {}, SILENT_REQUEST_CONFIG).catch(() => null),
      fetchAgentMetricChecks(agent, SILENT_REQUEST_CONFIG).catch(() => []),
    ]);
    if (request !== generation) return;
    catalog.value = Array.isArray(cat?.series) ? cat.series : [];
    checks.value = metricChecks;
  } finally {
    if (request === generation) loading.value = false;
  }
  if (request !== generation) return;
  // a new pick loads through the watcher below
  if (!catalog.value.some((s) => s.key === selected.value)) {
    const first = options.value.find((o) => o.value);
    const next = first ? first.value : null;
    if (next !== selected.value) {
      selected.value = next;
      return;
    }
  }
  await loadPoints();
}

async function loadPoints() {
  const s = series.value;
  const request = ++generation;
  if (!s) {
    data.value = null;
    return;
  }
  loading.value = true;
  try {
    const result = await fetchMetricSeries(
      props.agentId,
      { name: s.name, labels: s.labels || {}, range: props.range },
      SILENT_REQUEST_CONFIG,
    );
    if (request === generation) data.value = result;
  } catch {
    if (request === generation) data.value = null;
  } finally {
    if (request === generation) loading.value = false;
  }
}

onMounted(loadCatalog);
watch(() => props.refreshKey, loadCatalog);
watch(selected, loadPoints);
</script>

<style scoped>
.perf-card {
  position: relative;
  height: 100%;
}

.perf-card :deep(.apexcharts-tooltip) {
  font-variant-numeric: tabular-nums;
}

.metric-history__header {
  flex-wrap: wrap;
}

.metric-history__picker {
  flex: 1 1 100%;
  min-width: 0;
}

@media (min-width: 600px) {
  .metric-history__picker {
    flex: 0 0 50%;
  }
}

/* one line, cut with an ellipsis; the title holds the full text */
.metric-history__picker :deep(.q-field__native) {
  flex-wrap: nowrap;
}

.metric-history__picker :deep(.q-field__native > span) {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.metric-history__placeholder {
  min-height: 260px;
}
</style>

<style>
/* unscoped: the menu is teleported to body. A class, not
   popup-content-style: the position engine resets the inline max-height
   on every pass and reads the stylesheet bound instead */
.q-menu.metric-history__menu {
  max-width: min(90vw, 640px);
  max-height: 60vh;
}

.metric-history__menu .q-item__label {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
</style>
