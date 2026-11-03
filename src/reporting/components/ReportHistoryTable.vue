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
      <DialogHeader title="Report History">
        <template #actions>
          <q-btn
            dense
            flat
            icon="refresh"
            class="q-mr-sm"
            aria-label="Refresh report history"
            :loading="isLoading"
            @click="getReportHistory"
          >
            <q-tooltip>Reload the report run history</q-tooltip>
          </q-btn>
        </template>
      </DialogHeader>

      <div class="rmm-toolbar">
        <span class="rmm-muted text-caption">
          Every report run is kept here until Global Settings > Retention
          removes it
        </span>
        <q-space />
        <span class="rmm-muted rmm-num">
          {{ history.length }} {{ history.length === 1 ? "run" : "runs" }}
        </span>
        <q-input
          v-model="search"
          dense
          outlined
          clearable
          debounce="150"
          placeholder="Search runs"
          aria-label="Search runs"
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
        :rows="history"
        :filter-method="searchHistory"
        :filter="search"
        :loading="isLoading"
        row-key="id"
        :pagination="newestFirst"
        :rows-per-page-options="[0]"
        binary-state-sort
        virtual-scroll
        v-sortable-headers
      >
        <template #header-cell-result="props">
          <q-th :props="props">
            {{ props.col.label }}
            <q-tooltip>
              Whether the report was generated; click Failed to see the error
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
              title="No runs match your search"
              text="Clear the search to see every report run."
            />
            <EmptyState
              v-else
              class="full-width"
              icon="history"
              title="No report runs yet"
              text="Runs show up here once a report is opened, downloaded, emailed or run on a schedule."
            />
          </template>
        </template>

        <template #body="props">
          <q-tr :props="props">
            <q-menu context-menu>
              <MenuList :items="menuItems(props.row)" with-close />
            </q-menu>
            <q-td key="report_template_name" :props="props">
              {{ props.row.report_template_name }}
            </q-td>
            <q-td key="result" :props="props">
              <q-btn
                v-if="props.row.error_data"
                flat
                dense
                no-caps
                size="sm"
                color="negative"
                icon="warning"
                label="Failed"
                class="q-px-sm"
                :aria-label="`Failed: show error for ${props.row.report_template_name}`"
                @click.stop="showError(props.row)"
              >
                <q-tooltip>Show why this run failed</q-tooltip>
              </q-btn>
              <span v-else class="rmm-pill rmm-pill--positive">Generated</span>
            </q-td>
            <q-td key="report_template_type" :props="props">
              {{ historyTypeLabel(props.row.report_template_type) }}
            </q-td>
            <q-td key="run_by" :props="props">{{ props.row.run_by }}</q-td>
            <q-td key="date_created" :props="props">
              {{ formatDate(props.row.date_created) }}
            </q-td>
            <q-td key="actions" :props="props" @click.stop>
              <RowActions
                :label="`Actions for ${props.row.report_template_name}`"
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
import { useReportHistoryShared } from "@/reporting/stores";
import { useReportingPerms } from "@/reporting/permissions";
import { downloadHistoryReport, openHistoryReport } from "@/reporting/actions";
import { capitalize } from "@/utils/format";
import { searchWithRaw } from "@/reporting/utils";

import type { ReportFormat, ReportHistory } from "@/reporting/types";
import type { MenuItem } from "@/types/menu";

defineEmits([...useDialogPluginComponent.emits]);

const $q = useQuasar();
const store = useStore();
const { dialogRef, onDialogHide } = useDialogPluginComponent();
const { canManageReports } = useReportingPerms();
const { history, isLoading, getReportHistory, deleteReportHistory } =
  useReportHistoryShared;

const search = ref("");
const newestFirst = {
  sortBy: "date_created",
  descending: true,
  rowsPerPage: 0,
};

// the history list shows the raw type capitalized: Html, Plaintext, Markdown
const historyTypeLabel = (type: string) => (type ? capitalize(type) : "");

// in the user's date format
const formatDate = (value: string) => store.getters.formatDate(value);

// failed runs match on their error text as well
const searchHistory = searchWithRaw((row: ReportHistory) => [row.error_data]);

const leftCol = (
  name: keyof ReportHistory & string,
  label: string,
  extra: Partial<QTableColumn<ReportHistory>> = {},
): QTableColumn<ReportHistory> => ({
  name,
  label,
  field: name,
  align: "left",
  sortable: true,
  ...extra,
});

const columns: QTableColumn<ReportHistory>[] = [
  leftCol("report_template_name", "Template"),
  leftCol("error_data", "Result", {
    name: "result",
    field: (row) => (row.error_data ? "Failed" : "Generated"),
  }),
  leftCol("report_template_type", "Template Type", {
    format: historyTypeLabel,
  }),
  // the user who ran it or the schedule owner; "system" without an owner
  leftCol("run_by", "Run By"),
  leftCol("date_created", "Date Created"),
  { name: "actions", label: "Actions", field: () => "", align: "right" },
];

// error text is shown as plain text, never as markup
function showError(row: ReportHistory) {
  $q.dialog({
    title: "Report error",
    message: row.error_data ?? "",
    style: "white-space: pre-wrap; max-width: 720px",
  });
}

function deleteRun(row: ReportHistory) {
  $q.dialog({
    title: `Delete this run of ${row.report_template_name}?`,
    cancel: true,
    message: "This will remove the history entry permanently.",
    ok: { color: "negative", label: "Delete" },
  }).onOk(() => deleteReportHistory(row.id));
}

function menuItems(row: ReportHistory): MenuItem[] {
  const failed = !!row.error_data;
  const text = row.report_template_type === "plaintext";
  const second: ReportFormat = text ? "plaintext" : "html";
  const items: MenuItem[] = [];
  if (failed)
    items.push({
      header: true,
      label: "This run failed, so there is nothing to open or download",
    });
  items.push(
    {
      label: "Open PDF Report",
      icon: "mdi-file-pdf-box",
      disabled: failed,
      action: () => openHistoryReport(row.id, "pdf"),
    },
    {
      label: text ? "Open Text Report" : "Open HTML Report",
      icon: text ? "description" : "code",
      disabled: failed,
      action: () => openHistoryReport(row.id, second),
    },
    { separator: true },
    {
      label: "Download PDF Report",
      icon: "mdi-download",
      disabled: failed,
      action: () => downloadHistoryReport(row, "pdf"),
    },
    {
      label: text ? "Download Text Report" : "Download HTML Report",
      icon: "mdi-download",
      disabled: failed,
      action: () => downloadHistoryReport(row, second),
    },
  );
  if (canManageReports.value)
    items.push(
      { separator: true },
      {
        label: "Delete",
        icon: "delete",
        negative: true,
        action: () => deleteRun(row),
      },
    );
  return items;
}

onMounted(getReportHistory);
</script>
