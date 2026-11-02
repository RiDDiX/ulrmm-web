<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<script setup>
import { ref, computed, onMounted } from "vue";
import { useStore } from "vuex";
import { useQuasar, useDialogPluginComponent } from "quasar";
import axios from "axios";
import ScriptOutput from "../../checks/ScriptOutput.vue";
import EventLogCheckOutput from "@/components/checks/EventLogCheckOutput.vue";
import PreDialog from "../../ui/PreDialog.vue";
import DialogHeader from "@/components/ui/DialogHeader.vue";
import EmptyState from "@/components/ui/EmptyState.vue";

const props = defineProps({
  item: { required: true, type: Object },
  type: {
    required: true,
    type: String,
    validator: (value) => ["task", "check"].includes(value),
  },
});
defineEmits(useDialogPluginComponent.emits);
const $q = useQuasar();
const store = useStore();
const pagination = ref({ rowsPerPage: 0, sortBy: "status", descending: false });
const formatDate = computed(() => store.getters.formatDate);
const { dialogRef, onDialogHide } = useDialogPluginComponent();

const tableOpts = {
  dense: true,
  rowKey: "id",
  virtualScroll: true,
  hidePagination: true,
  binaryStateSort: true,
  rowsPerPageOptions: [0],
};

const rows = ref([]);

const sortCol = (name, label, field) => ({
  name,
  label,
  field,
  align: "left",
  sortable: true,
});
const columns = [
  sortCol("agent", "Hostname", "agent"),
  { name: "statusicon", align: "left" },
  sortCol("status", "Status", "status"),
  sortCol("moreinfo", "More Info", "more_info"),
  sortCol("datetime", "Date / Time", "last_run"),
];

const headerTips = {
  statusicon: "Passing, or the alert severity when it failed",
  status: "Whether the agent has picked up the latest version of the policy",
  moreinfo: "Latest output; open it for the full text",
  datetime: "When it last ran on the agent",
};

const heading = computed(
  () => (props.item.readable_desc || props.item.name) + " Status",
);

function severityOf(row) {
  const s = store.state;
  if (row.alert_severity === "info")
    return { icon: "info", color: s.dash_info_color, text: "Informational" };
  if (row.alert_severity === "warning")
    return { icon: "warning", color: s.dash_warning_color, text: "Warning" };
  return { icon: "error", color: s.dash_negative_color, text: "Error" };
}

const SYNC_TEXT = {
  notsynced: "Will sync on next agent checkin",
  synced: "Synced with agent",
  pendingdeletion: "Pending deletion on agent",
  initial: "Waiting for task creation on agent",
};
const syncText = (row) =>
  row.status === "pending"
    ? "Awaiting First Synchronization"
    : SYNC_TEXT[row.sync_status] || "";

function openPing(row) {
  $q.dialog({
    component: PreDialog,
    componentProps: {
      title: row.readable_desc,
      dialogStyle: "width: 50vw; max-width: 60vw",
      message: row.more_info,
    },
  });
}
const openEventLog = (row) =>
  $q.dialog({
    component: EventLogCheckOutput,
    componentProps: { evtLogData: row },
  });
const openScript = (row) =>
  $q.dialog({ component: ScriptOutput, componentProps: { scriptInfo: row } });

// an agent the policy applies to that has no result yet
const notRun = (row) => row.status === "pending" && !row.last_run;

function outputOpener(row) {
  if (notRun(row)) return null;
  if (row.check_type === "ping") return { css: "ping-cell", open: openPing };
  if (row.check_type === "script" || row.retcode || row.stdout || row.stderr)
    return { css: "script-cell", open: openScript };
  if (row.check_type === "eventlog")
    return { css: "eventlog-cell", open: openEventLog };
  return null;
}

function infoText(row) {
  if (notRun(row)) return null;
  if (row.check_type === "cpuload" || row.check_type === "memory")
    return row.history_info ?? "";
  return row.more_info || null;
}

async function load() {
  $q.loading.show();
  try {
    const { data } = await axios.get(
      `/automation/${props.type}s/${props.item.id}/status/`,
    );
    rows.value = data;
  } catch {
    // reported by the axios boot
  }
  $q.loading.hide();
}

onMounted(load);
</script>

<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide">
    <q-card class="q-dialog-plugin" style="min-width: 70vw">
      <DialogHeader
        :title="heading"
        :subtitle="`Result of this policy ${type} on each agent it applies to`"
      >
        <template v-slot:actions>
          <q-btn
            @click="load"
            class="q-mr-sm"
            dense
            flat
            icon="refresh"
            aria-label="Refresh status"
          >
            <q-tooltip>Reload the results</q-tooltip>
          </q-btn>
        </template>
      </DialogHeader>
      <q-card-section>
        <q-table
          style="max-height: 35vh"
          table-class="table-bgcolor"
          class="tabs-tbl-sticky rmm-table"
          v-bind="tableOpts"
          v-model:pagination="pagination"
          no-data-label="There are no agents in this policy"
          :columns="columns"
          :rows="rows"
        >
          <template v-slot:no-data>
            <EmptyState
              class="full-width"
              icon="devices_other"
              title="No agents in this policy"
              text="Assign the policy to a client, site or agent and their results show up here."
            />
          </template>
          <template
            v-for="(tip, col) in headerTips"
            :key="col"
            #[`header-cell-${col}`]="cell"
          >
            <q-th :props="cell" :auto-width="col === 'statusicon'">
              {{ col === "statusicon" ? "Result" : cell.col.label }}
              <q-tooltip>{{ tip }}</q-tooltip>
            </q-th>
          </template>
          <template v-slot:body="cell">
            <q-tr :props="cell">
              <q-td class="text-weight-medium">{{ cell.row.hostname }}</q-td>
              <q-td v-if="cell.row.status === 'passing'">
                <q-icon
                  size="1.3rem"
                  :color="store.state.dash_positive_color"
                  name="check_circle"
                >
                  <q-tooltip>Passing</q-tooltip>
                </q-icon>
                <span class="sr-only">Passing</span>
              </q-td>
              <q-td v-else-if="cell.row.status === 'failing'">
                <q-icon
                  size="1.3rem"
                  :color="severityOf(cell.row).color"
                  :name="severityOf(cell.row).icon"
                >
                  <q-tooltip>{{ severityOf(cell.row).text }}</q-tooltip>
                </q-icon>
                <span class="sr-only">{{ severityOf(cell.row).text }}</span>
              </q-td>
              <q-td v-else></q-td>
              <q-td>{{ syncText(cell.row) }}</q-td>
              <q-td v-if="outputOpener(cell.row)">
                <a
                  href="#"
                  role="button"
                  :class="`rmm-link ${outputOpener(cell.row).css}`"
                  @click.prevent="outputOpener(cell.row).open(cell.row)"
                  @keydown.space.prevent="outputOpener(cell.row).open(cell.row)"
                  >output</a
                >
              </q-td>
              <q-td v-else-if="infoText(cell.row) !== null">{{
                infoText(cell.row)
              }}</q-td>
              <q-td v-else class="rmm-muted">Awaiting Output</q-td>
              <q-td>{{
                cell.row.last_run ? formatDate(cell.row.last_run) : "Never"
              }}</q-td>
            </q-tr>
          </template>
        </q-table>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>
