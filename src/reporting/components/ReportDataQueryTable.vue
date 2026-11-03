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
      <DialogHeader title="Data Queries">
        <template #actions>
          <q-btn
            dense
            flat
            icon="refresh"
            class="q-mr-sm"
            aria-label="Refresh data queries"
            :loading="isLoading"
            @click="getReportDataQueries"
          >
            <q-tooltip>Reload the saved data queries</q-tooltip>
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
          label="New data query"
          class="q-px-sm"
          @click="openForm()"
        />
        <q-space />
        <span class="rmm-muted rmm-num">
          {{ dataQueries.length }}
          {{ dataQueries.length === 1 ? "query" : "queries" }}
        </span>
        <q-input
          v-model="search"
          dense
          outlined
          clearable
          debounce="150"
          placeholder="Search data queries"
          aria-label="Search data queries"
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
        :rows="dataQueries"
        :columns="columns"
        :filter="search"
        :loading="isLoading"
        :pagination="allRows"
        :rows-per-page-options="[0]"
        row-key="id"
        binary-state-sort
        virtual-scroll
        v-sortable-headers
      >
        <template #loading>
          <q-inner-loading showing color="primary" />
        </template>

        <template #no-data>
          <template v-if="!isLoading">
            <EmptyState
              v-if="search"
              class="full-width"
              icon="filter_alt_off"
              title="No data queries match your search"
              text="Clear the search to see every saved query."
            />
            <EmptyState
              v-else
              class="full-width"
              icon="storage"
              title="No data queries yet"
              text="A data query is a saved, read-only database query that report templates can reuse."
            >
              <q-btn
                v-if="canManageReports"
                unelevated
                no-caps
                color="primary"
                icon="add"
                label="New data query"
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
import DialogHeader from "@/components/ui/DialogHeader.vue";
import EmptyState from "@/components/ui/EmptyState.vue";
import RowActions from "@/components/ui/RowActions.vue";
import { sortableHeaders as vSortableHeaders } from "@/utils/sortableHeaders";
import MenuList from "@/components/ui/MenuList.vue";
import ReportDataQueryForm from "@/reporting/components/ReportDataQueryForm.vue";
import { useReportDataQueriesShared } from "@/reporting/stores";
import { useReportingPerms } from "@/reporting/permissions";

import type { ReportDataQuery } from "@/reporting/types";
import type { MenuItem } from "@/types/menu";

defineEmits([...useDialogPluginComponent.emits]);

const $q = useQuasar();
const { dialogRef, onDialogHide } = useDialogPluginComponent();
const { canManageReports } = useReportingPerms();
const { dataQueries, isLoading, getReportDataQueries, deleteReportDataQuery } =
  useReportDataQueriesShared;

const allRows = { rowsPerPage: 0 };
const search = ref("");

const columns: QTableColumn<ReportDataQuery>[] = [
  { name: "name", label: "Name", field: "name", align: "left", sortable: true },
  { name: "actions", label: "Actions", field: () => "", align: "right" },
];

function openForm(dataQuery?: ReportDataQuery, clone = false) {
  $q.dialog({
    component: ReportDataQueryForm,
    componentProps: { dataQuery, clone },
  });
}

function deleteQuery(query: ReportDataQuery) {
  $q.dialog({
    title: `Delete data query ${query.name}?`,
    message:
      "If this query is in use you will need to change it in every report template",
    cancel: true,
    ok: { label: "Delete", color: "negative" },
  }).onOk(() => deleteReportDataQuery(query.id));
}

function menuItems(query: ReportDataQuery): MenuItem[] {
  return [
    { label: "Clone", action: () => openForm(query, true) },
    { label: "Edit", action: () => openForm(query) },
    { separator: true },
    {
      label: "Delete",
      negative: true,
      action: () => deleteQuery(query),
    },
  ];
}

onMounted(getReportDataQueries);
</script>
