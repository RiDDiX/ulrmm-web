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
      <DialogHeader title="Base Templates">
        <template #actions>
          <q-btn
            dense
            flat
            icon="refresh"
            class="q-mr-sm"
            aria-label="Refresh base templates"
            :loading="isLoading"
            @click="getReportHTMLTemplates"
          >
            <q-tooltip>Reload the base templates</q-tooltip>
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
          label="New base template"
          class="q-px-sm"
          @click="openForm()"
        />
        <q-space />
        <span class="rmm-muted rmm-num">
          {{ htmlTemplates.length }}
          {{ htmlTemplates.length === 1 ? "base template" : "base templates" }}
        </span>
        <q-input
          v-model="search"
          dense
          outlined
          clearable
          debounce="150"
          placeholder="Search base templates"
          aria-label="Search base templates"
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
        :rows="htmlTemplates"
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
              title="No base templates match your search"
              text="Clear the search to see every base template."
            />
            <EmptyState
              v-else
              class="full-width"
              icon="web"
              title="No base templates yet"
              text="A base template is shared HTML, such as a letterhead, that report templates are placed into."
            >
              <q-btn
                v-if="canManageReports"
                unelevated
                no-caps
                color="primary"
                icon="add"
                label="New base template"
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
import ReportHTMLTemplateForm from "@/reporting/components/ReportHTMLTemplateForm.vue";
import { useReportHTMLTemplatesShared } from "@/reporting/stores";
import { useReportingPerms } from "@/reporting/permissions";

import type { ReportHTMLTemplate } from "@/reporting/types";
import type { MenuItem } from "@/types/menu";

defineEmits([...useDialogPluginComponent.emits]);

const $q = useQuasar();
const { dialogRef, onDialogHide } = useDialogPluginComponent();
const { canManageReports } = useReportingPerms();
const {
  htmlTemplates,
  isLoading,
  getReportHTMLTemplates,
  deleteReportHTMLTemplate,
} = useReportHTMLTemplatesShared;

const allRows = { rowsPerPage: 0 };
const search = ref("");

const columns: QTableColumn<ReportHTMLTemplate>[] = [
  { name: "name", label: "Name", field: "name", align: "left", sortable: true },
  { name: "actions", label: "Actions", field: () => "", align: "right" },
];

function openForm(template?: ReportHTMLTemplate, clone = false) {
  $q.dialog({
    component: ReportHTMLTemplateForm,
    componentProps: clone ? { cloneTemplate: template } : { template },
  });
}

function deleteTemplate(template: ReportHTMLTemplate) {
  $q.dialog({
    title: `Delete base template ${template.name}?`,
    message:
      "If this template is in use you will need to change it in every report template",
    cancel: true,
    ok: { label: "Delete", color: "negative" },
  }).onOk(() => deleteReportHTMLTemplate(template.id));
}

function menuItems(template: ReportHTMLTemplate): MenuItem[] {
  return [
    { label: "Edit", action: () => openForm(template) },
    { label: "Clone", action: () => openForm(template, true) },
    { separator: true },
    {
      label: "Delete",
      negative: true,
      action: () => deleteTemplate(template),
    },
  ];
}

onMounted(getReportHTMLTemplates);
</script>
