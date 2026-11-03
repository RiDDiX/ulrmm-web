<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide">
    <q-card class="q-dialog-plugin rmm-dialog--sm">
      <DialogHeader
        :title="`${download ? 'Download' : 'Run'} ${typeName} Report`"
        :subtitle="
          download
            ? `Saves a report for this ${type} as a file`
            : `Opens a report for this ${type} in a new tab`
        "
      />
      <q-form @submit="submit">
        <q-card-section class="q-gutter-y-sm">
          <EmptyState
            v-if="!isLoading && templates.length === 0"
            icon="summarize"
            :title="`No report templates for this ${type}`"
            :text="`Add ${type} to a template's Template Dependencies in the Reports Manager to list it here.`"
          />
          <template v-else>
            <RmmSelect
              v-model="templateId"
              :options="options"
              label="Report Template"
              map-options
              filterable
              :loading="isLoading"
            />
            <div v-if="template" class="row items-center q-gutter-x-md">
              <span class="rmm-label">Format</span>
              <q-radio v-model="format" val="pdf" label="PDF" dense />
              <q-radio
                v-model="format"
                :val="secondFormat"
                :label="template.type === 'plaintext' ? 'Text' : 'HTML'"
                dense
              />
            </div>
          </template>
        </q-card-section>
        <q-card-actions v-if="isLoading || templates.length > 0" align="right">
          <q-btn flat no-caps label="Cancel" @click="onDialogCancel" />
          <q-btn
            v-if="templates.length > 0"
            unelevated
            no-caps
            color="primary"
            type="submit"
            :label="download ? 'Download Report' : 'Run Report'"
            :disable="!template"
          >
            <q-tooltip v-if="!template">Pick a report template first</q-tooltip>
          </q-btn>
        </q-card-actions>
      </q-form>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { computed, onBeforeMount, ref, watch } from "vue";
import { useDialogPluginComponent } from "quasar";
import DialogHeader from "@/components/ui/DialogHeader.vue";
import EmptyState from "@/components/ui/EmptyState.vue";
import RmmSelect from "@/components/ui/RmmSelect.vue";
import { capitalize } from "@/utils/format";
import { notifyError } from "@/utils/notify";
import { useReportTemplates } from "@/reporting/stores";
import { downloadReport, openReport } from "@/reporting/actions";

import type { ReportFormat } from "@/reporting/types";

const props = defineProps<{
  // client or site id, or the agent's agent_id
  id: number | string;
  type: "client" | "site" | "agent";
  download?: boolean;
}>();

defineEmits([...useDialogPluginComponent.emits]);

const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } =
  useDialogPluginComponent();

// its own list, so the filtered result never replaces the shared one
const { templates, isLoading, getReportTemplates } = useReportTemplates();

const typeName = capitalize(props.type);
const templateId = ref<number | null>(null);
const format = ref<ReportFormat>("pdf");

const options = computed(() =>
  templates.value.map((template) => ({
    label: template.name,
    value: template.id,
  })),
);
const template = computed(() =>
  templates.value.find((entry) => entry.id === templateId.value),
);
const secondFormat = computed<ReportFormat>(() =>
  template.value?.type === "plaintext" ? "plaintext" : "html",
);

watch(templateId, () => (format.value = "pdf"));

onBeforeMount(() => getReportTemplates([props.type]));

function submit() {
  if (!template.value) {
    notifyError("Report Template is required.");
    return;
  }
  const presets = { [props.type]: props.id };
  if (props.download) downloadReport(template.value, format.value, presets);
  else openReport(template.value, format.value, presets);
  onDialogOK();
}
</script>
