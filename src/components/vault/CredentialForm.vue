<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-dialog
    ref="dialogRef"
    persistent
    aria-labelledby="vault-cred-form-title"
    @hide="onDialogHide"
  >
    <q-card class="q-dialog-plugin rmm-dialog--md">
      <DialogHeader
        title-id="vault-cred-form-title"
        :title="credential ? `Edit ${credential.name}` : 'New credential'"
        subtitle="The secret is stored encrypted and only shown on request"
      />
      <q-form autocomplete="off" @submit="submit">
        <q-card-section class="q-gutter-y-sm">
          <q-input
            v-model="form.name"
            label="Name"
            hint="What it opens, such as Local administrator or BIOS"
            maxlength="80"
            dense
            outlined
            autofocus
            :rules="[(v) => !!v?.trim() || 'Required']"
            :error="!!errors.name"
            :error-message="errors.name"
          />
          <q-input
            v-model="form.username"
            label="User name (optional)"
            maxlength="255"
            dense
            outlined
            autocomplete="off"
            hide-bottom-space
            :error="!!errors.username"
            :error-message="errors.username"
          />
          <SecretInput
            v-model="form.secret"
            v-model:clear="form.secret_clear"
            :stored="!!credential?.secret_set"
            label="Secret"
            maxlength="4096"
            autocomplete="new-password"
            hide-bottom-space
            :error="!!errors.secret"
            :error-message="errors.secret"
          />
          <q-input
            v-model="form.url"
            label="Address (optional)"
            hint="An http:// or https:// address, such as the admin page"
            maxlength="500"
            dense
            outlined
            :rules="[
              (v) => !v || URL_RE.test(v) || 'An http:// or https:// address',
            ]"
            :error="!!errors.url"
            :error-message="errors.url"
          />
          <q-input
            v-model="form.notes"
            type="textarea"
            label="Notes (optional)"
            maxlength="2000"
            counter
            autogrow
            dense
            outlined
            :error="!!errors.notes"
            :error-message="errors.notes"
          />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn
            flat
            label="Cancel"
            :disable="saving"
            @click="onDialogCancel"
          />
          <q-btn
            unelevated
            color="primary"
            :label="credential ? 'Save' : 'Create'"
            type="submit"
            :loading="saving"
          />
        </q-card-actions>
      </q-form>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { reactive, ref, onBeforeUnmount } from "vue";
import { useDialogPluginComponent } from "quasar";
import DialogHeader from "@/components/ui/DialogHeader.vue";
import SecretInput from "@/components/ui/SecretInput.vue";
import { saveCredential } from "@/api/vault";
import { serverErrors } from "@/components/vault/stepUp";
import { notifyError, notifySuccess } from "@/utils/notify";

const props = defineProps({
  // null => new credential in scope/scopeKey
  credential: { type: Object, default: null },
  scope: { type: String, required: true },
  scopeKey: { type: [String, Number], required: true },
});
const emit = defineEmits([...useDialogPluginComponent.emits, "forbidden"]);
const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } =
  useDialogPluginComponent();

// same rule as the server
const URL_RE = /^https?:\/\/[^\s<>"']+$/;

const form = reactive({
  name: props.credential?.name ?? "",
  username: props.credential?.username ?? "",
  secret: "",
  secret_clear: false,
  url: props.credential?.url ?? "",
  notes: props.credential?.notes ?? "",
});
const saving = ref(false);
const errors = ref({});
const FIELDS = ["name", "username", "secret", "url", "notes"];

async function submit() {
  saving.value = true;
  errors.value = {};
  const payload = {
    name: form.name.trim(),
    username: form.username.trim(),
    url: form.url.trim(),
    notes: form.notes,
  };
  // empty keeps the stored secret
  if (form.secret) payload.secret = form.secret;
  else if (form.secret_clear) payload.secret_clear = true;
  if (!props.credential) payload[props.scope] = props.scopeKey;
  try {
    const saved = await saveCredential(props.credential?.id, payload, {
      silent: true,
    });
    notifySuccess(`${saved.name} was saved`);
    onDialogOK(saved);
  } catch (e) {
    // offline banner and 401 redirect come from the axios boot
    if (!e?.response || e.response.status === 401) return;
    if (e.response.status === 403) emit("forbidden");
    // field errors go to their fields, anything else into a toast
    const { fields, message } = serverErrors(e);
    errors.value = fields;
    if (!FIELDS.some((k) => fields[k])) notifyError(message);
  } finally {
    saving.value = false;
  }
}

onBeforeUnmount(() => (form.secret = ""));
</script>
