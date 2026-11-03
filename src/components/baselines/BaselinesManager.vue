<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-table
    dense
    flat
    class="rmm-table"
    :loading="loading"
    :columns="columns"
    :rows="rows"
    row-key="id"
    virtual-scroll
    hide-pagination
    :pagination="{ rowsPerPage: 0 }"
    :style="{ maxHeight: '60vh' }"
  >
    <template #top>
      <div class="rmm-toolbar full-width">
        <q-btn
          label="New baseline"
          dense
          unelevated
          no-caps
          color="primary"
          icon="add"
          class="q-pl-sm q-pr-md"
          @click="edit(null)"
        />
        <span class="rmm-muted text-caption">
          Agents install the items in order and the server checks each one
        </span>
        <q-space />
        <span class="rmm-muted rmm-num">
          {{ rows.length }} {{ rows.length === 1 ? "baseline" : "baselines" }}
        </span>
      </div>
    </template>
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
          title="No baselines yet"
          text="A baseline lists software agents install after setup or through an automation policy, each one verified on the device."
        >
          <q-btn
            dense
            outline
            no-caps
            color="primary"
            icon="add"
            label="New baseline"
            class="q-pl-sm q-pr-md"
            @click="edit(null)"
          />
        </EmptyState>
      </div>
    </template>
    <template #body-cell-name="props">
      <q-td :props="props">
        <div class="text-weight-medium">{{ props.row.name }}</div>
        <div
          v-if="props.row.description"
          class="text-caption rmm-muted rmm-ellipsis-cell__text"
        >
          {{ props.row.description }}
        </div>
      </q-td>
    </template>
    <template #body-cell-enabled="props">
      <q-td :props="props">
        <span
          class="rmm-pill"
          :class="
            props.row.enabled ? 'rmm-pill--positive' : 'rmm-pill--neutral'
          "
          >{{ props.row.enabled ? "Enabled" : "Disabled" }}</span
        >
      </q-td>
    </template>
    <template #body-cell-actions="props">
      <q-td :props="props" auto-width>
        <q-btn
          dense
          flat
          round
          size="sm"
          icon="fact_check"
          :aria-label="`Status of ${props.row.name}`"
          @click="showStatus(props.row)"
        >
          <q-tooltip>Install state per agent, with retry</q-tooltip>
        </q-btn>
        <q-btn
          dense
          flat
          round
          size="sm"
          icon="edit"
          :aria-label="`Edit ${props.row.name}`"
          @click="edit(props.row)"
        >
          <q-tooltip>Edit items, order and assignments</q-tooltip>
        </q-btn>
        <q-btn
          dense
          flat
          round
          size="sm"
          icon="delete"
          color="negative"
          :aria-label="`Delete ${props.row.name}`"
          @click="remove(props.row)"
        >
          <q-tooltip
            >Delete the baseline; installed software stays on the
            devices</q-tooltip
          >
        </q-btn>
      </q-td>
    </template>
  </q-table>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useQuasar } from "quasar";
import EmptyState from "@/components/ui/EmptyState.vue";
import BaselineForm from "@/components/baselines/BaselineForm.vue";
import BaselineStatus from "@/components/baselines/BaselineStatus.vue";
import { fetchBaselines, removeBaseline } from "@/api/baselines";
import { notifySuccess } from "@/utils/notify";
import { PLAT_OPTIONS, type Baseline } from "@/utils/baselines";

const $q = useQuasar();
const rows = ref<Baseline[]>([]);
const loading = ref(false);
const error = ref("");

const platLabel = (plat: string) =>
  PLAT_OPTIONS.find((o) => o.value === plat)?.label ?? plat;
const count = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;

const columns = [
  {
    name: "name",
    label: "Name",
    field: "name",
    align: "left" as const,
    sortable: true,
  },
  {
    name: "plat",
    label: "Platform",
    field: (r: Baseline) => platLabel(r.plat),
    align: "left" as const,
    sortable: true,
  },
  {
    name: "items",
    label: "Items",
    field: (r: Baseline) => r.items?.length ?? 0,
    align: "right" as const,
    sortable: true,
  },
  {
    name: "assigned",
    label: "Assigned to",
    field: (r: Baseline) =>
      [
        count(r.policies?.length ?? 0, "policy", "policies"),
        count(r.deployments?.length ?? 0, "deployment", "deployments"),
      ].join(" · "),
    align: "left" as const,
  },
  { name: "enabled", label: "State", field: "enabled", align: "left" as const },
  { name: "actions", label: "", field: "id", align: "right" as const },
];

async function load() {
  loading.value = true;
  error.value = "";
  try {
    rows.value = await fetchBaselines();
  } catch (e) {
    rows.value = [];
    error.value =
      (e as { response?: { status?: number } })?.response?.status === 403
        ? "Your role needs Manage Packages or Install Packages."
        : "The baselines could not be loaded.";
  }
  loading.value = false;
}

function edit(baseline: Baseline | null) {
  $q.dialog({ component: BaselineForm, componentProps: { baseline } }).onOk(
    load,
  );
}

function showStatus(baseline: Baseline) {
  $q.dialog({ component: BaselineStatus, componentProps: { baseline } });
}

function remove(baseline: Baseline) {
  $q.dialog({
    title: `Delete ${baseline.name}?`,
    message:
      "Agents stop getting its items. Software it installed stays on the devices. This cannot be undone.",
    cancel: { label: "Cancel", flat: true },
    ok: { label: "Delete", color: "negative" },
    html: false,
  }).onOk(async () => {
    try {
      await removeBaseline(baseline.id);
      notifySuccess(`${baseline.name} was deleted`);
    } catch {
      // toast from the axios boot
    }
    load();
  });
}

onMounted(load);
defineExpose({ load });
</script>
