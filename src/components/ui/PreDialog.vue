<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-dialog ref="dialogRef" :aria-labelledby="titleId" @hide="onDialogHide">
    <q-card class="q-dialog-plugin" :style="dialogStyle">
      <DialogHeader :title="title" :title-id="titleId">
        <template #actions>
          <q-btn
            icon="content_copy"
            aria-label="Copy output to clipboard"
            size="md"
            flat
            dense
            @click="copyOutput(message)"
          >
            <q-tooltip>Copy output to clipboard</q-tooltip>
          </q-btn>
        </template>
      </DialogHeader>

      <q-card-section>
        <pre class="q-pa-sm">{{ message }}</pre>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn label="OK" color="primary" unelevated @click="onDialogOK()" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { getCurrentInstance } from "vue";
import { useDialogPluginComponent } from "quasar";
import { copyOutput } from "@/utils/helpers";
import DialogHeader from "@/components/ui/DialogHeader.vue";

defineProps({
  title: { type: String, required: true },
  dialogStyle: { type: [String, Object], default: () => ({}) },
  message: { type: String, default: "" },
});

defineEmits([...useDialogPluginComponent.emits]);

const titleId = `pre-dialog-title-${getCurrentInstance()?.uid}`;
const { dialogRef, onDialogHide, onDialogOK } = useDialogPluginComponent();
</script>
