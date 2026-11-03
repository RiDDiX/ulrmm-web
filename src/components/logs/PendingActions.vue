<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-dialog
    ref="dialogRef"
    aria-labelledby="pending-actions-title"
    @hide="onDialogHide"
  >
    <q-card class="q-dialog-plugin" style="height: 70vh; min-width: 70vw">
      <DialogHeader
        title-id="pending-actions-title"
        :title="
          agent
            ? `Pending actions for ${deviceName(agent)}`
            : 'All pending actions'
        "
        subtitle="Work queued for agents that runs at the due time or the next check-in"
      >
        <template #actions>
          <q-btn
            dense
            flat
            icon="refresh"
            aria-label="Refresh pending actions"
            @click="reload"
          >
            <q-tooltip>Reload the pending actions</q-tooltip>
          </q-btn>
        </template>
      </DialogHeader>
      <q-table
        v-sortable-headers
        dense
        flat
        table-class="table-bgcolor"
        class="remote-bg-tbl-sticky rmm-table"
        style="max-height: 65vh"
        :rows="shownRows"
        :columns="COLUMNS"
        :visible-columns="visibleColumns"
        :loading="loading"
        v-bind="TABLE_ATTRS"
        :pagination="{ rowsPerPage: 0, sortBy: 'status', descending: false }"
      >
        <template #loading>
          <q-inner-loading showing color="primary" />
        </template>

        <template #no-data>
          <div v-if="!loading" class="full-width row flex-center q-gutter-sm">
            <template v-if="error">
              <q-icon name="error_outline" color="negative" size="24px" />
              <span>{{ error }}</span>
              <q-btn
                outline
                dense
                color="primary"
                label="Retry"
                @click="reload"
              />
            </template>
            <EmptyState
              v-else
              class="full-width"
              icon="pending_actions"
              title="No pending actions"
              text="Scheduled reboots, agent updates and software installs that wait for an agent show up here."
            />
          </div>
        </template>

        <template #top>
          <div class="rmm-toolbar full-width">
            <span class="rmm-muted rmm-num">
              {{ shownRows.length }} shown
            </span>
            <q-space />
            <q-btn
              dense
              flat
              no-caps
              :label="`${showCompleted ? 'Hide' : 'Show'} ${doneCount} completed`"
              :icon="showCompleted ? 'visibility_off' : 'visibility'"
              @click="showCompleted = !showCompleted"
            >
              <q-tooltip>{{
                showCompleted
                  ? "Show only actions that still wait"
                  : "Also list actions that already ran"
              }}</q-tooltip>
            </q-btn>
          </div>
        </template>

        <template #header-cell="props">
          <q-th :props="props">
            {{ props.col.label }}
            <q-tooltip v-if="HEADER_TIPS[props.col.name]">
              {{ HEADER_TIPS[props.col.name] }}
            </q-tooltip>
          </q-th>
        </template>

        <template #body="{ row }">
          <q-tr class="cursor-pointer">
            <q-menu context-menu auto-close>
              <q-list dense style="min-width: 220px">
                <PendingCancelItem :row="row" @click="confirmCancel(row)" />
                <q-separator />
                <q-item v-close-popup clickable>
                  <q-item-section>Close</q-item-section>
                </q-item>
              </q-list>
            </q-menu>
            <q-td>
              <q-icon
                :name="typeInfo(row).icon"
                size="sm"
                class="pending-type-icon"
              />
              <span class="sr-only">{{ typeInfo(row).label }}</span>
              <q-tooltip>{{ typeInfo(row).label }}</q-tooltip>
            </q-td>
            <q-td v-if="row.status !== 'completed'" class="rmm-num">
              {{ dueText(row) }}
            </q-td>
            <q-td v-else>
              <span class="rmm-pill rmm-pill--positive">Completed</span>
            </q-td>
            <q-td>{{ row.description }}</q-td>
            <template v-if="!agent">
              <q-td class="text-weight-medium">{{ row.hostname }}</q-td>
              <q-td>{{ row.client }}</q-td>
              <q-td>{{ row.site }}</q-td>
            </template>
            <q-td
              v-if="
                SOFTWARE_INSTALLS.includes(row.action_type) &&
                row.status === 'completed'
              "
            >
              <q-btn
                outline
                dense
                no-caps
                color="primary"
                icon="preview"
                size="sm"
                label="View output"
                @click="showOutput(row.details.output)"
              />
            </q-td>
            <q-td v-else></q-td>
            <q-td class="text-right" @click.stop>
              <RowActions :label="`Actions for ${row.description}`">
                <q-list dense style="min-width: 220px">
                  <PendingCancelItem :row="row" @click="confirmCancel(row)" />
                </q-list>
              </RowActions>
            </q-td>
          </q-tr>
        </template>
      </q-table>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { useStore } from "vuex";
import { useQuasar, useDialogPluginComponent } from "quasar";
import * as logsApi from "@/api/logs";
import { getNextAgentUpdateTime } from "@/utils/format";
import { notifySuccess as toastOk } from "@/utils/notify";
import { deviceName } from "@/utils/deviceName";
import { sortableHeaders as vSortableHeaders } from "@/utils/sortableHeaders";
import PreDialog from "@/components/ui/PreDialog.vue";
import RowActions from "@/components/ui/RowActions.vue";
import DialogHeader from "@/components/ui/DialogHeader.vue";
import EmptyState from "@/components/ui/EmptyState.vue";
import PendingCancelItem from "@/components/logs/PendingCancelItem.vue";

defineOptions({ name: "PendingActions" });
defineEmits([...useDialogPluginComponent.emits]);

const props = defineProps({ agent: Object });

const COLUMNS = [
  { name: "id", field: "id" },
  { name: "status", field: "status" },
  ...[
    ["type", "Type", "action_type"],
    ["due", "Due", "due"],
    ["desc", "Description", "description"],
    ["agent", "Agent", "hostname"],
    ["client", "Client", "client"],
    ["site", "Site", "site"],
  ].map(([name, label, field]) => ({
    name,
    label,
    field,
    align: "left",
    sortable: true,
  })),
  {
    name: "details",
    label: "Output",
    field: "details",
    align: "left",
    sortable: false,
  },
  { name: "actions", label: "Actions", align: "right", field: () => "" },
];

const TABLE_ATTRS = {
  virtualScroll: true,
  rowKey: "id",
  rowsPerPageOptions: [0],
};

const HEADER_TIPS = {
  type: "Kind of action; hover the icon for its name",
  due: "When it runs: a set time, the next update cycle or the next check-in",
  details: "Installer output, once a software install has finished",
};

const SOFTWARE_INSTALLS = ["chocoinstall", "wingetinstall"];

const TYPE_INFO = {
  schedreboot: { icon: "power_settings_new", label: "Scheduled reboot" },
  agentupdate: { icon: "update", label: "Agent update" },
  chocoinstall: { icon: "download", label: "Software install" },
  wingetinstall: { icon: "download", label: "Software install" },
  runcmd: { icon: "terminal", label: "Run command" },
  runscript: { icon: "code", label: "Run script" },
  runpatchscan: { icon: "manage_search", label: "Patch scan" },
  runpatchinstall: { icon: "system_update_alt", label: "Patch install" },
};

const { dialogRef, onDialogHide } = useDialogPluginComponent();
const $q = useQuasar();
const store = useStore();
const formatDate = (v) => store.getters.formatDate(v);

const items = ref([]);
const showCompleted = ref(false);
const loading = ref(false);
const error = ref("");

const isDone = (a) => a.status === "completed";
const doneCount = computed(() => {
  try {
    return items.value.filter(isDone).length;
  } catch (e) {
    console.error(e);
    return 0;
  }
});
const shownRows = computed(() =>
  showCompleted.value ? items.value : items.value.filter((a) => !isDone(a)),
);
const visibleColumns = computed(() => {
  const cols = ["type", "due", "desc"];
  if (!props.agent) cols.push("agent", "client", "site");
  return [...cols, "details", "actions"];
});

function typeInfo(a) {
  return (
    TYPE_INFO[a.action_type] || {
      icon: "pending_actions",
      label: a.description || a.action_type,
    }
  );
}

function dueText(a) {
  if (a.action_type === "agentupdate")
    return formatDate(getNextAgentUpdateTime());
  if (a.action_type === "schedreboot") return formatDate(a.due);
  return a.due;
}

function showOutput(message) {
  $q.dialog({
    component: PreDialog,
    componentProps: {
      title: "Pending action output",
      dialogStyle: "width: 75vw; max-width: 85vw; max-height: 65vh;",
      message,
    },
  });
}

async function reload() {
  loading.value = true;
  error.value = "";
  try {
    items.value = props.agent
      ? await logsApi.fetchAgentPendingActions(props.agent.agent_id)
      : await logsApi.fetchPendingActions();
  } catch (e) {
    console.error(e);
    error.value =
      e?.response?.status === 403
        ? "Your role cannot view pending actions."
        : "Pending actions could not be loaded.";
  }
  loading.value = false;
}

function confirmCancel(a) {
  $q.dialog({
    title: "Cancel pending action?",
    message: `${a.description} on ${a.hostname}, due ${dueText(a)}`,
    cancel: { label: "Keep" },
    persistent: true,
    ok: { label: "Cancel action", color: "negative" },
  }).onOk(async () => {
    loading.value = true;
    try {
      toastOk(await logsApi.deletePendingAction(a.id));
      await reload();
      store.dispatch("refreshDashboard");
    } catch (e) {
      console.error(e);
    }
    loading.value = false;
  });
}

onMounted(reload);
</script>

<style scoped>
.pending-type-icon {
  color: var(--rmm-text-subtle);
}
</style>
