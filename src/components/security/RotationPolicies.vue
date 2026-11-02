<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <div>
    <div v-if="loading" class="q-py-md rmm-muted" role="status">
      <q-spinner size="1em" class="q-mr-sm" />Loading...
    </div>
    <div v-else-if="!reply" class="q-py-md">
      <div class="rmm-muted q-mb-sm">{{ loadError }}</div>
      <q-btn
        dense
        no-caps
        outline
        color="primary"
        label="Retry"
        @click="load"
      />
    </div>
    <template v-else>
      <q-card flat class="rmm-card q-mb-md">
        <div class="rmm-card__header">
          <div class="rmm-card__title">Global policy</div>
          <HelpTip
            text="How often agents renew their session keys, certificates and tokens. Clients and sites can override single fields below"
          />
          <q-space />
          <q-btn
            unelevated
            no-caps
            dense
            color="primary"
            label="Save"
            :disable="!dirty"
            :loading="saving === 'global'"
            @click="saveGlobal"
          />
        </div>
        <div class="rmm-card__body">
          <PolicyFields
            v-model="global"
            :limits="reply.limits"
            :errors="globalErrors"
          />
        </div>
      </q-card>

      <q-card flat class="rmm-card">
        <div class="rmm-card__header">
          <div class="rmm-card__title">Overrides</div>
          <span v-if="reply.overrides.length" class="rmm-muted rmm-num">{{
            reply.overrides.length
          }}</span>
          <q-space />
          <q-btn
            dense
            no-caps
            outline
            color="primary"
            icon="add"
            label="Add override"
            :disable="!clients.length"
            @click="openEditor(null)"
          />
        </div>
        <q-table
          dense
          flat
          class="rmm-table"
          row-key="key"
          :rows="overrideRows"
          :columns="columns"
          :pagination="{ rowsPerPage: 0 }"
          hide-pagination
          :hide-bottom="overrideRows.length > 0"
          no-data-label="No overrides. Every client and site follows the global policy."
        >
          <!-- an empty list is the normal case, not a warning -->
          <template #no-data="{ message }">
            <span class="rmm-muted">{{ message }}</span>
          </template>
          <template #body-cell-actions="cell">
            <q-td :props="cell" class="text-right">
              <q-btn
                dense
                flat
                round
                size="sm"
                icon="edit"
                :aria-label="`Edit the override for ${cell.row.name}`"
                @click="openEditor(cell.row)"
              />
              <q-btn
                dense
                flat
                round
                size="sm"
                icon="delete_outline"
                :aria-label="`Delete the override for ${cell.row.name}`"
                :loading="saving === cell.row.key"
                @click="confirmDelete(cell.row)"
              />
            </q-td>
          </template>
        </q-table>
      </q-card>

      <q-dialog v-model="editorOpen" aria-labelledby="policy-editor-title">
        <q-card class="q-dialog-plugin rmm-dialog--md">
          <DialogHeader
            title-id="policy-editor-title"
            :title="editing ? `Override for ${editing.name}` : 'New override'"
            subtitle="Empty fields inherit from the client, then from the global policy"
          />
          <q-card-section class="q-gutter-y-md">
            <div v-if="!editing" class="row q-col-gutter-sm">
              <div class="col-12 col-sm-4">
                <RmmSelect
                  v-model="draftScope"
                  map-options
                  :options="SCOPE_OPTIONS"
                  label="Scope"
                />
              </div>
              <div class="col-12 col-sm-8">
                <RmmSelect
                  v-model="draftId"
                  map-options
                  filterable
                  :options="targetOptions"
                  :label="draftScope === 'site' ? 'Site' : 'Client'"
                />
              </div>
            </div>
            <PolicyFields
              v-model="draft"
              inherit
              :limits="reply.limits"
              :errors="draftErrors"
            />
            <div v-if="draftErrors.other" class="text-negative" role="alert">
              {{ draftErrors.other }}
            </div>
          </q-card-section>
          <q-card-actions align="right">
            <q-btn flat no-caps label="Cancel" v-close-popup />
            <q-btn
              unelevated
              no-caps
              color="primary"
              label="Save"
              :disable="draftId === null"
              :loading="saving === 'draft'"
              @click="saveDraft"
            />
          </q-card-actions>
        </q-card>
      </q-dialog>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useQuasar } from "quasar";
import type { QTableColumn } from "quasar";
import DialogHeader from "@/components/ui/DialogHeader.vue";
import HelpTip from "@/components/ui/HelpTip.vue";
import RmmSelect from "@/components/ui/RmmSelect.vue";
import PolicyFields from "@/components/security/PolicyFields.vue";
import { fetchClients } from "@/api/clients";
import {
  fetchPolicies,
  savePolicy,
  type PolicyOverride,
  type PolicyReply,
  type PolicyScope,
  type RotationPolicy,
} from "@/api/security";
import { serverErrors, stepUpCall } from "@/components/vault/stepUp";
import { SILENT_REQUEST_CONFIG } from "@/constants/constants";
import type { ClientWithSites } from "@/types/clients";
import { notifyError, notifySuccess } from "@/utils/notify";

type Errors = Partial<Record<keyof RotationPolicy | "other", string>>;
type Row = PolicyOverride & { key: string; fields: string };

const EMPTY: RotationPolicy = {
  rekey_minutes: null,
  rekey_mb: null,
  cert_ttl_hours: null,
  renew_pct: null,
  offline_grace_days: null,
  auto_quarantine: null,
};
const FIELD_LABEL: Record<keyof RotationPolicy, string> = {
  rekey_minutes: "rekey",
  rekey_mb: "rekey MB",
  cert_ttl_hours: "cert lifetime",
  renew_pct: "renew",
  offline_grace_days: "offline grace",
  auto_quarantine: "auto quarantine",
};
const FIELD_UNIT: Record<keyof RotationPolicy, string> = {
  rekey_minutes: " min",
  rekey_mb: " MB",
  cert_ttl_hours: " h",
  renew_pct: "%",
  offline_grace_days: " d",
  auto_quarantine: "",
};
const SCOPE_OPTIONS = [
  { value: "client", label: "Client" },
  { value: "site", label: "Site" },
];

const emit = defineEmits<{ denied: [] }>();
const $q = useQuasar();

const reply = ref<PolicyReply | null>(null);
const loading = ref(true);
const loadError = ref("");
const saving = ref("");
const global = ref<RotationPolicy>({ ...EMPTY });
const globalErrors = ref<Errors>({});
const clients = ref<ClientWithSites[]>([]);

const editorOpen = ref(false);
const editing = ref<Row | null>(null);
const draftScope = ref<PolicyScope>("client");
const draftId = ref<number | null>(null);
const draft = ref<RotationPolicy>({ ...EMPTY });
const draftErrors = ref<Errors>({});

const dirty = computed(
  () =>
    !!reply.value &&
    JSON.stringify(global.value) !== JSON.stringify(reply.value.global),
);

const fieldText = (p: RotationPolicy) =>
  (Object.keys(FIELD_LABEL) as (keyof RotationPolicy)[])
    .filter((k) => p[k] !== null)
    .map((k) =>
      k === "auto_quarantine"
        ? `${FIELD_LABEL[k]} ${p[k] ? "on" : "off"}`
        : `${FIELD_LABEL[k]} ${p[k]}${FIELD_UNIT[k]}`,
    )
    .join(", ") || "inherits everything";

const overrideRows = computed<Row[]>(() =>
  (reply.value?.overrides ?? []).map((o) => ({
    ...o,
    key: `${o.scope}-${o.id}`,
    fields: fieldText(o),
  })),
);

const columns: QTableColumn<Row>[] = [
  {
    name: "scope",
    label: "Scope",
    field: "scope",
    align: "left",
    format: (v: PolicyScope) => (v === "site" ? "Site" : "Client"),
    sortable: true,
  },
  {
    name: "name",
    field: "name",
    format: (v: string, row: Row) =>
      row.client_name ? `${row.client_name} / ${v}` : v,
    align: "left",
    label: "Name",
    sortable: true,
  },
  { name: "fields", label: "Set fields", field: "fields", align: "left" },
  { name: "actions", label: "", field: "key", align: "right" },
];

// an override per target; targets that already have one are listed once
const targetOptions = computed(() => {
  const taken = new Set(overrideRows.value.map((r) => r.key));
  if (draftScope.value === "client")
    return clients.value
      .filter((c) => !taken.has(`client-${c.id}`))
      .map((c) => ({ value: c.id, label: c.name }));
  return clients.value.flatMap((c) =>
    c.sites
      .filter((s) => !taken.has(`site-${s.id}`))
      .map((s) => ({ value: s.id, label: `${c.name} / ${s.name}` })),
  );
});
// a new override starts over on another scope; opening an existing one sets
// scope and id together, which must not clear the id
watch(draftScope, () => {
  if (!editing.value) draftId.value = null;
});

function policyOf(src: RotationPolicy): RotationPolicy {
  return Object.fromEntries(
    (Object.keys(EMPTY) as (keyof RotationPolicy)[]).map((k) => [k, src[k]]),
  ) as unknown as RotationPolicy;
}

async function load() {
  loading.value = true;
  loadError.value = "";
  try {
    const [data, list] = await Promise.all([
      fetchPolicies(),
      fetchClients(SILENT_REQUEST_CONFIG).catch(() => []),
    ]);
    reply.value = data;
    global.value = { ...data.global };
    clients.value = list;
  } catch (e) {
    reply.value = null;
    const status = (e as { response?: { status?: number } })?.response?.status;
    if (status === 403) emit("denied");
    loadError.value =
      status === 403
        ? "Your role cannot view Global Settings."
        : "The rotation policies could not be loaded.";
  } finally {
    loading.value = false;
  }
}

// 400 {"policy": {"field": ["text"]}}; other keys land in other
function policyErrors(e: unknown): Errors {
  const { fields, message } = serverErrors(e);
  const policy = fields.policy;
  const out: Errors = {};
  if (policy && typeof policy === "object") {
    for (const [k, v] of Object.entries(policy as Record<string, unknown>))
      out[k as keyof RotationPolicy] = String(Array.isArray(v) ? v[0] : v);
  }
  if (!Object.keys(out).length) out.other = message;
  return out;
}

async function put(
  what: string,
  body: Parameters<typeof savePolicy>[0],
  done: string,
): Promise<Errors | null> {
  saving.value = what;
  try {
    const saved = await stepUpCall($q, (config: { silent: boolean }) =>
      savePolicy(body, config),
    );
    if (!saved) return null;
    reply.value = saved;
    global.value = { ...saved.global };
    notifySuccess(done);
    return {};
  } catch (e) {
    return policyErrors(e);
  } finally {
    saving.value = "";
  }
}

async function saveGlobal() {
  globalErrors.value = {};
  const errors = await put(
    "global",
    { scope: "global", id: null, policy: global.value },
    "Global policy saved",
  );
  if (!errors) return;
  globalErrors.value = errors;
  if (errors.other) notifyError(errors.other);
}

function openEditor(row: Row | null) {
  editing.value = row;
  draftErrors.value = {};
  draftScope.value = row?.scope ?? "client";
  draftId.value = row?.id ?? null;
  draft.value = row ? policyOf(row) : { ...EMPTY };
  editorOpen.value = true;
}

async function saveDraft() {
  if (draftId.value === null) return;
  draftErrors.value = {};
  const errors = await put(
    "draft",
    { scope: draftScope.value, id: draftId.value, policy: draft.value },
    "Override saved",
  );
  if (!errors) return;
  if (Object.keys(errors).length) {
    draftErrors.value = errors;
    return;
  }
  editorOpen.value = false;
}

function confirmDelete(row: Row) {
  $q.dialog({
    title: `Delete the override for ${row.name}?`,
    message: "It follows the level above again.",
    cancel: { label: "Cancel", flat: true },
    ok: { label: "Delete", color: "negative", noCaps: true },
    persistent: true,
  }).onOk(async () => {
    const errors = await put(
      row.key,
      { scope: row.scope, id: row.id, policy: null },
      "Override deleted",
    );
    if (errors?.other) notifyError(errors.other);
  });
}

onMounted(load);
</script>
