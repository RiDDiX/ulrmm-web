<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-dialog
    ref="dialogRef"
    persistent
    aria-labelledby="license-form-title"
    @hide="onDialogHide"
  >
    <q-card class="q-dialog-plugin rmm-dialog--md">
      <DialogHeader
        title-id="license-form-title"
        :title="license ? `Edit ${license.name}` : 'New license'"
        subtitle="The key is stored encrypted and only shown on request, after a two-factor code"
      />
      <q-form autocomplete="off" @submit="submit">
        <q-card-section class="q-gutter-y-sm">
          <q-input
            v-model="form.name"
            label="Name"
            hint="The product, such as Microsoft 365 Business"
            maxlength="120"
            dense
            outlined
            autofocus
            :rules="[(v) => !!v?.trim() || 'Required']"
            :error="!!errors.name"
            :error-message="errors.name"
          />
          <q-input
            v-model="form.vendor"
            label="Vendor (optional)"
            maxlength="120"
            dense
            outlined
            hide-bottom-space
            :error="!!errors.vendor"
            :error-message="errors.vendor"
          />
          <SecretInput
            v-model="form.key"
            v-model:clear="form.key_clear"
            :stored="!!license?.key_set"
            label="License key"
            maxlength="4096"
            autocomplete="new-password"
            hide-bottom-space
            :error="!!errors.key"
            :error-message="errors.key"
          />
          <div class="row q-col-gutter-x-md">
            <div class="col-6">
              <q-input
                v-model.number="form.seats"
                label="Seats"
                type="number"
                min="0"
                hint="Empty means unlimited"
                dense
                outlined
                :rules="[(v) => v === '' || v >= 0 || '0 or more']"
                :error="!!errors.seats"
                :error-message="errors.seats"
              />
            </div>
            <div class="col-6">
              <q-input
                v-model="form.expires"
                label="Expires"
                type="date"
                dense
                outlined
                stack-label
                clearable
                hint="A notice goes out 30 days before"
                :error="!!errors.expires"
                :error-message="errors.expires"
              />
            </div>
          </div>
          <RmmSelect
            v-model="form.site"
            :options="siteOptions"
            label="Site (optional)"
            outlined
            clearable
            map-options
            hide-bottom-space
            :error="!!errors.site"
            :error-message="errors.site"
          />
          <RmmSelect
            v-model="form.agents"
            :options="agentOptions"
            label="Devices that use it"
            outlined
            multiple
            filterable
            map-options
            hint="Assigned devices count against the seats. With a site set, only devices of that site"
            :error="!!errors.agents"
            :error-message="errors.agents"
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
            :label="license ? 'Save' : 'Create'"
            type="submit"
            :loading="saving"
          />
        </q-card-actions>
      </q-form>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { onBeforeUnmount, onMounted, reactive, ref } from "vue";
import { useDialogPluginComponent } from "quasar";
import DialogHeader from "@/components/ui/DialogHeader.vue";
import RmmSelect from "@/components/ui/RmmSelect.vue";
import SecretInput from "@/components/ui/SecretInput.vue";
import { fetchAgents } from "@/api/agents";
import { saveLicense } from "@/api/assets";
import { fetchClients } from "@/api/clients";
import { serverErrors } from "@/components/vault/stepUp";
import { formatAgentOptions, formatSiteOptions } from "@/utils/format";
import { deviceName } from "@/utils/deviceName";
import { notifyError, notifySuccess } from "@/utils/notify";

const props = defineProps({
  // null => new license
  license: { type: Object, default: null },
});
defineEmits([...useDialogPluginComponent.emits]);
const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } =
  useDialogPluginComponent();

const idOf = (v) => (v && typeof v === "object" ? v.id : v);

const form = reactive({
  name: props.license?.name ?? "",
  vendor: props.license?.vendor ?? "",
  key: "",
  key_clear: false,
  seats: props.license ? (props.license.seats ?? "") : 1,
  expires: props.license?.expires ?? "",
  site: idOf(props.license?.site) ?? null,
  agents: (props.license?.agents ?? []).map((a) => a.agent_id),
  notes: props.license?.notes ?? "",
});
const saving = ref(false);
const errors = ref({});
const FIELDS = [
  "name",
  "vendor",
  "key",
  "seats",
  "expires",
  "site",
  "agents",
  "notes",
];
const agentOptions = ref([]);
const siteOptions = ref([]);

onMounted(async () => {
  try {
    agentOptions.value = formatAgentOptions(
      (await fetchAgents({ detail: false })).map((a) => ({
        ...a,
        hostname: deviceName(a),
      })),
      false,
    );
  } catch (e) {
    console.error(e);
  }
  try {
    const clients = await fetchClients();
    siteOptions.value = formatSiteOptions(clients);
  } catch (err) {
    console.error(err);
  }
});

async function submit() {
  saving.value = true;
  errors.value = {};
  const payload = {
    name: form.name.trim(),
    vendor: form.vendor.trim(),
    seats: form.seats === "" || form.seats == null ? null : form.seats,
    expires: form.expires || null,
    site: form.site || null,
    agents: form.agents,
    notes: form.notes,
  };
  // empty keeps the stored key
  if (form.key) payload.key = form.key;
  else if (form.key_clear) payload.key_clear = true;
  try {
    const saved = await saveLicense(props.license?.id, payload, {
      silent: true,
    });
    notifySuccess(`${saved?.name || payload.name} was saved`);
    onDialogOK(saved);
  } catch (e) {
    // offline banner and 401 redirect come from the axios boot
    if (!e?.response || e.response.status === 401) return;
    // field errors go to their fields, anything else into a toast
    const { fields, message } = serverErrors(e);
    errors.value = fields;
    if (!FIELDS.some((k) => fields[k])) notifyError(message);
  } finally {
    saving.value = false;
  }
}

onBeforeUnmount(() => (form.key = ""));
</script>
