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
      <DialogHeader
        title="Reports Manager"
        :subtitle="
          $q.screen.gt.xs
            ? 'Templates define what a report shows; open, email or schedule them from the row menu'
            : ''
        "
      >
        <template #actions>
          <q-btn
            dense
            flat
            icon="refresh"
            class="q-mr-sm"
            aria-label="Refresh report templates"
            :loading="isLoading"
            @click="getReportTemplates()"
          >
            <q-tooltip>Reload the report templates</q-tooltip>
          </q-btn>
        </template>
      </DialogHeader>

      <div class="rmm-toolbar wrap">
        <q-btn-dropdown
          v-if="canManageReports"
          unelevated
          no-caps
          dense
          color="primary"
          icon="add"
          label="New template"
          class="q-px-sm"
        >
          <q-list dense style="min-width: 260px">
            <q-item
              v-for="kind in templateKinds"
              :key="kind.type"
              clickable
              v-close-popup
              @click="newTemplate(kind.type)"
            >
              <q-item-section>
                <q-item-label>{{ kind.label }}</q-item-label>
                <q-item-label caption>{{ kind.caption }}</q-item-label>
              </q-item-section>
            </q-item>
            <q-separator />
            <q-item clickable v-close-popup @click="importTemplate">
              <q-item-section>
                <q-item-label>Import Report Template</q-item-label>
                <q-item-label caption
                  >From a JSON file made with Export</q-item-label
                >
              </q-item-section>
            </q-item>
          </q-list>
        </q-btn-dropdown>
        <q-btn
          v-for="tool in tools"
          :key="tool.label"
          flat
          dense
          no-caps
          class="q-px-sm"
          :icon="tool.icon"
          :label="tool.label"
          @click="openTool(tool.component)"
        >
          <q-tooltip>{{ tool.tooltip }}</q-tooltip>
        </q-btn>
        <q-space />
        <span class="rmm-muted rmm-num">
          {{ templates.length }}
          {{ templates.length === 1 ? "template" : "templates" }}
        </span>
        <q-input
          v-model="search"
          dense
          outlined
          clearable
          debounce="150"
          placeholder="Search templates"
          aria-label="Search templates"
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
        :rows="templates"
        :filter-method="searchTemplates"
        :filter="search"
        :loading="isLoading"
        row-key="id"
        :pagination="byName"
        binary-state-sort
        :rows-per-page-options="[0]"
        virtual-scroll
        v-sortable-headers
      >
        <template #header-cell-depends_on="props">
          <q-th :props="props">
            {{ props.col.label }}
            <q-tooltip>
              Values the report asks for when it runs, such as a client, site or
              agent
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
              title="No templates match your search"
              text="Clear the search to see every report template."
            />
            <EmptyState
              v-else
              class="full-width"
              icon="summarize"
              title="No report templates yet"
              text="A template defines what a report shows. Start a new one or import an exported template."
            >
              <template v-if="canManageReports">
                <q-btn
                  outline
                  no-caps
                  color="primary"
                  icon="add"
                  label="New Markdown template"
                  @click="newTemplate('markdown')"
                />
                <q-btn
                  flat
                  no-caps
                  color="primary"
                  label="Import template"
                  @click="importTemplate"
                />
              </template>
            </EmptyState>
          </template>
        </template>

        <template #body="props">
          <q-tr
            :props="props"
            class="cursor-pointer"
            @dblclick="canManageReports && editTemplate(props.row)"
          >
            <!-- centered on the click, same as the agent rows -->
            <q-menu context-menu anchor="center left" self="center left">
              <MenuList :items="menuItems(props.row)" with-close avatar-icons />
            </q-menu>
            <q-td key="name" :props="props">{{ props.row.name }}</q-td>
            <q-td key="type" :props="props">
              {{ typeLabel(props.row.type) }}
            </q-td>
            <q-td key="depends_on" :props="props">
              <template v-if="props.row.depends_on.length">
                {{ props.row.depends_on.join(", ") }}
              </template>
              <span v-else class="rmm-muted">None</span>
            </q-td>
            <q-td key="actions" :props="props" @click.stop>
              <RowActions :label="`Actions for ${props.row.name}`">
                <MenuList :items="menuItems(props.row)" avatar-icons />
              </RowActions>
            </q-td>
          </q-tr>
        </template>
      </q-table>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { onMounted, ref, type Component } from "vue";
import { useDialogPluginComponent, useQuasar, type QTableColumn } from "quasar";
import DialogHeader from "@/components/ui/DialogHeader.vue";
import EmptyState from "@/components/ui/EmptyState.vue";
import RowActions from "@/components/ui/RowActions.vue";
import { sortableHeaders as vSortableHeaders } from "@/utils/sortableHeaders";
import MenuList from "@/components/ui/MenuList.vue";
import ReportTemplateForm from "@/reporting/components/ReportTemplateForm.vue";
import ReportTemplateImport from "@/reporting/components/ReportTemplateImport.vue";
import ReportHTMLTemplateTable from "@/reporting/components/ReportHTMLTemplateTable.vue";
import ReportAssets from "@/reporting/components/ReportAssets.vue";
import ReportDataQueryTable from "@/reporting/components/ReportDataQueryTable.vue";
import ReportScheduleTable from "@/reporting/components/ReportScheduleTable.vue";
import ReportScheduleForm from "@/reporting/components/ReportScheduleForm.vue";
import ReportHistoryTable from "@/reporting/components/ReportHistoryTable.vue";
import { useReportTemplatesShared } from "@/reporting/stores";
import { useReportingPerms } from "@/reporting/permissions";
import {
  downloadReport,
  exportReportTemplate,
  openReport,
} from "@/reporting/actions";
import { searchWithRaw, templateTypeLabel } from "@/reporting/utils";

import type { ReportTemplate, ReportTemplateType } from "@/reporting/types";
import type { MenuItem } from "@/types/menu";

defineEmits([...useDialogPluginComponent.emits]);

const $q = useQuasar();
const { dialogRef, onDialogHide } = useDialogPluginComponent();
const { canManageReports } = useReportingPerms();
const { templates, isLoading, getReportTemplates, deleteReportTemplate } =
  useReportTemplatesShared;

const byName = { rowsPerPage: 0, sortBy: "name", descending: false };
const search = ref("");

const templateKinds: {
  type: ReportTemplateType;
  label: string;
  caption: string;
}[] = [
  {
    type: "markdown",
    label: "Markdown Template",
    caption: "Write the report in Markdown with Jinja variables",
  },
  {
    type: "html",
    label: "HTML Template",
    caption: "Full control over the markup and layout",
  },
  {
    type: "plaintext",
    label: "Plain Text Template",
    caption: "Text output such as CSV, without styling",
  },
];

const tools: {
  label: string;
  icon: string;
  tooltip: string;
  component: Component;
}[] = [
  {
    label: "Base Templates",
    icon: "web",
    tooltip: "Shared HTML wrappers that report templates can build on",
    component: ReportHTMLTemplateTable,
  },
  {
    label: "Report Assets",
    icon: "perm_media",
    tooltip: "Images and files that templates can embed",
    component: ReportAssets,
  },
  {
    label: "Data Queries",
    icon: "storage",
    tooltip: "Saved database queries that templates can reuse",
    component: ReportDataQueryTable,
  },
  {
    label: "Report Schedules",
    icon: "event_repeat",
    tooltip: "Reports that run and email on a schedule",
    component: ReportScheduleTable,
  },
  {
    label: "Report History",
    icon: "history",
    tooltip: "Reports that already ran, to open or download again",
    component: ReportHistoryTable,
  },
];

function col(
  field: keyof ReportTemplate & string,
  label: string,
  format?: (value: never) => string,
): QTableColumn<ReportTemplate> {
  return { name: field, label, field, align: "left", sortable: true, format };
}

const columns: QTableColumn<ReportTemplate>[] = [
  col("name", "Name"),
  col("type", "Template Type", (value: ReportTemplateType) =>
    templateTypeLabel(value),
  ),
  col("depends_on", "Template Dependencies", (value: string[]) =>
    value.join(", "),
  ),
  { name: "actions", label: "Actions", field: () => "", align: "right" },
];

const typeLabel = templateTypeLabel;

// the type key matches as well as its label
const searchTemplates = searchWithRaw((row: ReportTemplate) => [row.type]);

function openTool(component: Component) {
  $q.dialog({ component });
}

function newTemplate(type: ReportTemplateType) {
  $q.dialog({
    component: ReportTemplateForm,
    componentProps: { templateType: type },
  });
}

function editTemplate(template: ReportTemplate) {
  $q.dialog({
    component: ReportTemplateForm,
    componentProps: { templateType: template.type, reportTemplate: template },
  });
}

function cloneTemplate(template: ReportTemplate) {
  $q.dialog({
    component: ReportTemplateForm,
    componentProps: { templateType: template.type, cloneTemplate: template },
  });
}

function importTemplate() {
  $q.dialog({ component: ReportTemplateImport });
}

function scheduleTemplate(template: ReportTemplate, emailOnly = false) {
  $q.dialog({
    component: ReportScheduleForm,
    componentProps: { reportTemplate: template.id, emailOnly },
  });
}

function deleteTemplate(template: ReportTemplate) {
  $q.dialog({
    title: `Delete template: ${template.name}?`,
    cancel: true,
    ok: { label: "Delete", color: "negative" },
  }).onOk(() => deleteReportTemplate(template.id));
}

function menuItems(template: ReportTemplate): MenuItem[] {
  const text = template.type === "plaintext";
  const second = text ? "plaintext" : "html";
  const manage = canManageReports.value;
  const items: MenuItem[] = [];
  if (manage)
    items.push(
      { label: "Edit", icon: "edit", action: () => editTemplate(template) },
      {
        label: "Clone",
        icon: "content_copy",
        action: () => cloneTemplate(template),
      },
      { separator: true },
    );
  items.push(
    {
      label: "Open PDF Report",
      caption: "Runs the report in a new browser tab",
      icon: "picture_as_pdf",
      action: () => openReport(template, "pdf"),
    },
    {
      label: text ? "Open Text Report" : "Open HTML Report",
      icon: "open_in_new",
      action: () => openReport(template, second),
    },
    { separator: true },
    {
      label: "Download PDF Report",
      caption: "Asks for a file name, then runs the report",
      icon: "download",
      action: () => downloadReport(template, "pdf"),
    },
    {
      label: text ? "Download Text Report" : "Download HTML Report",
      icon: "download",
      action: () => downloadReport(template, second),
    },
    { separator: true },
  );
  if (manage)
    items.push({
      label: "Schedule Report",
      caption: "Run it on a schedule and email the result",
      icon: "event_repeat",
      action: () => scheduleTemplate(template),
    });
  items.push(
    {
      label: "Email Report",
      caption: "Run it once now and email the result",
      icon: "forward_to_inbox",
      action: () => scheduleTemplate(template, true),
    },
    { separator: true },
    {
      label: "Export",
      caption: "Save as a JSON file to import elsewhere",
      icon: "file_download",
      action: () => exportReportTemplate(template),
    },
  );
  if (manage)
    items.push(
      { separator: true },
      {
        label: "Delete",
        icon: "delete",
        negative: true,
        action: () => deleteTemplate(template),
      },
    );
  return items;
}

onMounted(() => getReportTemplates());
</script>
