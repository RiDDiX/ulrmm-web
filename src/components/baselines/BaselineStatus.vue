<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-dialog
    ref="dialogRef"
    aria-labelledby="baseline-status-title"
    @hide="onDialogHide"
  >
    <q-card class="q-dialog-plugin rmm-dialog--lg">
      <DialogHeader
        title-id="baseline-status-title"
        :title="`${baseline.name}: status`"
        subtitle="Every agent the baseline applies to, per item; pending rows wait for the agent"
      >
        <template #actions>
          <q-btn
            dense
            flat
            icon="refresh"
            aria-label="Refresh status"
            :loading="loading"
            @click="load"
          >
            <q-tooltip>Reload the status</q-tooltip>
          </q-btn>
        </template>
      </DialogHeader>
      <div
        class="rmm-toolbar q-px-md q-pt-sm"
        role="group"
        aria-label="Filter by status"
      >
        <q-chip
          v-for="f in filters"
          :key="f.value"
          clickable
          dense
          role="button"
          :aria-pressed="filter === f.value ? 'true' : 'false'"
          :outline="filter !== f.value"
          :color="filter === f.value ? 'primary' : undefined"
          :text-color="filter === f.value ? 'white' : undefined"
          @click="filter = f.value"
          @keyup.enter="filter = f.value"
        >
          {{ f.label }} <span class="rmm-num q-ml-xs">{{ f.count }}</span>
        </q-chip>
      </div>
      <q-table
        dense
        flat
        class="rmm-table q-pa-sm"
        row-key="id"
        :loading="loading"
        :columns="columns"
        :rows="shown"
        virtual-scroll
        hide-pagination
        :pagination="{ rowsPerPage: 0 }"
        :style="{ maxHeight: '60vh' }"
      >
        <template #no-data>
          <div v-if="!loading" class="full-width">
            <div v-if="error" class="column flex-center q-gutter-sm q-py-md">
              <q-icon name="error_outline" color="negative" size="24px" />
              <div>{{ error }}</div>
              <q-btn
                flat
                dense
                no-caps
                color="primary"
                label="Retry"
                @click="load"
              />
            </div>
            <EmptyState
              v-else
              icon="checklist"
              :title="rows.length ? 'No row has this status' : 'No agent yet'"
              :text="
                rows.length
                  ? 'Choose another status above.'
                  : 'Assign the baseline to an automation policy or a deployment; its agents show up here.'
              "
            />
          </div>
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
        <template #body-cell-actions="props">
          <q-td :props="props" auto-width>
            <q-btn
              v-if="props.row.status === 'failed' && props.row.agent_id"
              dense
              flat
              no-caps
              size="sm"
              icon="replay"
              label="Retry"
              :aria-label="`Retry the failed items on ${props.row.hostname}`"
              :loading="retrying === props.row.agent_id"
              @click="retry(props.row)"
            >
              <q-tooltip
                >Sets the failed items of this agent back to pending</q-tooltip
              >
            </q-btn>
          </q-td>
        </template>
      </q-table>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useDialogPluginComponent } from "quasar";
import { useStore } from "vuex";
import DialogHeader from "@/components/ui/DialogHeader.vue";
import EmptyState from "@/components/ui/EmptyState.vue";
import { fetchBaselineStatus, retryAgentBaseline } from "@/api/baselines";
import { notifySuccess } from "@/utils/notify";
import {
  STATUS_META,
  countByStatus,
  statusMeta,
  type Baseline,
  type ItemState,
  type ItemStatus,
} from "@/utils/baselines";

type StatusRow = {
  id: number | string;
  agent_id?: string;
  hostname?: string;
  item_name?: string;
  status: string;
  attempts?: number;
  detected_version?: string;
  verified_at?: string | null;
  detail?: string;
};

// the server sends a row per agent with its item states nested
type AgentRow = StatusRow & {
  agent: number;
  items?: (ItemState & { item: number })[];
};

const props = defineProps<{ baseline: Baseline }>();
defineEmits([...useDialogPluginComponent.emits]);
const { dialogRef, onDialogHide } = useDialogPluginComponent();
const store = useStore();

const rows = ref<StatusRow[]>([]);
const loading = ref(true);
const error = ref("");
const filter = ref<string>("all");
const retrying = ref<string | null>(null);

const formatDate = (v?: string | null) =>
  v ? (store.getters.formatDate(v) as string) : "";

const columns = [
  {
    name: "hostname",
    label: "Agent",
    field: "hostname",
    align: "left" as const,
    sortable: true,
  },
  {
    name: "item",
    label: "Item",
    field: (r: StatusRow) => r.item_name ?? "",
    align: "left" as const,
    sortable: true,
  },
  {
    name: "status",
    label: "Status",
    field: "status",
    align: "left" as const,
    sortable: true,
  },
  {
    name: "attempts",
    label: "Attempts",
    field: (r: StatusRow) => r.attempts ?? "",
    align: "right" as const,
  },
  {
    name: "version",
    label: "Version found",
    field: (r: StatusRow) => r.detected_version ?? "",
    align: "left" as const,
  },
  {
    name: "verified",
    label: "Verified",
    field: (r: StatusRow) => formatDate(r.verified_at),
    align: "left" as const,
  },
  {
    name: "detail",
    label: "Detail",
    field: (r: StatusRow) => r.detail ?? "",
    align: "left" as const,
    classes: "rmm-ellipsis-td",
    style: "max-width: 320px",
  },
  { name: "actions", label: "", field: "id", align: "right" as const },
];

const filters = computed(() => {
  const counts = countByStatus(rows.value.map((r) => r.status));
  return [
    { value: "all", label: "All", count: rows.value.length },
    ...(Object.keys(STATUS_META) as ItemStatus[]).map((s) => ({
      value: s,
      label: STATUS_META[s].label,
      count: counts[s] ?? 0,
    })),
  ];
});
const shown = computed(() =>
  filter.value === "all"
    ? rows.value
    : rows.value.filter((r) => r.status === filter.value),
);

// a row per item state; an agent without states yet stays one pending row
function perItem(agents: AgentRow[]): StatusRow[] {
  const names = new Map(props.baseline.items.map((i) => [i.id, i.name]));
  return agents.flatMap(({ items, ...agent }): StatusRow[] =>
    items?.length
      ? items.map((s) => ({
          ...s,
          id: `${agent.agent}-${s.item}`,
          agent_id: agent.agent_id,
          hostname: agent.hostname,
          item_name: names.get(s.item) ?? `Item ${s.item}`,
        }))
      : [agent],
  );
}

// installs run for minutes; refresh while one does, stop on close
let timer: ReturnType<typeof setTimeout> | undefined;
let stopped = false;
async function load() {
  clearTimeout(timer);
  loading.value = true;
  try {
    const reply = await fetchBaselineStatus(props.baseline.id);
    rows.value = perItem(Array.isArray(reply) ? reply : (reply?.rows ?? []));
    error.value = "";
  } catch (e) {
    error.value =
      (e as { response?: { status?: number } })?.response?.status === 403
        ? "Your role cannot see this baseline."
        : "The status could not be loaded.";
  }
  loading.value = false;
  if (!stopped && rows.value.some((r) => r.status === "installing"))
    timer = setTimeout(load, 10000);
}

async function retry(row: StatusRow) {
  if (!row.agent_id) return;
  retrying.value = row.agent_id;
  try {
    await retryAgentBaseline(row.agent_id);
    notifySuccess(`Failed items on ${row.hostname} are pending again`);
    await load();
  } catch {
    // toast from the axios boot
  } finally {
    retrying.value = null;
  }
}

onMounted(load);
onBeforeUnmount(() => {
  stopped = true;
  clearTimeout(timer);
});
</script>
