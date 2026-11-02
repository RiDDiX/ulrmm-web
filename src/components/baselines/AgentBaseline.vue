<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <div class="agent-baseline">
    <StaleBanner
      v-if="error && rows.length > 0"
      :message="errorMessage"
      :loaded-at="lastLoadedAt ?? undefined"
      :format-date="formatDate"
      @retry="load"
    />
    <q-table
      class="tabs-tbl-sticky rmm-table"
      v-bind="denseTable"
      :rows="rows"
      :columns="columns"
      :style="{ 'max-height': tabHeight }"
      :loading="loading"
      :pagination="{ rowsPerPage: 0 }"
      row-key="rowKey"
    >
      <template #loading>
        <q-inner-loading showing color="primary" />
      </template>
      <template #top>
        <TabToolbar title="Software" :count="rows.length">
          <slot name="toolbar" />
          <q-btn
            v-if="failed > 0"
            icon="replay"
            :label="`Retry ${failed} failed`"
            :loading="retrying"
            dense
            flat
            no-caps
            @click="retry"
          >
            <q-tooltip>Sets the failed items back to pending</q-tooltip>
          </q-btn>
          <q-space />
          <q-btn
            icon="refresh"
            dense
            flat
            round
            aria-label="Reload the baseline"
            :loading="loading"
            @click="load"
          >
            <q-tooltip>Reload the baseline items and their state</q-tooltip>
          </q-btn>
        </TabToolbar>
      </template>
      <template #no-data>
        <div v-if="!loading" class="full-width">
          <LoadFailed
            v-if="error"
            title="Unable to load the baseline"
            :message="errorMessage"
            @retry="load"
          />
          <EmptyState
            v-else
            icon="checklist"
            title="No baseline applies to this device"
            text="Assign a baseline to one of its automation policies or to the deployment it was installed with, under Settings, Software catalog, Baselines."
          />
        </div>
      </template>
      <template #body-cell-name="props">
        <q-td :props="props">
          <div class="text-weight-medium">
            {{ props.row.name || props.row.ref }}
          </div>
          <div class="text-caption rmm-muted">
            {{ sourceLabel(props.row.source) }} ·
            <span class="rmm-mono">{{ props.row.ref }}</span>
            <template v-if="props.row.required === false">
              · optional, does not count toward the summary</template
            >
          </div>
        </q-td>
      </template>
      <template #body-cell-status="props">
        <q-td :props="props">
          <span class="rmm-pill" :class="statusMeta(props.value).cls">{{
            statusMeta(props.value).label
          }}</span>
          <q-tooltip v-if="statusMeta(props.value).tip">{{
            statusMeta(props.value).tip
          }}</q-tooltip>
        </q-td>
      </template>
      <template #body-cell-detail="props">
        <q-td :props="props">
          {{ props.value }}
          <q-tooltip v-if="props.value">{{ props.value }}</q-tooltip>
        </q-td>
      </template>
    </q-table>
  </div>
</template>

<script setup lang="ts">
// Device page, Software tab: the baseline items that apply to the agent and
// how far each one got.
import { computed, onBeforeUnmount, ref } from "vue";
import TabToolbar from "@/components/agents/TabToolbar.vue";
import StaleBanner from "@/components/agents/StaleBanner.vue";
import LoadFailed from "@/components/agents/LoadFailed.vue";
import EmptyState from "@/components/ui/EmptyState.vue";
import { denseTable } from "@/components/agents/tableProps";
import { useAgentTab } from "@/components/agents/useAgentTab";
import { fetchAgentBaseline, retryAgentBaseline } from "@/api/baselines";
import { notifySuccess } from "@/utils/notify";
import {
  SOURCE_META,
  agentBaselineRows,
  statusMeta,
  type AgentBaselineRow,
  type BaselineSource,
} from "@/utils/baselines";

type Row = AgentBaselineRow & { rowKey: string };

const rows = ref<Row[]>([]);
const retrying = ref(false);
let timer: ReturnType<typeof setTimeout> | undefined;
// a reply that lands after unmount must not start the poll again
let stopped = false;

const sourceLabel = (s: string) => SOURCE_META[s as BaselineSource]?.label ?? s;

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
  fetch: fetchAgentBaseline,
  accept: (reply: unknown) => {
    rows.value = agentBaselineRows(reply).map((r, i) => ({
      ...r,
      rowKey: `${r.id ?? i}-${r.source}-${r.ref}`,
    }));
    clearTimeout(timer);
    // an install runs for minutes; follow it while the tab is open
    if (!stopped && rows.value.some((r) => r.state?.status === "installing"))
      timer = setTimeout(load, 15000);
  },
  clear: () => {
    clearTimeout(timer);
    rows.value = [];
  },
  forbidden: "Your role cannot view the baseline of this agent.",
  failed: "The baseline could not be loaded.",
});

const when = (v?: string | null) => (v ? formatDate.value(v) : "");

const columns = [
  {
    name: "name",
    label: "Item",
    field: "name",
    align: "left" as const,
    sortable: true,
  },
  {
    name: "baseline",
    label: "Baseline",
    field: (r: Row) => r.baseline_name ?? "",
    align: "left" as const,
    sortable: true,
  },
  {
    name: "status",
    label: "State",
    field: (r: Row) => r.state?.status ?? "pending",
    align: "left" as const,
    sortable: true,
  },
  {
    name: "version",
    label: "Version found",
    field: (r: Row) => r.state?.detected_version ?? "",
    align: "left" as const,
  },
  {
    name: "verified",
    label: "Verified",
    field: (r: Row) => when(r.state?.verified_at),
    align: "left" as const,
  },
  {
    name: "attempts",
    label: "Attempts",
    field: (r: Row) => r.state?.attempts ?? "",
    align: "right" as const,
  },
  {
    name: "detail",
    label: "Last detail",
    field: (r: Row) => r.state?.detail ?? "",
    align: "left" as const,
    classes: "rmm-ellipsis-td",
    style: "max-width: 320px",
  },
];

const failed = computed(
  () => rows.value.filter((r) => r.state?.status === "failed").length,
);

async function retry() {
  const agentId = selectedAgent.value;
  if (!agentId) return;
  retrying.value = true;
  try {
    await retryAgentBaseline(agentId);
    notifySuccess("The failed items are pending again");
    await load();
  } catch {
    // toast from the axios boot
  } finally {
    retrying.value = false;
  }
}

onBeforeUnmount(() => {
  stopped = true;
  clearTimeout(timer);
});
</script>

<style scoped>
.agent-baseline {
  min-width: 0;
  background: var(--rmm-surface);
}

.agent-baseline :deep(.q-table__top) {
  padding: 0;
}
</style>
