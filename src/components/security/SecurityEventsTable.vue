<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-table
    dense
    flat
    bordered
    class="rmm-table sec-events"
    row-key="id"
    :rows="events"
    :columns="columns"
    :loading="loading && !events.length"
    :pagination="{ rowsPerPage: 0 }"
    hide-pagination
    :hide-bottom="!hasMore && events.length > 0"
  >
    <template #top>
      <div class="rmm-toolbar full-width wrap">
        <RmmSelect
          v-model="severity"
          map-options
          :options="SEVERITY_OPTIONS"
          label="Severity"
          style="min-width: 150px"
        />
        <RmmSelect
          v-model="kind"
          map-options
          :options="kindOptions"
          label="Event"
          style="min-width: 220px"
        />
        <q-space />
        <span class="rmm-muted rmm-num" role="status"
          >{{ events.length }}
          {{ events.length === 1 ? "event" : "events" }}</span
        >
        <q-btn
          flat
          dense
          no-caps
          icon="refresh"
          label="Refresh"
          :loading="loading"
          @click="load"
        />
      </div>
    </template>

    <template #loading>
      <q-inner-loading showing color="primary" />
    </template>

    <template #no-data>
      <NoDataPanel
        :loading="loading"
        :error="error"
        icon="verified_user"
        title="No security events"
        :text="
          severity || kind
            ? 'Nothing matches these filters.'
            : 'Refused certificates, pin mismatches, refused updates and similar events show up here.'
        "
        @retry="load"
      />
    </template>

    <template #body-cell-severity="cell">
      <q-td :props="cell">
        <span :class="`rmm-pill rmm-pill--${tone(cell.row.severity)}`">{{
          severityLabel(cell.row.severity)
        }}</span>
      </q-td>
    </template>

    <template #body-cell-agent="cell">
      <q-td :props="cell">
        <span v-if="cell.row.hostname">{{ cell.row.hostname }}</span>
        <span v-else-if="cell.row.agent_id" class="rmm-mono">{{
          cell.row.agent_id
        }}</span>
        <span v-else class="rmm-muted">None</span>
      </q-td>
    </template>

    <template #bottom>
      <div class="full-width row justify-center">
        <q-btn
          flat
          dense
          no-caps
          color="primary"
          icon="expand_more"
          label="Load more"
          :loading="loadingMore"
          @click="loadMore"
        >
          <q-tooltip>Load the next {{ PAGE }} older events</q-tooltip>
        </q-btn>
      </div>
    </template>
  </q-table>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useStore } from "vuex";
import type { QTableColumn } from "quasar";
import RmmSelect from "@/components/ui/RmmSelect.vue";
import NoDataPanel from "@/core/ui/NoDataPanel.vue";
import {
  fetchSecurityEvents,
  type EventSeverity,
  type SecurityEvent,
  type SecurityEventQuery,
} from "@/api/security";
import { notifyError } from "@/utils/notify";

const PAGE = 100;

const SEVERITY_LABEL: Record<EventSeverity, string> = {
  info: "Info",
  warning: "Warning",
  high: "High",
  critical: "Critical",
};
const TONE: Record<EventSeverity, string> = {
  info: "info",
  warning: "warning",
  high: "negative",
  critical: "negative",
};
const known = (v: string): v is EventSeverity =>
  Object.prototype.hasOwnProperty.call(SEVERITY_LABEL, v);
const tone = (v: string) => (known(v) ? TONE[v] : "neutral");
const severityLabel = (v: string) => (known(v) ? SEVERITY_LABEL[v] : v);
const SEVERITY_OPTIONS = [
  { value: "", label: "All" },
  ...(Object.keys(SEVERITY_LABEL) as EventSeverity[]).map((value) => ({
    value,
    label: SEVERITY_LABEL[value],
  })),
];

const store = useStore();
const formatDate = (v: string) => store.getters.formatDate(v) as string;

const events = ref<SecurityEvent[]>([]);
const kinds = ref<{ value: string; label: string }[]>([]);
const severity = ref<EventSeverity | "">("");
const kind = ref("");
const loading = ref(false);
const loadingMore = ref(false);
const hasMore = ref(false);
const error = ref("");
// a filter change while a page loads drops the older reply
let request = 0;

const kindOptions = computed(() => [
  { value: "", label: "All" },
  ...kinds.value,
]);
const kindLabel = (value: string) =>
  kinds.value.find((k) => k.value === value)?.label ?? value;

const column = (
  name: string,
  label: string,
  extra: Partial<QTableColumn> = {},
): QTableColumn => ({ name, label, field: name, align: "left", ...extra });
const columns: QTableColumn[] = [
  column("severity", "Severity"),
  column("kind", "Event", { format: kindLabel }),
  column("agent", "Agent", { field: "hostname" }),
  column("source_ip", "Source IP", {
    classes: "rmm-mono",
    format: (v: string | null) => v || "",
  }),
  column("detail", "Detail", { classes: "sec-events__detail" }),
  column("count", "Count", { align: "right", classes: "rmm-num" }),
  column("first_seen", "First seen", { format: formatDate }),
  column("last_seen", "Last seen", { format: formatDate }),
];

const query = (before?: number): SecurityEventQuery => ({
  severity: severity.value,
  kind: kind.value,
  before,
  limit: PAGE,
});

async function load() {
  const mine = ++request;
  loading.value = true;
  error.value = "";
  try {
    const page = await fetchSecurityEvents(query());
    if (mine !== request) return;
    events.value = page.results;
    kinds.value = page.kinds;
    hasMore.value = page.results.length === PAGE;
  } catch (e) {
    if (mine !== request) return;
    events.value = [];
    hasMore.value = false;
    error.value =
      (e as { response?: { status?: number } })?.response?.status === 403
        ? "Your role cannot view security events."
        : "Security events could not be loaded.";
  } finally {
    if (mine === request) loading.value = false;
  }
}

// the Security Center refetches on its live timer
defineExpose({ load });

async function loadMore() {
  const last = events.value[events.value.length - 1];
  if (!last) return;
  const mine = request;
  loadingMore.value = true;
  try {
    const page = await fetchSecurityEvents(query(last.id));
    if (mine !== request) return;
    events.value = [...events.value, ...page.results];
    hasMore.value = page.results.length === PAGE;
  } catch {
    notifyError("More security events could not be loaded.");
  } finally {
    loadingMore.value = false;
  }
}

watch([severity, kind], load);
onMounted(load);
</script>

<style scoped>
.sec-events :deep(.sec-events__detail) {
  min-width: 220px;
  white-space: normal;
  overflow-wrap: anywhere;
}
</style>
