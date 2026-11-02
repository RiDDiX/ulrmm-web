<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <EmptyState
    v-if="agentPlatform.toLowerCase() !== 'windows'"
    icon="desktop_windows"
    title="Windows only"
    text="The event log can only be read on Windows agents at this time."
  />
  <div v-else>
    <q-banner
      v-if="error && events.length > 0"
      class="rmm-banner-warning q-mb-sm"
      rounded
      dense
    >
      <template #avatar>
        <q-icon name="warning_amber" color="warning" />
      </template>
      {{ errorMessage }} Showing the last successful result from
      {{ formatDate(lastLoadedAt) }}.
      <template #action>
        <q-btn
          label="Retry"
          color="primary"
          flat
          dense
          no-caps
          @click="loadEvents"
        />
      </template>
    </q-banner>
    <q-table
      row-key="uid"
      class="remote-bg-tbl-sticky rmm-table"
      table-class="table-bgcolor"
      v-bind="tableFlags"
      :columns="columns"
      :rows="events"
      :loading="loading"
      :filter="filter"
      :style="{ 'max-height': `${$q.screen.height - 77}px` }"
    >
      <template #top>
        <div class="rmm-toolbar full-width evlog-bar">
          <span class="rmm-card__title">{{ logType }} log</span>
          <span v-if="events" class="rmm-muted rmm-num"
            >{{ events.length }}
            {{ events.length === 1 ? "record" : "records" }}</span
          >
          <q-btn
            icon="refresh"
            aria-label="Refresh event log"
            flat
            round
            dense
            @click="loadEvents"
          >
            <q-tooltip>Read the event log from the agent again</q-tooltip>
          </q-btn>
          <q-space />
          <div class="evlog-bar__types">
            <q-radio
              v-for="name in logTypes"
              :key="name"
              v-model="logType"
              :val="name"
              :label="name"
              color="primary"
              dense
            />
          </div>
          <q-select
            v-model="days"
            class="evlog-bar__range"
            label="Time range"
            outlined
            dense
            options-dense
            :options="dayChoices"
            :option-label="rangeLabel"
            :display-value="rangeLabel(days)"
          />
          <q-input
            v-model="filter"
            class="evlog-bar__search"
            placeholder="Search events"
            aria-label="Search events"
            outlined
            dense
            clearable
          >
            <template #prepend><q-icon name="search" /></template>
          </q-input>
          <export-table-btn
            v-bind="{ data: events, columns }"
            class="q-ml-sm"
          />
        </div>
      </template>
      <template #no-data="{ filter: activeFilter }">
        <div v-if="!loading" class="full-width">
          <EmptyState
            v-if="error"
            icon="error_outline"
            title="Event log could not be loaded"
            :text="errorMessage"
          >
            <q-btn
              icon="refresh"
              label="Retry"
              color="primary"
              outline
              no-caps
              @click="loadEvents"
            />
          </EmptyState>
          <EmptyState
            v-else-if="activeFilter"
            icon="filter_alt_off"
            title="No events match your search"
            text="Clear the search to see every record in this range."
          />
          <EmptyState
            v-else
            icon="event_note"
            title="No event log records for this range"
            text="Pick a longer time range or another log."
          />
        </div>
      </template>
      <template #header-cell-message="props">
        <q-th :props="props">
          {{ props.col.label }}
          <q-tooltip>Click a message to read it in full</q-tooltip>
        </q-th>
      </template>
      <template #body="props">
        <q-tr :props="props">
          <q-td>
            <span
              class="rmm-pill"
              :class="eventTypeMeta(props.row.eventType).cls"
              >{{ eventTypeMeta(props.row.eventType).label }}</span
            >
          </q-td>
          <q-td>{{ props.row.source }}</q-td>
          <q-td class="rmm-num">{{ props.row.eventID }}</q-td>
          <q-td class="rmm-num">{{ props.row.time }}</q-td>
          <q-td @click="openMessage(props.row.message)">
            <a
              href="#"
              role="button"
              class="rmm-link"
              @click.stop.prevent="openMessage(props.row.message)"
              @keydown.space.prevent="openMessage(props.row.message)"
              >{{ truncateText(props.row.message, 60) }}</a
            >
          </q-td>
        </q-tr>
      </template>
    </q-table>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from "vue";
import { useQuasar } from "quasar";
import { useStore } from "vuex";
import { fetchAgentEventLog } from "@/api/agents";
import { truncateText } from "@/utils/format";
import ExportTableBtn from "@/components/ui/ExportTableBtn.vue";
import PreDialog from "@/components/ui/PreDialog.vue";
import EmptyState from "@/components/ui/EmptyState.vue";

const props = defineProps({
  agent_id: { type: String },
  agentPlatform: { type: String },
});

const $q = useQuasar();
const store = useStore();
const formatDate = computed(() => store.getters.formatDate);

const columns = [
  ["eventType", "Type"],
  ["source", "Source"],
  ["eventID", "Event ID"],
  ["time", "Time"],
  ["message", "Message"],
].map(([name, label]) => ({
  name,
  label,
  field: name,
  align: "left",
  sortable: true,
}));

const logTypes = ["Application", "System", "Security"];
const dayChoices = [1, 2, 3, 4, 5, 10, 30, 60, 90, 180, 360, 9999];

// event types the Windows agent actually sends
const typeMeta = {
  ERROR: ["Error", "negative"],
  WARNING: ["Warning", "warning"],
  INFO: ["Information", "info"],
  SUCCESS: ["Success", "positive"],
  AUDIT_SUCCESS: ["Audit success", "positive"],
  AUDIT_FAILURE: ["Audit failure", "negative"],
};

function eventTypeMeta(type) {
  const hit = typeMeta[type];
  if (!hit) return { label: type, cls: "rmm-pill--neutral" };
  return { label: hit[0], cls: `rmm-pill--${hit[1]}` };
}

function rangeLabel(n) {
  if (n === 9999) return "All records";
  return n === 1 ? "Last 24 hours" : `Last ${n} days`;
}

const events = ref([]);
const filter = ref("");
const logType = ref("Application");
const days = ref(1);

const tableFlags = {
  virtualScroll: true,
  binaryStateSort: true,
  dense: true,
  rowsPerPageOptions: [0],
  pagination: { rowsPerPage: 0, sortBy: "record", descending: true },
};

const loading = ref(false);
const error = ref(null);
const lastLoadedAt = ref(null);

const errorMessage = computed(() => {
  if (!error.value) return "";
  return error.value?.response?.status === 403
    ? "Your role cannot view the event log for this agent."
    : "Event log could not be loaded.";
});

async function loadEvents() {
  loading.value = true;
  try {
    events.value = await fetchAgentEventLog(
      props.agent_id,
      logType.value,
      days.value,
    );
    error.value = null;
    lastLoadedAt.value = new Date();
  } catch (err) {
    console.error(err);
    error.value = err;
  } finally {
    loading.value = false;
  }
}

function openMessage(message) {
  $q.dialog({
    component: PreDialog,
    componentProps: {
      dialogStyle: "width: 85vw; max-width: 90vw",
      message,
    },
  });
}

// a new selection must not show the previous one's rows under its label
watch([logType, days], () => {
  events.value = [];
  error.value = null;
  lastLoadedAt.value = null;
  loadEvents();
});

onMounted(() => {
  if (props.agentPlatform === "windows") loadEvents();
});
</script>

<style scoped>
.evlog-bar {
  flex-wrap: wrap;
}
.evlog-bar__types {
  display: inline-flex;
  align-items: center;
  gap: 12px;
}
.evlog-bar__range {
  width: 170px;
}
.evlog-bar__search {
  width: 260px;
}
</style>
