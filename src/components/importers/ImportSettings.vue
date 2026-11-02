<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <div>
    <SettingsPanelHeader
      title="Import"
      text="Takes clients, sites, devices, scripts, custom fields and the key store over from another RMM, then moves its devices over by running the installer through it."
    >
      <q-btn
        unelevated
        no-caps
        color="primary"
        icon="add"
        label="Add source"
        :disable="!ready || !!form"
        @click="edit(null)"
      />
    </SettingsPanelHeader>

    <div v-if="loading" class="q-py-md rmm-muted" role="status">
      <q-spinner size="1em" class="q-mr-sm" />Loading...
    </div>
    <div v-else-if="error" class="q-py-md">
      <div class="rmm-muted q-mb-sm">{{ error }}</div>
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
      <q-card v-if="form" flat bordered class="q-mb-md">
        <q-card-section class="text-subtitle2">
          {{ form.id ? `Edit ${form.name}` : "New source" }}
        </q-card-section>
        <q-card-section class="q-gutter-y-sm q-pt-none">
          <q-select
            v-model="form.kind"
            outlined
            dense
            emit-value
            map-options
            label="Source"
            :options="kindOptions"
            :disable="!!form.id"
          />
          <q-input
            v-model="form.name"
            outlined
            dense
            label="Name"
            :error="!!errs.name"
            :error-message="errs.name"
          />
          <q-input
            v-model="form.url"
            outlined
            dense
            label="URL"
            :hint="kinds[form.kind].urlHint"
            :error="!!errs.url"
            :error-message="errs.url"
          />
          <q-input
            v-for="o in kinds[form.kind].options"
            :key="o.key"
            v-model="form.options[o.key]"
            outlined
            dense
            :label="o.label"
            :hint="o.hint"
          />
          <SecretInput
            v-for="s in kinds[form.kind].secrets"
            :key="s.key"
            v-model="form.secrets[s.key]"
            v-model:clear="form.clear[s.key]"
            :label="s.label"
            :stored="!!form.stored?.includes(s.key)"
            :error="errs.secrets ? true : undefined"
            :error-message="errs.secrets"
          />
          <q-toggle
            v-model="form.verify_tls"
            label="Verify the TLS certificate"
          />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat no-caps label="Cancel" @click="form = null" />
          <q-btn
            unelevated
            no-caps
            color="primary"
            label="Save"
            :loading="saving"
            @click="save"
          />
        </q-card-actions>
      </q-card>

      <div v-if="!sources.length && !form" class="rmm-muted q-py-md">
        No source yet. Add the old RMM to read what it holds; nothing is
        imported before you confirm.
      </div>

      <q-card
        v-for="src in sources"
        :key="src.id"
        flat
        bordered
        class="q-mb-md"
      >
        <q-card-section class="row items-center q-gutter-sm">
          <div>
            <div class="text-subtitle2">{{ src.name }}</div>
            <div class="text-caption rmm-muted">
              {{ kinds[src.kind]?.label || src.kind }} · {{ src.url }}
            </div>
          </div>
          <q-space />
          <q-btn
            outline
            dense
            no-caps
            class="q-px-sm"
            color="primary"
            icon="cloud_download"
            label="Read source"
            :loading="busy[src.id] === 'fetch'"
            :disable="!!busy[src.id]"
            @click="read(src)"
          />
          <q-btn flat dense no-caps label="Edit" @click="edit(src)" />
          <q-btn
            flat
            dense
            no-caps
            color="negative"
            label="Delete"
            @click="remove(src)"
          />
        </q-card-section>
        <q-card-section class="q-pt-none text-caption">
          <span class="rmm-muted">
            {{
              src.last_fetch
                ? `Read ${relativeTime(src.last_fetch)}`
                : "Not read yet"
            }}
            <template v-if="src.last_import">
              · imported {{ relativeTime(src.last_import) }}</template
            >
          </span>
          <span v-if="src.last_error" class="text-negative q-ml-sm">{{
            src.last_error
          }}</span>
        </q-card-section>

        <template v-if="plans[src.id]">
          <q-separator />
          <q-card-section>
            <div class="text-subtitle2 q-mb-xs">What the import adds</div>
            <div class="text-caption rmm-muted q-mb-sm">
              Existing entries with the same name stay as they are; only empty
              custom field values are filled in. Running it again adds nothing.
            </div>
            <q-list dense bordered separator>
              <q-expansion-item
                v-for="p in partRows(src.id)"
                :key="p.key"
                dense
                :hide-expand-icon="!p.new.length"
              >
                <template #header>
                  <q-item-section side class="imp-check">
                    <q-checkbox
                      v-if="p.part"
                      v-model="parts[src.id]"
                      :val="p.part"
                      dense
                      @click.stop
                    />
                  </q-item-section>
                  <q-item-section>{{ p.label }}</q-item-section>
                  <q-item-section side class="rmm-num">
                    {{ p.new_count }} new of {{ p.total }}
                  </q-item-section>
                </template>
                <div v-if="p.new.length" class="q-pa-sm text-caption">
                  {{ p.new.join(", ")
                  }}<template v-if="p.new_count > p.new.length">, ...</template>
                </div>
              </q-expansion-item>
            </q-list>
            <div
              v-if="plans[src.id].devices.without_site"
              class="text-caption text-warning q-mt-xs"
            >
              {{ plans[src.id].devices.without_site }} devices have no site in
              the source and cannot be placed.
            </div>
            <div
              v-if="src.kind === 'ninjaone'"
              class="text-caption rmm-muted q-mt-xs"
            >
              NinjaOne gives no script contents through its API, so scripts are
              not imported.
            </div>
            <div class="row q-mt-sm q-gutter-sm items-center">
              <q-btn
                unelevated
                no-caps
                color="primary"
                label="Import"
                :loading="busy[src.id] === 'import'"
                :disable="!parts[src.id]?.length || !!busy[src.id]"
                @click="doImport(src)"
              />
              <span v-if="done[src.id]" class="text-caption">{{
                done[src.id]
              }}</span>
            </div>
          </q-card-section>
        </template>

        <template v-if="devices[src.id]?.length">
          <q-separator />
          <q-card-section>
            <div class="row items-center q-gutter-sm q-mb-sm">
              <div class="text-subtitle2">Devices</div>
              <q-space />
              <q-btn
                flat
                dense
                no-caps
                icon="refresh"
                label="Refresh"
                @click="loadDevices(src)"
              />
              <q-btn
                outline
                dense
                no-caps
                class="q-px-sm"
                color="primary"
                icon="link"
                label="Link enrolled agents"
                :loading="busy[src.id] === 'link'"
                :disable="!!busy[src.id]"
                @click="doLink(src)"
              />
              <q-btn
                unelevated
                dense
                no-caps
                class="q-px-sm"
                color="primary"
                icon="install_desktop"
                label="Send installer"
                :disable="
                  !src.push_plats.length ||
                  !sendable(src).length ||
                  !!busy[src.id]
                "
                :loading="busy[src.id] === 'migrate'"
                @click="doMigrate(src)"
              >
                <q-tooltip>{{ sendHint(src) }}</q-tooltip>
              </q-btn>
            </div>
            <q-banner
              v-if="src.kind === 'ninjaone'"
              dense
              rounded
              class="rmm-banner-warning q-mb-sm"
            >
              NinjaOne only runs scripts from its own library. Create these two
              scripts there, enter their ids under Edit (Windows script id,
              Linux script id), and they get the installer link as parameter.
              macOS devices: install the agent with a deployment; they link when
              they enroll.
              <q-expansion-item dense label="Library scripts" class="q-mt-xs">
                <pre class="rmm-pre">{{ ninjaScripts }}</pre>
              </q-expansion-item>
            </q-banner>
            <q-table
              flat
              dense
              row-key="id"
              selection="multiple"
              v-model:selected="selected[src.id]"
              :rows="devices[src.id]"
              :columns="columns"
              :pagination="{ rowsPerPage: 25 }"
            >
              <template #body-cell-state="props">
                <q-td :props="props">
                  <q-badge
                    :color="stateColor(props.row)"
                    :label="stateLabel(props.row)"
                  />
                  <div
                    v-if="props.row.migrate_error"
                    class="text-caption text-negative"
                  >
                    {{ props.row.migrate_error }}
                  </div>
                </q-td>
              </template>
            </q-table>
          </q-card-section>
        </template>
      </q-card>
    </template>
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, reactive, ref } from "vue";
import { useQuasar } from "quasar";
import SettingsPanelHeader from "@/components/modals/coresettings/SettingsPanelHeader.vue";
import SecretInput from "@/components/ui/SecretInput.vue";
import {
  deleteSource,
  fetchImportedDevices,
  fetchPlan,
  fetchSource,
  fetchSources,
  linkDevices,
  migrateDevices,
  readSource,
  runImport,
  saveSource,
} from "@/api/importers";
import { relativeTime } from "@/utils/format";
import { notifyError, notifySuccess } from "@/utils/notify";
import { SILENT_REQUEST_CONFIG } from "@/constants/constants";

const $q = useQuasar();

const kinds = {
  upstream: {
    label: "Compatible RMM server",
    urlHint: "The API address, e.g. https://api.example.com",
    secrets: [
      {
        key: "api_key",
        label:
          "API key (of a superuser, Settings > Global Settings > API Keys)",
      },
    ],
    options: [],
  },
  ninjaone: {
    label: "NinjaOne",
    urlHint:
      "Your region, e.g. https://eu.ninjarmm.com or https://app.ninjarmm.com",
    secrets: [{ key: "client_secret", label: "Client secret" }],
    options: [
      {
        key: "client_id",
        label: "Client id",
        hint: "An API app (Administration > Apps > API) with Client Credentials and the scopes Monitoring and Management",
      },
      {
        key: "script_windows",
        label: "Windows script id",
        hint: "Optional, needed to send the installer to Windows devices",
      },
      {
        key: "script_linux",
        label: "Linux script id",
        hint: "Optional, needed to send the installer to Linux devices",
      },
    ],
  },
};
const kindOptions = Object.entries(kinds).map(([value, k]) => ({
  value,
  label: k.label,
}));

const PARTS = [
  { key: "clients", part: "clients", label: "Clients" },
  { key: "sites", part: "", label: "Sites (with their clients)" },
  { key: "custom_fields", part: "custom_fields", label: "Custom fields" },
  { key: "scripts", part: "scripts", label: "Scripts" },
  { key: "snippets", part: "snippets", label: "Script snippets" },
  { key: "keystore", part: "keystore", label: "Key store" },
  { key: "devices", part: "devices", label: "Devices" },
];

const ninjaScripts = `Windows (PowerShell):
param([string]$Url)
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
Invoke-RestMethod -UseBasicParsing $Url | Invoke-Expression

Linux (Bash):
#!/bin/bash
f=/tmp/ulrmm-install.sh
curl -fsSL --proto '=https' --proto-redir '=https' -o "$f" "$1" && bash "$f"
rc=$?; rm -f "$f"; exit $rc`;

const columns = [
  {
    name: "hostname",
    label: "Device",
    field: "hostname",
    sortable: true,
    align: "left",
  },
  {
    name: "plat",
    label: "Platform",
    field: "plat",
    sortable: true,
    align: "left",
  },
  {
    name: "site",
    label: "Client / site",
    field: (r) => (r.site ? `${r.client} / ${r.site}` : "no site"),
    sortable: true,
    align: "left",
  },
  {
    name: "state",
    label: "State",
    field: "migrate_state",
    sortable: true,
    align: "left",
  },
];

const sources = ref([]);
const loading = ref(false);
const error = ref("");
const ready = ref(false);
const form = ref(null);
const errs = reactive({});
const saving = ref(false);
const busy = reactive({});
const plans = reactive({});
const parts = reactive({});
const done = reactive({});
const devices = reactive({});
const selected = reactive({});
const timers = new Set();

function after(ms, fn) {
  const t = setTimeout(() => {
    timers.delete(t);
    fn();
  }, ms);
  timers.add(t);
}

async function load() {
  loading.value = true;
  error.value = "";
  try {
    sources.value = await fetchSources();
    ready.value = true;
    for (const src of sources.value) {
      if (src.last_fetch) loadPlan(src);
      loadDevices(src);
    }
  } catch (e) {
    error.value =
      e?.response?.status === 403
        ? "Only superusers can import from another RMM."
        : "The import sources could not be loaded.";
  }
  loading.value = false;
}

function edit(src) {
  for (const k of Object.keys(errs)) delete errs[k];
  form.value = {
    id: src?.id,
    kind: src?.kind || "upstream",
    name: src?.name || "",
    url: src?.url || "",
    verify_tls: src ? src.verify_tls : true,
    options: { ...(src?.options || {}) },
    secrets: {},
    clear: {},
    stored: src?.secrets_set || [],
  };
}

async function save() {
  const f = form.value;
  const secrets = {};
  for (const s of kinds[f.kind].secrets) {
    if (f.secrets[s.key]) secrets[s.key] = f.secrets[s.key];
    else if (f.clear[s.key]) secrets[s.key] = null;
  }
  const options = {};
  for (const o of kinds[f.kind].options)
    options[o.key] = (f.options[o.key] || "").trim();
  saving.value = true;
  for (const k of Object.keys(errs)) delete errs[k];
  try {
    await saveSource(
      f.id,
      {
        kind: f.kind,
        name: f.name.trim(),
        url: f.url.trim(),
        verify_tls: f.verify_tls,
        options,
        secrets,
      },
      SILENT_REQUEST_CONFIG,
    );
    notifySuccess("Source saved");
    form.value = null;
    await load();
  } catch (e) {
    const data = e?.response?.data || {};
    for (const [k, v] of Object.entries(data))
      errs[k] = String(Array.isArray(v) ? v[0] : v);
    if (!Object.keys(errs).length)
      notifyError("The source could not be saved.");
  }
  saving.value = false;
}

function remove(src) {
  $q.dialog({
    title: `Delete ${src.name}?`,
    message:
      "The source, its stored key and its device list go. Imported clients, sites and scripts stay.",
    cancel: true,
    ok: { label: "Delete", color: "negative", flat: true },
  }).onOk(async () => {
    await deleteSource(src.id);
    delete plans[src.id];
    delete devices[src.id];
    await load();
  });
}

async function loadPlan(src) {
  try {
    plans[src.id] = await fetchPlan(src.id);
    parts[src.id] ??= PARTS.filter(
      (p) => p.part && plans[src.id][p.key]?.new_count,
    ).map((p) => p.part);
  } catch {
    // the error toast comes from the axios boot
  }
}

async function loadDevices(src) {
  try {
    devices[src.id] = await fetchImportedDevices(src.id);
    selected[src.id] = (selected[src.id] || []).filter((s) =>
      devices[src.id].some((d) => d.id === s.id),
    );
  } catch {
    // shown by the axios boot
  }
}

// the read runs in the background; done when last_fetch or last_error moves
async function read(src) {
  busy[src.id] = "fetch";
  const before = { fetch: src.last_fetch, err: src.last_error };
  await readSource(src.id);
  let tries = 0;
  const poll = async () => {
    const now = await fetchSource(src.id).catch(() => null);
    tries += 1;
    if (
      now &&
      (now.last_fetch !== before.fetch ||
        (now.last_error && now.last_error !== before.err))
    ) {
      Object.assign(src, now);
      busy[src.id] = "";
      if (now.last_error) notifyError(now.last_error);
      else {
        delete parts[src.id];
        await loadPlan(src);
      }
      return;
    }
    if (tries > 150) {
      busy[src.id] = "";
      notifyError("Reading the source takes too long; refresh later.");
      return;
    }
    after(2000, poll);
  };
  after(1000, poll);
}

function partRows(id) {
  const plan = plans[id] || {};
  return PARTS.filter((p) => plan[p.key]).map((p) => ({
    ...p,
    ...plan[p.key],
  }));
}

async function doImport(src) {
  busy[src.id] = "import";
  try {
    const r = await runImport(src.id, parts[src.id]);
    done[src.id] =
      `Added ${r.clients} clients, ${r.sites} sites, ${r.custom_fields} custom fields, ` +
      `${r.scripts} scripts, ${r.snippets} snippets, ${r.keystore} key store entries, ` +
      `${r.devices} devices; ${r.linked} devices linked to enrolled agents.`;
    notifySuccess("Import finished");
    delete parts[src.id];
    await loadPlan(src);
    await loadDevices(src);
  } catch {
    // shown by the axios boot
  }
  busy[src.id] = "";
}

async function doLink(src) {
  busy[src.id] = "link";
  try {
    const { linked } = await linkDevices(src.id);
    notifySuccess(`${linked} devices linked`);
    await loadDevices(src);
  } catch {
    // shown by the axios boot
  }
  busy[src.id] = "";
}

function sendable(src) {
  return (selected[src.id] || []).filter(
    (d) => !d.agent_id && d.site && src.push_plats.includes(d.plat),
  );
}

function sendHint(src) {
  if (!src.push_plats.length)
    return "This source cannot run commands on its devices";
  return `Runs the installer on the selected devices (${src.push_plats.join(", ")}) through ${src.name}. The link it uses is valid for 3 days and enrolls only that many agents.`;
}

function doMigrate(src) {
  const list = sendable(src);
  $q.dialog({
    title: `Send the installer to ${list.length} devices?`,
    message: `${src.name} runs the ulrmm agent installer on them. The old agent stays installed; remove it once the device shows up here.`,
    cancel: true,
    ok: { label: "Send", color: "primary", flat: true },
  }).onOk(async () => {
    busy[src.id] = "migrate";
    try {
      const { queued } = await migrateDevices(
        src.id,
        list.map((d) => d.id),
      );
      notifySuccess(`Sending to ${queued} devices`);
      watchSend(src, new Set(list.map((d) => d.id)));
    } catch {
      // shown by the axios boot
    }
    busy[src.id] = "";
  });
}

// the server clears the state of queued devices; poll until each has one again
function watchSend(src, ids, tries = 0) {
  after(4000, async () => {
    await loadDevices(src);
    const open = (devices[src.id] || []).some(
      (d) => ids.has(d.id) && !d.agent_id && !d.migrate_state,
    );
    if (open && tries < 90) watchSend(src, ids, tries + 1);
  });
}

function stateLabel(row) {
  if (row.agent_id) return "linked";
  return (
    { sent: "installer sent", failed: "failed" }[row.migrate_state] || "waiting"
  );
}

function stateColor(row) {
  if (row.agent_id) return "positive";
  return { sent: "info", failed: "negative" }[row.migrate_state] || "grey-6";
}

onMounted(load);
onBeforeUnmount(() => timers.forEach(clearTimeout));
</script>

<style scoped>
.imp-check {
  min-width: 32px;
}
.rmm-pre {
  white-space: pre-wrap;
  font-size: 12px;
  margin: 0;
}
</style>
