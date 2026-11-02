<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-dialog
    ref="dialogRef"
    :aria-labelledby="titleId"
    @hide="onDialogHide"
    persistent
  >
    <q-card class="q-dialog-plugin rmm-dialog--sm">
      <DialogHeader :title="title" :title-id="titleId" />

      <q-card-section class="confirm-yes__body">
        <div v-if="consequence" class="confirm-yes__consequence">
          <q-icon name="warning_amber" size="18px" />
          <span>{{ consequence }}</span>
        </div>
        <div>
          To confirm {{ actionVerb }} of
          <strong class="confirm-yes__target">{{ hostname }}</strong
          >, type
          <code class="confirm-yes__token">{{ confirmText }}</code>
          below.
        </div>
      </q-card-section>

      <q-card-section class="q-pt-none q-gutter-y-sm">
        <q-input
          v-model="model"
          autofocus
          outlined
          dense
          :label="`Type ${confirmText} to confirm`"
        />
        <q-input
          v-if="requireTotp"
          v-model="code"
          class="rmm-otp"
          outlined
          dense
          label="Two-factor code"
          autocomplete="one-time-code"
          inputmode="numeric"
          maxlength="6"
          hint="The current code from your authenticator app"
        />
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat no-caps label="Cancel" @click="onDialogCancel" />
        <q-btn
          unelevated
          no-caps
          :color="okColor"
          :label="okLabel"
          :disable="!ready"
          @click="onDialogOK(code)"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { ref, computed, getCurrentInstance } from "vue";
import { useDialogPluginComponent } from "quasar";
import DialogHeader from "@/components/ui/DialogHeader.vue";

const props = defineProps({
  hostname: { type: String, required: true },
  // "yes" ignores case. anything else has to match exactly.
  confirmText: { type: String, default: "yes" },
  // onOk gets the code. the server checks it.
  requireTotp: { type: Boolean, default: false },
  actionVerb: { type: String, required: true },
  title: { type: String, default: "Confirm action" },
  okLabel: { type: String, default: "Confirm" },
  okColor: { type: String, default: "negative" },
  consequence: { type: String, default: "" },
});

defineEmits([...useDialogPluginComponent.emits]);
const titleId = `confirm-yes-title-${getCurrentInstance()?.uid}`;

const model = ref("");
const code = ref("");

function matches(val) {
  return props.confirmText === "yes"
    ? (val || "").toLowerCase() === "yes"
    : val === props.confirmText;
}

const ready = computed(
  () =>
    matches(model.value) &&
    (!props.requireTotp || /^\d{6}$/.test(code.value || "")),
);

const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } =
  useDialogPluginComponent();
</script>

<style scoped>
.confirm-yes__body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.confirm-yes__consequence {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 12px;
  border: 1px solid color-mix(in srgb, var(--q-negative) 28%, transparent);
  border-radius: var(--rmm-radius-sm);
  background: color-mix(in srgb, var(--q-negative) 8%, var(--rmm-surface));
}

.confirm-yes__consequence .q-icon {
  flex-shrink: 0;
  color: var(--rmm-status-negative);
}

.confirm-yes__target {
  overflow-wrap: anywhere;
}

.confirm-yes__token {
  padding: 1px 6px;
  border: 1px solid var(--rmm-border);
  border-radius: 4px;
  color: var(--rmm-status-negative);
  background: var(--rmm-surface-2);
  font-family: var(--rmm-mono);
  font-weight: 600;
  overflow-wrap: anywhere;
}
</style>
