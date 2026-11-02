<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <div v-if="!selectedAgent" class="q-pa-sm rmm-muted">No agent selected</div>
  <div v-else>
    <q-banner
      v-if="error && tasks.length > 0"
      dense
      rounded
      class="rmm-banner-warning q-mb-sm"
    >
      <template #avatar>
        <q-icon name="warning_amber" color="warning" />
      </template>
      {{ errorMessage }} Showing the last successful result from
      {{ formatDate(lastLoadedAt) }}.
      <template #action>
        <q-btn
          flat
          dense
          no-caps
          color="primary"
          label="Retry"
          @click="getTasks"
        />
      </template>
    </q-banner>
    <q-table
      v-model:pagination="pagination"
      v-sortable-headers
      class="tabs-tbl-sticky rmm-table"
      :style="{ 'max-height': tabHeight }"
      row-key="id"
      :loading="loading"
      v-bind="denseTable"
      :rows="tasks"
      :columns="columns"
    >
      <template #top>
        <TabToolbar title="Tasks" :count="tasks.length">
          <q-btn
            class="tab-toolbar__primary"
            icon="add"
            label="Add task"
            color="primary"
            unelevated
            no-caps
            dense
            @click="addTask"
          >
            <q-tooltip
              >Run scripts or commands on this agent on a schedule or
              trigger</q-tooltip
            >
          </q-btn>
          <q-space />
          <q-btn
            icon="refresh"
            aria-label="Refresh tasks"
            dense
            flat
            round
            @click="getTasks"
          >
            <q-tooltip>Refresh tasks</q-tooltip>
          </q-btn>
        </TabToolbar>
      </template>

      <template #loading>
        <q-inner-loading showing color="primary" />
      </template>

      <template #no-data>
        <div v-if="!loading" class="full-width">
          <EmptyState
            v-if="error"
            icon="error_outline"
            title="Unable to load tasks"
            :text="errorMessage"
          >
            <q-btn
              outline
              dense
              no-caps
              color="primary"
              label="Retry"
              @click="getTasks"
            />
          </EmptyState>
          <EmptyState
            v-else
            icon="task"
            title="No tasks yet"
            text="Tasks run scripts or commands on a schedule or trigger. Add one here, or assign a policy that brings its own."
          >
            <q-btn
              icon="add"
              label="Add task"
              color="primary"
              unelevated
              dense
              no-caps
              @click="addTask"
            />
          </EmptyState>
        </div>
      </template>

      <template
        v-for="h in iconHeaders"
        :key="h.name"
        #[`header-cell-${h.name}`]="hp"
      >
        <q-th auto-width :props="hp">
          <q-icon :name="h.icon" size="1.3em" class="rmm-muted">
            <q-tooltip>{{ h.tip }}</q-tooltip>
          </q-icon>
          <span class="sr-only">{{ hp.col.label }}</span>
        </q-th>
      </template>
      <template
        v-for="h in textHeaders"
        :key="h.name"
        #[`header-cell-${h.name}`]="hp"
      >
        <q-th auto-width :props="hp">
          {{ hp.col.label }}
          <q-tooltip v-if="h.tip">{{ h.tip }}</q-tooltip>
        </q-th>
      </template>

      <template #body="tr">
        <q-tr
          :props="tr"
          class="cursor-pointer"
          @dblclick="editTaskDialog(tr.row)"
        >
          <q-menu context-menu>
            <TaskRowMenu
              v-bind="menuProps(tr.row)"
              close-item
              v-on="menuHandlers(tr.row)"
            />
          </q-menu>

          <q-td>
            <q-checkbox
              :model-value="tr.row.enabled"
              :disable="!!tr.row.policy"
              :aria-label="`Enabled for ${tr.row.name}`"
              dense
              @update:model-value="(on) => editTask(tr.row, { enabled: on })"
            />
            <q-icon
              v-if="lockedMeta(tr.row)"
              :name="lockedMeta(tr.row).icon"
              :aria-label="lockedMeta(tr.row).tooltip"
              size="14px"
              class="rmm-muted q-ml-xs"
              role="img"
            >
              <q-tooltip>{{ lockedMeta(tr.row).tooltip }}</q-tooltip>
            </q-icon>
          </q-td>

          <AlertFlagCell
            v-for="a in alertCells"
            :key="a.field"
            :row="tr.row"
            :subject="tr.row.name"
            strict-null
            v-bind="a"
            @change="(patch) => editTask(tr.row, patch)"
          />

          <q-td>
            <q-icon
              v-if="tr.row.policy"
              size="1.3rem"
              name="policy"
              role="img"
              class="rmm-muted"
              :aria-label="policyTooltip(tr.row.policy)"
            >
              <q-tooltip>{{ policyTooltip(tr.row.policy) }}</q-tooltip>
            </q-icon>
          </q-td>

          <q-td>
            <template v-if="tr.row.custom_field">
              <q-icon size="1.3rem" name="check" class="rmm-muted">
                <q-tooltip
                  >The task updates a custom field on the agent</q-tooltip
                >
              </q-icon>
              <span class="sr-only">Collector task</span>
            </template>
          </q-td>

          <ResultStatusCell
            :result="tr.row.task_result"
            :severity="tr.row.alert_severity"
            passing-tip="Passing: the last run succeeded"
          />

          <q-td class="rmm-ellipsis-td"
            >{{ tr.row.name
            }}<q-tooltip :delay="700"
              >{{ tr.row.name
              }}<template v-if="tr.row.win_task_name"
                ><br />{{ tr.row.win_task_name }}</template
              ></q-tooltip
            ></q-td
          >

          <!-- glyph plus hidden text, the wording sits in the tooltip so the
               name column keeps its width -->
          <q-td>
            <q-icon
              :name="syncMeta(tr.row).icon"
              size="1.3rem"
              class="rmm-muted"
            >
              <q-tooltip>{{ syncMeta(tr.row).text }}</q-tooltip>
            </q-icon>
            <span class="sr-only">{{ syncMeta(tr.row).text }}</span>
          </q-td>

          <q-td v-if="hasOutput(tr.row.task_result)">
            <a
              href="#"
              role="button"
              class="rmm-link"
              @click.prevent="showOutput(tr.row)"
              @keydown.space.prevent="showOutput(tr.row)"
              >Output</a
            >
          </q-td>
          <q-td v-else class="rmm-muted">Awaiting output</q-td>

          <q-td v-if="tr.row.task_result.last_run">{{
            formatDate(tr.row.task_result.last_run)
          }}</q-td>
          <q-td v-else class="rmm-muted">Has not run yet</q-td>

          <q-td
            v-for="(text, i) in [tr.row.schedule, tr.row.check_name]"
            :key="i"
            class="rmm-ellipsis-td"
          >
            <template v-if="text">
              <span class="rmm-ellipsis-cell__text">{{ text }}</span>
              <q-tooltip>{{ text }}</q-tooltip>
            </template>
          </q-td>

          <q-td @click.stop>
            <RowActions :label="`Actions for ${tr.row.name}`">
              <TaskRowMenu
                v-bind="menuProps(tr.row)"
                v-on="menuHandlers(tr.row)"
              />
            </RowActions>
          </q-td>
        </q-tr>
      </template>
    </q-table>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { useQuasar } from "quasar";
import { updateTask, removeTask, runTask } from "@/api/tasks";
import { fetchAgentTasks } from "@/api/agents";
import { notifySuccess, notifyError } from "@/utils/notify";
import { alertOverrideMeta } from "@/utils/format";
import { usePolicyNames } from "@/composables/automation";
import { sortableHeaders as vSortableHeaders } from "@/utils/sortableHeaders";

import AutomatedTaskForm from "@/components/tasks/AutomatedTaskForm.vue";
import ScriptOutput from "@/components/checks/ScriptOutput.vue";
import RowActions from "@/components/ui/RowActions.vue";
import EmptyState from "@/components/ui/EmptyState.vue";
import TabToolbar from "@/components/agents/TabToolbar.vue";
import AlertFlagCell from "@/components/agents/AlertFlagCell.vue";
import ResultStatusCell from "@/components/agents/ResultStatusCell.vue";
import TaskRowMenu from "@/components/agents/TaskRowMenu.vue";
import { useAgentTab } from "@/components/agents/useAgentTab";
import { denseTable } from "@/components/agents/tableProps";
import AutomationManager from "@/components/automation/AutomationManager.vue";

defineOptions({ name: "AutomatedTasksTab" });

const col = (name, label, extra = {}) => ({
  name,
  label,
  align: "left",
  ...extra,
});
const sortableCol = (name, label, field, extra = {}) =>
  col(name, label, { field, sortable: true, ...extra });

const columns = [
  col("enabled", "Enabled", { field: "enabled" }),
  col("smsalert", "SMS alert", { field: "text_alert" }),
  col("emailalert", "Email alert", { field: "email_alert" }),
  col("dashboardalert", "Dashboard alert", { field: "dashboard_alert" }),
  col("policystatus", "Policy"),
  sortableCol("collector", "Collector", "custom_field"),
  col("status", "Status"),
  sortableCol("name", "Name", "name", {
    headerStyle: "width: 40%; min-width: 130px",
  }),
  sortableCol("sync_status", "Sync status", "sync_status"),
  sortableCol("moreinfo", "More info", "more_info"),
  sortableCol("datetime", "Last run", "last_run"),
  sortableCol("schedule", "Schedule", "schedule", {
    headerStyle: "width: 30%",
  }),
  sortableCol("assignedcheck", "Assigned check", "assigned_check", {
    headerStyle: "width: 30%",
  }),
  col("actions", "Actions", { align: "right", field: () => "" }),
];

const iconHeaders = [
  {
    name: "enabled",
    icon: "power_settings_new",
    tip: "Enabled: the task runs on its schedule or trigger",
  },
  {
    name: "smsalert",
    icon: "phone_android",
    tip: "SMS alert: send a text message when the task fails",
  },
  {
    name: "emailalert",
    icon: "email",
    tip: "Email alert: send an email when the task fails",
  },
  {
    name: "dashboardalert",
    icon: "notifications",
    tip: "Dashboard alert: raise an alert in the dashboard when the task fails",
  },
  {
    name: "sync_status",
    icon: "sync",
    tip: "Sync status: whether the agent has the current version of the task",
  },
  {
    name: "collector",
    icon: "mdi-database-arrow-up",
    tip: "Collector: the task saves its output to a custom field",
  },
];
const textHeaders = [
  { name: "policystatus", tip: "Set when a policy manages the task" },
  { name: "status", tip: "Result of the last run; failing tasks by severity" },
  { name: "actions" },
];

const alertCells = [
  { field: "text_alert", templateKey: "always_text", label: "SMS alert" },
  { field: "email_alert", templateKey: "always_email", label: "Email alert" },
  {
    field: "dashboard_alert",
    templateKey: "always_alert",
    label: "Dashboard alert",
  },
];

const SYNC_META = {
  notsynced: { icon: "sync", text: "Will sync on next agent checkin" },
  synced: { icon: "cloud_done", text: "Synced with agent" },
  pendingdeletion: { icon: "auto_delete", text: "Pending deletion on agent" },
};
const syncMeta = (row) =>
  SYNC_META[row.task_result.sync_status] || {
    icon: "hourglass_empty",
    text: "Waiting for task creation on agent",
  };

const $q = useQuasar();

// policy id to name, so a locked row can name the policy that manages it
const { policyNames, loadPolicyNames } = usePolicyNames();
const policyName = (id) => policyNames.value[id] || "policy";
const policyTooltip = (id) =>
  `This task is managed by policy: ${policyName(id)}`;
const lockedMeta = (row) => alertOverrideMeta(null, null, !!row.policy);
const showAutomationManager = () => $q.dialog({ component: AutomationManager });

const tasks = ref([]);
const pagination = ref({ rowsPerPage: 0, sortBy: "name", descending: false });

const {
  selectedAgent,
  tabHeight,
  agentPlatform,
  formatDate,
  loading,
  error,
  errorMessage,
  lastLoadedAt,
  load: getTasks,
} = useAgentTab({
  fetch: fetchAgentTasks,
  accept: (rows) =>
    (tasks.value = rows.filter((t) => t.sync_status !== "pendingdeletion")),
  clear: () => (tasks.value = []),
  forbidden: "Your role cannot view tasks for this agent.",
  failed: "Tasks could not be loaded.",
});

const hasOutput = (result) =>
  result.retcode !== null || result.stdout || result.stderr;

async function editTask(task, patch) {
  if (task.policy) return;
  loading.value = true;
  Object.assign(task, patch);
  try {
    notifySuccess(await updateTask(task.id, patch));
  } catch (e) {
    console.error(e);
  } finally {
    // reload so a rejected update puts the checkbox back
    await getTasks();
  }
}

function confirmAndRun(options, call, { reload = false } = {}) {
  $q.dialog({ cancel: true, persistent: true, ...options }).onOk(async () => {
    loading.value = true;
    try {
      const msg = await call();
      notifySuccess(msg);
      if (reload) getTasks();
    } catch (err) {
      console.error("task action failed", err);
    }
    loading.value = false;
  });
}

function deleteTask(task) {
  if (task.policy) return;
  confirmAndRun(
    {
      title: `Delete task ${task.name}?`,
      ok: { label: "Delete", color: "negative" },
    },
    () => removeTask(task.id),
    { reload: true },
  );
}

function runNow(task) {
  if (!task.enabled) {
    return notifyError(
      "Task cannot be run when it's disabled. Enable it first.",
    );
  }
  confirmAndRun(
    { title: "Are you sure?", message: `Run ${task.name} task` },
    () =>
      runTask(task.id, task.policy ? { agent_id: selectedAgent.value } : {}),
  );
}

function openForm(task) {
  $q.dialog({
    component: AutomatedTaskForm,
    componentProps: {
      task,
      parent: { agent: selectedAgent.value },
      plat: agentPlatform.value,
    },
  }).onOk(getTasks);
}
const addTask = () => openForm(undefined);
function editTaskDialog(task) {
  if (!task.policy) openForm(task);
}

const showOutput = (task) =>
  $q.dialog({
    component: ScriptOutput,
    componentProps: { scriptInfo: task.task_result },
  });

const menuProps = (row) => ({
  managed: !!row.policy,
  policyName: policyName(row.policy),
});
const menuHandlers = (row) => ({
  run: () => runNow(row),
  edit: () => editTaskDialog(row),
  policy: showAutomationManager,
  delete: () => deleteTask(row),
});

onMounted(loadPolicyNames);
</script>

<style scoped>
.tab-toolbar__primary {
  padding: 2px 10px;
}
</style>
