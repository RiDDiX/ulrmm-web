<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide">
    <q-card class="q-dialog-plugin rmm-dialog--md">
      <DialogHeader
        title="Import Report Template"
        subtitle="Adds a template, with its base template and assets, from an export file"
      />
      <q-form @submit="submit">
        <q-card-section class="q-gutter-y-sm">
          <q-file
            v-model="file"
            accept=".json"
            outlined
            dense
            label="Import File"
            hint="A .json file made with Export in the Reports Manager"
          >
            <template #prepend>
              <q-icon name="attach_file" />
            </template>
          </q-file>
          <div class="items-center row">
            <q-checkbox
              v-model="overwrite"
              dense
              label="Overwrite if name exists"
            />
            <HelpTip
              text="On: replaces a template or base template with the same name. Off: imports it under a new name."
            />
          </div>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat no-caps label="Cancel" @click="onDialogCancel" />
          <q-btn
            :loading="isLoading"
            v-bind="primaryBtn"
            label="Import"
            type="submit"
          />
        </q-card-actions>
      </q-form>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { ref } from "vue";
import DialogHeader from "@/components/ui/DialogHeader.vue";
import { useDialogPluginComponent } from "quasar";
import HelpTip from "@/components/ui/HelpTip.vue";
import { notifyError } from "@/utils/notify";
import { useReportTemplatesShared } from "@/reporting/stores";

const primaryBtn = { unelevated: true, "no-caps": true, color: "primary" };

defineEmits([...useDialogPluginComponent.emits]);

const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } =
  useDialogPluginComponent();
const { isLoading, importReportTemplate } = useReportTemplatesShared;

const file = ref<File | null>(null);
const overwrite = ref(false);

async function submit() {
  if (!file.value) {
    notifyError("File is required");
    return;
  }
  let text: string;
  try {
    text = await file.value.text();
  } catch (e) {
    console.error(e);
    notifyError("The file could not be read");
    return;
  }
  if (
    await importReportTemplate({ overwrite: overwrite.value, template: text })
  )
    onDialogOK();
}
</script>
