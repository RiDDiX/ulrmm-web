<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <div class="row">
    <div class="col-12">
      <div v-if="!!selectedPolicy" class="row items-center q-gutter-sm q-pb-xs">
        <q-btn
          icon="add"
          label="Add Task"
          no-caps
          dense
          unelevated
          color="primary"
          class="q-px-sm"
          @click="openTaskForm()"
        />
        <q-btn
          dense
          flat
          no-caps
          label="Assign existing task"
          icon="link"
          @click="assignments()"
        />
        <q-btn
          dense
          flat
          @click="loadTasks"
          icon="refresh"
          aria-label="Refresh tasks"
        >
          <q-tooltip>Reload this policy's tasks</q-tooltip>
        </q-btn>
      </div>
      <q-table
        table-class="table-bgcolor"
        class="tabs-tbl-sticky rmm-table"
        v-bind="tableOpts"
        :rows="tasks"
        :columns="columns"
        v-model:pagination="pagination"
        v-sortable-headers
      >
        <template #no-data>
          <div class="full-width row flex-center q-gutter-sm">
            <span v-if="!selectedPolicy"
              >Click on a policy to see the tasks</span
            >
            <EmptyState
              v-else
              icon="fas fa-tasks"
              title="No tasks in this policy"
              text="Every agent under this policy gets the tasks you add here."
            >
              <q-btn
                unelevated
                no-caps
                color="primary"
                icon="add"
                label="Add Task"
                @click="openTaskForm()"
              />
            </EmptyState>
          </div>
        </template>
        <template
          v-for="(head, colName) in headerCells"
          :key="colName"
          #[`header-cell-${colName}`]="cell"
        >
          <q-th :props="cell" :auto-width="head.narrow">
            <span v-if="head.hidden" class="sr-only">{{ cell.col.label }}</span>
            <template v-else>
              {{ head.text || cell.col.label }}
              <q-tooltip>{{ head.tip }}</q-tooltip>
            </template>
          </q-th>
        </template>

        <template v-slot:body="cell">
          <q-tr class="cursor-pointer" @dblclick="openTaskForm(cell.row)">
            <q-menu context-menu>
              <q-list dense style="min-width: 200px">
                <template v-for="m in menuFor(cell.row)" :key="m.id">
                  <q-separator v-if="m.gap" />
                  <q-item
                    clickable
                    v-close-popup
                    :class="m.danger ? 'text-negative' : ''"
                    @click="m.run(cell.row)"
                  >
                    <q-item-section side>
                      <q-icon
                        :name="m.icon"
                        :color="m.danger ? 'negative' : ''"
                      />
                    </q-item-section>
                    <q-item-section v-if="m.hint">
                      <q-item-label>{{ m.label }}</q-item-label>
                      <q-item-label caption>{{ m.hint }}</q-item-label>
                    </q-item-section>
                    <q-item-section v-else>{{ m.label }}</q-item-section>
                  </q-item>
                </template>
                <q-separator />
                <q-item clickable v-close-popup>
                  <q-item-section>Close</q-item-section>
                </q-item>
              </q-list>
            </q-menu>
            <q-td v-for="f in toggleCols" :key="f.field">
              <q-checkbox
                dense
                :model-value="cell.row[f.field]"
                @update:model-value="
                  (on) => patchTask(cell.row, { [f.field]: on })
                "
                :aria-label="`${f.aria} for ${cell.row.name}`"
              />
            </q-td>
            <q-td>
              <q-icon
                v-if="!!cell.row.custom_field"
                size="1.3rem"
                name="check"
                class="rmm-muted"
              >
                <q-tooltip
                  >The task updates a custom field on the agent</q-tooltip
                >
              </q-icon>
              <span v-if="!!cell.row.custom_field" class="sr-only"
                >Collector task</span
              >
            </q-td>
            <q-td class="text-weight-medium">{{ cell.row.name }}</q-td>
            <q-td class="rmm-muted">{{ cell.row.schedule }}</q-td>
            <q-td>
              <a
                href="#"
                role="button"
                class="rmm-link status-cell"
                @click.prevent="openStatus(cell.row)"
                @keydown.space.prevent="openStatus(cell.row)"
                >See Status</a
              >
            </q-td>
            <q-td>{{ cell.row.check_name }}</q-td>
            <!-- mirrors the context menu -->
            <q-td @click.stop>
              <RowActions :label="`Actions for ${cell.row.name}`">
                <q-list dense style="min-width: 200px">
                  <template v-for="m in menuFor(cell.row)" :key="m.id">
                    <q-separator v-if="m.gap" />
                    <q-item
                      clickable
                      v-close-popup
                      :class="m.danger ? 'text-negative' : ''"
                      @click="m.run(cell.row)"
                    >
                      <q-item-section side>
                        <q-icon
                          :name="m.icon"
                          :color="m.danger ? 'negative' : ''"
                        />
                      </q-item-section>
                      <q-item-section v-if="m.hint">
                        <q-item-label>{{ m.label }}</q-item-label>
                        <q-item-label caption>{{ m.hint }}</q-item-label>
                      </q-item-section>
                      <q-item-section v-else>{{ m.label }}</q-item-section>
                    </q-item>
                  </template>
                </q-list>
              </RowActions>
            </q-td>
          </q-tr>
        </template>
      </q-table>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from "vue";
import { useStore } from "vuex";
import { useQuasar } from "quasar";
import axios from "axios";
import AutomatedTaskForm from "@/components/tasks/AutomatedTaskForm.vue";
import TaskAssignments from "@/components/tasks/TaskAssignments.vue";
import { deleteTaskConfirmText } from "@/components/tasks/deleteTask";
import PolicyStatus from "@/components/automation/modals/PolicyStatus.vue";
import RowActions from "@/components/ui/RowActions.vue";
import EmptyState from "@/components/ui/EmptyState.vue";
import { sortableHeaders as vSortableHeaders } from "@/utils/sortableHeaders";
import { notifySuccess, notifyError } from "@/utils/notify";

const props = defineProps({ selectedPolicy: Number });
const $q = useQuasar();
const store = useStore();

const tableOpts = {
  dense: true,
  rowKey: "id",
  virtualScroll: true,
  hidePagination: true,
  binaryStateSort: true,
  rowsPerPageOptions: [0],
};
const deleteBtn = { label: "Delete", color: "negative" };
const tasks = ref([]);
const pagination = ref({ rowsPerPage: 0, sortBy: "name", descending: false });

// a flag the session has not loaded counts as allowed; the server enforces it
const mayRun = computed(() => store.state.can_run_autotasks !== false);

const col = (name, label, field, sortable) => ({
  name,
  label,
  field,
  align: "left",
  sortable,
});
const columns = [
  col("enabled", undefined, "enabled"),
  col("smsalert", "SMS alert", "text_alert"),
  col("emailalert", "Email alert", "email_alert"),
  col("dashboardalert", "Dashboard alert", "dashboard_alert"),
  col("collector", "Collector", "custom_field", true),
  col("name", "Name", "name", true),
  col("schedule", "Schedule", "schedule", true),
  col("status", "More Info", "more_info", true),
  col("check_name", "Assigned Check", "check_name", true),
  { name: "actions", label: "Actions", align: "right", field: () => "" },
];

// body cells 1-4, same order as the columns
const toggleCols = [
  { field: "enabled", aria: "Enabled" },
  { field: "text_alert", aria: "SMS alert" },
  { field: "email_alert", aria: "Email alert" },
  { field: "dashboard_alert", aria: "Dashboard alert" },
];

const headerCells = {
  enabled: {
    text: "Enabled",
    narrow: true,
    tip: "Disabled tasks stay in the policy but do not run",
  },
  smsalert: {
    text: "SMS",
    narrow: true,
    tip: "Send an SMS when the task fails",
  },
  emailalert: {
    text: "Email",
    narrow: true,
    tip: "Send an email when the task fails",
  },
  dashboardalert: {
    text: "Dashboard",
    narrow: true,
    tip: "Show an alert in the dashboard when the task fails",
  },
  collector: {
    narrow: true,
    tip: "Collector tasks save their output to a custom field",
  },
  status: { tip: "Result of this task on each agent under the policy" },
  check_name: { tip: "The task runs when this check fails" },
  actions: { narrow: true, hidden: true },
};

let taskLoad = 0;
async function loadTasks() {
  const generation = ++taskLoad;
  const policyId = props.selectedPolicy;
  if (!policyId) return;
  $q.loading.show();
  try {
    const { data } = await axios.get(`/automation/policies/${policyId}/tasks/`);
    if (generation === taskLoad) tasks.value = data;
  } catch {
    // reported by the axios boot
  } finally {
    $q.loading.hide();
  }
}

function patchTask(task, body) {
  $q.dialog({
    title: `Update task ${task.name}?`,
    message: "This changes the task wherever it is assigned.",
    cancel: true,
  }).onOk(async () => {
    try {
      const { data } = await axios.put(`/tasks/${task.id}/`, body);
      notifySuccess(data);
      loadTasks();
    } catch {
      // reported by the axios boot
    }
  });
}

function assignments(task) {
  $q.dialog({
    component: TaskAssignments,
    componentProps: { taskId: task?.id, policyId: props.selectedPolicy },
  }).onOk(loadTasks);
}

function openTaskForm(task) {
  $q.dialog({
    component: AutomatedTaskForm,
    componentProps: {
      ...(task ? { task } : {}),
      parent: { policy: props.selectedPolicy },
    },
  }).onOk(loadTasks);
}

function openStatus(task) {
  $q.dialog({
    component: PolicyStatus,
    componentProps: {
      type: "task",
      item: task,
      policyId: props.selectedPolicy,
    },
  });
}

function runNow(task) {
  if (task.enabled) {
    const policyId = props.selectedPolicy;
    $q.dialog({
      title: "Are you sure?",
      message: `Run ${task.name} task`,
      persistent: true,
      cancel: true,
    }).onOk(() => confirmRun(task, policyId));
  } else {
    notifyError("Task cannot be run when it's disabled. Enable it first.");
  }
}

async function confirmRun(task, policyId) {
  $q.loading.show();
  try {
    await axios.post(`/automation/tasks/${task.id}/run/`, {
      policy: policyId,
    });
    $q.loading.hide();
    notifySuccess("The task was initiated on all affected agents");
  } catch {
    $q.loading.hide();
  }
}

async function removeTask(task) {
  $q.dialog({
    title: `Delete task ${task.name}?`,
    message: await deleteTaskConfirmText(task.id),
    ok: deleteBtn,
    cancel: true,
    persistent: true,
  }).onOk(async () => {
    $q.loading.show();
    try {
      await axios.delete(`/tasks/${task.id}/`);
      loadTasks();
      $q.loading.hide();
      notifySuccess("Task was deleted successfully");
    } catch {
      $q.loading.hide();
    }
  });
}

const rowMenu = [
  {
    id: "run",
    icon: "play_arrow",
    label: "Run task now",
    hint: "Starts it on every agent under the policy",
    run: runNow,
  },
  {
    id: "assignments",
    icon: "link",
    label: "Policy assignment",
    run: assignments,
  },
  {
    id: "edit",
    icon: "edit",
    label: "Edit task definition",
    run: openTaskForm,
  },
  {
    id: "status",
    icon: "sync",
    label: "Policy Status",
    hint: "Result on each agent",
    run: openStatus,
  },
  {
    id: "delete",
    icon: "delete",
    label: "Delete",
    danger: true,
    gap: true,
    run: removeTask,
  },
];

const menuFor = () => (mayRun.value ? rowMenu : rowMenu.slice(1));

watch(
  () => props.selectedPolicy,
  (now, before) => {
    if (now !== before) {
      tasks.value = [];
      loadTasks();
    }
  },
);
onMounted(loadTasks);
</script>
