<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-dialog ref="dialogRef" persistent @hide="onDialogHide">
    <q-card class="q-dialog-plugin rmm-dialog--md">
      <DialogHeader
        title="Customize Email"
        subtitle="Leave a field blank to use its default"
      />
      <q-form @submit="onDialogOK({ ...settings })">
        <q-card-section class="q-gutter-y-sm">
          <q-input
            v-model="settings.subject"
            dense
            outlined
            label="Subject"
            :rules="[singleLine]"
            hint="Default: 'Scheduled Report: <template name>'"
          />
          <q-input
            v-model="settings.body"
            type="textarea"
            outlined
            autogrow
            label="Body"
            hint="Default: 'Your report is attached.'"
          />
          <q-input
            v-model="settings.attachment_name"
            dense
            outlined
            label="Attachment Name"
            hint="Without the extension; defaults to the template name"
            :rules="[singleLine]"
          />
          <q-input
            v-if="format === 'plaintext'"
            v-model="settings.attachment_extension"
            dense
            outlined
            prefix="."
            label="Attachment Extension"
            hint="Without the dot, e.g. csv, json or txt; defaults to txt"
            :rules="[extensionRule]"
          />
          <template v-if="format === 'html'">
            <q-checkbox
              v-model="settings.include_report_link"
              dense
              label="Include a link to view the report online"
            />
            <div class="rmm-muted text-caption">
              Added at the end of the email body. Opening it requires signing in
              to the dashboard.
            </div>
          </template>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat no-caps label="Cancel" @click="onDialogCancel" />
          <q-btn v-bind="primaryBtn" label="Save" type="submit" />
        </q-card-actions>
      </q-form>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { reactive } from "vue";
import { useDialogPluginComponent } from "quasar";
import DialogHeader from "@/components/ui/DialogHeader.vue";

import type { EmailSettings, ReportFormat } from "@/reporting/types";

const primaryBtn = { unelevated: true, "no-caps": true, color: "primary" };

const props = defineProps<{
  emailSettings: Partial<EmailSettings>;
  format: ReportFormat;
}>();

defineEmits([...useDialogPluginComponent.emits]);

const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } =
  useDialogPluginComponent();

// hidden fields keep their earlier values
const settings = reactive<EmailSettings>({
  subject: props.emailSettings.subject ?? "",
  body: props.emailSettings.body ?? "",
  attachment_name: props.emailSettings.attachment_name ?? "",
  attachment_extension: props.emailSettings.attachment_extension ?? "",
  include_report_link: props.emailSettings.include_report_link ?? false,
});

// the server checks these as well
function singleLine(value: string) {
  return !/[\r\n]/.test(value ?? "") || "Must fit on one line";
}

function extensionRule(value: string) {
  return (
    !value ||
    /^[A-Za-z0-9]{1,8}$/.test(value) ||
    "Letters and digits only, up to 8"
  );
}
</script>
