<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-dialog
    ref="dialogRef"
    aria-labelledby="maintenance-title"
    @hide="onDialogHide"
  >
    <q-card class="q-dialog-plugin" style="width: 90vw; max-width: 90vw">
      <DialogHeader
        title-id="maintenance-title"
        title="Maintenance & power"
        subtitle="Maintenance windows, sleep and wake schedules"
      >
        <template #actions>
          <q-btn
            dense
            flat
            icon="refresh"
            aria-label="Refresh schedules"
            @click="load"
          >
            <q-tooltip>Reload the schedules</q-tooltip>
          </q-btn>
        </template>
      </DialogHeader>
      <div class="q-pa-sm" style="min-height: 65vh; max-height: 65vh">
        <q-table
          dense
          flat
          class="rmm-table"
          row-key="id"
          :rows="rows"
          :columns="columns"
          :virtual-scroll="true"
          hide-pagination
          :loading="loading"
          :pagination="{ rowsPerPage: 0 }"
          :style="{ maxHeight: '60vh' }"
        >
          <template #top>
            <div class="rmm-toolbar full-width">
              <q-btn
                label="New schedule"
                dense
                unelevated
                class="q-pl-sm q-pr-md"
                no-caps
                color="primary"
                icon="add"
                @click="edit(null)"
              />
              <q-space />
              <span class="rmm-muted rmm-num">
                {{ rows.length }}
                {{ rows.length === 1 ? "schedule" : "schedules" }}
              </span>
            </div>
          </template>
          <template #header-cell="props">
            <q-th :props="props">
              {{ props.col.label }}
              <q-tooltip v-if="HEADER_TIPS[props.col.name]">
                {{ HEADER_TIPS[props.col.name] }}
              </q-tooltip>
            </q-th>
          </template>
          <template #no-data>
            <div
              v-if="!loading"
              class="full-width column flex-center q-gutter-sm q-py-md"
            >
              <template v-if="error">
                <q-icon name="error_outline" color="negative" size="24px" />
                <div>{{ error }}</div>
                <q-btn
                  outline
                  dense
                  color="primary"
                  label="Retry"
                  @click="load"
                />
              </template>
              <EmptyState
                v-else
                class="full-width"
                icon="event_repeat"
                title="No schedules yet"
                text="A maintenance window wakes its devices, installs the approved updates and puts back to sleep only the ones it woke."
              >
                <q-btn
                  dense
                  outline
                  no-caps
                  color="primary"
                  icon="add"
                  label="New schedule"
                  class="q-pl-sm q-pr-md"
                  @click="edit(null)"
                />
              </EmptyState>
            </div>
          </template>
          <template #body-cell-enabled="props">
            <q-td :props="props">
              <span
                class="rmm-pill"
                :class="
                  props.row.enabled ? 'rmm-pill--positive' : 'rmm-pill--neutral'
                "
                >{{ props.row.enabled ? "On" : "Off" }}</span
              >
              <q-tooltip>{{
                props.row.enabled
                  ? "The schedule runs at its next start"
                  : "Kept, but never runs until you turn it on"
              }}</q-tooltip>
            </q-td>
          </template>
          <template #body-cell-name="props">
            <q-td :props="props" class="text-weight-medium">
              {{ props.value }}
            </q-td>
          </template>
          <template #body-cell-actions="props">
            <q-td :props="props" auto-width>
              <q-btn
                dense
                flat
                round
                size="sm"
                icon="edit"
                :aria-label="`Edit ${props.row.name}`"
                @click="edit(props.row)"
              >
                <q-tooltip>Edit this schedule</q-tooltip>
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
                  >Delete this schedule; runs in progress stop</q-tooltip
                >
              </q-btn>
            </q-td>
          </template>
        </q-table>
      </div>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { onMounted, ref } from "vue";
import { useDialogPluginComponent, useQuasar } from "quasar";
import DialogHeader from "@/components/ui/DialogHeader.vue";
import EmptyState from "@/components/ui/EmptyState.vue";
import ScheduleForm from "@/components/maintenance/ScheduleForm.vue";
import { fetchSchedules, removeSchedule } from "@/api/maintenance";
import {
  KIND_LABELS,
  formatRun,
  scheduleSummary,
  targetSummary,
} from "@/utils/maintenance";
import { notifySuccess } from "@/utils/notify";

defineEmits([...useDialogPluginComponent.emits]);
const { dialogRef, onDialogHide } = useDialogPluginComponent();
const $q = useQuasar();

const rows = ref([]);
const loading = ref(false);
const error = ref("");

const columns = [
  { name: "enabled", label: "Enabled", field: "enabled", align: "left" },
  { name: "name", label: "Name", field: "name", align: "left", sortable: true },
  {
    name: "kind",
    label: "Kind",
    field: (r) => KIND_LABELS[r.kind] || r.kind,
    align: "left",
    sortable: true,
  },
  {
    name: "when",
    label: "When (device time)",
    field: scheduleSummary,
    align: "left",
  },
  { name: "targets", label: "Targets", field: targetSummary, align: "left" },
  {
    name: "next",
    label: "Next run",
    field: (r) =>
      r.enabled && r.next_runs?.length
        ? formatRun(r.next_runs[0].start, r.timezone)
        : "—",
    align: "left",
  },
  { name: "actions", label: "", field: "id", align: "right" },
];

const HEADER_TIPS = {
  enabled: "Off keeps the schedule but it never runs",
  kind: "Maintenance window, sleep or wake",
  when: "Start time in each device's own time zone, and how long it lasts",
  targets:
    "Every agent in these clients and sites, plus agents picked one by one",
  next: "Next start of the schedule, shown in the server time zone",
};

async function load() {
  loading.value = true;
  error.value = "";
  try {
    rows.value = await fetchSchedules();
  } catch {
    rows.value = [];
    error.value = "The schedules could not be loaded.";
  }
  loading.value = false;
}

function edit(schedule) {
  $q.dialog({ component: ScheduleForm, componentProps: { schedule } }).onOk(
    load,
  );
}

function remove(schedule) {
  $q.dialog({
    title: `Delete ${schedule.name}?`,
    message:
      "Runs in progress stop and leave their devices awake. This cannot be undone.",
    cancel: { label: "Cancel", flat: true },
    ok: { label: "Delete", color: "negative" },
  }).onOk(async () => {
    try {
      await removeSchedule(schedule.id);
      notifySuccess(`${schedule.name} was deleted`);
    } catch {
      // error toast from axios boot (ignore)
    }
    load();
  });
}

onMounted(load);
</script>
