<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-table
    dense
    flat
    :rows="rows"
    :columns="shownColumns"
    row-key="id"
    :loading="loading"
    :pagination="{ rowsPerPage: 0 }"
    hide-pagination
    class="q-pa-sm rmm-table"
  >
    <template #no-data>
      <div v-if="!loading" class="full-width">
        <div v-if="error" class="text-center q-py-md">{{ error }}</div>
        <EmptyState
          v-else
          icon="history"
          title="No package installs yet"
          text="Installs started from the agent menu or Bulk Package Install show up here with their result."
        />
      </div>
    </template>
    <template v-if="!batch && rows.length >= HISTORY_CAP" #bottom-row>
      <q-tr>
        <q-td colspan="100%" class="text-caption rmm-muted">
          Only the newest {{ HISTORY_CAP }} installs are shown.
        </q-td>
      </q-tr>
    </template>
    <template #header="scope">
      <q-tr :props="scope">
        <q-th auto-width><span class="sr-only">Output</span></q-th>
        <q-th v-for="col in scope.cols" :key="col.name" :props="scope">
          {{ col.label }}
          <q-tooltip v-if="HEADER_TIPS[col.name]">
            {{ HEADER_TIPS[col.name] }}
          </q-tooltip>
        </q-th>
      </q-tr>
    </template>
    <template #body="scope">
      <q-tr :props="scope">
        <q-td auto-width>
          <q-btn
            v-if="scope.row.output || scope.row.detail"
            dense
            flat
            round
            size="sm"
            :icon="scope.expand ? 'expand_less' : 'expand_more'"
            :aria-label="`Output from ${scope.row.hostname}`"
            :aria-expanded="scope.expand ? 'true' : 'false'"
            @click="scope.expand = !scope.expand"
          >
            <q-tooltip>{{
              scope.expand
                ? "Hide the installer output"
                : "Show the installer output"
            }}</q-tooltip>
          </q-btn>
        </q-td>
        <q-td v-for="col in scope.cols" :key="col.name" :props="scope">
          <template v-if="col.name === 'state'">
            <span class="rmm-pill" :class="stateMeta(scope.row).cls">{{
              stateMeta(scope.row).label
            }}</span>
            <!-- agent-native jobs (archives, large files) report bytes -->
            <span
              v-if="scope.row.state === 'running' && scope.row.total_bytes > 0"
              class="rmm-muted rmm-num q-ml-xs"
              >{{
                Math.floor((scope.row.done_bytes / scope.row.total_bytes) * 100)
              }}
              %</span
            >
            <q-tooltip v-if="stateMeta(scope.row).tip">{{
              stateMeta(scope.row).tip
            }}</q-tooltip>
          </template>
          <template v-else>
            {{ col.value }}
            <q-tooltip
              v-if="
                (col.name === 'detail' || col.name === 'signature') && col.value
              "
              >{{ col.value }}</q-tooltip
            >
          </template>
        </q-td>
      </q-tr>
      <q-tr v-if="scope.expand" :props="scope">
        <q-td colspan="100%">
          <div v-if="scope.row.detail" class="q-mb-xs">
            {{ scope.row.detail }}
          </div>
          <pre
            v-if="scope.row.output"
            class="rmm-mono q-ma-none pkg-output"
            style="white-space: pre-wrap; max-height: 40vh; overflow: auto"
            >{{ scope.row.output }}</pre
          >
        </q-td>
      </q-tr>
    </template>
  </q-table>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useStore } from "vuex";
import { fetchPackageInstalls } from "@/api/packages";
import { INSTALL_STATES, RUN_AS_LABELS, isPending } from "@/utils/packages";
import EmptyState from "@/components/ui/EmptyState.vue";

const props = defineProps({
  // one batch, all of its rows. empty = latest installs you can see
  // (the server caps that list)
  batch: { type: String, default: "" },
});

const store = useStore();
const rows = ref([]);
const loading = ref(true);
const error = ref("");

const columns = [
  { name: "hostname", label: "Agent", field: "hostname", align: "left" },
  { name: "package", label: "Package", field: "package_name", align: "left" },
  {
    name: "run_as",
    label: "Run as",
    field: (r) => RUN_AS_LABELS[r.run_as] ?? r.run_as,
    align: "left",
  },
  { name: "state", label: "State", field: "state", align: "left" },
  {
    name: "exit_code",
    label: "Exit code",
    field: (r) => r.exit_code ?? "",
    align: "left",
  },
  {
    name: "signature",
    label: "Signature",
    field: (r) => [r.signature, r.signer].filter(Boolean).join(" · "),
    align: "left",
    classes: "rmm-ellipsis-td",
    style: "max-width: 260px",
  },
  {
    name: "detail",
    label: "Detail",
    field: "detail",
    align: "left",
    classes: "rmm-ellipsis-td",
    style: "max-width: 320px",
  },
  { name: "requested_by", label: "By", field: "requested_by", align: "left" },
  {
    name: "finished",
    label: "Finished",
    field: (r) => (r.finished ? store.getters.formatDate(r.finished) : ""),
    align: "left",
  },
];
const HEADER_TIPS = {
  run_as: "Account the installer ran under on the device",
  state: "Result of the install; hover a state for its meaning",
  exit_code: "Exit code of the installer; 0 usually means success",
  signature: "Signature check the device reported, and the signer",
  requested_by: "User who started the install",
};
const shownColumns = computed(() =>
  props.batch ? columns.filter((c) => c.name !== "package") : columns,
);

function stateMeta(row) {
  return INSTALL_STATES[row.state] ?? { label: row.state, cls: "" };
}

// the server's MAX_INSTALLS for the history without a batch
const HISTORY_CAP = 200;

// poll every 3s while something is queued or running. stop on close.
// no paging: a batch is every row the server sent.
let timer = null;
let stopped = false;
async function load() {
  clearTimeout(timer);
  try {
    rows.value = await fetchPackageInstalls(
      props.batch ? { batch: props.batch } : {},
    );
    error.value = "";
  } catch {
    error.value = "The install results could not be loaded.";
  }
  loading.value = false;
  // refresh mid-poll should not start a second chain
  clearTimeout(timer);
  if (!stopped && rows.value.some(isPending)) timer = setTimeout(load, 3000);
}

onMounted(load);
onBeforeUnmount(() => {
  stopped = true;
  clearTimeout(timer);
});

defineExpose({ load });
</script>

<style scoped>
.pkg-output {
  padding: 8px 10px;
  border: 1px solid var(--rmm-border);
  border-radius: var(--rmm-radius-sm);
  background: var(--rmm-surface-2);
  font-size: var(--rmm-fs-xs);
}
</style>
