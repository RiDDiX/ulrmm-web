<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <div class="perf-tab">
    <TabToolbar title="Performance">
      <q-btn-toggle
        :model-value="range"
        :options="rangeOptions"
        dense
        no-caps
        unelevated
        toggle-color="primary"
        class="perf-range"
        role="group"
        aria-label="Time range"
        @update:model-value="setRange"
      />
      <q-space />
      <q-btn
        dense
        flat
        round
        icon="refresh"
        aria-label="Refresh performance history"
        @click="load()"
      >
        <q-tooltip>Reload now; the charts also refresh every minute</q-tooltip>
      </q-btn>
    </TabToolbar>

    <div class="perf-tab__body q-pa-sm">
      <q-banner
        v-if="error && data"
        dense
        rounded
        class="rmm-banner-warning q-mb-sm"
      >
        <template #avatar>
          <q-icon name="warning_amber" color="warning" />
        </template>
        {{ errorMessage }} Showing the last loaded data.
        <template #action>
          <q-btn
            flat
            dense
            no-caps
            color="primary"
            label="Retry"
            @click="load()"
          />
        </template>
      </q-banner>

      <EmptyState
        v-if="error && !data && !loading"
        icon="error_outline"
        title="Unable to load performance history"
        :text="errorMessage"
      >
        <q-btn
          outline
          dense
          no-caps
          color="primary"
          label="Retry"
          @click="load()"
        />
      </EmptyState>

      <EmptyState
        v-else-if="data && !points.length"
        icon="show_chart"
        title="No samples yet"
        text="CPU, memory and disk use are sampled every 5 minutes while the agent is online. The charts fill in after the next sample."
      />

      <template v-else-if="data">
        <div class="perf-tab__summary rmm-num">
          <span>
            <strong>CPU</strong> avg {{ pct(summary.cpu_avg) }} · max
            {{ pct(summary.cpu_max) }}
          </span>
          <span>
            <strong>Memory</strong> avg {{ pct(summary.mem_avg) }}
            <template v-if="summary.mem_max != null">
              · max {{ pct(summary.mem_max) }}
            </template>
          </span>
          <span class="rmm-muted">
            {{ summary.samples ?? points.length }} samples in the
            {{ rangeMeta.noun
            }}{{ stepText ? `, one point per ${stepText}` : "" }}
          </span>
        </div>

        <div class="row q-col-gutter-sm">
          <div class="col-12 col-md-6">
            <q-card flat class="rmm-card perf-card">
              <div class="rmm-card__header">
                <div class="rmm-card__title">CPU</div>
                <HelpTip
                  text="Average CPU use per point, from the server's 5-minute samples"
                />
              </div>
              <VueApexCharts
                type="line"
                height="220"
                :options="cpuOptions"
                :series="cpuSeries"
              />
            </q-card>
          </div>
          <div class="col-12 col-md-6">
            <q-card flat class="rmm-card perf-card">
              <div class="rmm-card__header">
                <div class="rmm-card__title">Memory</div>
                <HelpTip
                  text="Memory in use per point; the tooltip shows used and total"
                />
              </div>
              <VueApexCharts
                type="line"
                height="220"
                :options="memOptions"
                :series="memSeries"
              />
            </q-card>
          </div>
          <div class="col-12">
            <q-card flat class="rmm-card perf-card">
              <div class="rmm-card__header">
                <div class="rmm-card__title">Disks</div>
                <HelpTip text="Used space per volume, one line each" />
              </div>
              <div v-if="!mounts.length" class="rmm-card__body rmm-muted">
                No disk usage in these samples
              </div>
              <template v-else>
                <ul class="perf-legend" aria-label="Disks, latest value">
                  <li v-for="(mount, index) in mounts" :key="mount">
                    <span
                      class="perf-legend__swatch"
                      :style="{ background: diskColors[index] }"
                      aria-hidden="true"
                    />
                    <span class="perf-legend__name rmm-mono">{{ mount }}</span>
                    <span class="rmm-num">{{ pct(latestDisk(mount)) }}</span>
                  </li>
                  <li v-if="hiddenMounts" class="rmm-muted">
                    {{ hiddenMounts }} more not shown
                  </li>
                </ul>
                <VueApexCharts
                  type="line"
                  height="240"
                  :options="diskOptions"
                  :series="diskSeries"
                />
              </template>
            </q-card>
          </div>
          <div class="col-12">
            <MetricHistory
              :agent-id="selectedAgent"
              :range="range"
              :base-options="baseOptions"
              :palette="diskColors"
              :refresh-key="windowEnd"
            />
          </div>
        </div>
      </template>

      <div v-else class="perf-tab__placeholder" />
      <q-inner-loading :showing="loading" color="primary" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useQuasar } from "quasar";
import { useStore } from "vuex";
import VueApexCharts from "vue3-apexcharts";
import { fetchAgentMetrics } from "@/api/metrics";
import { SILENT_REQUEST_CONFIG } from "@/constants/constants";
import { useDashboardStore } from "@/stores/dashboard";
import { escapeHtml } from "@/utils/patchStatus";
import TabToolbar from "@/components/agents/TabToolbar.vue";
import EmptyState from "@/components/ui/EmptyState.vue";
import HelpTip from "@/components/ui/HelpTip.vue";
import MetricHistory from "@/components/graphs/MetricHistory.vue";

interface Point {
  ts: string;
  cpu: number | null;
  mem_percent: number | null;
  mem_used: number | null;
  mem_total?: number | null;
  disks?: Record<string, number> | null;
}

interface Metrics {
  range: string;
  step_seconds: number;
  points: Point[];
  summary?: {
    cpu_avg?: number | null;
    cpu_max?: number | null;
    mem_avg?: number | null;
    mem_max?: number | null;
    samples?: number;
  };
}

const RANGES = [
  { value: "1h", label: "1h", noun: "last hour", ms: 3_600_000 },
  { value: "6h", label: "6h", noun: "last 6 hours", ms: 21_600_000 },
  { value: "24h", label: "24h", noun: "last 24 hours", ms: 86_400_000 },
  { value: "7d", label: "7d", noun: "last 7 days", ms: 604_800_000 },
  { value: "30d", label: "30d", noun: "last 30 days", ms: 2_592_000_000 },
];
const rangeOptions = RANGES.map(({ label, value }) => ({ label, value }));
const REFRESH_MS = 60_000;
const MAX_DISKS = 8;
// fixed order. First colour is the accent. Checked on the light and
// dark card for colour-blind contrast
const DISK_PALETTE = {
  light: [
    "#2563eb",
    "#eb6834",
    "#1baf7a",
    "#eda100",
    "#e87ba4",
    "#008300",
    "#4a3aa7",
    "#e34948",
  ],
  dark: [
    "#3b82f6",
    "#d95926",
    "#199e70",
    "#c98500",
    "#d55181",
    "#008300",
    "#9085e9",
    "#e66767",
  ],
};

const $q = useQuasar();
const store = useStore();
const dashboardStore = useDashboardStore();
const selectedAgent = computed(() => store.state.selectedRow);

const range = ref("24h");
const data = ref<Metrics | null>(null);
const loading = ref(false);
const error = ref<{ response?: { status?: number } } | null>(null);
const windowEnd = ref(Date.now());
let generation = 0;
let timer: number | undefined;
let mounted = false;

const rangeMeta = computed(
  () => RANGES.find((r) => r.value === range.value) || RANGES[2],
);
const points = computed(() => data.value?.points ?? []);
const summary = computed<NonNullable<Metrics["summary"]>>(
  () => data.value?.summary ?? {},
);
const status = computed(() => error.value?.response?.status);
const errorMessage = computed(() =>
  status.value === 403
    ? "Your role cannot view this device's performance history."
    : "Performance history could not be loaded.",
);
const stepText = computed(() => {
  const s = data.value?.step_seconds;
  if (!s) return "";
  if (s < 3600) return `${Math.round(s / 60)} min`;
  return `${Math.round((s / 3600) * 10) / 10} h`;
});

function pct(value?: number | null) {
  return typeof value === "number" && Number.isFinite(value)
    ? `${Math.round(value)}%`
    : "—";
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.round(value * 10) / 10
    : null;
}

// a gap longer than a few steps (agent offline) breaks the line,
// with no segment drawn across it
type ChartPoint = { x: number; y: number | null; [extra: string]: unknown };

function series(
  pick: (p: Point) => { y: number | null; [extra: string]: unknown },
) {
  const step = (data.value?.step_seconds || 300) * 1000;
  const out: ChartPoint[] = [];
  let prev: number | null = null;
  for (const p of points.value) {
    const x = Date.parse(p.ts);
    if (Number.isNaN(x)) continue;
    if (prev !== null && x - prev > step * 2.5) {
      out.push({ x: prev + step, y: null });
    }
    out.push({ ...pick(p), x });
    prev = x;
  }
  return out;
}

const cpuSeries = computed(() => [
  { name: "CPU", data: series((p) => ({ y: num(p.cpu) })) },
]);

const memSeries = computed(() => [
  {
    name: "Memory",
    data: series((p) => {
      const used = num(p.mem_used);
      const percent = num(p.mem_percent);
      const total =
        num(p.mem_total) ??
        (used !== null && percent ? (used * 100) / percent : null);
      return { y: percent, used, total };
    }),
  },
]);

// fullest volumes in the range, then by name, so a mount keeps its colour
const allMounts = computed(() => {
  const peak = new Map<string, number>();
  for (const p of points.value) {
    if (!p.disks || typeof p.disks !== "object") continue;
    for (const [mount, value] of Object.entries(p.disks)) {
      if (typeof value !== "number") continue;
      peak.set(mount, Math.max(peak.get(mount) ?? 0, value));
    }
  }
  return [...peak.entries()].sort((a, b) => b[1] - a[1]).map(([m]) => m);
});
const mounts = computed(() =>
  allMounts.value
    .slice(0, MAX_DISKS)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
);
const hiddenMounts = computed(() =>
  Math.max(0, allMounts.value.length - MAX_DISKS),
);

function diskValue(p: Point, mount: string) {
  return p.disks && Object.prototype.hasOwnProperty.call(p.disks, mount)
    ? num(p.disks[mount])
    : null;
}

function latestDisk(mount: string) {
  for (let i = points.value.length - 1; i >= 0; i--) {
    const v = diskValue(points.value[i], mount);
    if (v !== null) return v;
  }
  return null;
}

const diskSeries = computed(() =>
  mounts.value.map((mount) => ({
    // the chart writes series names into its tooltip as HTML
    name: escapeHtml(mount),
    data: series((p) => ({ y: diskValue(p, mount) })),
  })),
);

const dark = computed(() => $q.dark.isActive);
const diskColors = computed(() =>
  dark.value ? DISK_PALETTE.dark : DISK_PALETTE.light,
);

// SVG attributes can't read CSS variables; resolve the tokens per theme
function token(name: string, fallback: string) {
  const value = getComputedStyle(document.body).getPropertyValue(name).trim();
  return value || fallback;
}

function gb(mb: number | null) {
  return mb === null ? "?" : `${(mb / 1024).toFixed(1)} GB`;
}

type Ctx = {
  seriesIndex: number;
  dataPointIndex: number;
  w: { config: { series: { data: ChartPoint[] }[] } };
};

const baseOptions = computed(() => {
  const isDark = dark.value;
  const muted = token("--rmm-text-muted", isDark ? "#9ca3af" : "#475569");
  const border = token("--rmm-border", isDark ? "#1f2937" : "#e2e8f0");
  const long = rangeMeta.value.ms > 86_400_000;
  return {
    chart: {
      type: "line",
      background: "transparent",
      foreColor: muted,
      fontFamily: "inherit",
      toolbar: { show: false },
      zoom: { enabled: false },
      animations: { enabled: false },
    },
    theme: { mode: isDark ? "dark" : "light" },
    stroke: { width: 2, curve: "straight" },
    dataLabels: { enabled: false },
    markers: { size: 0, hover: { size: 4 } },
    legend: { show: false },
    // room for the last x label, which apexcharts centres on the edge
    grid: { borderColor: border, strokeDashArray: 3, padding: { right: 24 } },
    xaxis: {
      type: "datetime",
      min: windowEnd.value - rangeMeta.value.ms,
      max: windowEnd.value,
      labels: { datetimeUTC: false },
      axisBorder: { color: border },
      axisTicks: { color: border },
      tooltip: { enabled: false },
    },
    yaxis: {
      min: 0,
      max: 100,
      tickAmount: 4,
      labels: { formatter: (v: number) => `${Math.round(v)}%` },
    },
    tooltip: {
      theme: isDark ? "dark" : "light",
      x: { format: long ? "dd MMM HH:mm" : "HH:mm" },
      y: {
        formatter: (v: number | null) =>
          v === null || v === undefined ? "—" : `${v.toFixed(1)}%`,
      },
    },
    noData: { text: "" },
  };
});

const cpuOptions = computed(() => ({
  ...baseOptions.value,
  colors: [diskColors.value[0]],
}));

const memOptions = computed(() => ({
  ...baseOptions.value,
  colors: [diskColors.value[0]],
  tooltip: {
    ...baseOptions.value.tooltip,
    y: {
      formatter: (v: number | null, ctx: Ctx) => {
        if (v === null || v === undefined) return "—";
        const d =
          ctx?.w?.config?.series?.[ctx.seriesIndex]?.data?.[ctx.dataPointIndex];
        const used = num(d?.used);
        return used === null
          ? `${v.toFixed(1)}%`
          : `${v.toFixed(1)}% (${gb(used)} of ${gb(num(d?.total))})`;
      },
    },
  },
}));

const diskOptions = computed(() => ({
  ...baseOptions.value,
  colors: diskColors.value.slice(0, mounts.value.length),
}));

function clearTimer() {
  window.clearTimeout(timer);
  timer = undefined;
}

function schedule() {
  clearTimer();
  // polling will not fix a 403 or 404
  if (mounted && status.value !== 403 && status.value !== 404) {
    timer = window.setTimeout(tick, REFRESH_MS);
  }
}

function tick() {
  if (document.visibilityState === "visible" && !dashboardStore.isOffline) {
    void load(true);
  } else {
    schedule();
  }
}

async function load(silent = false) {
  const agentId = selectedAgent.value;
  if (!agentId) return;
  const request = ++generation;
  clearTimer();
  if (!silent) loading.value = true;
  try {
    const result = await fetchAgentMetrics(
      agentId,
      range.value,
      silent ? SILENT_REQUEST_CONFIG : {},
    );
    if (!mounted || request !== generation) return;
    windowEnd.value = Date.now();
    data.value = result;
    error.value = null;
  } catch (e) {
    if (!mounted || request !== generation) return;
    error.value = e as typeof error.value;
  } finally {
    if (mounted && request === generation) {
      loading.value = false;
      schedule();
    }
  }
}

function setRange(value: string) {
  if (value === range.value) return;
  range.value = value;
  void load();
}

watch(selectedAgent, () => {
  data.value = null;
  error.value = null;
  void load();
});

onMounted(() => {
  mounted = true;
  void load();
});

onBeforeUnmount(() => {
  mounted = false;
  generation += 1;
  clearTimer();
});
</script>

<style scoped>
.perf-range {
  border: 1px solid var(--rmm-border-strong);
  border-radius: var(--rmm-radius-sm);
}

.perf-range :deep(.q-btn) {
  min-width: 40px;
}

.perf-tab__body {
  position: relative;
  min-height: 240px;
}

.perf-tab__placeholder {
  min-height: 240px;
}

.perf-tab__summary {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 20px;
  margin-bottom: 8px;
  padding: 0 4px;
  color: var(--rmm-text);
  font-size: var(--rmm-fs-sm);
}

.perf-tab__summary strong {
  font-weight: 600;
}

.perf-card {
  height: 100%;
}

.perf-card :deep(.apexcharts-tooltip) {
  font-variant-numeric: tabular-nums;
}

.perf-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 16px;
  margin: 0;
  padding: 8px 12px 0;
  list-style: none;
  font-size: var(--rmm-fs-sm);
}

.perf-legend li {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  gap: 6px;
}

.perf-legend__swatch {
  width: 12px;
  height: 4px;
  flex: 0 0 auto;
  border-radius: 2px;
}

.perf-legend__name {
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
