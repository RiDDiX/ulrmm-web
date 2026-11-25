<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<script setup>
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useQuasar } from "quasar";
import { fetchAgents } from "@/api/agents";
import { fetchClients } from "@/api/clients";
import { fetchGroups, fetchTags } from "@/api/groups";
import { endpoint } from "@/api/http";
import { volumeWarning } from "@/components/agents/imagingVolumes";
import { serverErrors, stepUpCall } from "@/components/vault/stepUp";
import { SILENT_REQUEST_CONFIG } from "@/constants/constants";
import { notifySuccess } from "@/utils/notify";
import BackupConfigFields from "./BackupConfigFields.vue";
import {
  ENFORCEABLE,
  SCOPES,
  deviceWins,
  enforcedText,
  fieldErrors,
  fieldLabel,
  moreDevicesText,
  policyBody,
  policyDraft,
  reviewState,
  withoutKeptEnv,
} from "./backups";

const props = defineProps({
  // null for a new policy
  policy: { type: Object, default: null },
  targets: { type: Array, default: () => [] },
  // opened from a device: it joins the assigned policy picked here, a new
  // one starts from its settings
  agentId: { type: String, default: "" },
  config: { type: Object, default: () => ({}) },
  // opened from a device: the assigned policies to pick from, and the one
  // the device follows now
  policies: { type: Array, default: () => [] },
  policyId: { type: Number, default: null },
  internal: Boolean,
});
const emit = defineEmits(["close", "saved"]);
const $q = useQuasar();
const api = endpoint("/imaging");

const p =
  props.policy ??
  props.policies.find((row) => row.id === props.policyId) ??
  null;
const current = ref(p);
const opened = { agentId: props.agentId, config: props.config };
// a new policy from a device: values the answer hid must be typed again,
// unless its hooks were not copied
const reentry =
  "hooks" in policyDraft(null, opened).config
    ? withoutKeptEnv(props.config.hooks ?? []).names
    : [];
const draft = ref(policyDraft(p, opened));
// a new policy saved with warnings stays open and saves onto that row
const savedId = ref(p?.id ?? null);
const saving = ref(false);
const errors = ref([]);
const warnings = ref([]);
const warningsMore = ref(0);
const agents = ref([]);
const loadingAgents = ref(false);
const suspended = ref([...(p?.hooks_suspended ?? [])]);
// assigned policies: every listed device is reviewed before the save
const details = ref({});
const checking = ref(false);
const reviewed = ref(false);
let reviewRun = 0;

const isGlobal = p?.scope === "global";
// from a device only assigned policies are offered, as before
const fixedScope = isGlobal ? "global" : props.agentId ? "assigned" : "";
const scopeOptions = Object.entries(SCOPES)
  .filter(([value]) => (fixedScope ? value === fixedScope : value !== "global"))
  .map(([value, label]) => ({ value, label }));
const pick = (list) =>
  list.map((item) => ({ value: item.id, label: item.name }));
// clients, sites, groups and tags are read when the user opens their picker,
// so a role without those rights sees the stored name and no refused request
const lists = ref({ clients: [], groups: [], tags: [] });
const LOADERS = {
  clients: fetchClients,
  groups: fetchGroups,
  tags: fetchTags,
};
const requested = new Set();
// a select's filter callback: the popup opens once update() ran
async function ensure(list, update) {
  if (requested.has(list)) return update(() => {});
  requested.add(list);
  let rows = [];
  try {
    rows = await LOADERS[list](SILENT_REQUEST_CONFIG);
  } catch {
    // the stored name stays shown, the list stays empty
  }
  update(() => (lists.value = { ...lists.value, [list]: rows }));
}
// the picked id as a name: from its list, else the answer's scope_name
function scopeDisplay(options, key) {
  const id = draft.value[key];
  if (id === null) return "";
  return (
    options.find((o) => o.value === id)?.label ||
    (current.value?.[key] === id && current.value.scope_name) ||
    String(id)
  );
}
const siteOptions = computed(() =>
  lists.value.clients.flatMap((c) =>
    c.sites.map((s) => ({ value: s.id, label: `${c.name} / ${s.name}` })),
  ),
);
const agentOptions = computed(() =>
  agents.value.map((a) => ({
    value: a.agent_id,
    label: `${a.effective_name} · ${a.client} / ${a.site}`,
  })),
);
const agentLabel = (id) =>
  agentOptions.value.find((a) => a.value === id)?.label ?? id;
const enforceable = computed(() =>
  ENFORCEABLE.filter((key) => key in draft.value.config),
);
const assigned = computed(() => draft.value.scope === "assigned");
// the storage statement of the target this policy sets
const policyTarget = computed(() =>
  "target" in draft.value.config
    ? props.targets.find((t) => t.id === draft.value.config.target)
    : null,
);
// a stored assigned policy may be saved without devices: all leave it
const reviewReady = computed(
  () =>
    !assigned.value ||
    !draft.value.agents.length ||
    (!checking.value && reviewed.value),
);
const scopeMissing = computed(() => {
  const { scope } = draft.value;
  if (scope === "assigned")
    return !draft.value.agents.length && savedId.value === null;
  return scope !== "global" && draft.value[scope] === null;
});

watch(
  () => draft.value.scope,
  async (scope) => {
    if (scope !== "assigned" || agents.value.length || loadingAgents.value)
      return;
    loadingAgents.value = true;
    try {
      agents.value = await fetchAgents({ detail: false });
    } catch {
      errors.value = ["The device list could not be loaded."];
    } finally {
      loadingAgents.value = false;
    }
  },
  { immediate: true },
);

watch(
  () => [assigned.value, [...draft.value.agents]],
  async ([on, ids]) => {
    const run = ++reviewRun;
    // fetched answers stay; missing devices and errors are asked again
    details.value = Object.fromEntries(
      ids
        .filter((id) => details.value[id] && !details.value[id].error)
        .map((id) => [id, details.value[id]]),
    );
    const missing = on ? ids.filter((id) => !(id in details.value)) : [];
    checking.value = missing.length > 0;
    if (!checking.value) return;
    await new Promise((resolve) => setTimeout(resolve, 200));
    if (run !== reviewRun) return;
    const review = Object.create(null);
    for (let index = 0; index < missing.length; index += 8) {
      await Promise.all(
        missing.slice(index, index + 8).map(async (id) => {
          try {
            review[id] = await api.get(`/agents/${id}/`, { silent: true });
          } catch (e) {
            review[id] = { error: serverErrors(e).message };
          }
        }),
      );
      if (run !== reviewRun) return;
    }
    details.value = { ...details.value, ...review };
    checking.value = false;
  },
  { immediate: true },
);
// any change asks for the review again
watch(draft, () => (reviewed.value = false), { deep: true });
onBeforeUnmount(() => (reviewRun += 1));
const pickOptions = computed(() => [
  { value: null, label: "New policy" },
  ...props.policies.map((row) => ({ value: row.id, label: row.name })),
]);
function choosePolicy(id) {
  const row = props.policies.find((item) => item.id === id) ?? null;
  current.value = row;
  draft.value = policyDraft(row, opened);
  savedId.value = row?.id ?? null;
  suspended.value = [...(row?.hooks_suspended ?? [])];
  errors.value = [];
  warnings.value = [];
}
const removeDevice = (id) =>
  (draft.value.agents = draft.value.agents.filter((item) => item !== id));

async function confirmHook({ script_id, sha256 }) {
  errors.value = [];
  try {
    const row = await stepUpCall($q, (config) =>
      api.post(
        `/policies/${savedId.value}/hooks/confirm/`,
        { script_id, sha256 },
        config,
      ),
    );
    if (row === null) return;
    // the answer is the policy row as the list returns it
    suspended.value = row?.hooks_suspended ?? [];
    notifySuccess("Hook confirmed");
    emit("saved");
  } catch (e) {
    errors.value = fieldErrors(serverErrors(e));
  }
}

function warningText(item) {
  if (item.legacy)
    return `${item.hostname || agentLabel(item.agent_id)}: older agent, its backups with hooks wait for an agent update.`;
  return volumeWarning(item, item.hostname || agentLabel(item.agent_id));
}

async function save() {
  saving.value = true;
  errors.value = [];
  warnings.value = [];
  const body = policyBody(
    draft.value,
    savedId.value === null ? null : current.value,
  );
  try {
    const result = await stepUpCall($q, (config) =>
      savedId.value === null
        ? api.post("/policies/", body, config)
        : api.put(`/policies/${savedId.value}/`, body, config),
    );
    if (!result) return;
    savedId.value = result.id;
    notifySuccess("Backup policy saved");
    emit("saved");
    if (!result.warnings?.length) return emit("close");
    warnings.value = result.warnings;
    warningsMore.value = result.warnings_more ?? 0;
  } catch (e) {
    errors.value = fieldErrors(serverErrors(e));
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <q-dialog
    :model-value="true"
    :persistent="saving"
    @update:model-value="emit('close')"
  >
    <q-card class="q-pa-md" style="width: 800px; max-width: 94vw">
      <h3 class="text-h6">
        {{ current ? `Backup policy ${current.name}` : "New backup policy" }}
      </h3>
      <q-form class="q-gutter-sm" @submit="save">
        <q-select
          v-if="agentId"
          :model-value="current?.id ?? null"
          :options="pickOptions"
          emit-value
          map-options
          outlined
          dense
          label="Policy"
          :disable="saving"
          @update:model-value="choosePolicy"
        />
        <q-input
          v-model="draft.name"
          outlined
          dense
          label="Policy name"
          maxlength="100"
          :disable="saving"
        />
        <div class="row q-col-gutter-sm">
          <div class="col-12 col-sm-4">
            <q-select
              v-model="draft.scope"
              :options="scopeOptions"
              emit-value
              map-options
              outlined
              dense
              label="Applies to"
              :disable="saving || !!fixedScope"
            />
          </div>
          <div class="col-12 col-sm-8">
            <q-select
              v-if="draft.scope === 'client'"
              v-model="draft.client"
              :options="pick(lists.clients)"
              :display-value="scopeDisplay(pick(lists.clients), 'client')"
              @filter="(_, update) => ensure('clients', update)"
              emit-value
              map-options
              outlined
              dense
              label="Client"
              :disable="saving"
            />
            <q-select
              v-else-if="draft.scope === 'site'"
              v-model="draft.site"
              :options="siteOptions"
              :display-value="scopeDisplay(siteOptions, 'site')"
              @filter="(_, update) => ensure('clients', update)"
              emit-value
              map-options
              outlined
              dense
              label="Site"
              :disable="saving"
            />
            <q-select
              v-else-if="draft.scope === 'group'"
              v-model="draft.group"
              :options="pick(lists.groups)"
              :display-value="scopeDisplay(pick(lists.groups), 'group')"
              @filter="(_, update) => ensure('groups', update)"
              emit-value
              map-options
              outlined
              dense
              label="Device group"
              :disable="saving"
            />
            <q-select
              v-else-if="draft.scope === 'tag'"
              v-model="draft.tag"
              :options="pick(lists.tags)"
              :display-value="scopeDisplay(pick(lists.tags), 'tag')"
              @filter="(_, update) => ensure('tags', update)"
              emit-value
              map-options
              outlined
              dense
              label="Tag"
              :disable="saving"
            />
            <q-select
              v-else-if="draft.scope === 'assigned'"
              v-model="draft.agents"
              :options="agentOptions"
              emit-value
              map-options
              multiple
              use-chips
              outlined
              dense
              label="Devices"
              :loading="loadingAgents"
              :disable="saving"
            />
          </div>
        </div>
        <q-input
          v-if="draft.scope === 'group' || draft.scope === 'tag'"
          v-model.number="draft.priority"
          type="number"
          min="-1000"
          max="1000"
          outlined
          dense
          label="Priority"
          hint="Of two group or tag policies the higher priority wins; at equal priority the older one"
          :disable="saving"
        />
        <BackupConfigFields
          v-model="draft.config"
          mode="policy"
          :targets="targets"
          :internal="internal"
          :can-run-scripts="current?.can_run_scripts ?? true"
          :suspended="savedId === null ? [] : suspended"
          :disabled="saving"
          @confirm-hook="confirmHook"
        />
        <div v-if="enforceable.length" role="group" aria-label="Enforced">
          <div class="text-caption">{{ enforcedText(draft.scope) }}</div>
          <q-checkbox
            v-for="key in enforceable"
            :key="key"
            v-model="draft.enforced"
            :val="key"
            dense
            :label="`Enforce ${fieldLabel(key)}`"
            :disable="saving"
          />
        </div>
        <p v-if="agentId && policyId && !current" class="text-warning">
          Saving a new policy moves this device out of its current policy.
        </p>
        <p v-if="agentId && !current && reentry.length" class="text-warning">
          Enter the values of {{ reentry.join(", ") }} in the copied hooks
          again; the device settings do not show them.
        </p>
        <p
          v-if="assigned && savedId !== null && !draft.agents.length"
          class="text-warning"
        >
          Saving without devices takes every device off this policy.
        </p>
        <template v-if="assigned">
          <p v-if="current" class="q-mb-none">
            Existing assignments also receive these settings.
          </p>
          <p v-if="policyTarget" class="q-mb-none">
            Backup target {{ policyTarget.name }}
            <template v-if="policyTarget.storage_encryption"
              >· {{ policyTarget.storage_encryption }}</template
            >
          </p>
          <p v-if="checking" role="status">
            Checking backup scope and requirements…
          </p>
          <q-list
            v-else-if="draft.agents.length"
            separator
            bordered
            aria-label="Affected devices"
          >
            <q-item v-for="id in draft.agents" :key="id">
              <q-item-section>
                <q-item-label
                  >{{ agentLabel(id) }}
                  <span
                    class="rmm-pill q-ml-xs"
                    :class="
                      reviewState(details[id]).ready
                        ? 'rmm-pill--positive'
                        : 'rmm-pill--warning'
                    "
                    >{{
                      reviewState(details[id]).ready
                        ? "Ready"
                        : reviewState(details[id]).noSource
                          ? "No backup source"
                          : "Not ready"
                    }}</span
                  ></q-item-label
                >
                <q-item-label v-if="reviewState(details[id]).reason" caption>{{
                  reviewState(details[id]).reason
                }}</q-item-label>
                <q-item-label
                  v-if="deviceWins(draft, details[id]).length"
                  caption
                  >Set on the device, wins over this policy:
                  {{
                    deviceWins(draft, details[id]).map(fieldLabel).join(", ")
                  }}</q-item-label
                >
                <template v-if="!details[id]?.error">
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
                    >{{
                      details[id].capability.native.encryption
                    }}</q-item-label
                  >
                  <q-item-label v-if="details[id]?.at_rest" caption>
                    Current backup folder
                    {{ details[id].config?.destination }} ·
                    {{ details[id].at_rest }}
                  </q-item-label>
                  <q-item-label
                    v-if="
                      details[id]?.capability?.native?.method ===
                        'macos-timemachine-disk-v1' &&
                      (draft.config.network_mode ??
                        details[id].config?.network_mode) === 'internal'
                    "
                    caption
                  >
                    Internal-only macOS backups wait for a verifiable
                    WireGuard-bound connection.
                  </q-item-label>
                </template>
              </q-item-section>
              <q-item-section v-if="!reviewState(details[id]).ready" side>
                <q-btn
                  flat
                  dense
                  no-caps
                  label="Remove"
                  :aria-label="`Remove ${agentLabel(id)}`"
                  :disable="saving"
                  @click="removeDevice(id)"
                />
              </q-item-section>
            </q-item>
          </q-list>
          <q-checkbox
            v-model="reviewed"
            :disable="checking || !draft.agents.length"
            label="I reviewed backup scope, recovery requirements and storage encryption for every affected device."
          />
        </template>
        <q-banner
          v-if="errors.length"
          dense
          class="rmm-banner-warning"
          role="alert"
        >
          <div v-for="line in errors" :key="line">{{ line }}</div>
        </q-banner>
        <q-banner
          v-if="warnings.length"
          dense
          class="rmm-banner-warning"
          role="alert"
        >
          Policy saved. Some devices need attention:
          <div v-for="(item, index) in warnings" :key="index">
            {{ warningText(item) }}
          </div>
          <div v-if="warningsMore">{{ moreDevicesText(warningsMore) }}</div>
        </q-banner>
        <q-card-actions align="right">
          <q-btn flat label="Cancel" :disable="saving" @click="emit('close')" />
          <q-btn
            color="primary"
            type="submit"
            label="Save policy"
            :disable="!draft.name.trim() || scopeMissing || !reviewReady"
            :loading="saving"
          />
        </q-card-actions>
      </q-form>
    </q-card>
  </q-dialog>
</template>
