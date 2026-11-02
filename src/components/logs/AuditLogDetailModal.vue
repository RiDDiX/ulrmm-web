<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-dialog
    ref="dialogRef"
    aria-labelledby="audit-detail-title"
    @hide="onDialogHide"
  >
    <q-card class="q-dialog-plugin" style="min-width: 70vw">
      <DialogHeader
        title-id="audit-detail-title"
        title="Audit log entry"
        subtitle="Values before and after the change, as the server recorded them"
      />
      <q-card-section class="q-pb-none">
        <div class="audit-detail__message">{{ log.message }}</div>
      </q-card-section>
      <q-card-section class="scroll" style="max-height: 65vh">
        <q-splitter v-model="splitterModel">
          <template #before>
            <div class="q-pr-sm">
              <div class="rmm-label q-mb-xs">Before</div>
              <pre class="audit-detail__value rmm-mono">{{
                shown(log.before_value)
              }}</pre>
            </div>
          </template>

          <template #after>
            <div class="q-pl-sm">
              <div class="rmm-label q-mb-xs">After</div>
              <pre class="audit-detail__value rmm-mono">{{
                shown(log.after_value)
              }}</pre>
            </div>
          </template>
        </q-splitter>
      </q-card-section>
      <q-card-actions align="right">
        <q-btn flat dense label="Close" v-close-popup />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { ref } from "vue";
import { useDialogPluginComponent } from "quasar";
import DialogHeader from "@/components/ui/DialogHeader.vue";

defineOptions({ name: "AuditLogDetail" });
defineEmits([...useDialogPluginComponent.emits]);
defineProps({ log: Object });

const { dialogRef, onDialogHide } = useDialogPluginComponent();
const splitterModel = ref(50);
// remote sessions and similar entries record no values
const shown = (value) =>
  value == null ? "Nothing recorded" : JSON.stringify(value, null, 4);
</script>

<style scoped>
.audit-detail__message {
  font-weight: 500;
  word-break: break-word;
}

.audit-detail__value {
  margin: 0;
  padding: 8px 10px;
  border: 1px solid var(--rmm-border);
  border-radius: var(--rmm-radius-sm);
  background: var(--rmm-surface-2);
  font-size: var(--rmm-fs-xs);
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
