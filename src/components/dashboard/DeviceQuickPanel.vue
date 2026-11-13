<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <section class="quick-panel" :aria-label="`Details for ${shownName}`">
    <header class="quick-panel__head">
      <div class="quick-panel__identity">
        <div class="quick-panel__title">
          <h2 class="quick-panel__hostname" :title="shownName">
            {{ shownName }}
          </h2>
          <span class="rmm-pill" :class="`rmm-pill--${status.state}`">
            {{ agentStatusLabel(agent) }}
            <q-tooltip>{{ statusTooltip }}</q-tooltip>
          </span>
        </div>
        <div class="quick-panel__scope rmm-muted">{{ scopeText }}</div>
      </div>
    </header>
    <div class="quick-panel__tools">
      <q-btn
        flat
        round
        dense
        icon="more_horiz"
        :aria-label="`More actions for ${shownName}`"
      >
        <q-tooltip v-if="!menuOpen">More actions</q-tooltip>
        <q-menu v-model="menuOpen" no-route-dismiss>
          <AgentActionMenu :agent="agent" />
        </q-menu>
      </q-btn>
      <q-btn
        flat
        round
        dense
        icon="close"
        aria-label="Close device details"
        @click="$emit('close')"
      >
        <q-tooltip>Close device details</q-tooltip>
      </q-btn>
    </div>

    <div class="quick-panel__actions">
      <q-btn
        unelevated
        no-caps
        color="primary"
        icon="desktop_windows"
        label="Remote control"
        class="full-width"
        @click="runTakeControl(agent.agent_id)"
      >
        <q-tooltip>{{
          offline ? meshOfflineWarning : "Open a remote desktop session"
        }}</q-tooltip>
      </q-btn>
      <div class="quick-panel__actions-row">
        <div>
          <q-btn
            outline
            no-caps
            icon="terminal"
            label="Terminal"
            class="full-width"
            :disable="offline"
            @click="runRemoteBackground(agent.agent_id, agent.plat)"
          />
          <q-tooltip>{{
            offline ? offlineReason : "Open a remote terminal"
          }}</q-tooltip>
        </div>
        <div>
          <q-btn
            outline
            no-caps
            icon="code"
            label="Run script"
            class="full-width"
            :disable="offline"
            @click="showRunScript"
          />
          <q-tooltip>{{
            offline ? offlineReason : "Run a script on this device"
          }}</q-tooltip>
        </div>
      </div>
    </div>

    <q-tabs
      v-model="tab"
      dense
      no-caps
      align="left"
      class="quick-panel__tabs"
      active-color="primary"
      indicator-color="primary"
      narrow-indicator
    >
      <q-tab name="overview" label="Overview" />
      <q-tab name="activity" label="Activity" />
    </q-tabs>

    <div class="quick-panel__body">
      <div v-if="tab === 'overview'" class="quick-panel__overview">
        <div
          v-if="issue"
          class="quick-panel__banner"
          :class="issue.tone && `quick-panel__banner--${issue.tone}`"
          role="status"
        >
          <q-icon :name="issue.icon || 'warning_amber'" size="20px" />
          <div>
            <div class="quick-panel__banner-title">{{ issue.title }}</div>
            <div v-if="issue.text" class="quick-panel__banner-text">
              {{ issue.text }}
            </div>
          </div>
        </div>

        <dl class="quick-panel__facts">
          <div>
            <dt><q-icon :name="platformIcon" size="16px" /> OS</dt>
            <dd :title="osText">{{ osText }}</dd>
          </div>
          <div>
            <dt><q-icon name="lan" size="16px" /> IP address</dt>
            <dd :title="ipText">{{ ipText }}</dd>
          </div>
          <div>
            <dt><q-icon name="schedule" size="16px" /> Last seen</dt>
            <dd>
              {{ lastSeenText }}
              <q-tooltip v-if="agent.last_seen">{{
                formatDate(agent.last_seen)
              }}</q-tooltip>
            </dd>
          </div>
        </dl>

        <div class="quick-panel__meters">
          <div v-for="meter in meters" :key="meter.label" class="quick-meter">
            <div class="quick-meter__row">
              <span>{{ meter.label }}</span>
              <span class="rmm-num" :class="`quick-meter--${meter.state}`">{{
                meter.text
              }}</span>
            </div>
            <div
              class="quick-meter__track"
              role="progressbar"
              :aria-label="meter.label"
              :aria-valuenow="meter.percent ?? undefined"
              aria-valuemin="0"
              aria-valuemax="100"
            >
              <div
                class="quick-meter__fill"
                :class="`quick-meter--${meter.state}`"
                :style="{ width: `${meter.percent ?? 0}%` }"
              />
            </div>
            <div v-if="meter.caption" class="quick-meter__caption rmm-muted">
              {{ meter.caption }}
            </div>
          </div>
        </div>

        <div v-if="disks.length > 1" class="quick-panel__disks">
          <div class="rmm-label">Disks</div>
          <div v-for="disk in disks" :key="disk.device" class="quick-meter">
            <div class="quick-meter__row">
              <span>{{ disk.device }}</span>
              <span class="rmm-muted rmm-num"
                >{{ disk.free }} free of {{ disk.total }}</span
              >
            </div>
            <div
              class="quick-meter__track"
              role="progressbar"
              :aria-label="`${disk.device} used`"
              :aria-valuenow="disk.percent"
              aria-valuemin="0"
              aria-valuemax="100"
            >
              <div
                class="quick-meter__fill"
                :class="`quick-meter--${meterState(disk.percent)}`"
                :style="{ width: `${disk.percent}%` }"
              />
            </div>
          </div>
        </div>

        <router-link
          :to="{ name: 'Agent', params: { agent_id: agent.agent_id } }"
          class="rmm-link quick-panel__more"
        >
          Open full device details
          <q-icon name="north_east" size="14px" />
        </router-link>
      </div>

      <div v-else>
        <div v-if="activityLoading && !activity.length" class="q-py-md">
          <q-spinner size="24px" color="primary" />
        </div>
        <EmptyState
          v-else-if="!activity.length"
          icon="history"
          title="Nothing recorded yet"
          :text="
            activityError
              ? 'Recent activity could not be loaded.'
              : 'Commands, scripts, tasks and alerts for this device appear here.'
          "
        >
          <q-btn
            v-if="activityError"
            outline
            dense
            no-caps
            color="primary"
            label="Retry"
            @click="loadActivity"
          />
        </EmptyState>
        <ol v-else class="quick-panel__activity">
          <li v-for="item in activity" :key="item.key">
            <q-icon
              :name="item.icon"
              size="18px"
              :class="`quick-meter--${item.state}`"
            />
            <div class="quick-panel__activity-copy">
              <div class="quick-panel__activity-title" :title="item.title">
                {{ item.title }}
              </div>
              <div class="rmm-muted quick-panel__activity-caption">
                {{ item.caption }}
              </div>
            </div>
            <span class="rmm-muted quick-panel__activity-time">
              {{ relativeTime(item.time) }}
              <q-tooltip>{{ formatDate(item.time) }}</q-tooltip>
            </span>
          </li>
        </ol>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useQuasar } from "quasar";
import { useStore } from "vuex";
import axios from "axios";
import { useDashboardStore } from "@/stores/dashboard";
import {
  DASHBOARD_REFRESH_INTERVAL,
  SILENT_REQUEST_CONFIG,
} from "@/constants/constants";
import {
  fetchAgent,
  fetchAgentHistory,
  fetchAgentPerf,
  runRemoteBackground,
  runTakeControl,
} from "@/api/agents";
import {
  agentStatusLabel,
  agentStatusMeta,
  checksMeta,
  platformMeta,
  relativeTime,
  usageLevel,
  MESH_OFFLINE_WARNING,
} from "@/utils/format";
import { deviceName } from "@/utils/deviceName";
import { historyActivityRow } from "@/utils/appupdates";
import { statusTooltip as rowStatusTooltip } from "@/components/agentTableRows";
import AgentActionMenu from "@/components/agents/AgentActionMenu.vue";
import EmptyState from "@/components/ui/EmptyState.vue";
import RunScript from "@/components/modals/agents/RunScript.vue";

const props = defineProps({
  // the fleet table row: live status, checks and last seen come from the
  // table's own 30 s refresh
  agent: { type: Object, required: true },
});
defineEmits(["close"]);

const $q = useQuasar();
const store = useStore();
const dashboardStore = useDashboardStore();
const meshOfflineWarning = MESH_OFFLINE_WARNING;

const tab = ref("overview");
const menuOpen = ref(false);
const detail = ref(null);
const perf = ref(null);
const history = ref([]);
const alerts = ref([]);
const activityLoading = ref(false);
const activityError = ref(false);
let pollTimer;
let inFlight = null;
let generation = 0;

const formatDate = computed(() => store.getters.formatDate);
const status = computed(() => agentStatusMeta(props.agent.status));
const offline = computed(() => props.agent.status !== "online");
const offlineReason = computed(
  () =>
    `Needs the agent online, last seen ${relativeTime(props.agent.last_seen)}`,
);
const statusTooltip = computed(() => rowStatusTooltip(props.agent));
const shownName = computed(() => deviceName(props.agent));
// hostname on this line when it differs from the display name
const scopeText = computed(() =>
  [
    shownName.value !== props.agent.hostname && props.agent.hostname,
    [props.agent.client_name, props.agent.site_name]
      .filter(Boolean)
      .join(" / "),
  ]
    .filter(Boolean)
    .join(" · "),
);
const platformIcon = computed(() => platformMeta(props.agent.plat).icon);
const osText = computed(
  () =>
    detail.value?.operating_system ||
    props.agent.operating_system ||
    "Unknown OS",
);
// the first local address; the public one when the agent reported none
const ipText = computed(() => {
  const local = String(props.agent.local_ips || "")
    .split(",")[0]
    .trim();
  return local || props.agent.public_ip || "—";
});
const lastSeenText = computed(() => relativeTime(props.agent.last_seen));

// the agent reports a list, older agents a dict keyed by device
const disks = computed(() =>
  Object.values(detail.value?.disks || {}).filter((d) =>
    Number.isFinite(d?.percent),
  ),
);
const worstDisk = computed(() =>
  disks.value.reduce(
    (worst, disk) => (!worst || disk.percent > worst.percent ? disk : worst),
    null,
  ),
);

const plural = (n, noun) => `${n} ${noun}${n === 1 ? "" : "s"}`;

// worst problem first: failing checks, a failed patch, a full disk, a check
// warning, then a pending reboot. Maintenance mode replaces them all with a
// neutral note, its alerts are suppressed anyway
const issue = computed(() => {
  const agent = props.agent;
  const checks = checksMeta(agent);
  if (agent.maintenance_mode)
    return {
      tone: "neutral",
      icon: "construction",
      title: "Maintenance mode",
      text: "Alerts for this device are suppressed until it is disabled.",
    };
  if (checks.state === "negative")
    return {
      title: plural(agent.checks?.failing ?? 0, "failing check"),
      text: "See the Checks tab.",
    };
  if (agent.has_patches_failed)
    return {
      title: "A patch failed to install",
      text: "See the Patches tab for the update and its result.",
    };
  const disk = worstDisk.value;
  if (disk && disk.percent >= 90)
    return {
      title: "Disk space is running low",
      text: `${disk.device} · ${disk.free} available`,
    };
  if (checks.state === "warning")
    return {
      title: plural(agent.checks?.warning ?? 0, "warning check"),
      text: "See the Checks tab.",
    };
  if (agent.needs_reboot)
    return {
      title: "Reboot needed",
      text: "The device reports a pending restart.",
    };
  if (agent.status === "overdue")
    return {
      title: "Agent is overdue",
      text: `Last seen ${relativeTime(agent.last_seen)}.`,
    };
  return null;
});

function meterState(percent) {
  if (!Number.isFinite(percent)) return "neutral";
  return usageLevel(percent) ?? "accent";
}

function percentText(value) {
  return Number.isFinite(value) ? `${Math.round(value)}%` : "—";
}

const meters = computed(() => {
  const cpu = perf.value?.cpu_percent;
  const mem = perf.value?.mem_percent;
  const disk = worstDisk.value;
  const liveCaption = offline.value
    ? "Live data needs the agent online"
    : perf.value?.error
      ? "The agent did not answer"
      : "";
  return [
    {
      label: "CPU",
      percent: Number.isFinite(cpu) ? cpu : null,
      text: percentText(cpu),
      state: meterState(cpu),
      caption: liveCaption,
    },
    {
      label: "Memory",
      percent: Number.isFinite(mem) ? mem : null,
      text: percentText(mem),
      state: meterState(mem),
    },
    {
      label: disk ? `Disk ${disk.device}` : "Disk",
      percent: disk ? disk.percent : null,
      text: disk ? `${disk.percent}%` : "—",
      state: meterState(disk?.percent),
      caption: disk ? `${disk.free} free of ${disk.total}` : "",
    },
  ];
});

// alerts and history for this device, newest first, ten rows
const activity = computed(() => {
  const rows = [
    ...alerts.value.map((a) => ({
      key: `alert-${a.id}`,
      time: a.alert_time,
      icon: a.severity === "error" ? "error" : "warning_amber",
      state: a.severity === "error" ? "negative" : "warning",
      title: a.message,
      caption: `Alert · ${a.severity}`,
    })),
    ...history.value.map(historyActivityRow),
  ];
  return rows
    .filter((r) => r.time)
    .sort((a, b) => new Date(b.time) - new Date(a.time))
    .slice(0, 10);
});

function showRunScript() {
  $q.dialog({
    component: RunScript,
    componentProps: { agent: props.agent },
  });
}

// facts and disks load while the tab is visible and the server answers;
// the perf sample and the 30 s timer also need the agent online
function canFetch() {
  return !dashboardStore.isOffline && document.visibilityState === "visible";
}

function canPoll() {
  return canFetch() && !offline.value;
}

// a poll the browser aborted (the page was left) or that got no answer
// at all (the offline banner says so) is no error worth logging
function logPollError(e) {
  if (e?.response) console.error(e);
}

function clearPollTimer() {
  window.clearTimeout(pollTimer);
  pollTimer = undefined;
}

async function loadPerf() {
  const id = props.agent.agent_id;
  const mine = generation;
  try {
    const result = await fetchAgentPerf(id, SILENT_REQUEST_CONFIG);
    if (mine === generation && !offline.value) perf.value = result;
  } catch (e) {
    logPollError(e);
  }
}

async function loadDetail() {
  const id = props.agent.agent_id;
  const mine = generation;
  try {
    const result = await fetchAgent(id, {}, SILENT_REQUEST_CONFIG);
    if (mine === generation) detail.value = result;
  } catch (e) {
    logPollError(e);
  }
}

// one silent pass: detail always, perf only while online. Leave a pass
// that is already running for this agent. Offline: detail once, no timer.
// If that pass ends with the agent online, start the live pass now
async function poll() {
  clearPollTimer();
  const mine = generation;
  if (inFlight === mine || !canFetch()) return;
  const live = canPoll();
  if (!live && detail.value) return;
  inFlight = mine;
  try {
    await Promise.all(live ? [loadDetail(), loadPerf()] : [loadDetail()]);
  } finally {
    if (inFlight === mine) inFlight = null;
    if (mine === generation && canPoll())
      pollTimer = window.setTimeout(
        poll,
        live ? DASHBOARD_REFRESH_INTERVAL : 0,
      );
  }
}

async function loadActivity() {
  const id = props.agent.agent_id;
  const mine = generation;
  activityLoading.value = true;
  activityError.value = false;
  // alerts need a permission the history call does not. Either source
  // can fill the tab alone. Alerts: this device's last 30 days, resolved
  // included
  const [rows, own] = await Promise.allSettled([
    fetchAgentHistory(id, { newest: 10 }, SILENT_REQUEST_CONFIG),
    axios.patch(
      "/alerts/",
      { timeFilter: 30, agentFilter: id },
      SILENT_REQUEST_CONFIG,
    ),
  ]);
  if (mine !== generation) return;
  if (rows.status === "fulfilled")
    history.value = Array.isArray(rows.value) ? rows.value : [];
  if (own.status === "fulfilled")
    alerts.value = Array.isArray(own.value.data) ? own.value.data : [];
  const failed = [rows, own].filter((r) => r.status === "rejected");
  failed.forEach((r) => console.error(r.reason));
  activityError.value = failed.some((r) => r.reason?.response?.status !== 403);
  activityLoading.value = false;
}

function start() {
  generation += 1;
  clearPollTimer();
  detail.value = null;
  perf.value = null;
  history.value = [];
  alerts.value = [];
  void poll();
  if (tab.value === "activity") void loadActivity();
}

function handleVisibilityChange() {
  if (document.visibilityState === "visible") void poll();
  else clearPollTimer();
}

watch(() => props.agent.agent_id, start);
// the table's refresh flips the status; live data follows it
watch(offline, (now) => {
  if (now) {
    perf.value = null;
    clearPollTimer();
  } else void poll();
});
watch(
  () => dashboardStore.isOffline,
  (down) => {
    if (!down) void poll();
  },
);
watch(tab, (name) => {
  if (name === "activity" && !history.value.length && !alerts.value.length)
    void loadActivity();
});

onMounted(() => {
  document.addEventListener("visibilitychange", handleVisibilityChange);
  start();
});

onBeforeUnmount(() => {
  generation += 1;
  clearPollTimer();
  document.removeEventListener("visibilitychange", handleVisibilityChange);
});
</script>

<style scoped>
/* beside the table the blocks stack. Under it, head, actions and tools
   share a row and the overview is two columns */
.quick-panel {
  display: grid;
  height: 100%;
  min-height: 0;
  grid-template-areas:
    "head tools"
    "actions actions"
    "tabs tabs"
    "body body";
  grid-template-columns: minmax(0, 1fr) auto;
  grid-template-rows: auto auto auto minmax(0, 1fr);
  color: var(--rmm-text);
}

.quick-panel__head {
  display: flex;
  grid-area: head;
  align-items: flex-start;
  gap: 8px;
  padding: 18px 0 0 20px;
}

.quick-panel__tools {
  grid-area: tools;
  padding: 14px 12px 0 0;
}

.quick-panel__actions {
  grid-area: actions;
}

.quick-panel__tabs {
  grid-area: tabs;
}

.quick-panel__body {
  grid-area: body;
}

.quick-panel__identity {
  min-width: 0;
  flex: 1;
}

.quick-panel__title {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 10px;
}

.quick-panel__hostname {
  overflow: hidden;
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  line-height: 1.3;
  letter-spacing: -0.01em;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.quick-panel__scope {
  margin-top: 2px;
  font-size: 13px;
}

.quick-panel__tools {
  display: flex;
  flex-shrink: 0;
  gap: 2px;
}

.quick-panel__actions {
  display: grid;
  gap: 8px;
  padding: 16px 20px 4px;
}

.quick-panel__actions .q-btn {
  min-height: 40px;
}

.quick-panel__actions-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.quick-panel__tabs {
  margin: 8px 20px 0;
  border-bottom: 1px solid var(--rmm-border);
}

.quick-panel__tabs :deep(.q-tab) {
  min-height: 40px;
  padding: 0 4px;
  margin-right: 16px;
}

.quick-panel__tabs :deep(.q-tab--active) {
  color: var(--rmm-text);
}

.quick-panel__body {
  min-height: 0;
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px 20px;
}

.quick-panel__banner {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-bottom: 16px;
  padding: 10px 12px;
  border: 1px solid color-mix(in srgb, var(--q-warning) 35%, transparent);
  border-radius: var(--rmm-radius-sm);
  color: var(--rmm-status-warning);
  background: color-mix(in srgb, var(--q-warning) 10%, var(--rmm-surface));
  font-size: 13px;
}

.quick-panel__banner--neutral {
  border-color: var(--rmm-border);
  color: var(--rmm-text);
  background: var(--rmm-surface-2);
}

.quick-panel__banner-title {
  font-weight: 600;
}

.quick-panel__banner-text {
  color: var(--rmm-text-muted);
}

.quick-panel__facts {
  display: grid;
  gap: 10px;
  margin: 0 0 18px;
  font-size: 13px;
}

.quick-panel__facts > div {
  display: grid;
  grid-template-columns: 110px minmax(0, 1fr);
  gap: 8px;
  align-items: center;
}

.quick-panel__facts dt {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--rmm-text-muted);
}

.quick-panel__facts dd {
  overflow: hidden;
  margin: 0;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.quick-panel__meters,
.quick-panel__disks {
  display: grid;
  gap: 12px;
}

.quick-panel__disks {
  margin-top: 16px;
}

.quick-meter__row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 6px;
  font-size: 13px;
}

.quick-meter__track {
  overflow: hidden;
  height: 8px;
  border-radius: 999px;
  background: var(--rmm-bar-track);
}

.quick-meter__fill {
  height: 100%;
  border-radius: 999px;
  background: var(--rmm-accent);
  transition: width 0.3s ease;
}

.quick-meter__caption {
  margin-top: 4px;
  font-size: var(--rmm-fs-xs);
}

.quick-meter--warning {
  color: var(--rmm-status-warning);
}

.quick-meter--negative {
  color: var(--rmm-status-negative);
}

.quick-meter__fill.quick-meter--warning {
  background: var(--q-warning);
}

.quick-meter__fill.quick-meter--negative {
  background: var(--q-negative);
}

.quick-meter--neutral {
  color: var(--rmm-text-muted);
}

.quick-panel__more {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-top: 18px;
  font-size: 13px;
  font-weight: 500;
}

.quick-panel__activity {
  display: grid;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.quick-panel__activity li {
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr) auto;
  gap: 10px;
  align-items: start;
  padding: 8px 0;
  border-bottom: 1px solid var(--rmm-border);
  font-size: 13px;
}

.quick-panel__activity-copy {
  min-width: 0;
}

.quick-panel__activity-title {
  overflow: hidden;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.quick-panel__activity-caption,
.quick-panel__activity-time {
  font-size: var(--rmm-fs-xs);
  white-space: nowrap;
}

@container (min-width: 720px) {
  .quick-panel {
    grid-template-areas:
      "head actions tools"
      "tabs tabs tabs"
      "body body body";
    grid-template-columns: minmax(0, 1fr) auto auto;
    grid-template-rows: auto auto minmax(0, 1fr);
  }

  .quick-panel__actions {
    display: flex;
    align-items: center;
    padding: 14px 8px 0 0;
  }

  .quick-panel__actions .q-btn {
    width: auto !important;
    white-space: nowrap;
  }

  .quick-panel__actions-row > div {
    flex: 0 0 auto;
  }

  .quick-panel__actions-row {
    display: contents;
  }

  .quick-panel__overview {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 0 32px;
  }

  .quick-panel__banner,
  .quick-panel__more {
    grid-column: 1 / -1;
  }

  .quick-panel__disks {
    grid-column: 1;
    margin-top: 0;
  }

  .quick-panel__more {
    justify-self: start;
  }
}
</style>
