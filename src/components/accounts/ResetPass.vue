<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide">
    <q-card class="rmm-dialog--md">
      <DialogHeader
        title="Change My Password"
        subtitle="Ends your other sessions and deletes your API keys; this one stays signed in"
      />
      <q-card-section class="q-pb-none">
        <PasswordField
          v-model="pass"
          v-model:shown="shown"
          label="New Password"
          :rules="[(val) => !!val || '*Required']"
        />
      </q-card-section>
      <q-card-section>
        <PasswordField
          v-model="pass2"
          v-model:shown="shown"
          label="Confirm"
          :rules="[(val) => val === pass || 'Passwords do not match']"
        />
      </q-card-section>
      <q-card-section class="q-pt-none">
        <q-input
          v-model="code"
          class="rmm-otp"
          label="Two-factor code"
          maxlength="6"
          inputmode="numeric"
          autocomplete="one-time-code"
          :error-message="codeError"
          :error="!!codeError"
          outlined
          dense
          @update:model-value="clearError"
        />
      </q-card-section>
      <q-card-actions align="right">
        <q-btn label="Cancel" flat @click="onDialogCancel" />
        <q-btn
          label="Reset"
          color="primary"
          unelevated
          :disable="!canReset"
          @click="onOKClick"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { computed, ref } from "vue";
import { useDialogPluginComponent } from "quasar";
import { resetPass } from "@/api/accounts";
import { notifySuccess } from "@/utils/notify";
import DialogHeader from "@/components/ui/DialogHeader.vue";
import PasswordField from "@/components/modals/admin/PasswordField.vue";

const pass = ref("");
const pass2 = ref("");
const code = ref("");
const codeError = ref("");
const shown = ref(false);
const clearError = () => (codeError.value = "");
const canReset = computed(
  () =>
    !!pass.value && pass.value === pass2.value && /^\d{6}$/.test(code.value),
);

defineEmits([...useDialogPluginComponent.emits]);

const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } =
  useDialogPluginComponent();

async function onOKClick() {
  try {
    const ret = await resetPass(pass.value, code.value);
    notifySuccess(ret);
    onDialogOK();
  } catch (e) {
    const data = e.response?.data;
    codeError.value =
      typeof data === "string"
        ? data
        : data?.detail || "The password was not changed.";
  }
}
</script>
