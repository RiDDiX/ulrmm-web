<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <div class="row">
    <div class="col-12">
      <div v-if="!!selectedPolicy" class="row items-center q-gutter-sm q-pb-xs">
        <q-btn-dropdown
          icon="add"
          label="Add check"
          no-caps
          dense
          unelevated
          color="primary"
          class="q-px-sm"
        >
          <q-list dense style="min-width: 260px">
            <q-item
              v-for="kind in checkKinds"
              :key="kind.type"
              clickable
              v-close-popup
              @click="openCheckForm(kind.type)"
            >
              <q-item-section side>
                <q-icon size="xs" :name="kind.icon" />
              </q-item-section>
              <q-item-section>
                <q-item-label>{{ kind.label }}</q-item-label>
                <q-item-label caption>{{ kind.hint }}</q-item-label>
              </q-item-section>
            </q-item>
          </q-list>
        </q-btn-dropdown>
        <q-btn
          dense
          flat
          @click="loadChecks"
          icon="refresh"
          aria-label="Refresh checks"
        >
          <q-tooltip>Reload this policy's checks</q-tooltip>
        </q-btn>
      </div>

      <q-table
        table-class="table-bgcolor"
        class="tabs-tbl-sticky rmm-table"
        v-bind="tableOpts"
        :rows="checks"
        :columns="columns"
        v-model:pagination="pagination"
        :loading="busy"
        v-sortable-headers
      >
        <template v-slot:loading>
          <q-inner-loading showing color="primary" />
        </template>

        <template v-slot:no-data>
          <div v-if="!busy" class="full-width row flex-center q-gutter-sm">
            <span v-if="!selectedPolicy"
              >Click on a policy to see the checks</span
            >
            <template v-else-if="loadError">
              <q-icon name="error_outline" color="negative" size="24px" />
              <span>{{ loadError }}</span>
              <q-btn
                outline
                dense
                color="primary"
                label="Retry"
                @click="loadChecks"
              />
            </template>
            <EmptyState
              v-else
              icon="fas fa-check-double"
              title="No checks in this policy"
              text="Pick a check type from Add check above; every agent under this policy then runs it."
            />
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
          <q-tr
            :props="cell"
            class="cursor-pointer"
            @dblclick="openCheckForm(cell.row.check_type, cell.row)"
          >
            <q-menu context-menu>
              <q-list dense style="min-width: 200px">
                <template v-for="m in rowMenu" :key="m.id">
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
            <q-td v-for="a in alertCols" :key="a.field">
              <q-checkbox
                dense
                v-model="cell.row[a.field]"
                @update:model-value="(on) => setAlert(cell.row, a, on)"
                :aria-label="`${a.aria} alert for ${cell.row.readable_desc}`"
              />
            </q-td>
            <q-td>{{ cell.row.readable_desc }}</q-td>
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
            <q-td>{{ taskSummary(cell.row.assignedtasks) }}</q-td>
            <!-- mirrors the context menu -->
            <q-td @click.stop>
              <RowActions :label="`Actions for ${cell.row.readable_desc}`">
                <q-list dense style="min-width: 200px">
                  <template v-for="m in rowMenu" :key="m.id">
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
import axios from "axios";
import { useQuasar } from "quasar";
import { ref, watch, onMounted } from "vue";
import RowActions from "@/components/ui/RowActions.vue";
import EmptyState from "@/components/ui/EmptyState.vue";
import MemCheck from "@/components/checks/MemCheck.vue";
import PingCheck from "@/components/checks/PingCheck.vue";
import HealthCheck from "@/components/checks/HealthCheck.vue";
import ScriptCheck from "../checks/ScriptCheck.vue";
import WinSvcCheck from "@/components/checks/WinSvcCheck.vue";
import CpuLoadCheck from "../checks/CpuLoadCheck.vue";
import EventLogCheck from "@/components/checks/EventLogCheck.vue";
import DiskSpaceCheck from "@/components/checks/DiskSpaceCheck.vue";
import SystemdCheck from "@/components/checks/SystemdCheck.vue";
import ContainerCheck from "@/components/checks/ContainerCheck.vue";
import MetricCheck from "@/components/checks/MetricCheck.vue";
import PolicyStatus from "@/components/automation/modals/PolicyStatus.vue";
import { sortableHeaders as vSortableHeaders } from "@/utils/sortableHeaders";
import { notifySuccess, notifyWarning } from "@/utils/notify";

const props = defineProps({ selectedPolicy: Number });
const $q = useQuasar();

const tableOpts = {
  dense: true,
  rowKey: "id",
  virtualScroll: true,
  hidePagination: true,
  binaryStateSort: true,
  rowsPerPageOptions: [0],
};

const checks = ref([]);
const busy = ref(false);
const loadError = ref("");
const pagination = ref({ rowsPerPage: 0, sortBy: "status", descending: true });

const checkKinds = [
  {
    type: "diskspace",
    icon: "far fa-hdd",
    label: "Disk space check",
    hint: "Free space on a drive or mount point",
  },
  {
    type: "ping",
    icon: "fas fa-network-wired",
    label: "Ping check",
    hint: "Whether the agent can reach a host",
  },
  {
    type: "cpuload",
    icon: "fas fa-microchip",
    label: "CPU load check",
    hint: "Average processor use",
  },
  {
    type: "memory",
    icon: "fas fa-memory",
    label: "Memory check",
    hint: "Memory use",
  },
  {
    type: "winsvc",
    icon: "fas fa-cogs",
    label: "Windows service check",
    hint: "Windows only: a service is running",
  },
  {
    type: "script",
    icon: "fas fa-terminal",
    label: "Script check",
    hint: "Status from a script's exit code",
  },
  {
    type: "eventlog",
    icon: "fas fa-clipboard-list",
    label: "Event log check",
    hint: "Windows only: matching event log entries",
  },
  {
    type: "security",
    icon: "fas fa-shield-alt",
    label: "Security check",
    hint: "Antivirus and firewall state",
  },
  {
    type: "hwhealth",
    icon: "fas fa-heartbeat",
    label: "Hardware health check",
    hint: "Disk health, temperatures, battery wear",
  },
  {
    type: "systemd",
    icon: "fas fa-server",
    label: "Service check",
    hint: "Linux and FreeBSD: a systemd unit or rc.d service is running",
  },
  {
    type: "container",
    icon: "fas fa-cubes",
    label: "Container check",
    hint: "A container or virtual machine is running",
  },
  {
    type: "metric",
    icon: "fas fa-chart-line",
    label: "Metric threshold check",
    hint: "A reported metric stays within thresholds",
  },
];

const formByType = {
  diskspace: DiskSpaceCheck, // also the default form
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

// kind is the wording used in the notification
const alertCols = [
  { field: "text_alert", kind: "Text", aria: "SMS" },
  { field: "email_alert", kind: "Email", aria: "Email" },
  { field: "dashboard_alert", kind: "Dashboard", aria: "Dashboard" },
];

const col = (name, label, field, sortable) => ({
  name,
  label,
  field,
  align: "left",
  sortable,
});
const columns = [
  col("smsalert", undefined, "text_alert"),
  col("emailalert", undefined, "email_alert"),
  col("dashboardalert", undefined, "dashboard_alert"),
  col("desc", "Description", "readable_desc", true),
  col("status", "Status", "status"),
  col("assigned_task", "Assigned Tasks", "assigned_task", true),
  { name: "actions", label: "Actions", align: "right", field: () => "" },
];

const headerCells = {
  smsalert: {
    text: "SMS",
    narrow: true,
    tip: "Send an SMS when the check fails",
  },
  emailalert: {
    text: "Email",
    narrow: true,
    tip: "Send an email when the check fails",
  },
  dashboardalert: {
    text: "Dashboard",
    narrow: true,
    tip: "Show an alert in the dashboard when the check fails",
  },
  status: { tip: "Result of this check on each agent under the policy" },
  assigned_task: { tip: "Policy tasks that run when this check fails" },
  actions: { narrow: true, hidden: true },
};

function taskSummary(tasks) {
  if (tasks.length > 1) return `${tasks.length} Tasks`;
  return tasks.length === 1 ? tasks[0].name : "";
}

async function loadChecks() {
  busy.value = true;
  loadError.value = "";
  try {
    const { data } = await axios.get(
      `/automation/policies/${props.selectedPolicy}/checks/`,
    );
    checks.value = data;
  } catch (err) {
    loadError.value =
      err?.response?.status === 403
        ? "Your role cannot view the checks of this policy."
        : "Checks could not be loaded.";
  } finally {
    busy.value = false;
  }
}

// `on` is the value the checkbox just took
async function setAlert(row, alertCol, on) {
  $q.loading.show();
  try {
    await axios.put(`/checks/${row.id}/`, { [alertCol.field]: on });
    $q.loading.hide();
    const message = `${alertCol.kind} alerts ${on ? "enabled" : "disabled"}`;
    if (on) notifySuccess(message);
    else notifyWarning(message);
  } catch {
    // the checkbox flipped already; show what the server still has
    row[alertCol.field] = !on;
    $q.loading.hide();
  }
}

function removeCheck(check) {
  $q.dialog({
    title: `Delete ${check.check_type} check?`,
    cancel: true,
    ok: { label: "Delete", color: "negative" },
  }).onOk(() => confirmRemove(check));
}

async function confirmRemove(check) {
  $q.loading.show();
  try {
    await axios.delete(`/checks/${check.id}/`);
    loadChecks();
    $q.loading.hide();
    notifySuccess("Check Deleted!");
  } catch {
    $q.loading.hide();
  }
}

function openStatus(check) {
  $q.dialog({
    component: PolicyStatus,
    componentProps: { type: "check", item: check },
  });
}

function openCheckForm(type, check) {
  const component = formByType[type];
  if (!component) return;
  $q.dialog({
    component,
    componentProps: {
      check,
      parent: !check ? { policy: props.selectedPolicy } : undefined,
      checkType: component === HealthCheck ? type : undefined,
    },
  }).onOk(loadChecks);
}

const rowMenu = [
  {
    id: "edit",
    icon: "edit",
    label: "Edit",
    run: (row) => openCheckForm(row.check_type, row),
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
    run: removeCheck,
  },
];

watch(
  () => props.selectedPolicy,
  (now, before) => {
    if (now !== before) loadChecks();
  },
);
onMounted(loadChecks);
</script>
