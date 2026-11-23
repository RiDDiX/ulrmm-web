<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useQuasar } from "quasar";
import { fetchAgents } from "@/api/agents";
import { endpoint } from "@/api/http";
import { serverErrors } from "@/components/vault/stepUp";
import { notifySuccess } from "@/utils/notify";
import ImagingProfileFields from "./ImagingProfileFields.vue";

const props = defineProps({
  agentId: { type: String, required: true },
  config: { type: Object, required: true },
  activePolicy: { type: Object, default: null },
  storageLocation: { type: String, default: "" },
  storageInternal: Boolean,
  agentSupported: Boolean,
});
const emit = defineEmits(["close", "saved"]);
const $q = useQuasar();

const policiesApi = endpoint("/imaging/policies");
const devicesApi = endpoint("/imaging/agents");
const policies = ref([]);
const devices = ref([]);
const selectedPolicy = ref(null);
const current = props.agentSupported ? [props.agentId] : [];
const selectedDevices = ref([...current]);
const name = ref("");
const form = ref({});
const details = ref({});
const confirmed = ref(false);
const loading = ref(true);
const checking = ref(true);
const saving = ref(false);
const message = ref("");
let reviewRun = 0;

const policyOptions = computed(() => [
  { label: "New policy", value: null },
  ...policies.value.map((policy) => ({ label: policy.name, value: policy.id })),
]);
const labels = computed(() =>
  Object.fromEntries(devices.value.map(({ value, label }) => [value, label])),
);
const members = computed(
  () =>
    policies.value.find((item) => item.id === selectedPolicy.value)?.agents ??
    [],
);
const affected = computed(() => [
  ...new Set([...selectedDevices.value, ...members.value]),
]);
// the policy PUT only adds devices; a member leaves through its own device settings
const deviceOptions = computed(() =>
  devices.value.map((device) => ({
    ...device,
    disable: members.value.includes(device.value),
  })),
);
// the server refuses unsupported devices, so they stay listed with their reason but are not saved
const unsupported = (id) => {
  const capability = details.value[id]?.capability;
  return !!capability && !(capability.supported && capability.native?.method);
};
const included = computed(() =>
  affected.value.filter((id) => !unsupported(id)),
);
const destination = computed(() => form.value.destination?.trim() ?? "");
const previewReady = computed(
  () =>
    !loading.value &&
    !checking.value &&
    !saving.value &&
    !!destination.value &&
    included.value.length > 0 &&
    included.value.every((id) => {
      const result = details.value[id];
      return (
        result?.destination === destination.value &&
        !!result.at_rest &&
        result.capability?.supported &&
        !!result.capability.native?.method &&
        result.storage.configured
      );
    }),
);
const canSave = computed(
  () => previewReady.value && !!name.value.trim() && confirmed.value,
);

function selectPolicy(id) {
  selectedPolicy.value = id;
  const policy = policies.value.find((item) => item.id === id);
  name.value = policy?.name ?? "";
  form.value = { ...(policy?.config ?? props.config) };
  if (!policy && !props.storageInternal) form.value.network_mode = "internet";
  selectedDevices.value = [...new Set([...current, ...(policy?.agents ?? [])])];
}

onMounted(async () => {
  try {
    const [list, agents] = await Promise.all([
      policiesApi.get("/"),
      fetchAgents({ detail: false }),
    ]);
    policies.value = list;
    devices.value = agents.map((device) => ({
      value: device.agent_id,
      label: `${device.effective_name} · ${device.client} / ${device.site}`,
    }));
    const active = list.find((policy) => policy.id === props.activePolicy?.id);
    selectPolicy(active?.id ?? null);
  } catch (err) {
    message.value = serverErrors(err).message;
  } finally {
    loading.value = false;
  }
});

watch(
  [affected, destination],
  async ([ids, folder]) => {
    const run = ++reviewRun;
    confirmed.value = false;
    checking.value = !!folder && ids.length > 0;
    details.value = {};
    if (!checking.value) return;
    await new Promise((resolve) => setTimeout(resolve, 200));
    if (run !== reviewRun) return;
    const review = Object.create(null);
    for (let index = 0; index < ids.length; index += 8) {
      const pending = ids.slice(index, index + 8).map(async (id) => {
        try {
          review[id] = await devicesApi.get(`/${id}/`, {
            params: { destination: folder },
            silent: true,
          });
        } catch (err) {
          review[id] = { error: serverErrors(err).message };
        }
      });
      await Promise.all(pending);
      if (run !== reviewRun) return;
    }
    details.value = review;
    checking.value = false;
  },
  { immediate: true, flush: "sync" },
);

onBeforeUnmount(() => {
  reviewRun += 1;
});

watch([name, form], () => (confirmed.value = false), { deep: true });

async function save() {
  if (!canSave.value) return;
  saving.value = true;
  message.value = "";
  try {
    const config = {
      ...form.value,
      destination: destination.value,
      schedule_time: form.value.schedule_time || null,
    };
    delete config.next_run;
    const payload = { name: name.value.trim(), config, agents: included.value };
    if (selectedPolicy.value === null) await policiesApi.post("/", payload);
    else await policiesApi.put(`/${selectedPolicy.value}/`, payload);
    notifySuccess("Backup policy applied");
    emit("saved");
    emit("close");
  } catch (err) {
    message.value = serverErrors(err).message;
  } finally {
    saving.value = false;
  }
}

function removePolicy() {
  const id = selectedPolicy.value;
  $q.dialog({
    title: `Delete backup policy ${policies.value.find((item) => item.id === id)?.name}?`,
    message: "No device is assigned to this policy.",
    ok: { label: "Delete", color: "negative" },
    cancel: true,
  }).onOk(async () => {
    if (saving.value || id !== selectedPolicy.value) return;
    saving.value = true;
    message.value = "";
    try {
      await policiesApi.delete(`/${id}/`);
      policies.value = policies.value.filter((item) => item.id !== id);
      selectPolicy(null);
      notifySuccess("Backup policy deleted");
    } catch (err) {
      message.value = serverErrors(err).message;
    } finally {
      saving.value = false;
    }
  });
}
</script>

<template>
  <q-dialog
    :model-value="true"
    :persistent="saving"
    @update:model-value="emit('close')"
  >
    <q-card class="q-pa-md" style="width: 750px; max-width: 92vw">
      <h3 class="text-h6">Backup policy</h3>
      <q-form class="q-gutter-sm" @submit="save">
        <q-select
          :model-value="selectedPolicy"
          :options="policyOptions"
          emit-value
          map-options
          outlined
          dense
          label="Policy"
          :loading="loading"
          :disable="loading || saving"
          @update:model-value="selectPolicy"
        />
        <q-input
          v-model="name"
          outlined
          dense
          label="Policy name"
          maxlength="100"
          :disable="loading || saving"
        />
        <q-select
          v-model="selectedDevices"
          :options="deviceOptions"
          emit-value
          map-options
          multiple
          use-chips
          outlined
          dense
          label="Devices"
          :hint="
            members.length
              ? 'Assigned devices stay on this policy. To take one off, save its own device settings.'
              : ''
          "
          :disable="loading || saving"
        />
        <ImagingProfileFields
          v-model="form"
          :location="storageLocation"
          :internal="storageInternal"
          :disabled="loading || saving"
        />
        <p v-if="selectedPolicy !== null">
          Existing assignments also receive these settings.
        </p>
        <q-banner
          v-if="message"
          dense
          class="rmm-banner-warning"
          role="alert"
          >{{ message }}</q-banner
        >
        <p v-if="checking" role="status">
          Checking backup scope and requirements…
        </p>
        <p v-else-if="!destination">
          Enter a backup folder to check its storage encryption.
        </p>
        <q-list v-else separator aria-label="Affected devices">
          <q-item v-for="id in affected" :key="id">
            <q-item-section>
              <q-item-label>{{ labels[id] || id }}</q-item-label>
              <q-item-label v-if="details[id]?.error" caption>{{
                details[id].error
              }}</q-item-label>
              <template v-else>
                <q-item-label caption>{{
                  details[id]?.capability?.reason
                }}</q-item-label>
                <q-item-label
                  v-if="unsupported(id) && !members.includes(id)"
                  caption
                  >Not included in this policy.</q-item-label
                >
                <q-item-label
                  v-if="details[id]?.capability?.native?.scope"
                  caption
                  >Backup scope ·
                  {{ details[id].capability.native.scope }}</q-item-label
                >
                <q-item-label
                  v-if="details[id]?.capability?.native?.recovery"
                  caption
                  >Recovery ·
                  {{ details[id].capability.native.recovery }}</q-item-label
                >
                <q-item-label
                  v-if="details[id]?.capability?.native?.encryption"
                  caption
                  >{{ details[id].capability.native.encryption }}</q-item-label
                >
                <q-item-label v-if="details[id]?.at_rest" caption>
                  Backup folder {{ details[id].destination }} ·
                  {{ details[id].at_rest }}
                </q-item-label>
                <q-item-label
                  v-if="
                    details[id]?.capability?.native?.method ===
                      'macos-timemachine-disk-v1' &&
                    form.network_mode === 'internal'
                  "
                  caption
                >
                  Internal-only macOS backups wait for a verifiable
                  WireGuard-bound connection.
                </q-item-label>
              </template>
            </q-item-section>
            <q-item-section
              v-if="unsupported(id) && !members.includes(id)"
              side
            >
              <q-btn
                flat
                dense
                no-caps
                label="Remove"
                :aria-label="`Remove ${labels[id] || id}`"
                :disable="saving"
                @click="
                  selectedDevices = selectedDevices.filter(
                    (item) => item !== id,
                  )
                "
              />
            </q-item-section>
          </q-item>
        </q-list>
        <q-checkbox
          v-model="confirmed"
          :disable="!previewReady"
          label="I reviewed backup scope, recovery requirements and storage encryption for every affected device."
        />
        <q-card-actions align="right">
          <q-btn
            v-if="selectedPolicy !== null && !members.length"
            flat
            color="negative"
            label="Delete policy…"
            :disable="loading || saving"
            @click="removePolicy"
          />
          <q-btn flat label="Cancel" :disable="saving" @click="emit('close')" />
          <q-btn
            color="primary"
            type="submit"
            label="Apply policy"
            :disable="!canSave"
            :loading="saving"
          />
        </q-card-actions>
      </q-form>
    </q-card>
  </q-dialog>
</template>
