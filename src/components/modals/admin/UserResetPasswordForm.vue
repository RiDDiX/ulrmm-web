<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide">
    <q-card class="rmm-dialog--md">
      <DialogHeader
        :title="`${user.username} Password Reset`"
        subtitle="Sets a new password; the user's other sessions and API keys end on a reset"
      />
      <q-form @submit="reset">
        <q-card-section class="q-pb-none">
          <PasswordField
            v-model="password"
            v-model:shown="shown"
            label="New Password"
            :rules="[(val) => !!val || '*Required']"
          />
        </q-card-section>
        <q-card-section>
          <PasswordField
            v-model="confirm"
            v-model:shown="shown"
            label="Confirm"
            :rules="[(val) => val === password || 'Passwords do not match']"
          />
        </q-card-section>
        <q-card-section class="q-pt-none">
          <q-input
            v-model="code"
            class="rmm-otp"
            label="Your two-factor code"
            autocomplete="one-time-code"
            inputmode="numeric"
            maxlength="6"
            :error="!!codeError"
            :error-message="codeError"
            outlined
            dense
            @update:model-value="codeError = ''"
          />
        </q-card-section>
        <FormActions label="Reset" :disable="!canReset" />
      </q-form>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { computed, ref } from "vue";
import axios from "axios";
import { useDialogPluginComponent, useQuasar } from "quasar";
import { useAuthStore } from "@/stores/auth";
import { notifySuccess } from "@/utils/notify";
import DialogHeader from "@/components/ui/DialogHeader.vue";
import FormActions from "@/core/ui/FormActions.vue";
import PasswordField from "@/components/modals/admin/PasswordField.vue";

const props = defineProps({ user: { type: Object, required: true } });
defineEmits([...useDialogPluginComponent.emits]);

const $q = useQuasar();
const { dialogRef, onDialogHide, onDialogOK } = useDialogPluginComponent();

const password = ref("");
const confirm = ref("");
const shown = ref(false);
const code = ref("");
const codeError = ref("");

const canReset = computed(
  () =>
    !!password.value &&
    password.value === confirm.value &&
    /^\d{6}$/.test(code.value),
);

async function reset() {
  $q.loading.show();
  // the server wants the code under another name when you reset yourself
  const self = props.user.username === useAuthStore().username;
  const body = {
    id: props.user.id,
    password: password.value,
    [self ? "code" : "totp_code"]: code.value,
  };

  try {
    await axios.post("/accounts/users/reset/", body, { silent: true });
    onDialogOK();
    $q.loading.hide();
    notifySuccess("User Password Reset!");
  } catch (e) {
    $q.loading.hide();
    const data = e.response?.data;
    codeError.value =
      typeof data === "string"
        ? data
        : data?.detail || "The password was not changed.";
  }
}
</script>
