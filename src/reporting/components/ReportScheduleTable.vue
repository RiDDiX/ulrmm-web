<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-dialog
    ref="dialogRef"
    maximized
    transition-show="slide-up"
    transition-hide="slide-down"
    @hide="onDialogHide"
  >
    <q-card class="column no-wrap">
      <DialogHeader title="Report Schedules">
        <template #actions>
          <q-btn
            dense
            flat
            icon="refresh"
            class="q-mr-sm"
            aria-label="Refresh report schedules"
            :loading="isLoading"
            @click="getReportSchedules"
          >
            <q-tooltip>Reload the report schedules</q-tooltip>
          </q-btn>
        </template>
      </DialogHeader>

      <div class="rmm-toolbar">
        <q-btn
          v-if="canManageReports"
          unelevated
          no-caps
          dense
          color="primary"
          icon="add"
          label="New schedule"
          class="q-px-sm"
          @click="openForm()"
        />
        <q-space />
        <span class="rmm-muted rmm-num">
          {{ schedules.length }}
          {{ schedules.length === 1 ? "schedule" : "schedules" }}
        </span>
        <q-input
          v-model="search"
          dense
          outlined
          clearable
          debounce="150"
          placeholder="Search schedules"
          aria-label="Search schedules"
          style="width: 240px"
        >
          <template #prepend>
            <q-icon name="search" class="rmm-muted" />
          </template>
        </q-input>
      </div>

      <q-table
        dense
        flat
        class="rmm-table col"
        style="min-height: 0"
        :columns="columns"
        :rows="schedules"
        :loading="isLoading"
        :filter="search"
        :pagination="allRows"
        row-key="id"
        :rows-per-page-options="[0]"
        binary-state-sort
        virtual-scroll
        v-sortable-headers
      >
        <template #header-cell-send_report_email="props">
          <q-th :props="props">
            {{ props.col.label }}
            <q-tooltip>
              Whether each run is emailed; every run is kept in the run history
            </q-tooltip>
          </q-th>
        </template>

        <template #header-cell-owner_name="props">
          <q-th :props="props">
            {{ props.col.label }}
            <q-tooltip>
              Runs see only the clients and sites this user's role may see
            </q-tooltip>
          </q-th>
        </template>

        <template #loading>
          <q-inner-loading showing color="primary" />
        </template>

        <template #no-data>
          <template v-if="!isLoading">
            <EmptyState
              v-if="search"
              class="full-width"
              icon="filter_alt_off"
              title="No schedules match your search"
              text="Clear the search to see every report schedule."
            />
            <EmptyState
              v-else
              class="full-width"
              icon="event_repeat"
              title="No report schedules yet"
              text="A schedule runs a report template at set times and can email the result."
            >
              <q-btn
                v-if="canManageReports"
                unelevated
                no-caps
                color="primary"
                icon="add"
                label="New schedule"
                @click="openForm()"
              />
            </EmptyState>
          </template>
        </template>

        <template #body="props">
          <q-tr
            :props="props"
            class="cursor-pointer"
            @dblclick="canManageReports && openForm(props.row)"
          >
            <q-menu v-if="canManageReports" context-menu>
              <MenuList :items="menuItems(props.row)" with-close />
            </q-menu>
            <q-td key="name" :props="props">{{ props.row.name }}</q-td>
            <q-td key="enabled" :props="props">
              <span
                class="rmm-pill"
                :class="
                  props.row.enabled ? 'rmm-pill--positive' : 'rmm-pill--neutral'
                "
              >
                {{ props.row.enabled ? "Enabled" : "Disabled" }}
              </span>
            </q-td>
            <q-td key="report_template_name" :props="props">
              {{ props.row.report_template_name }}
            </q-td>
            <q-td key="format" :props="props">
              {{ formatLabel(props.row.format) }}
            </q-td>
            <q-td key="schedule_name" :props="props">
              {{ props.row.schedule_name }}
            </q-td>
            <q-td key="email_recipients" :props="props">
              <template v-if="props.row.email_recipients.length">
                {{ props.row.email_recipients.join(", ") }}
              </template>
              <span v-else class="rmm-muted">
                Default recipients
                <q-tooltip>
                  Emails go to the recipients set in Global Settings
                </q-tooltip>
              </span>
            </q-td>
            <q-td key="send_report_email" :props="props">
              {{ props.row.send_report_email ? "Yes" : "No" }}
            </q-td>
            <q-td key="owner_name" :props="props">
              <template v-if="props.row.owner_name">
                {{ props.row.owner_name }}
              </template>
              <span v-else class="text-warning">
                No owner (runs unscoped)
                <q-tooltip>
                  Saved before schedules had owners. Save it again to make you
                  the owner; its runs then use your role's scope
                </q-tooltip>
              </span>
            </q-td>
            <q-td key="last_run" :props="props">
              {{
                props.row.last_run ? formatDate(props.row.last_run) : "Never"
              }}
            </q-td>
            <q-td key="actions" :props="props" @click.stop>
              <RowActions
                v-if="canManageReports"
                :label="`Actions for ${props.row.name}`"
              >
                <MenuList :items="menuItems(props.row)" />
              </RowActions>
            </q-td>
          </q-tr>
        </template>
      </q-table>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useDialogPluginComponent, useQuasar, type QTableColumn } from "quasar";
import { useStore } from "vuex";
import DialogHeader from "@/components/ui/DialogHeader.vue";
import EmptyState from "@/components/ui/EmptyState.vue";
import RowActions from "@/components/ui/RowActions.vue";
import { sortableHeaders as vSortableHeaders } from "@/utils/sortableHeaders";
import MenuList from "@/components/ui/MenuList.vue";
import ReportScheduleForm from "@/reporting/components/ReportScheduleForm.vue";
import { useReportSchedulesShared } from "@/reporting/stores";
import { useReportingPerms } from "@/reporting/permissions";

import type { ReportSchedule } from "@/reporting/types";
import type { MenuItem } from "@/types/menu";

defineEmits([...useDialogPluginComponent.emits]);

const $q = useQuasar();
const store = useStore();
const { dialogRef, onDialogHide } = useDialogPluginComponent();
const { canManageReports } = useReportingPerms();
const {
  schedules,
  isLoading,
  getReportSchedules,
  deleteReportSchedule,
  runReportSchedule,
} = useReportSchedulesShared;

const allRows = { rowsPerPage: 0 };
const search = ref("");

// in the user's date format
const formatDate = (value: string) => store.getters.formatDate(value);

const FORMAT_LABELS: Record<string, string> = {
  pdf: "PDF",
  html: "HTML",
  plaintext: "Plain text",
};
const formatLabel = (format: string) => FORMAT_LABELS[format] ?? format ?? "";

const yesNo = (value: boolean) => (value ? "Yes" : "No");

function col(
  field: keyof ReportSchedule & string,
  label: string,
  extra: Partial<QTableColumn<ReportSchedule>> = {},
): QTableColumn<ReportSchedule> {
  return { name: field, label, field, align: "left", sortable: true, ...extra };
}

const columns: QTableColumn<ReportSchedule>[] = [
  col("name", "Name"),
  col("enabled", "Enabled", { format: yesNo }),
  col("report_template_name", "Template"),
  col("format", "Format", { format: formatLabel }),
  col("schedule_name", "Schedule"),
  col("email_recipients", "Recipients", {
    sortable: false,
    format: (value: string[]) => value.join(", "),
  }),
  col("send_report_email", "Send Email", { align: "center", format: yesNo }),
  col("owner_name", "Owner"),
  col("last_run", "Last Run", {
    align: "center",
    format: (value?: string | null) => (value ? formatDate(value) : "Never"),
  }),
  { name: "actions", label: "Actions", field: () => "", align: "right" },
];

function openForm(schedule?: ReportSchedule, clone = false) {
  $q.dialog({
    component: ReportScheduleForm,
    componentProps: { schedule, clone },
  });
}

function deleteSchedule(schedule: ReportSchedule) {
  $q.dialog({
    title: `Delete schedule ${schedule.name}?`,
    message: "This action cannot be undone.",
    cancel: true,
    ok: { color: "negative", label: "Delete" },
  }).onOk(() => deleteReportSchedule(schedule.id));
}

function menuItems(schedule: ReportSchedule): MenuItem[] {
  return [
    {
      label: "Run Scheduled Report",
      caption: "Runs it now and emails it if email is on",
      action: () => runReportSchedule(schedule.id),
    },
    { separator: true },
    { label: "Edit", action: () => openForm(schedule) },
    { label: "Clone", action: () => openForm(schedule, true) },
    { separator: true },
    {
      label: "Delete",
      negative: true,
      action: () => deleteSchedule(schedule),
    },
  ];
}

onMounted(getReportSchedules);
</script>
