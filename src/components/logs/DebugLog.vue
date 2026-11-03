<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-card :flat="!modal">
    <q-bar v-if="modal">
      <span>Debug log</span>
      <span class="rmm-muted text-caption q-ml-sm gt-xs"
        >Agent, patching, script and system events for troubleshooting</span
      >
      <q-space />
      <q-btn
        dense
        flat
        icon="refresh"
        aria-label="Refresh debug log"
        @click="loadLog"
      >
        <q-tooltip>Reload the debug log</q-tooltip>
      </q-btn>
      <q-btn v-close-popup dense flat icon="close" aria-label="Close">
        <q-tooltip>Close</q-tooltip>
      </q-btn>
    </q-bar>
    <q-table
      table-class="table-bgcolor"
      class="tabs-tbl-sticky rmm-table"
      :style="{
        'max-height': tabHeight ? tabHeight : `${$q.screen.height - 33}px`,
      }"
      :rows="rows"
      :columns="COLUMNS"
      :title="modal ? 'Debug Logs' : ''"
      :pagination="{ sortBy: 'entry_time', descending: true, rowsPerPage: 0 }"
      v-bind="TABLE_ATTRS"
      :filter="search"
      :loading="loading"
    >
      <template #top>
        <div class="rmm-toolbar full-width debug-toolbar">
          <q-btn
            v-if="agent"
            dense
            flat
            push
            icon="refresh"
            aria-label="Refresh debug log"
            @click="loadLog"
          >
            <q-tooltip>Reload the debug log of this agent</q-tooltip>
          </q-btn>
          <rmm-select
            v-if="!agent"
            v-model="agentId"
            style="width: 250px"
            label="Agent"
            :options="agentOptions"
            v-bind="PICKER_ATTRS"
            filterable
          />
          <rmm-select
            v-model="logType"
            style="width: 250px"
            label="Log type"
            :options="LOG_TYPES"
            v-bind="PICKER_ATTRS"
          />
          <div
            class="row items-center no-wrap"
            role="radiogroup"
            aria-labelledby="debug-level-label"
          >
            <span id="debug-level-label" class="rmm-label q-mr-xs">Level</span>
            <q-radio
              v-for="lv in levels"
              :key="lv.val"
              v-model="level"
              class="q-mr-sm"
              dense
              :val="lv.val"
              :label="lv.label"
              :color="lv.color"
            />
            <HelpTip
              text="Shows only this exact level, newest 1000 entries; changes apply right away"
            />
          </div>
          <q-space />
          <q-input v-model="search" outlined label="Search" dense clearable>
            <template #prepend>
              <q-icon name="search" class="rmm-muted" />
            </template>
            <q-tooltip>Searches the loaded rows only</q-tooltip>
          </q-input>
          <export-table-btn :data="rows" :columns="COLUMNS" />
        </div>
      </template>

      <template #top-row>
        <q-tr v-if="Array.isArray(rows) && rows.length === 1000">
          <q-td colspan="100%" class="rmm-muted">
            <q-icon name="warning" :color="warnColor" />
            Results are limited to 1000 rows.
          </q-td>
        </q-tr>
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
              @click="loadLog"
            />
          </template>
          <EmptyState
            v-else
            class="full-width"
            icon="bug_report"
            title="No log entries"
            text="Agent updates, patching, scripting and system issues are logged here. Try another level or log type."
          />
        </div>
      </template>

      <template #body-cell-entry_time="props">
        <q-td :props="props" class="rmm-num">
          {{ formatDate(props.value) }}
        </q-td>
      </template>

      <template #body-cell-log_level="props">
        <q-td :props="props">
          <span
            class="rmm-pill text-capitalize"
            :class="LEVEL_PILL[props.value]"
          >
            {{ props.value }}
          </span>
        </q-td>
      </template>
    </q-table>
  </q-card>
</template>

<script setup>
import { ref, computed, watch, onMounted } from "vue";
import { useStore } from "vuex";
import { fetchDebugLog as requestLog } from "@/api/logs";
import { useAgentDropdown } from "@/composables/agents";
import { formatTableColumnText } from "@/utils/format";

import RmmSelect from "@/components/ui/RmmSelect.vue";
import ExportTableBtn from "@/components/ui/ExportTableBtn.vue";
import HelpTip from "@/components/ui/HelpTip.vue";
import EmptyState from "@/components/ui/EmptyState.vue";

defineOptions({ name: "LogModal" });

const props = defineProps({
  agent: String,
  tabHeight: String,
  modal: { type: Boolean, default: false },
});

const TABLE_ATTRS = {
  flat: true,
  dense: true,
  virtualScroll: true,
  binaryStateSort: true,
  rowsPerPageOptions: [0],
};

const PICKER_ATTRS = { mapOptions: true, outlined: true, clearable: true };

const LOG_TYPES = [
  ["agent_update", "Agent Update"],
  ["agent_issues", "Agent Issues"],
  ["win_updates", "Patching"],
  ["system_issues", "System Issues"],
  ["scripting", "Scripting"],
].map(([value, label]) => ({ label, value }));

const LEVEL_PILL = {
  critical: "rmm-pill--negative",
  error: "rmm-pill--negative",
  warning: "rmm-pill--warning",
  info: "rmm-pill--info",
};

const COLUMNS = [
  ["entry_time", "Time"],
  ["log_level", "Log level"],
  ["agent", "Agent"],
  ["log_type", "Log type"],
  ["message", "Message"],
].map(([name, label]) => ({
  name,
  label,
  field: name,
  align: "left",
  sortable: true,
  ...(name === "log_type" && { format: (v) => formatTableColumnText(v) }),
}));

const store = useStore();
const formatDate = (v) => store.getters.formatDate(v);
const warnColor = computed(() => store.state.dash_warning_color);
const levels = computed(() => {
  const { dash_info_color: info, dash_negative_color: neg } = store.state;
  return [
    { val: "info", label: "Info", color: info },
    { val: "critical", label: "Critical", color: neg },
    { val: "error", label: "Error", color: neg },
    { val: "warning", label: "Warning", color: warnColor.value },
  ];
});

const { agentOptions, getAgentOptions } = useAgentDropdown();

const rows = ref([]);
const agentId = ref(props.agent ? props.agent : null);
const level = ref("info");
const logType = ref(null);
const loading = ref(false);
const search = ref("");
const error = ref("");

async function loadLog() {
  loading.value = true;
  error.value = "";
  try {
    const query = { logLevelFilter: level.value };
    if (agentId.value) query.agentFilter = agentId.value;
    if (logType.value) query.logTypeFilter = logType.value;
    rows.value = await requestLog(query);
  } catch (e) {
    console.error(e);
    error.value =
      e?.response?.status === 403
        ? "Your role cannot view the debug log."
        : "Debug log could not be loaded.";
  }
  loading.value = false;
}

if (props.agent) {
  watch(
    () => props.agent,
    (id) => {
      if (id) {
        agentId.value = id;
        loadLog();
      }
    },
  );
}

watch([level, agentId, logType], loadLog);

onMounted(() => {
  if (!props.agent) getAgentOptions();
  loadLog();
});
</script>

<style scoped>
.debug-toolbar {
  flex-wrap: wrap;
  row-gap: 6px;
}
</style>
