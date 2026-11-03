<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide">
    <q-card class="q-dialog-plugin rmm-dialog--sm">
      <DialogHeader
        title="SSO Settings"
        subtitle="Controls single sign-on for every user of this server"
      />
      <q-form @submit="submit">
        <q-card-section>
          <q-checkbox v-model="settings.sso_enabled" label="Enable SSO" dense />
          <div class="sso-settings__hint">
            Shows a sign-in button for each provider on the login page. Turning
            it off also allows local logins again.
          </div>
        </q-card-section>
        <q-card-section>
          <q-checkbox
            v-model="settings.block_local_user_logon"
            label="Block Local User Login"
            :disable="!settings.sso_enabled"
            dense
          />
          <div class="sso-settings__hint">
            {{
              settings.sso_enabled
                ? "When enabled, users sign in through SSO only; superusers (the built-in account or a Super User role) keep the password sign-in."
                : "Enable SSO first."
            }}
          </div>
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
import { onMounted, reactive, ref, watch } from "vue";
import { useDialogPluginComponent } from "quasar";
import DialogHeader from "@/components/ui/DialogHeader.vue";
import { fetchSSOSettings, saveSSOSettings } from "@/sso/api";
import { notifySuccess } from "@/utils/notify";

import type { SSOSettings } from "@/sso/types";

defineEmits([...useDialogPluginComponent.emits]);

const { dialogRef, onDialogHide, onDialogOK } = useDialogPluginComponent();

const settings = reactive<SSOSettings>({
  sso_enabled: false,
  block_local_user_logon: false,
});
const busy = ref(false);

// the server forces the same rule on save
watch(
  () => settings.sso_enabled,
  (enabled) => {
    if (!enabled) settings.block_local_user_logon = false;
  },
);

async function submit() {
  busy.value = true;
  try {
    await saveSSOSettings({ ...settings });
    notifySuccess("Settings updated successfully");
    onDialogOK({ ...settings });
  } catch (e) {
    console.error(e);
  }
  busy.value = false;
}

onMounted(async () => {
  busy.value = true;
  try {
    const data = await fetchSSOSettings();
    settings.sso_enabled = !!data.sso_enabled;
    settings.block_local_user_logon = !!data.block_local_user_logon;
  } catch (e) {
    console.error(e);
  }
  busy.value = false;
});
</script>

<style scoped>
.sso-settings__hint {
  margin: 4px 0 0 28px;
  color: var(--rmm-text-muted);
  font-size: var(--rmm-fs-xs);
}
</style>
