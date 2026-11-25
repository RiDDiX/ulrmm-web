<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<script setup>
import { computed, onMounted, ref } from "vue";
import { useQuasar } from "quasar";
import { useStore } from "vuex";
import { fetchClients } from "@/api/clients";
import { endpoint } from "@/api/http";
import { serverErrors } from "@/components/vault/stepUp";
import { SILENT_REQUEST_CONFIG } from "@/constants/constants";
import { fmtBytes, NO_VALUE } from "@/utils/format";
import { notifyError, notifySuccess } from "@/utils/notify";
import { wholeNumberIn } from "@/utils/validation";
import { fieldErrors } from "./backups";

const GB = 1024 ** 3;
const SCOPE_OPTIONS = [
  { value: "global", label: "Every device" },
  { value: "client", label: "One client" },
  { value: "site", label: "One site" },
];

const $q = useQuasar();
const store = useStore();
const api = endpoint("/imaging/targets");
const targets = ref([]);
const clients = ref([]);
const loading = ref(true);
const loadError = ref("");
const draft = ref(null);
const saving = ref(false);
const errors = ref([]);

const sites = computed(() =>
  clients.value.flatMap((c) =>
    c.sites.map((s) => ({ value: s.id, label: `${c.name} / ${s.name}` })),
  ),
);
const clientOptions = computed(() =>
  clients.value.map((c) => ({ value: c.id, label: c.name })),
);

function scopeText(t) {
  if (t.scope === "client")
    return (
      clientOptions.value.find((c) => c.value === t.client)?.label ?? t.client
    );
  if (t.scope === "site")
    return sites.value.find((s) => s.value === t.site)?.label ?? t.site;
  return "Every device";
}

const columns = [
  { name: "name", label: "Folder", field: "name", align: "left" },
  { name: "scope", label: "Covers", field: "scope", align: "left" },
  {
    name: "used_bytes",
    label: "Used",
    field: "used_bytes",
    align: "right",
    format: fmtBytes,
  },
  {
    name: "quota_bytes",
    label: "Quota",
    field: "quota_bytes",
    align: "right",
    format: (v) => (v ? fmtBytes(v) : "None"),
  },
  { name: "max_runs", label: "Run limit", field: "max_runs", align: "right" },
  {
    name: "storage_encryption",
    label: "Storage encryption",
    field: "storage_encryption",
    align: "left",
    format: (v) => v || NO_VALUE,
    classes: "text-caption",
    style: "white-space: normal; max-width: 280px",
  },
  { name: "state", label: "State", field: "unreachable_since", align: "left" },
  { name: "actions", label: "", field: "id", align: "right" },
];

async function load() {
  loading.value = true;
  loadError.value = "";
  try {
    const [rows, list] = await Promise.all([
      api.get("/", { silent: true }),
      fetchClients(SILENT_REQUEST_CONFIG).catch(() => []),
    ]);
    targets.value = rows;
    clients.value = list;
  } catch (e) {
    loadError.value =
      e?.response?.status === 403
        ? "Your role cannot view the backup targets."
        : "The backup targets could not be loaded.";
  } finally {
    loading.value = false;
  }
}

function edit(t) {
  errors.value = [];
  draft.value = t
    ? { ...t, quota_gb: t.quota_bytes / GB }
    : {
        name: "",
        scope: "global",
        client: null,
        site: null,
        quota_gb: 0,
        max_runs: 5,
        is_default: false,
        in_use: false,
      };
}

async function save() {
  const d = draft.value;
  const body = {
    scope: d.scope,
    client: d.scope === "client" ? d.client : null,
    site: d.scope === "site" ? d.site : null,
    quota_bytes: Math.round((Number(d.quota_gb) || 0) * GB),
    max_runs: Number(d.max_runs),
    is_default: d.is_default,
  };
  // the folder name of existing points is fixed once the target is in use
  if (!d.in_use) body.name = d.name.trim();
  saving.value = true;
  errors.value = [];
  try {
    await (d.id
      ? api.put(`/${d.id}/`, body, { silent: true })
      : api.post("/", body, { silent: true }));
    notifySuccess("Backup target saved");
    draft.value = null;
    await load();
  } catch (e) {
    errors.value = fieldErrors(serverErrors(e));
  } finally {
    saving.value = false;
  }
}

function remove(t) {
  $q.dialog({
    title: `Delete backup target ${t.name}?`,
    message: "The folder and its stored data stay on the server.",
    cancel: { label: "Cancel", flat: true },
    ok: { label: "Delete", color: "negative", noCaps: true },
  }).onOk(async () => {
    try {
      await api.delete(`/${t.id}/`, { silent: true });
      notifySuccess("Backup target deleted");
      await load();
    } catch (e) {
      notifyError(serverErrors(e).message);
    }
  });
}

onMounted(load);
</script>

<template>
  <q-card-section>
    <div class="row items-center q-mb-sm">
      <div class="text-subtitle2">Backup targets</div>
      <q-space />
      <q-btn
        dense
        no-caps
        outline
        color="primary"
        icon="add"
        label="Add target"
        :disable="loading || !!loadError"
        @click="edit(null)"
      />
    </div>
    <div class="imgstore-hint q-mb-sm">
      Folders in the image store that policies and devices back up to. A client
      or site target serves only the devices of that client or site.
    </div>
    <div v-if="loadError" class="rmm-muted">
      {{ loadError }}
      <q-btn dense flat no-caps label="Retry" @click="load" />
    </div>
    <q-table
      v-else
      dense
      flat
      class="rmm-table"
      row-key="id"
      :rows="targets"
      :columns="columns"
      :loading="loading"
      :pagination="{ rowsPerPage: 0 }"
      hide-pagination
      no-data-label="No backup targets yet."
    >
      <template #body-cell-name="cell">
        <q-td :props="cell">
          <code>{{ cell.row.name }}</code>
          <span
            v-if="cell.row.is_default"
            class="rmm-pill rmm-pill--info q-ml-xs"
            >Default</span
          >
        </q-td>
      </template>
      <template #body-cell-scope="cell">
        <q-td :props="cell">{{ scopeText(cell.row) }}</q-td>
      </template>
      <template #body-cell-state="cell">
        <q-td :props="cell">
          <span
            v-if="cell.row.unreachable_since"
            class="rmm-pill rmm-pill--negative"
            >Unreachable since
            {{ store.getters.formatDate(cell.row.unreachable_since) }}</span
          >
          <span v-else class="rmm-muted">{{ NO_VALUE }}</span>
        </q-td>
      </template>
      <template #body-cell-actions="cell">
        <q-td :props="cell" class="text-right">
          <q-btn
            dense
            flat
            round
            size="sm"
            icon="edit"
            :aria-label="`Edit backup target ${cell.row.name}`"
            @click="edit(cell.row)"
          />
          <q-btn
            v-if="!cell.row.in_use && !cell.row.is_default"
            dense
            flat
            round
            size="sm"
            icon="delete_outline"
            :aria-label="`Delete backup target ${cell.row.name}`"
            @click="remove(cell.row)"
          />
        </q-td>
      </template>
    </q-table>

    <q-dialog
      :model-value="!!draft"
      :persistent="saving"
      @update:model-value="draft = null"
    >
      <q-card
        v-if="draft"
        class="q-pa-md"
        style="width: 520px; max-width: 92vw"
      >
        <h3 class="text-h6">
          {{ draft.id ? `Backup target ${draft.name}` : "New backup target" }}
        </h3>
        <q-form class="q-gutter-sm" @submit="save">
          <q-input
            v-model="draft.name"
            outlined
            dense
            label="Folder name"
            maxlength="64"
            input-class="rmm-mono"
            :hint="
              draft.in_use
                ? 'Existing points are stored under this name, so it cannot change.'
                : 'A folder below the image store, such as nordwind-nas'
            "
            :disable="saving || draft.in_use"
          />
          <q-select
            v-model="draft.scope"
            :options="SCOPE_OPTIONS"
            emit-value
            map-options
            outlined
            dense
            label="Covers"
            :disable="saving"
          />
          <q-select
            v-if="draft.scope === 'client'"
            v-model="draft.client"
            :options="clientOptions"
            emit-value
            map-options
            outlined
            dense
            label="Client"
            :disable="saving"
          />
          <q-select
            v-if="draft.scope === 'site'"
            v-model="draft.site"
            :options="sites"
            emit-value
            map-options
            outlined
            dense
            label="Site"
            :disable="saving"
          />
          <q-input
            v-model.number="draft.quota_gb"
            type="number"
            min="0"
            step="any"
            outlined
            dense
            label="Quota in GB, 0 = none"
            hint="A full target defers new backups; it never deletes a point"
            :disable="saving"
          />
          <q-input
            v-model.number="draft.max_runs"
            type="number"
            min="1"
            max="100"
            :rules="[wholeNumberIn(1, 100)]"
            outlined
            dense
            label="Backups at the same time"
            :disable="saving"
          />
          <q-checkbox
            v-model="draft.is_default"
            dense
            label="Default target for devices without another one"
            :disable="saving"
          />
          <q-banner
            v-if="errors.length"
            dense
            class="rmm-banner-warning"
            role="alert"
          >
            <div v-for="line in errors" :key="line">{{ line }}</div>
          </q-banner>
          <q-card-actions align="right">
            <q-btn
              flat
              label="Cancel"
              :disable="saving"
              @click="draft = null"
            />
            <q-btn
              color="primary"
              type="submit"
              label="Save target"
              :loading="saving"
              :disable="
                (!draft.in_use && !draft.name.trim()) ||
                (draft.scope === 'client' && draft.client === null) ||
                (draft.scope === 'site' && draft.site === null)
              "
            />
          </q-card-actions>
        </q-form>
      </q-card>
    </q-dialog>
  </q-card-section>
</template>

<style scoped>
.imgstore-hint {
  color: var(--rmm-text-muted);
  font-size: var(--rmm-fs-xs);
}
</style>
