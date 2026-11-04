<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide">
    <q-card class="q-dialog-plugin rmm-dialog--sm">
      <DialogHeader
        :title="provider ? 'Edit OIDC Provider' : 'Add OIDC Provider'"
        subtitle="Copy these values from the app you registered at the provider"
      />
      <q-form autocomplete="off" @submit="submit">
        <q-card-section class="q-gutter-y-sm">
          <q-input
            v-model="form.name"
            label="Provider Name"
            outlined
            dense
            maxlength="40"
            :readonly="!!provider"
            :disable="!!provider"
            :hint="
              provider
                ? 'Part of the callback URL, so it cannot be changed'
                : 'Unique ID that becomes part of the callback URL; letters, numbers, - and _ only'
            "
            :rules="provider ? [] : nameRules"
          />
          <q-input
            v-model="form.server_url"
            label="Issuer URL"
            outlined
            dense
            input-class="rmm-mono"
            maxlength="255"
            hint="Base URL that serves /.well-known/openid-configuration, e.g. https://login.example.com/realms/main"
            :rules="[
              (val) => !!val || '*Required',
              (val) =>
                /^https:\/\/[^\s/?#]+/i.test(val) || 'Must be an https:// URL',
            ]"
          />
          <q-input
            v-model="form.client_id"
            label="Client ID"
            outlined
            dense
            input-class="rmm-mono"
            hint="The application (client) ID of the app registration"
            :rules="[(val) => !!val || '*Required']"
          />
          <SecretInput
            v-model="form.secret"
            v-model:clear="form.secret_clear"
            :stored="!!provider?.secret_set"
            label="Secret"
            autocomplete="new-password"
            :rules="[(val) => !!provider || !!val || '*Required']"
          />
          <RmmSelect
            v-model="form.role"
            :options="roleOptions"
            label="Default User Role"
            map-options
            clearable
            hint="Given to users the first time they sign in here; without a role they have no permissions"
          />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancel" v-close-popup />
          <q-btn
            color="primary"
            :loading="busy"
            label="Save"
            type="submit"
            unelevated
          />
        </q-card-actions>
      </q-form>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { reactive, ref } from "vue";
import DialogHeader from "@/components/ui/DialogHeader.vue";
import { useDialogPluginComponent, useQuasar } from "quasar";
import RmmSelect from "@/components/ui/RmmSelect.vue";
import SecretInput from "@/components/ui/SecretInput.vue";
import { askChangeCode, useRoleDropdown } from "@/composables/accounts";
import { addSSOProvider, editSSOProvider } from "@/sso/api";
import { notifySuccess } from "@/utils/notify";

import type { SSOProvider } from "@/sso/types";

// no provider: create mode
const props = defineProps<{
  provider?: SSOProvider;
}>();

defineEmits([...useDialogPluginComponent.emits]);

const $q = useQuasar();
const { dialogRef, onDialogHide, onDialogOK } = useDialogPluginComponent();
const { roleOptions } = useRoleDropdown({ onMount: true });

// the secret is write-only and always starts empty
const form = reactive({
  name: props.provider?.name ?? "",
  server_url: props.provider?.server_url ?? "",
  client_id: props.provider?.client_id ?? "",
  secret: "",
  secret_clear: false,
  role: props.provider?.role ?? null,
});
const busy = ref(false);

// create only: names of older providers may not follow the rule
const nameRules = [
  (val: string) => !!val || "*Required",
  (val: string) =>
    /^[A-Za-z0-9_-]+$/.test(val) ||
    "Only letters, numbers, hyphens, and underscores are allowed",
];

async function submit() {
  const code = await askChangeCode($q, {
    title: props.provider ? "Save OIDC Provider" : "Add OIDC Provider",
  });
  if (code === null) return;
  busy.value = true;
  try {
    const fields = {
      server_url: form.server_url.trim(),
      client_id: form.client_id.trim(),
      secret: form.secret,
      role: form.role ?? null,
    };
    if (props.provider) {
      await editSSOProvider(
        props.provider.id,
        {
          ...fields,
          ...(form.secret_clear && { secret_clear: true }),
        },
        code,
      );
    } else {
      await addSSOProvider({ ...fields, name: form.name }, code);
    }
    notifySuccess("SSO Provider was edited!");
    onDialogOK();
  } catch (e) {
    // the interceptor shows the server message
    console.error(e);
  }
  busy.value = false;
}
</script>
