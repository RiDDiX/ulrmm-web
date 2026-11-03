<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <div class="fleet-overview q-pa-md">
    <div class="row items-center q-col-gutter-sm q-mb-md">
      <div class="col">
        <div class="row items-center q-gutter-sm">
          <q-icon name="monitor_heart" class="rmm-muted" size="24px" />
          <div>
            <div
              id="fleet-overview-title"
              class="text-subtitle1 text-weight-medium"
            >
              Fleet overview
            </div>
            <div class="text-caption rmm-muted">
              Fleet-wide · {{ branding.productName }} operational health
            </div>
          </div>
        </div>
      </div>
      <div v-if="stats" class="col-auto">
        <q-chip
          dense
          icon="devices"
          class="overview-chip overview-chip--neutral"
        >
          {{ formatNumber(stats.agents.total) }} agents
        </q-chip>
        <q-chip dense icon="wifi" class="overview-chip overview-chip--positive">
          {{ formatNumber(stats.agents.online) }} online
        </q-chip>
      </div>
      <div class="text-caption rmm-muted">
        {{ updatedAt ? `Updated ${formatTime(updatedAt)}` : "" }}
      </div>
      <q-btn
        flat
        round
        dense
        icon="refresh"
        aria-label="Refresh overview"
        :loading="loading"
        @click="loadStats()"
      >
        <q-tooltip>Refresh overview</q-tooltip>
      </q-btn>
      <slot name="close" />
    </div>

    <q-banner
      v-if="error && stats"
      dense
      rounded
      class="overview-warning q-mb-md"
    >
      <template #avatar>
        <q-icon name="warning_amber" :color="dashWarningColor" />
      </template>
      The latest statistics could not be loaded. Showing the last successful
      result.
    </q-banner>

    <div v-if="loading && !stats" class="row q-col-gutter-sm">
      <div v-for="item in 8" :key="item" class="col-6 col-md-3">
        <q-card flat bordered class="overview-card rmm-card q-pa-md">
          <q-skeleton type="text" width="55%" />
          <q-skeleton type="text" width="35%" class="q-mt-sm" />
        </q-card>
      </div>
    </div>

    <q-card
      v-else-if="error && !stats"
      flat
      bordered
      class="overview-card rmm-card"
    >
      <q-card-section class="row items-center no-wrap q-gutter-md">
        <q-avatar
          :color="dashWarningColor"
          :text-color="contrastText(dashWarningColor)"
          icon="cloud_off"
        />
        <div class="col">
          <div class="text-subtitle2">Fleet statistics are unavailable</div>
          <div class="text-caption rmm-muted">
            The agent table and client tree are still available.
          </div>
        </div>
        <q-btn outline color="primary" label="Retry" @click="loadStats()" />
      </q-card-section>
    </q-card>

    <q-card
      v-else-if="stats && stats.agents.total === 0"
      flat
      bordered
      class="overview-card rmm-card"
    >
      <EmptyState
        icon="devices_other"
        title="No agents yet"
        text="Install the first agent to start monitoring your fleet."
      >
        <q-btn
          unelevated
          color="primary"
          icon="cloud_download"
          label="Install agent"
          @click="emit('install')"
        />
      </EmptyState>
    </q-card>

    <template v-else-if="stats">
      <div class="row q-col-gutter-sm q-mb-sm">
        <div
          v-for="metric in headlineMetrics"
          :key="metric.label"
          class="col-6 col-md-3"
        >
          <q-card
            flat
            bordered
            v-ripple
            role="button"
            tabindex="0"
            class="overview-card rmm-card metric-card full-height"
            :class="`metric-card--${metric.state}`"
            :aria-label="`${metric.label}: ${formatNumber(metric.value)}${metric.caption ? ` (${metric.caption})` : ''}. ${metric.tooltip}`"
            @click="onEntryClick(metric)"
            @keydown.enter="onEntryClick(metric)"
            @keydown.space.prevent="onEntryClick(metric)"
          >
            <q-card-section class="row items-start no-wrap q-pa-md">
              <q-icon :name="metric.icon" size="20px" class="metric-icon" />
              <div class="q-ml-sm metric-copy">
                <div class="text-h6 text-weight-medium metric-value">
                  {{ formatNumber(metric.value) }}
                </div>
                <div class="text-caption rmm-muted">
                  {{ metric.label }}
                </div>
                <div v-if="metric.caption" class="metric-caption rmm-muted">
                  {{ metric.caption }}
                </div>
              </div>
            </q-card-section>
            <q-tooltip>{{ metric.tooltip }}</q-tooltip>
          </q-card>
        </div>
      </div>

      <div class="row q-col-gutter-sm">
        <div class="col-12 col-md-6">
          <q-card flat bordered class="overview-card rmm-card full-height">
            <q-card-section class="section-heading">
              <q-icon name="priority_high" :color="dashNegativeColor" />
              <span>Attention required</span>
            </q-card-section>
            <q-separator />
            <q-list v-if="actionItems.length" separator>
              <q-item
                v-for="item in actionItems"
                :key="item.label"
                clickable
                v-ripple
                :aria-label="`${item.label}: ${formatNumber(item.value)} (${item.detail}). ${entryActionText(item)}`"
                @click="onEntryClick(item)"
              >
                <q-item-section avatar>
                  <q-icon :name="item.icon" size="20px" class="rmm-muted" />
                </q-item-section>
                <q-item-section>
                  <q-item-label>{{ item.label }}</q-item-label>
                  <q-item-label caption>{{ item.detail }}</q-item-label>
                </q-item-section>
                <q-item-section side>
                  <q-badge
                    :color="item.color"
                    :text-color="contrastText(item.color)"
                    :label="formatNumber(item.value)"
                  />
                </q-item-section>
                <q-tooltip>{{ entryActionText(item) }}</q-tooltip>
              </q-item>
            </q-list>
            <q-card-section
              v-else
              class="row items-center q-gutter-sm rmm-muted"
            >
              <q-icon name="check_circle" :color="dashPositiveColor" />
              <span>No current action items in fleet statistics.</span>
            </q-card-section>
            <q-separator v-if="sortedAlerts.length" />
            <q-card-section v-if="sortedAlerts.length" class="q-pa-sm">
              <div class="text-caption rmm-muted q-mb-xs">
                Alerts by severity
              </div>
              <div class="row q-gutter-xs">
                <q-chip
                  v-for="alert in sortedAlerts"
                  :key="alert.severity"
                  dense
                  square
                  clickable
                  :color="severityColor(alert.severity)"
                  :text-color="contrastText(severityColor(alert.severity))"
                  :aria-label="`View ${alert.severity || 'unknown'} alerts, ${formatNumber(alert.count)}`"
                  @click="onSeverityClick(alert.severity)"
                >
                  {{ alert.severity || "Unknown" }} ·
                  {{ formatNumber(alert.count) }}
                </q-chip>
              </div>
            </q-card-section>
          </q-card>
        </div>

        <div class="col-12 col-md-6">
          <q-card flat bordered class="overview-card rmm-card full-height">
            <q-card-section class="section-heading">
              <q-icon name="fact_check" class="rmm-muted" />
              <span>Check health</span>
              <q-space />
              <span class="text-caption rmm-muted">
                {{ formatNumber(stats.checks.passing + stats.checks.failing) }}
                total
              </span>
            </q-card-section>
            <q-separator />
            <q-card-section class="q-pa-sm">
              <template v-if="checkTotal">
                <div class="row justify-between text-caption q-mb-xs">
                  <span>{{ formatNumber(stats.checks.passing) }} passing</span>
                  <span>{{ formatNumber(stats.checks.failing) }} failing</span>
                </div>
                <q-linear-progress
                  rounded
                  size="8px"
                  :value="percent(stats.checks.passing, checkTotal)"
                  :color="dashPositiveColor"
                  :track-color="dashNegativeColor"
                  aria-label="Passing check ratio"
                />
              </template>
              <div v-else class="text-caption rmm-muted">
                No checks reported.
              </div>
              <div v-if="sortedFailingChecks.length" class="q-mt-md">
                <div
                  v-for="check in sortedFailingChecks"
                  :key="check.check_type"
                  class="bar-row"
                >
                  <div class="row justify-between no-wrap text-caption">
                    <span class="ellipsis">{{
                      checkTypeLabel(check.check_type)
                    }}</span>
                    <span class="q-ml-sm">{{ formatNumber(check.count) }}</span>
                  </div>
                  <q-linear-progress
                    rounded
                    size="5px"
                    :value="percent(check.count, stats.checks.failing)"
                    :color="dashNegativeColor"
                    class="overview-progress"
                  />
                </div>
              </div>
              <div v-else class="text-caption rmm-muted q-mt-md">
                No failing check types reported.
              </div>
            </q-card-section>
          </q-card>
        </div>

        <div class="col-12 col-md-6">
          <q-card flat bordered class="overview-card rmm-card full-height">
            <q-card-section class="section-heading">
              <q-icon name="schedule" class="rmm-muted" />
              <span>Last seen</span>
            </q-card-section>
            <q-separator />
            <q-list dense>
              <q-item v-for="bucket in lastSeenBuckets" :key="bucket.label">
                <q-item-section>
                  <div class="row justify-between text-caption q-mb-xs">
                    <span>{{ bucket.label }}</span>
                    <span>{{ formatNumber(bucket.value) }}</span>
                  </div>
                  <q-linear-progress
                    rounded
                    size="6px"
                    :value="percent(bucket.value, stats.agents.total)"
                    :color="bucket.color"
                    class="overview-progress"
                  />
                </q-item-section>
              </q-item>
            </q-list>
          </q-card>
        </div>

        <div class="col-12 col-md-6">
          <q-card flat bordered class="overview-card rmm-card full-height">
            <q-card-section class="section-heading">
              <q-icon name="difference" class="rmm-muted" />
              <span>Agent versions</span>
              <q-space />
              <q-badge
                outline
                color="primary"
                :label="`${sortedVersions.length} ${sortedVersions.length === 1 ? 'version' : 'versions'}`"
              />
            </q-card-section>
            <q-separator />
            <q-card-section v-if="sortedVersions.length" class="q-pa-sm">
              <div
                v-for="version in sortedVersions"
                :key="version.version"
                class="bar-row"
              >
                <div class="row justify-between no-wrap text-caption">
                  <span class="ellipsis">{{
                    version.version || "Unknown"
                  }}</span>
                  <span class="q-ml-sm">{{ formatNumber(version.count) }}</span>
                </div>
                <q-linear-progress
                  rounded
                  size="5px"
                  :value="percent(version.count, stats.agents.total)"
                  color="primary"
                  class="overview-progress"
                />
              </div>
            </q-card-section>
            <q-card-section v-else class="text-caption rmm-muted">
              No agent version data reported.
            </q-card-section>
          </q-card>
        </div>

        <div class="col-12">
          <q-card flat bordered class="overview-card rmm-card">
            <q-card-section class="section-heading">
              <q-icon name="dns" class="rmm-muted" />
              <span>Fleet makeup</span>
            </q-card-section>
            <q-separator />
            <q-card-section class="row q-col-gutter-md q-pa-sm">
              <div class="col-12 col-sm-7">
                <div v-if="sortedPlatforms.length">
                  <div
                    v-for="platform in sortedPlatforms"
                    :key="platform.plat"
                    class="bar-row"
                  >
                    <div class="row justify-between no-wrap text-caption">
                      <span class="ellipsis">{{
                        platformMeta(platform.plat).label || "Unknown"
                      }}</span>
                      <span class="q-ml-sm">{{
                        formatNumber(platform.count)
                      }}</span>
                    </div>
                    <q-linear-progress
                      rounded
                      size="5px"
                      :value="percent(platform.count, stats.agents.total)"
                      :color="dashInfoColor"
                      class="overview-progress"
                    />
                  </div>
                </div>
                <div v-else class="text-caption rmm-muted">
                  No platform data reported.
                </div>
              </div>
              <div class="col-12 col-sm-5 fleet-facts">
                <div>
                  <q-icon name="dns" /> Servers
                  <b>{{ formatNumber(stats.agents.servers) }}</b>
                </div>
                <div>
                  <q-icon name="computer" /> Workstations
                  <b>{{ formatNumber(stats.agents.workstations) }}</b>
                </div>
                <div>
                  <q-icon name="restart_alt" /> Needs reboot
                  <b>{{ formatNumber(stats.agents.needs_reboot) }}</b>
                </div>
                <div>
                  <q-icon name="construction" /> Maintenance mode
                  <b>{{ formatNumber(stats.agents.maintenance_mode) }}</b>
                </div>
              </div>
            </q-card-section>
          </q-card>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { colors, useQuasar } from "quasar";
import { useStore } from "vuex";

import { fetchFleetStats, type FleetStats } from "@/api/core";
import { useBrandingStore } from "@/stores/branding";
import { SILENT_REQUEST_CONFIG } from "@/constants/constants";
import AlertsOverview from "@/components/modals/alerts/AlertsOverview.vue";
import EmptyState from "@/components/ui/EmptyState.vue";
import { platformMeta } from "@/utils/format";

// a tile/row either filters the agent table to a search token it already
// understands, or opens the dialog that already covers that category
// elsewhere in the app
interface ActionItem {
  label: string;
  detail?: string;
  value: number;
  icon: string;
  color: string;
  filter?: string;
  action?: "alerts";
  // an explanatory line under a headline tile's value
  caption?: string;
  tooltip?: string;
  state?: "positive" | "warning" | "negative" | "info";
}

const emit = defineEmits<{ filter: [token: string]; install: [] }>();

const $q = useQuasar();
const store = useStore();
const branding = useBrandingStore();
const stats = ref<FleetStats | null>(null);
const loading = ref(false);
const error = ref(false);
const updatedAt = ref<Date | null>(null);
let requestSequence = 0;
let requestsInFlight = 0;
let refreshQueued = false;

const dashInfoColor = computed(() => store.state.dash_info_color || "info");
const dashPositiveColor = computed(
  () => store.state.dash_positive_color || "positive",
);
const dashNegativeColor = computed(
  () => store.state.dash_negative_color || "negative",
);
const dashWarningColor = computed(
  () => store.state.dash_warning_color || "warning",
);

const totalAlerts = computed(
  () =>
    stats.value?.alerts.reduce((total, alert) => total + alert.count, 0) || 0,
);
const checkTotal = computed(
  () => (stats.value?.checks.passing || 0) + (stats.value?.checks.failing || 0),
);

const headlineMetrics = computed<ActionItem[]>(() =>
  stats.value
    ? [
        {
          label: "Failing checks",
          value: stats.value.checks.failing,
          icon: "error_outline",
          color:
            stats.value.checks.failing > 0
              ? dashNegativeColor.value
              : dashPositiveColor.value,
          filter: "is:checksfailing",
          tooltip: "Show agents with failing checks",
          caption: "Counted per check, all severities",
          state: stats.value.checks.failing > 0 ? "negative" : "positive",
        },
        {
          label: "Overdue agents",
          value: stats.value.agents.overdue,
          icon: "timer_off",
          color:
            stats.value.agents.overdue > 0
              ? dashWarningColor.value
              : dashPositiveColor.value,
          filter: "is:overdue",
          tooltip: "Show overdue agents",
          caption: "Monitored for outages, silent past the overdue time",
          state: stats.value.agents.overdue > 0 ? "warning" : "positive",
        },
        {
          label: "Patches pending",
          value: stats.value.patches_pending_agents,
          icon: "system_update",
          color:
            stats.value.patches_failed_agents > 0
              ? dashNegativeColor.value
              : stats.value.patches_pending_agents > 0
                ? dashWarningColor.value
                : dashPositiveColor.value,
          filter: "is:patchespending",
          tooltip: "Show agents with patches pending",
          state:
            stats.value.patches_failed_agents > 0
              ? "negative"
              : stats.value.patches_pending_agents > 0
                ? "warning"
                : "positive",
          caption:
            stats.value.patches_failed_agents > 0
              ? `${stats.value.patches_failed_agents} with a failed install`
              : "Approved updates waiting",
        },
        {
          label: "Active alerts",
          value: totalAlerts.value,
          icon: "notifications_active",
          color:
            totalAlerts.value > 0
              ? dashNegativeColor.value
              : dashPositiveColor.value,
          action: "alerts",
          tooltip: "Open active alerts",
          caption: "Unresolved, including snoozed",
          state: totalAlerts.value > 0 ? "negative" : "positive",
        },
      ]
    : [],
);

const actionItems = computed<ActionItem[]>(() => {
  if (!stats.value) return [];

  return [
    {
      label: "Failing checks",
      detail: "Checks currently reporting a failure",
      value: stats.value.checks.failing,
      icon: "error_outline",
      color: dashNegativeColor.value,
      filter: "is:checksfailing",
    },
    {
      label: "Active alerts",
      detail: "Unresolved alerts, including snoozed",
      value: totalAlerts.value,
      icon: "notifications_active",
      color: dashNegativeColor.value,
      action: "alerts",
    },
    {
      label: "Overdue agents",
      detail: "Monitored for outages, silent past the overdue time",
      value: stats.value.agents.overdue,
      icon: "timer_off",
      color: dashWarningColor.value,
      filter: "is:overdue",
    },
    {
      label: "Offline agents",
      detail: "Missed check-in, often just shut down",
      value: stats.value.agents.offline,
      icon: "wifi_off",
      color: "grey-7",
      filter: "is:offline",
    },
    {
      label: "Patch installs failed",
      detail: "Agents where an approved update failed to install",
      value: stats.value.patches_failed_agents,
      icon: "sync_problem",
      color: dashNegativeColor.value,
      filter: "is:patchesfailed",
    },
    {
      label: "Agents awaiting patches",
      detail: "Agents with approved updates not installed yet",
      value: stats.value.patches_pending_agents,
      icon: "system_update",
      color: dashWarningColor.value,
      filter: "is:patchespending",
    },
    {
      label: "Reboot required",
      detail: "Devices that report a pending OS restart",
      value: stats.value.agents.needs_reboot,
      icon: "restart_alt",
      color: dashInfoColor.value,
      filter: "is:rebootneeded",
    },
  ].filter((item) => item.value > 0);
});

// a tile/row either opens the dialog that already covers that category
// (alerts bell) or asks the parent to apply the matching
// agent-table search token; the fleet numbers are fleet-wide, so
// the parent also resets the table scope to match
function onEntryClick(entry: { filter?: string; action?: "alerts" }) {
  if (entry.action === "alerts") {
    $q.dialog({ component: AlertsOverview });
  } else if (entry.filter) {
    emit("filter", entry.filter);
  }
}

// a severity chip opens the same overview, pre-filtered to that severity;
// unresolved/not-snoozed/30-day are still the overview's own defaults
function onSeverityClick(severity: string) {
  $q.dialog({
    component: AlertsOverview,
    componentProps: { initialSeverityFilter: [severity] },
  });
}

const sortedFailingChecks = computed(() =>
  [...(stats.value?.failing_checks_by_type || [])].sort(
    (a, b) => b.count - a.count,
  ),
);
const sortedVersions = computed(() =>
  [...(stats.value?.by_version || [])].sort((a, b) => b.count - a.count),
);
const sortedPlatforms = computed(() =>
  [...(stats.value?.by_plat || [])].sort((a, b) => b.count - a.count),
);
const sortedAlerts = computed(() => {
  const rank: Record<string, number> = {
    critical: 0,
    error: 1,
    warning: 2,
    info: 3,
  };
  return [...(stats.value?.alerts || [])].sort(
    (a, b) =>
      (rank[a.severity.toLowerCase()] ?? 4) -
        (rank[b.severity.toLowerCase()] ?? 4) || b.count - a.count,
  );
});

const lastSeenBuckets = computed(() =>
  stats.value
    ? [
        {
          label: "Never seen",
          value: stats.value.last_seen_buckets.never,
          color: dashNegativeColor.value,
        },
        {
          label: "More than 7 days",
          value: stats.value.last_seen_buckets.over_7d,
          color: dashWarningColor.value,
        },
        {
          label: "1–7 days",
          value: stats.value.last_seen_buckets["1d_7d"],
          color: dashInfoColor.value,
        },
        {
          label: "Under 24 hours",
          value: stats.value.last_seen_buckets.under_1d,
          color: dashPositiveColor.value,
        },
      ]
    : [],
);

const numberFormatter = new Intl.NumberFormat();
const timeFormatter = new Intl.DateTimeFormat([], {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

function formatNumber(value: number): string {
  return numberFormatter.format(value);
}

function formatTime(value: Date): string {
  return timeFormatter.format(value);
}

function percent(value: number, total: number): number {
  return total > 0 ? Math.min(Math.max(value / total, 0), 1) : 0;
}

// the backend reports raw check identifiers
const checkTypeLabels: Record<string, string> = {
  diskspace: "Disk space",
  ping: "Ping",
  cpuload: "CPU load",
  memory: "Memory",
  winsvc: "Windows service",
  script: "Script",
  eventlog: "Event log",
  security: "Security",
  hwhealth: "Hardware health",
};

function checkTypeLabel(checkType: string): string {
  return checkTypeLabels[checkType] || checkType || "Unknown";
}

// white where contrast stays at 4.5:1, black otherwise
function contrastText(color: string): string {
  try {
    const l = colors.luminosity(colors.getPaletteColor(color));
    return 1.05 / (l + 0.05) >= 4.5 ? "white" : "black";
  } catch {
    return "white";
  }
}

// tooltip and aria-label for a tile or attention-row click
function entryActionText(entry: ActionItem): string {
  if (entry.action === "alerts") return "Open active alerts";
  return "Show these agents in the table";
}

function severityColor(severity: string): string {
  const normalized = severity.toLowerCase();
  if (normalized === "critical" || normalized === "error") {
    return dashNegativeColor.value;
  }
  if (normalized === "warning") return dashWarningColor.value;
  return dashInfoColor.value;
}

async function loadStats(
  options: { silent?: boolean; force?: boolean } = {},
): Promise<void> {
  const silent = options?.silent === true;
  if (silent && requestsInFlight) {
    if (options.force) refreshQueued = true;
    return;
  }
  const request = ++requestSequence;
  requestsInFlight += 1;
  if (!silent) loading.value = true;
  if (!silent) error.value = false;
  try {
    const result = await fetchFleetStats(
      {},
      silent ? SILENT_REQUEST_CONFIG : undefined,
    );
    if (request !== requestSequence) return;
    stats.value = result;
    error.value = false;
    updatedAt.value = new Date();
  } catch (err) {
    console.error("fleet stats load failed", err);
    if (request === requestSequence) error.value = true;
  } finally {
    requestsInFlight -= 1;
    if (request === requestSequence) {
      loading.value = false;
    }
    if (!requestsInFlight && refreshQueued) {
      refreshQueued = false;
      if (document.visibilityState === "visible") {
        void loadStats({ silent: true });
      }
    }
  }
}

onMounted(() => {
  void loadStats();
});
onBeforeUnmount(() => {
  requestSequence += 1;
  refreshQueued = false;
});

// re-aggregate whenever the agent table reloads (header refresh, tree
// selection, post-action refreshes) so the overview never shows stale
// counts next to a freshly refreshed table
watch(
  () => store.state.agents,
  () =>
    void loadStats({
      silent: true,
      force: true,
    }),
);
</script>

<style scoped>
.fleet-overview {
  height: 100%;
  overflow: auto;
  color: var(--rmm-text);
  background: var(--rmm-bg);
}

.overview-card {
  border-radius: var(--rmm-radius);
}

.overview-warning {
  color: var(--rmm-status-warning);
  background: color-mix(in srgb, var(--q-warning) 10%, var(--rmm-surface));
}

.metric-card {
  --metric-accent: var(--rmm-text-subtle);
  min-height: 88px;
  border-left: 3px solid var(--metric-accent) !important;
  cursor: pointer;
  transition:
    background-color 0.15s ease-out,
    border-color 0.15s ease-out;
}

.metric-card:hover {
  background: var(--rmm-surface-3) !important;
}

.metric-card--positive {
  --metric-accent: var(--rmm-status-positive);
}

.metric-card--warning {
  --metric-accent: var(--rmm-status-warning);
}

.metric-card--negative {
  --metric-accent: var(--rmm-status-negative);
}

.metric-card--info {
  --metric-accent: var(--rmm-status-info);
}

.metric-icon {
  padding: 6px;
  border-radius: var(--rmm-radius-sm);
  color: var(--metric-accent);
  background: color-mix(in srgb, var(--metric-accent) 10%, transparent);
}

.metric-value {
  color: var(--rmm-text);
  font-size: 1.5rem;
  line-height: 1.1;
}

.metric-caption {
  font-size: var(--rmm-fs-xs);
  line-height: 1.2;
}

.metric-copy {
  min-width: 0;
}

.section-heading {
  display: flex;
  min-height: 42px;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  font-size: 0.875rem;
  font-weight: 600;
}

.bar-row + .bar-row {
  margin-top: 10px;
}

.overview-chip {
  color: var(--rmm-text);
  border: 1px solid var(--rmm-border);
  background: var(--rmm-surface);
}

.overview-chip--positive {
  color: var(--rmm-status-positive);
  background: color-mix(in srgb, var(--q-positive) 9%, var(--rmm-surface));
}

.overview-progress :deep(.q-linear-progress__track) {
  background: var(--rmm-border-strong) !important;
  opacity: 1;
}

.overview-card :deep(.q-list--separator > .q-item + .q-item) {
  border-top-color: var(--rmm-border);
}

.fleet-facts {
  display: grid;
  gap: 8px;
  align-content: start;
  font-size: 0.8rem;
}

.fleet-facts > div {
  display: grid;
  grid-template-columns: 20px 1fr auto;
  align-items: center;
  gap: 6px;
}
</style>
