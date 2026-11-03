<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-dialog ref="dialogRef" v-bind="DIALOG_PROPS" @hide="onDialogHide">
    <q-card>
      <DialogHeader
        title="Alerts Overview"
        subtitle="Find alerts across all agents, then snooze or resolve them"
      >
        <template #actions>
          <q-btn
            class="q-mr-sm"
            flat
            dense
            icon="refresh"
            aria-label="Refresh alerts"
            @click="load"
          >
            <q-tooltip
              >Load the alerts again with the current filters</q-tooltip
            >
          </q-btn>
        </template>
      </DialogHeader>

      <!-- server side: what gets loaded -->
      <div class="rmm-label q-px-sm q-pt-sm">Load alerts</div>
      <div class="row items-start">
        <div
          v-for="pick in loadPickers"
          :key="pick.key"
          class="q-pa-sm"
          :class="pick.width"
        >
          <q-select v-model="query[pick.key]" v-bind="pick.attrs" />
        </div>
        <div class="q-pa-sm col-2">
          <q-checkbox
            v-for="extra in EXTRAS"
            :key="extra.key"
            v-model="query[extra.key]"
            :label="extra.label"
            outlined
            dense
          >
            <q-tooltip>{{ extra.tip }}</q-tooltip>
          </q-checkbox>
        </div>
        <div class="q-pa-sm col-2">
          <q-btn color="primary" unelevated label="Search" @click="load">
            <q-tooltip
              >Load alerts from the server with these filters</q-tooltip
            >
          </q-btn>
        </div>
      </div>

      <!-- client side: narrows what is already loaded -->
      <div class="rmm-label q-px-sm q-pt-sm">Narrow loaded alerts</div>
      <div class="row items-center">
        <div class="q-pa-sm col-4">
          <q-input
            v-model="narrow.text"
            outlined
            dense
            clearable
            label="Search"
            aria-label="Search loaded alerts by hostname, site, client, message or type"
            placeholder="Hostname, site, client, message or type"
          >
            <template #prepend
              ><q-icon name="search" class="rmm-muted"
            /></template>
          </q-input>
        </div>
        <div class="q-pa-sm col-3">
          <q-select
            v-model="narrow.types"
            :options="TYPES"
            label="Type"
            v-bind="CHIPS"
          />
        </div>
        <div class="col-5 text-caption rmm-muted q-px-sm">
          Search and Type only narrow the alerts already loaded above; use
          Clients, Severity and Time, then Search, to change what is loaded.
        </div>
      </div>

      <q-separator />

      <q-card-section>
        <q-table
          v-model:pagination="pager"
          v-model:selected="picked"
          v-bind="TABLE_PROPS"
          :rows="loaded"
          :columns="COLUMNS"
          :visible-columns="shownColumns"
          :no-data-label="emptyLabel"
          :filter="narrowKey"
          :filter-method="narrowRows"
          class="audit-mgr-tbl-sticky rmm-table"
          table-class="table-bgcolor"
        >
          <!-- an empty search is not a warning -->
          <template #no-data="{ message }">
            <div class="full-width text-center rmm-muted q-py-lg">
              {{ message }}
            </div>
          </template>
          <template #top>
            <div class="rmm-toolbar full-width">
              <span class="q-table__title">Alerts</span>
              <span class="rmm-muted rmm-num">{{ countText }}</span>

              <AlertsBulkMenu
                :actions="bulkActions"
                :selected="picked"
                :resolved-loaded="query.resolved"
              />
            </div>
          </template>

          <template #body-cell-hostname="cell">
            <q-td :props="cell">
              <a
                v-if="cell.row.agent_id"
                href="#"
                role="button"
                class="rmm-link"
                @click.prevent="openAgentWindow(cell.row.agent_id)"
                @keydown.space.prevent="openAgentWindow(cell.row.agent_id)"
                >{{ cell.value }}</a
              >
              <span v-else>{{ cell.value }}</span>
            </q-td>
          </template>

          <template #body-cell-severity="cell">
            <q-td :props="cell">
              <span
                class="rmm-pill severity-pill"
                :class="`rmm-pill--${look(cell.row).pill}`"
                ><span
                  class="severity-pill__dot"
                  :class="`bg-${look(cell.row).dot}`"
                  aria-hidden="true"
                />{{ capitalize(cell.row.severity) }}
                <q-tooltip>{{ look(cell.row).tip }}</q-tooltip>
              </span>
            </q-td>
          </template>

          <template #body-cell-actions="cell">
            <q-td :props="cell" class="alert-actions">
              <template v-for="act in rowActions" :key="act.icon">
                <q-btn
                  v-if="act.when(cell.row)"
                  flat
                  round
                  dense
                  size="sm"
                  :icon="act.icon"
                  :aria-label="act.label"
                  @click="act.run(cell.row)"
                >
                  <q-tooltip>{{ act.tip }}</q-tooltip>
                </q-btn>
              </template>
            </q-td>
          </template>
        </q-table>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from "vue";
import axios from "axios";
import { useStore } from "vuex";
import { useDialogPluginComponent, useQuasar } from "quasar";
import { openAgentWindow } from "@/api/agents";
import { capitalize } from "@/utils/format";
import DialogHeader from "@/components/ui/DialogHeader.vue";
import AlertsBulkMenu from "@/components/modals/alerts/AlertsBulkMenu.vue";
import { useAlertActions } from "@/components/modals/alerts/useAlertActions";

const props = defineProps({
  // preset from the fleet overview's severity chips; the default
  // filters (unresolved, not snoozed, 30 days) still apply
  initialSeverityFilter: { type: Array, default: () => [] },
});
defineEmits([...useDialogPluginComponent.emits]);

const DIALOG_PROPS = {
  maximized: true,
  transitionShow: "slide-up",
  transitionHide: "slide-down",
};

const TABLE_PROPS = {
  dense: true,
  rowKey: "id",
  selection: "multiple",
  virtualScroll: true,
  binaryStateSort: true,
  rowsPerPageOptions: [25, 50, 100, 500, 1000],
};

// multi-select with chips, shared by Clients, Severity and Type
const CHIPS = {
  outlined: true,
  dense: true,
  multiple: true,
  useChips: true,
  emitValue: true,
  mapOptions: true,
};

const toOptions = (labels) =>
  Object.entries(labels).map(([value, label]) => ({ value, label }));

const SEVERITIES = toOptions({
  info: "Informational",
  warning: "Warning",
  error: "Error",
});
const TYPES = [
  "availability",
  "check",
  "task",
  "custom",
  "network",
  "agent",
].map((value) => ({ value, label: capitalize(value) }));
const PERIODS = [
  [1, "1 Day Ago"],
  [7, "1 Week Ago"],
  [30, "30 Days Ago"],
  [90, "3 Months Ago"],
  [180, "6 Months Ago"],
  [365, "1 Year Ago"],
  [0, "Everything"],
].map(([value, label]) => ({ value, label }));

const EXTRAS = [
  {
    key: "snoozed",
    label: "Include snoozed",
    tip: "Also load alerts that are snoozed right now",
  },
  {
    key: "resolved",
    label: "Include resolved",
    tip: "Also load resolved alerts; bulk actions are off while this is on",
  },
];

// pill colour and tooltip per severity; anything unknown reads as info
const SEVERITY_LOOK = {
  error: {
    pill: "negative",
    tip: "Error: something failed and needs attention",
  },
  warning: { pill: "warning", tip: "Warning: worth a look soon" },
  info: { pill: "info", tip: "Informational: no action needed" },
};
const SEVERITY_ORDER = ["error", "warning", "info"];
const severityRank = (severity) => {
  const at = SEVERITY_ORDER.indexOf(severity);
  return at < 0 ? SEVERITY_ORDER.length : at;
};

const $q = useQuasar();
const vuex = useStore();
const { dialogRef, onDialogHide } = useDialogPluginComponent();
const formatDate = (val) => vuex.getters.formatDate(val);

const column = (name, label, extra) =>
  Object.assign(
    { name, label, field: name, align: "left", sortable: true },
    extra,
  );
const ACTIONS_COLUMN = { name: "actions", label: "Actions", align: "left" };
const COLUMNS = [
  column("alert_time", "Time", { format: formatDate }),
  column("client", "Client"),
  column("site", "Site"),
  column("hostname", "Agent"),
  column("alert_type", "Type", { format: (type) => capitalize(type) }),
  column("severity", "Severity", {
    sort: (a, b) => severityRank(a) - severityRank(b),
  }),
  column("message", "Message"),
  column("resolved_on", "Resolved On", { format: formatDate }),
  column("snoozed_until", "Snoozed Until", {
    field: "snooze_until",
    format: formatDate,
  }),
  ACTIONS_COLUMN,
];

const query = reactive({
  clients: [],
  severities: [...props.initialSeverityFilter],
  days: 30,
  snoozed: false,
  resolved: false,
});
const narrow = reactive({ text: "", types: [] });
const loaded = ref([]);
const picked = ref([]);
const clientChoices = ref([]);
const ran = ref(false);
const pager = ref({ rowsPerPage: 50, sortBy: "alert_time", descending: true });

const loadPickers = computed(() => [
  {
    key: "clients",
    width: "col-3",
    attrs: {
      ...CHIPS,
      options: clientChoices.value,
      label: "Clients",
      hint: "Empty loads every client",
    },
  },
  {
    key: "severities",
    width: "col-3",
    attrs: {
      ...CHIPS,
      options: SEVERITIES,
      label: "Severity",
      hint: "Empty loads every severity",
    },
  },
  {
    key: "days",
    width: "col-2",
    attrs: {
      options: PERIODS,
      label: "Time",
      hint: "Alerts raised within this period",
      outlined: true,
      dense: true,
      emitValue: true,
      mapOptions: true,
    },
  },
]);

// Snoozed Until and Resolved On only show when those alerts are loaded
const shownColumns = computed(() =>
  COLUMNS.map((col) => col.name).filter(
    (name) =>
      (name !== "snoozed_until" || query.snoozed) &&
      (name !== "resolved_on" || query.resolved),
  ),
);

const emptyLabel = computed(() =>
  ran.value
    ? "No data found. Try to refine your search"
    : "Click search to find alerts",
);

const countText = computed(() => {
  const count = `${loaded.value.length} loaded`;
  return picked.value.length
    ? `${count}, ${picked.value.length} selected`
    : count;
});

const narrowKey = computed(() => ({ text: narrow.text, types: narrow.types }));

// the alerts endpoint has no text search and no paging, so Search and Type
// filter the loaded rows here
function narrowRows(rows, key) {
  const needle = (key.text || "").trim().toLowerCase();
  const types = key.types || [];
  return rows.filter((alert) => {
    if (types.length > 0 && !types.includes(alert.alert_type)) return false;
    if (!needle) return true;
    const haystack = [
      alert.hostname,
      alert.client,
      alert.site,
      alert.message,
      alert.alert_type,
    ];
    return haystack.some(
      (text) => text && `${text}`.toLowerCase().includes(needle),
    );
  });
}

// keep bulk actions away from rows the narrowing took off screen
watch(narrowKey, (key) => {
  if (picked.value.length === 0) return;
  const shown = new Set(narrowRows(loaded.value, key).map((alert) => alert.id));
  picked.value = picked.value.filter((alert) => shown.has(alert.id));
});

function look(alert) {
  const { pill, tip } = SEVERITY_LOOK[alert.severity] || SEVERITY_LOOK.info;
  return { pill, tip, dot: vuex.state[`dash_${pill}_color`] || pill };
}

async function loadClients() {
  const { data } = await axios.get("/clients/");
  clientChoices.value = Object.freeze(
    data.map((client) => ({ label: client.name, value: client.id })),
  );
}

async function load() {
  $q.loading.show();
  picked.value = [];
  ran.value = true;

  const body = { snoozedFilter: query.snoozed, resolvedFilter: query.resolved };
  if (query.clients.length > 0) body.clientFilter = query.clients;
  if (query.days) body.timeFilter = query.days;
  if (query.severities.length > 0) body.severityFilter = query.severities;

  try {
    const { data } = await axios.patch("/alerts/", body);
    loaded.value = Object.freeze(data);
  } catch {
    // the interceptor reports it
  }
  $q.loading.hide();
}

const { rowActions, bulkActions } = useAlertActions($q, load);

onMounted(() => {
  loadClients();
  load();
});
</script>

<style scoped>
/* hide rmm-pill's ::before dot. this one uses the dashboard colour; text stays on the status token */
.severity-pill::before {
  content: none;
}

.severity-pill__dot {
  width: 6px;
  height: 6px;
  flex: none;
  border-radius: 50%;
}
</style>
