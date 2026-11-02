<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-card :flat="!modal">
    <q-bar v-if="modal">
      <span>Audit log</span>
      <span class="rmm-muted text-caption q-ml-sm gt-xs"
        >Who changed what and when</span
      >
      <q-space />
      <q-btn
        dense
        flat
        icon="refresh"
        aria-label="Refresh audit logs"
        @click="load"
      >
        <q-tooltip>Run the search again</q-tooltip>
      </q-btn>
      <q-btn v-close-popup dense flat icon="close" aria-label="Close">
        <q-tooltip>Close</q-tooltip>
      </q-btn>
    </q-bar>
    <q-table
      v-model:pagination="paging"
      v-bind="TABLE_PROPS"
      :title="heading"
      :rows="entries"
      :columns="COLUMNS"
      :loading="busy"
      :style="tableStyle"
      class="tabs-tbl-sticky rmm-table"
      table-class="table-bgcolor"
      @request="changePage"
      @row-click="(_evt, entry) => showDetail(entry)"
    >
      <template #top>
        <div class="rmm-toolbar full-width">
          <!-- the filters wrap among themselves; export stays on the first line -->
          <div class="audit-filters">
            <q-btn
              v-if="agent"
              dense
              flat
              push
              icon="refresh"
              aria-label="Refresh audit logs"
              @click="load"
            >
              <q-tooltip>Reload the audit log of this agent</q-tooltip>
            </q-btn>
            <div v-else class="row items-center no-wrap">
              <span id="audit-filter-type-label" class="rmm-label q-mr-xs"
                >Filter by</span
              >
              <q-option-group
                v-model="scope"
                aria-labelledby="audit-filter-type-label"
                :options="SCOPES"
                color="primary"
                inline
                dense
              />
              <HelpTip
                class="q-ml-xs"
                text="Limit the search to whole clients or to single agents; switching clears the other list"
              />
            </div>
            <rmm-select
              v-for="field in fields"
              :key="field.key"
              v-model="chosen[field.key]"
              :label="field.label"
              :options="field.options"
              style="flex: 1 1 150px; max-width: 200px"
              v-bind="field.attrs"
            />
            <q-btn
              v-if="!agent"
              color="primary"
              unelevated
              no-caps
              icon="search"
              label="Search"
              @click="load"
            />
            <HelpTip
              text="Empty filters match everything. Click a row to see the values before and after the change."
            />
          </div>
          <export-table-btn :data="entries" :columns="COLUMNS" />
        </div>
      </template>

      <template #no-data>
        <div v-if="!busy" class="full-width row flex-center q-gutter-sm">
          <template v-if="failure">
            <q-icon name="error_outline" color="negative" size="24px" />
            <span>{{ failure }}</span>
            <q-btn outline dense color="primary" label="Retry" @click="load" />
          </template>
          <EmptyState v-else class="full-width" v-bind="emptyCopy" />
        </div>
      </template>

      <template #header-cell="head">
        <q-th :props="head">
          {{ head.col.label }}
          <q-tooltip v-if="HINTS[head.col.name]">{{
            HINTS[head.col.name]
          }}</q-tooltip>
        </q-th>
      </template>

      <!-- one slot for every column; the plain ones fall through to the value -->
      <template #body-cell="cell">
        <q-td :props="cell" :class="CELL_CLASS[cell.col.name]">
          <div v-if="cell.col.name === 'action'">
            <q-badge
              :color="actionColor(cell.row.action)"
              :label="cell.value"
            />
          </div>
          <template v-else-if="cell.col.name === 'client'">{{
            cell.value?.client_name
          }}</template>
          <template v-else-if="cell.col.name === 'site'">{{
            cell.value?.name
          }}</template>
          <template v-else-if="cell.col.name === 'agent'">
            <a
              v-if="linksAgent(cell.row)"
              href="#"
              role="button"
              class="rmm-link"
              @click.prevent.stop="openAgentWindow(cell.row.agent_id)"
              @keydown.space.prevent.stop="openAgentWindow(cell.row.agent_id)"
              >{{ cell.value
              }}<q-tooltip>Open {{ cell.value }} in a new window</q-tooltip></a
            >
            <span v-else>{{ cell.value }}</span>
          </template>
          <template v-else-if="cell.col.name === 'entry_time'">{{
            formatDate(cell.value)
          }}</template>
          <div
            v-else-if="cell.col.name === 'message'"
            class="row items-center no-wrap q-gutter-x-xs"
          >
            <span class="col">{{ cell.value }}</span>
            <q-btn
              flat
              dense
              round
              size="sm"
              icon="manage_search"
              class="audit-detail-btn"
              :aria-label="`Show before and after values: ${cell.value}`"
              @click.stop="showDetail(cell.row)"
            >
              <q-tooltip
                >Show the values before and after this change</q-tooltip
              >
            </q-btn>
          </div>
          <template v-else>{{ cell.value }}</template>
        </q-td>
      </template>
    </q-table>
  </q-card>
</template>

<script setup>
import { computed, watch } from "vue";
import { useStore } from "vuex";
import { useQuasar } from "quasar";
import { openAgentWindow } from "@/api/agents";
import { formatTableColumnText } from "@/utils/format";
import { SCOPES, useAuditLog } from "@/components/logs/useAuditLog";
import AuditLogDetailModal from "@/components/logs/AuditLogDetailModal.vue";
import EmptyState from "@/components/ui/EmptyState.vue";
import HelpTip from "@/components/ui/HelpTip.vue";
import RmmSelect from "@/components/ui/RmmSelect.vue";
import ExportTableBtn from "@/components/ui/ExportTableBtn.vue";

defineOptions({ name: "AuditManager" });

const props = defineProps({
  agent: String,
  tabHeight: String,
  modal: { type: Boolean, default: false },
});

const TABLE_PROPS = {
  rowKey: "id",
  flat: true,
  dense: true,
  virtualScroll: true,
  binaryStateSort: true,
  rowsPerPageOptions: [25, 50, 100, 500, 1000],
};

const asWords = (text) => formatTableColumnText(text);
const column = (name, label, extra) =>
  Object.assign(
    { name, label, field: name, align: "left", sortable: true },
    extra,
  );

const COLUMNS = [
  column("entry_time", "Time"),
  column("username", "Username"),
  column("agent", "Agent"),
  column("client", "Client", { field: "site", sortable: false }),
  column("site", "Site", { sortable: false }),
  column("action", "Action", { format: asWords }),
  column("object_type", "Object", { format: asWords }),
  column("message", "Message"),
  column("client_ip", "Client IP", { field: "ip_address" }),
];

const CELL_CLASS = {
  entry_time: "rmm-num",
  message: "audit-message-cell",
  client_ip: "rmm-mono",
};

const HINTS = {
  username: "Account that did it, or the name tried in a failed login",
  agent: "Agent the entry is about; click the name to open it in a new window",
  action: "What was done: add, modify, delete, login, script run and so on",
  object_type: "Kind of object that was changed",
  message:
    "Summary of the change; click a row for the full before and after values",
  client_ip: "Address the request came from",
};

// action -> dashboard colour; anything else keeps the primary badge
const TONES = {
  add: "positive",
  agent_install: "positive",
  modify: "warning",
  delete: "negative",
  failed_login: "negative",
};

const vuex = useStore();
const $q = useQuasar();
const formatDate = (val) => vuex.getters.formatDate(val);

const {
  entries,
  busy,
  ran,
  failure,
  scope,
  chosen,
  paging,
  fields,
  load,
  changePage,
} = useAuditLog(props.agent);

const heading = computed(() => (props.modal ? "Audit Logs" : ""));
const tableStyle = computed(() => ({
  "max-height": props.tabHeight || `${$q.screen.height - 33}px`,
}));

const emptyCopy = computed(() =>
  ran.value
    ? {
        icon: "filter_alt_off",
        title: "No matching entries",
        text: "Widen the time range or remove a filter.",
      }
    : {
        icon: "manage_search",
        title: "Search the audit log",
        text: "Changes, logins and remote actions are recorded here. Pick filters, then click Search.",
      },
);

const linksAgent = (entry) => !!entry.agent_id && entry.agent_id !== "N/A";

function actionColor(action) {
  const tone = TONES[`${action}`.toLowerCase()];
  return tone ? vuex.state[`dash_${tone}_color`] : "primary";
}

function showDetail(log) {
  $q.dialog({ component: AuditLogDetailModal, componentProps: { log } });
}

// the agent tab has no Search button: filter changes reload at once
if (props.agent) {
  watch(() => [chosen.users, chosen.actions, chosen.time], load);
  watch(
    () => props.agent,
    (id) => {
      if (!id) return;
      chosen.agents = [id];
      load();
    },
  );
}
</script>

<style scoped>
.audit-filters {
  display: flex;
  flex: 1;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 8px;
  min-width: 0;
}

.audit-message-cell {
  /* narrow screens scroll the table instead of breaking every word */
  min-width: 220px;
  max-width: 420px;
  white-space: normal;
  word-break: break-word;
}

.audit-detail-btn {
  color: var(--rmm-text-subtle);
}
</style>
