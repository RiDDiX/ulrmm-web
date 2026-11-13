<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <div v-if="!selectedAgent" class="q-pa-sm rmm-muted">No agent selected</div>
  <div v-else>
    <StaleBanner
      v-if="error && history.length > 0"
      :message="errorMessage"
      :loaded-at="lastLoadedAt"
      :format-date="formatDate"
      @retry="load"
    />
    <q-table
      v-bind="denseTable"
      class="rmm-table"
      :filter="filter"
      :loading="loading"
      :rows="shownRows"
      :columns="columns"
      :style="{ 'max-height': tabHeight }"
      :pagination="{ rowsPerPage: 0, sortBy: 'time', descending: true }"
    >
      <template #top>
        <TabToolbar title="History" :count="history.length">
          <div class="row items-center q-gutter-xs">
            <q-chip
              v-for="opt in typeChips"
              :key="opt.value"
              :outline="!isActive(opt.value)"
              :aria-pressed="isActive(opt.value)"
              :text-color="isActive(opt.value) ? 'white' : undefined"
              color="primary"
              role="button"
              clickable
              dense
              @click="toggleType(opt.value)"
            >
              {{ opt.label }}
              <q-tooltip>{{ chipTip(opt) }}</q-tooltip>
            </q-chip>
          </div>
          <q-space />
          <q-input
            v-model="filter"
            class="history-search"
            placeholder="Search history"
            aria-label="Search history"
            outlined
            dense
            clearable
          >
            <template #prepend>
              <q-icon name="search" class="rmm-muted" />
            </template>
          </q-input>
          <ExportTableBtn :data="shownRows" :columns="columns" />
          <q-btn
            icon="refresh"
            aria-label="Refresh history"
            dense
            flat
            round
            @click="load"
          >
            <q-tooltip>Refresh history</q-tooltip>
          </q-btn>
        </TabToolbar>
      </template>

      <template #loading>
        <q-inner-loading showing color="primary" />
      </template>

      <template #no-data>
        <div v-if="!loading" class="full-width">
          <LoadFailed
            v-if="error"
            title="Unable to load history"
            :message="errorMessage"
            @retry="load"
          />
          <EmptyState
            v-else-if="history.length > 0"
            icon="filter_alt_off"
            title="No history matches your filter"
            text="Clear the search and the type filters to see every entry."
          >
            <q-btn
              label="Clear filters"
              color="primary"
              outline
              dense
              no-caps
              @click="clearFilters"
            />
          </EmptyState>
          <EmptyState
            v-else
            icon="history"
            title="No history yet"
            text="Commands, scripts, tasks and app updates run on this agent are listed here."
          />
        </div>
      </template>

      <template #body-cell-output="cell">
        <q-td :props="cell">
          <a
            href="#"
            role="button"
            class="rmm-link"
            @click.prevent="showOutput(cell.row)"
            @keydown.space.prevent="showOutput(cell.row)"
            >Output</a
          >
        </q-td>
      </template>

      <template #body-cell-result="cell">
        <q-td :props="cell">
          <q-icon
            :name="resultOf(cell.row).icon"
            :color="resultOf(cell.row).color"
            :class="{ 'rmm-muted': !resultOf(cell.row).color }"
            size="1.2em"
          >
            <q-tooltip>{{ resultOf(cell.row).label }}</q-tooltip>
          </q-icon>
          <span class="sr-only">{{ resultOf(cell.row).label }}</span>
        </q-td>
      </template>

      <template #body-cell-command="cell">
        <q-td :props="cell">
          <span class="rmm-ellipsis-cell__text" style="max-width: 320px">{{
            cell.value
          }}</span>
          <q-tooltip>{{ cell.value }}</q-tooltip>
        </q-td>
      </template>

      <template #body-cell-time="cell">
        <q-td :props="cell">{{ formatDate(cell.row.time) }}</q-td>
      </template>
    </q-table>
  </div>
</template>

<script setup>
import { computed, ref } from "vue";
import { useQuasar } from "quasar";
import { fetchAgentHistory } from "@/api/agents";
import { historyOutcome } from "@/utils/appupdates";
import { formatTableColumnText } from "@/utils/format";
import { notifyInfo } from "@/utils/notify";
import ScriptOutput from "@/components/checks/ScriptOutput.vue";
import ExportTableBtn from "@/components/ui/ExportTableBtn.vue";
import PreDialog from "@/components/ui/PreDialog.vue";
import EmptyState from "@/components/ui/EmptyState.vue";
import TabToolbar from "@/components/agents/TabToolbar.vue";
import { denseTable } from "@/components/agents/tableProps";
import StaleBanner from "@/components/agents/StaleBanner.vue";
import LoadFailed from "@/components/agents/LoadFailed.vue";
import { useAgentTab } from "@/components/agents/useAgentTab";

defineOptions({ name: "HistoryTab" });

const $q = useQuasar();

// a cmd_run row has no retcode and exists before the agent answers, so
// success cannot be read off it
function resultOf(row) {
  if (row.type === "cmd_run") {
    return row.results
      ? { label: "Output received", icon: "subject", color: null }
      : { label: "No output", icon: "remove", color: null };
  }
  if (row.type === "app_update") return historyOutcome(row.results);
  const code = row.script_results?.retcode;
  if (code === null || code === undefined)
    return { label: "Unknown", icon: "help_outline", color: null };
  return code === 0
    ? { label: "Success", icon: "check_circle", color: "positive" }
    : { label: "Failed", icon: "error", color: "negative" };
}

const typeChips = [
  { value: "cmd_run", label: "Command", noun: "commands" },
  { value: "script_run", label: "Script", noun: "script runs" },
  { value: "task_run", label: "Task", noun: "task runs" },
  { value: "app_update", label: "App update", noun: "app updates" },
];

const col = (name, label, field, extra = {}) => ({
  name,
  label,
  field,
  align: "left",
  sortable: true,
  ...extra,
});
const columns = [
  col("result", "Result", (row) => resultOf(row).label),
  col("time", "Time", "time"),
  col("type", "Action", "type", { format: (v) => formatTableColumnText(v) }),
  col("command", "Script/Command", (row) =>
    row.type === "script_run" ? row.script_name : row.command,
  ),
  col("username", "Initiated by", "username"),
  // a link per row, nothing to sort by
  col("output", "Output", "output", { sortable: false }),
];

const history = ref([]);
const filter = ref("");
const activeTypes = ref([]);

const {
  selectedAgent,
  tabHeight,
  formatDate,
  loading,
  error,
  errorMessage,
  lastLoadedAt,
  load,
} = useAgentTab({
  fetch: fetchAgentHistory,
  accept: (rows) => (history.value = rows),
  clear: () => (history.value = []),
  forbidden: "Your role cannot view history for this agent.",
  failed: "History could not be loaded.",
});

// no chip picked shows every type; a picked type only narrows
const shownRows = computed(() =>
  activeTypes.value.length
    ? history.value.filter((row) => activeTypes.value.includes(row.type))
    : history.value,
);

const isActive = (type) => activeTypes.value.includes(type);
const toggleType = (type) => {
  activeTypes.value = isActive(type)
    ? activeTypes.value.filter((t) => t !== type)
    : [...activeTypes.value, type];
};
const clearFilters = () => {
  filter.value = "";
  activeTypes.value = [];
};

function chipTip(opt) {
  if (isActive(opt.value)) return `Remove ${opt.noun} from the filter`;
  return activeTypes.value.length
    ? `Also show ${opt.noun}`
    : `Show only ${opt.noun}; pick more types to combine`;
}

function showScriptOutput(output) {
  if (!output) return notifyInfo("No output is available yet");
  $q.dialog({
    component: ScriptOutput,
    componentProps: { scriptInfo: output },
  });
}

function showCommandOutput(title, output) {
  const componentProps = {
    message: output,
    title,
    dialogStyle: "width: 70vw; max-width: 80vw",
  };
  $q.dialog({ component: PreDialog, componentProps });
}

const showOutput = (row) =>
  row.type === "cmd_run" || row.type === "app_update"
    ? showCommandOutput(row.command, row.results)
    : showScriptOutput(
        // script_results carries no run time of its own
        row.script_results && { last_run: row.time, ...row.script_results },
      );
</script>

<style scoped>
.history-search {
  width: min(240px, 40vw);
}
</style>
