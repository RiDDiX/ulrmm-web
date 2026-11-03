<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <div v-if="agentId">
    <StaleBanner
      v-if="error && checkRows.length > 0"
      :message="errorMessage"
      :loaded-at="lastLoadedAt"
      :format-date="formatDate"
      @retry="reload"
    />
    <q-table
      v-model:pagination="paging"
      v-sortable-headers
      class="tabs-tbl-sticky rmm-table"
      :style="{ maxHeight: tabHeight }"
      v-bind="TABLE_PROPS"
      :rows="checkRows"
      :columns="COLUMNS"
      :loading="busy"
    >
      <template #loading>
        <q-inner-loading color="primary" showing />
      </template>

      <template #no-data>
        <div v-if="!busy" class="full-width">
          <LoadFailed
            v-if="error"
            title="Unable to load checks"
            :message="errorMessage"
            @retry="reload"
          />
          <EmptyState
            v-else
            icon="checklist"
            title="No checks yet"
            text="Add a check here, or assign an automation policy that brings its own checks."
          >
            <ChecksAddMenu :platform="platform" @pick="openCheck" />
          </EmptyState>
        </div>
      </template>

      <template #top>
        <TabToolbar title="Checks" :count="checkRows.length">
          <ChecksAddMenu
            class="tab-toolbar__primary"
            :platform="platform"
            @pick="openCheck"
          />
          <q-btn
            v-for="tool in TOOLBAR"
            :key="tool.label"
            v-bind="TOOL_BTN"
            :label="tool.label"
            :icon="tool.icon"
            @click="tool.run"
          >
            <q-tooltip>{{ tool.tip }}</q-tooltip>
          </q-btn>
          <q-space />
          <q-btn
            dense
            flat
            round
            icon="refresh"
            aria-label="Refresh checks"
            @click="reload"
          >
            <q-tooltip>Refresh checks</q-tooltip>
          </q-btn>
        </TabToolbar>
      </template>

      <template
        v-for="column in HEADED_COLUMNS"
        :key="column.name"
        #[`header-cell-${column.name}`]="head"
      >
        <q-th auto-width :props="head">
          <template v-if="column.icon">
            <q-icon :name="column.icon" size="1.3em" class="rmm-muted">
              <q-tooltip>{{ column.tip }}</q-tooltip>
            </q-icon>
            <span class="sr-only">{{ head.col.label }}</span>
          </template>
          <template v-else>
            {{ head.col.label }}
            <q-tooltip v-if="column.tip">{{ column.tip }}</q-tooltip>
          </template>
        </q-th>
      </template>

      <template #body="line">
        <q-tr
          :props="line"
          class="cursor-pointer"
          @dblclick="openCheck(line.row.check_type, line.row)"
        >
          <q-menu context-menu>
            <ChecksRowMenu
              v-bind="rowMenuProps(line.row)"
              close-item
              v-on="rowMenuEvents(line.row)"
            />
          </q-menu>

          <AlertFlagCell
            v-for="column in ALERT_COLUMNS"
            :key="column.field"
            :row="line.row"
            :subject="line.row.readable_desc"
            :field="column.field"
            :template-key="column.templateKey"
            :label="column.label"
            :strict-null="column.strictNull"
            @change="(patch) => editCheck(line.row, patch)"
          />

          <q-td>
            <q-icon
              v-if="policyMark(line.row)"
              size="1.3rem"
              :name="policyMark(line.row).icon"
              role="img"
              class="rmm-muted"
              :aria-label="policyMark(line.row).tip"
            >
              <q-tooltip>{{ policyMark(line.row).tip }}</q-tooltip>
            </q-icon>
          </q-td>

          <ResultStatusCell
            :result="line.row.check_result"
            :severity="severityOf(line.row)"
            passing-tip="Passing: the last run was within its limits"
          />

          <!-- long names end in an ellipsis so the task and status columns
               stay visible -->
          <q-td class="rmm-ellipsis-td">
            <span class="rmm-ellipsis-cell__text">{{
              line.row.readable_desc
            }}</span>
            <q-tooltip>{{ line.row.readable_desc }}</q-tooltip>
          </q-td>

          <CheckInfoCell :check="line.row" />

          <q-td :class="{ 'rmm-muted': !line.row.check_result.last_run }">{{
            lastRun(line.row)
          }}</q-td>

          <q-td
            :class="{ 'rmm-ellipsis-td': line.row.assignedtasks.length === 1 }"
          >
            <template v-if="line.row.assignedtasks.length === 1">
              <span class="rmm-ellipsis-cell__text">{{
                line.row.assignedtasks[0].name
              }}</span>
              <q-tooltip>{{ line.row.assignedtasks[0].name }}</q-tooltip>
            </template>
            <template v-else-if="line.row.assignedtasks.length"
              >{{ line.row.assignedtasks.length }} tasks</template
            >
          </q-td>

          <q-td @click.stop>
            <RowActions :label="`Actions for ${line.row.readable_desc}`">
              <ChecksRowMenu
                v-bind="rowMenuProps(line.row)"
                v-on="rowMenuEvents(line.row)"
              />
            </RowActions>
          </q-td>
        </q-tr>
      </template>
    </q-table>
  </div>
  <div v-else class="q-pa-sm rmm-muted">No agent selected</div>
</template>

<script setup>
import { inject, onMounted, ref } from "vue";
import { useQuasar } from "quasar";
import * as checksApi from "@/api/checks";
import { fetchAgentChecks } from "@/api/agents";
import { notifySuccess, notifyWarning } from "@/utils/notify";
import { usePolicyNames } from "@/composables/automation";
import { sortableHeaders as vSortableHeaders } from "@/utils/sortableHeaders";

import DiskSpaceCheck from "../checks/DiskSpaceCheck.vue";
import MemCheck from "../checks/MemCheck.vue";
import CpuLoadCheck from "../checks/CpuLoadCheck.vue";
import PingCheck from "../checks/PingCheck.vue";
import WinSvcCheck from "../checks/WinSvcCheck.vue";
import EventLogCheck from "../checks/EventLogCheck.vue";
import ScriptCheck from "../checks/ScriptCheck.vue";
import HealthCheck from "../checks/HealthCheck.vue";
import SystemdCheck from "../checks/SystemdCheck.vue";
import ContainerCheck from "../checks/ContainerCheck.vue";
import MetricCheck from "../checks/MetricCheck.vue";
import RowActions from "@/components/ui/RowActions.vue";
import EmptyState from "@/components/ui/EmptyState.vue";
import AutomationManager from "@/components/automation/AutomationManager.vue";
import TabToolbar from "./TabToolbar.vue";
import StaleBanner from "./StaleBanner.vue";
import LoadFailed from "./LoadFailed.vue";
import ChecksAddMenu from "./ChecksAddMenu.vue";
import ChecksRowMenu from "./ChecksRowMenu.vue";
import AlertFlagCell from "./AlertFlagCell.vue";
import ResultStatusCell from "./ResultStatusCell.vue";
import CheckInfoCell from "./CheckInfoCell.vue";
import { useAgentTab } from "./useAgentTab";
import { denseTable } from "./tableProps";

defineOptions({ name: "ChecksTab" });

// edit dialog per check type; both health kinds share one
const CHECK_FORMS = {
  diskspace: DiskSpaceCheck,
  memory: MemCheck,
  cpuload: CpuLoadCheck,
  ping: PingCheck,
  winsvc: WinSvcCheck,
  eventlog: EventLogCheck,
  script: ScriptCheck,
  security: HealthCheck,
  hwhealth: HealthCheck,
  systemd: SystemdCheck,
  container: ContainerCheck,
  metric: MetricCheck,
};

// sort order of the status column, as in the fleet table: failing with
// error severity, warning, info, then passing, then not run yet
const FAILING_RANK = { warning: 1, info: 2 };
function statusRank(row) {
  const status = row.check_result?.status;
  if (status === "passing") return 3;
  if (status !== "failing") return 4;
  const severity = row.check_result.alert_severity || row.alert_severity;
  return FAILING_RANK[severity] ?? 0;
}

// a sortable column of plain values; the width goes to its header
const textColumn = (name, label, field, width) => ({
  name,
  label,
  field,
  sortable: true,
  headerStyle: width && `width: ${width}`,
});

// one entry per column; icon and tip go to its header cell, templateKey and
// strictNull to the alert checkbox cell
const COLUMNS = [
  {
    name: "smsalert",
    label: "SMS alert",
    field: "text_alert",
    icon: "phone_android",
    tip: "SMS alert: send a text message when the check fails",
    templateKey: "always_text",
  },
  {
    name: "emailalert",
    label: "Email alert",
    field: "email_alert",
    icon: "email",
    tip: "Email alert: send an email when the check fails",
    templateKey: "always_email",
  },
  {
    name: "dashboardalert",
    label: "Dashboard alert",
    field: "dashboard_alert",
    icon: "notifications",
    tip: "Dashboard alert: raise an alert in the dashboard when the check fails",
    templateKey: "always_alert",
    strictNull: true,
  },
  {
    name: "policystatus",
    label: "Policy",
    tip: "Set when a policy manages the check or overrides it",
    ownHeader: true,
  },
  {
    name: "statusicon",
    label: "Status",
    field: (row) => row.check_result?.status,
    sortable: true,
    sort: (a, b, rowA, rowB) => statusRank(rowA) - statusRank(rowB),
    tip: "Result of the last run; failing checks by severity",
    ownHeader: true,
  },
  textColumn("desc", "Description", "readable_desc", "40%"),
  textColumn("moreinfo", "More info", "more_info", "40%"),
  textColumn("datetime", "Last run", "last_run"),
  textColumn("assignedtasks", "Assigned tasks", "assigned_task", "20%"),
  {
    name: "actions",
    label: "Actions",
    field: () => "",
    align: "right",
    ownHeader: true,
  },
].map((column) => ({ align: "left", ...column }));
const HEADED_COLUMNS = COLUMNS.filter((c) => c.icon || c.ownHeader);
const ALERT_COLUMNS = COLUMNS.filter((c) => c.templateKey);

const TABLE_PROPS = { ...denseTable, rowKey: "id" };
const TOOL_BTN = { dense: true, flat: true, noCaps: true };
const OVERRIDDEN_TIP =
  "Overridden by a policy check of the same kind; this one does not run";

const $q = useQuasar();
const refreshDash = inject("refreshDashboard");
const logError = (err) => console.error(err);

// policy id to name, so a managed row can say which policy owns it
const { policyNames, loadPolicyNames } = usePolicyNames();
const policyName = (id) => policyNames.value[id] || "policy";
const openAutomation = () => $q.dialog({ component: AutomationManager });

const checkRows = ref([]);
const paging = ref({ rowsPerPage: 0, sortBy: "statusicon", descending: false });

const {
  selectedAgent: agentId,
  agentPlatform: platform,
  tabHeight,
  formatDate,
  loading: busy,
  error,
  errorMessage,
  lastLoadedAt,
  load: reload,
} = useAgentTab({
  fetch: fetchAgentChecks,
  accept: (rows) => (checkRows.value = rows),
  clear: () => (checkRows.value = []),
  forbidden: "Your role cannot view checks for this agent.",
  failed: "Checks could not be loaded.",
});

function policyMark(row) {
  if (row.policy)
    return {
      icon: "policy",
      tip: `This check is managed by policy: ${policyName(row.policy)}`,
    };
  if (row.overridden_by_policy)
    return { icon: "remove_circle_outline", tip: OVERRIDDEN_TIP };
  return null;
}

const severityOf = (row) =>
  row.check_result.alert_severity || row.alert_severity;

const lastRun = (row) =>
  row.check_result.last_run
    ? formatDate.value(row.check_result.last_run)
    : "Never";

// spinner on while a change runs, then its message; reloads the rows unless
// the call does that itself
async function changeChecks(call, reloadAfter = true) {
  busy.value = true;
  try {
    const message = await call();
    if (reloadAfter) await reload();
    notifySuccess(message);
  } catch (err) {
    logError(err);
  }
  busy.value = false;
}

async function editCheck(row, patch) {
  if (row.policy) return;
  busy.value = true;
  Object.assign(row, patch);
  await checksApi
    .updateCheck(row.id, patch)
    .then(notifySuccess)
    .catch(logError);
  // the reload also puts back a checkbox the server refused
  await reload();
}

function confirmDanger(title, message, label) {
  const ok = { label, color: "negative" };
  return $q.dialog({ title, message, ok, cancel: true, persistent: true });
}

function confirmDelete(check) {
  confirmDanger(
    "Are you sure?",
    `Delete ${check.readable_desc}`,
    "Delete",
  ).onOk(() => changeChecks(() => checksApi.removeCheck(check.id)));
}

function resetAll() {
  confirmDanger(
    "Reset all check statuses?",
    "Every check that has run is marked passing and its open alerts are resolved until the next run.",
    "Reset",
  ).onOk(() =>
    changeChecks(() => checksApi.resetAllChecksStatus(agentId.value)),
  );
}

// why a single reset is pointless; the row menu shows it as well
function resetBlocker(check) {
  const status = check.check_result?.status;
  if (!status) return "Check hasn't run yet";
  return status === "passing" ? "Check is already passing" : "";
}

function resetOne(check) {
  const blocker = resetBlocker(check);
  if (blocker) return notifyWarning(blocker);
  return changeChecks(async () => {
    const message = await checksApi.resetCheck(check.check_result.id);
    await reload();
    refreshDash(false, false);
    return message;
  }, false);
}

function runAll() {
  checksApi.runAgentChecks(agentId.value).then(notifySuccess).catch(logError);
}

const TOOLBAR = [
  {
    label: "Run checks now",
    icon: "play_arrow",
    tip: "Ask the agent to run every check on this device now",
    run: runAll,
  },
  {
    label: "Reset all statuses",
    icon: "restart_alt",
    tip: "Mark every check as passing and resolve its open alerts until the next run",
    run: resetAll,
  },
];

function openCheck(type, check) {
  const form = CHECK_FORMS[type];
  if (check?.policy || !form) return;
  const componentProps = {
    check,
    // edit dialogs that read the agent's state need its agent_id; the
    // check only carries the agent pk
    parent: { agent: agentId.value },
    plat: type === "script" ? platform.value : undefined,
    checkType: form === HealthCheck ? type : undefined,
  };
  $q.dialog({ component: form, componentProps }).onOk(reload);
}

const rowMenuProps = (row) => ({
  managed: !!row.policy,
  resetBlocked: resetBlocker(row),
  policyName: policyName(row.policy),
});
const rowMenuEvents = (row) => ({
  edit: () => openCheck(row.check_type, row),
  reset: () => resetOne(row),
  policy: openAutomation,
  delete: () => confirmDelete(row),
});

onMounted(loadPolicyNames);
</script>

<style scoped>
.tab-toolbar__primary {
  padding: 2px 10px;
}
</style>
