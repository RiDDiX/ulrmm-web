<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <div>
    <SettingsPanelHeader
      title="Import"
      text="Takes clients, sites, devices, scripts, custom fields and the key store over from another RMM, from a compatible RMM server also URL actions, alert templates, policies, roles, users and reports, then moves its devices over by running the installer through it."
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
          <q-toggle
            v-if="form.kind === 'upstream' && !form.id"
            v-model="form.from_file"
            label="Read from an export file (the old server can be off)"
          />
          <div v-if="fileForm" class="text-caption rmm-muted">
            {{
              form.id
                ? "Read from an export file."
                : "The file is made with the exporter ulrmm_export.py on a machine that reaches the old server."
            }}
            <a
              class="rmm-link"
              :href="EXPORT_DOCS_URL"
              target="_blank"
              rel="noopener"
              >How to make the file</a
            >
          </div>
          <template v-else>
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
          </template>
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
              {{ kinds[src.kind]?.label || src.kind }} ·
              {{
                src.from_file
                  ? src.url
                    ? `export file of ${src.url}`
                    : "export file"
                  : src.url
              }}
            </div>
          </div>
          <q-space />
          <q-btn
            v-if="src.from_file"
            outline
            dense
            no-caps
            class="q-px-sm"
            color="primary"
            icon="upload_file"
            label="Upload file"
            :loading="busy[src.id] === 'upload'"
            :disable="!!busy[src.id]"
            @click="upload = { src, file: null, key: '', error: '' }"
          >
            <q-tooltip v-if="src.last_fetch"
              >Upload a newer file to replace what was read</q-tooltip
            >
          </q-btn>
          <q-btn
            v-else
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
            :loading="busy[src.id] === 'delete'"
            :disable="!!busy[src.id]"
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
              custom field values are filled in. A new run adds only what is new
              and completes the policies it imported earlier.
            </div>
            <q-list dense bordered separator>
              <q-expansion-item
                v-for="p in partRows(src)"
                :key="p.key"
                dense
                :hide-expand-icon="!p.new.length && !p.skipped?.length"
              >
                <template #header>
                  <q-item-section side class="imp-check">
                    <q-checkbox
                      v-if="p.part"
                      v-model="parts[src.id]"
                      :val="p.part"
                      dense
                      :aria-label="p.label"
                      @click.stop
                    />
                  </q-item-section>
                  <q-item-section>
                    <q-item-label>{{ p.label }}</q-item-label>
                    <q-item-label
                      v-for="n in partNotes(p.key, p)"
                      :key="n"
                      caption
                    >
                      {{ n }}
                    </q-item-label>
                  </q-item-section>
                  <q-item-section side class="rmm-num">
                    {{ p.new_count }} new of {{ p.total }}
                    <span v-if="p.skipped_count" class="text-warning">
                      · {{ p.skipped_count }} left out
                    </span>
                  </q-item-section>
                </template>
                <div v-if="p.new.length" class="q-pa-sm text-caption">
                  {{ p.new.join(", ")
                  }}<template v-if="p.new_count > p.new.length">, ...</template>
                </div>
                <SkippedList
                  v-if="p.skipped?.length"
                  :items="p.skipped"
                  :more="p.skipped_count - p.skipped.length"
                />
              </q-expansion-item>
            </q-list>
            <div
              v-if="plans[src.id].devices.without_site"
              class="text-caption text-warning q-mt-xs"
            >
              {{ withoutSiteText(plans[src.id].devices.without_site) }}
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
                done[src.id].text
              }}</span>
            </div>
            <q-list
              v-if="done[src.id]?.skipped.length"
              dense
              bordered
              separator
              class="q-mt-sm"
            >
              <q-expansion-item
                v-for="g in done[src.id].skipped"
                :key="g.label"
                dense
                :label="`${g.label}: ${g.total} left out`"
                header-class="text-warning"
              >
                <SkippedList
                  :items="g.items"
                  :more="g.total - g.items.length"
                />
              </q-expansion-item>
            </q-list>
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
                v-if="src.removes_agent"
                outline
                dense
                no-caps
                class="q-px-sm"
                color="negative"
                label="Remove old agent"
                :disable="!askable(src).length || !!busy[src.id]"
                :loading="busy[src.id] === 'remove'"
                @click="doRemoveOld(src)"
              >
                <q-tooltip
                  >Removes the old agent from the selected devices without
                  sending an installer, for devices whose agent here was
                  installed another way</q-tooltip
                >
              </q-btn>
              <q-btn
                v-if="src.removes_agent"
                flat
                dense
                no-caps
                label="Withdraw removal"
                :disable="!withdrawable(src).length || !!busy[src.id]"
                :loading="busy[src.id] === 'withdraw'"
                @click="doWithdraw(src)"
              >
                <q-tooltip
                  >Stops the removal of the old agent on the selected devices
                  that are still waiting for it</q-tooltip
                >
              </q-btn>
              <q-btn
                v-if="!src.from_file"
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
            <div v-if="src.removes_agent" class="q-mb-sm">
              <q-toggle
                v-model="removeOld[src.id]"
                label="Remove the old agent once the device is linked and online here"
              />
              <div class="text-caption text-warning q-ml-sm">
                {{ removeWarning(src) }}
              </div>
            </div>
            <q-banner
              v-if="src.from_file"
              dense
              rounded
              class="rmm-banner-warning q-mb-sm"
            >
              This source was read from a file, so there is no server to send
              installers through. Install the ulrmm agent on each device with a
              deployment link or by hand. A device links by host name and site
              when its agent enrolls; use Link enrolled agents for devices that
              enrolled earlier. Remove the old agent by hand.
            </q-banner>
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
              :columns="
                src.removes_agent
                  ? columns
                  : columns.filter((c) => c.name !== 'removal')
              "
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
                  <q-btn
                    v-if="props.row.link_skipped?.length"
                    flat
                    dense
                    no-caps
                    size="sm"
                    color="warning"
                    class="q-px-xs"
                    :label="`${props.row.link_skipped.length} left out when linking`"
                  >
                    <q-menu>
                      <SkippedList :items="props.row.link_skipped" />
                    </q-menu>
                  </q-btn>
                </q-td>
              </template>
              <template #body-cell-removal="props">
                <q-td :props="props">
                  <q-badge
                    v-if="props.row.removal.color"
                    :color="props.row.removal.color"
                    :label="props.row.removal.label"
                  />
                  <span v-else class="rmm-muted">{{
                    props.row.removal.label
                  }}</span>
                  <div
                    v-for="d in props.row.removal.details"
                    :key="d"
                    class="text-caption rmm-muted"
                  >
                    {{ d }}
                  </div>
                </q-td>
              </template>
            </q-table>
          </q-card-section>
        </template>
      </q-card>
    </template>

    <q-dialog
      :model-value="!!upload"
      :persistent="!!upload && busy[upload.src.id] === 'upload'"
      @hide="upload = null"
    >
      <q-card v-if="upload" style="width: 520px; max-width: 90vw">
        <DialogHeader
          :title="`Upload file to ${upload.src.name}`"
          :close-disable="busy[upload.src.id] === 'upload'"
        />
        <q-card-section class="q-gutter-y-sm">
          <q-file v-model="upload.file" outlined dense label="Export file">
            <template #prepend>
              <q-icon name="attach_file" />
            </template>
          </q-file>
          <SecretInput v-model="upload.key" label="File key" />
          <div class="text-caption rmm-muted">
            The file holds the old server's secrets (key store values, script
            bodies, web hook headers, user e-mail addresses), encrypted with the
            file key. It is sent over this HTTPS connection; the installation
            keeps only its own encrypted copy of what it read, not the file.
            Keep the file, apart from its key, until every part you want is
            imported; an update of ulrmm can ask for it again. Delete it after
            that.
          </div>
          <div v-if="upload.error" class="text-negative" role="alert">
            {{ upload.error }}
          </div>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn
            v-close-popup
            flat
            no-caps
            label="Cancel"
            :disable="busy[upload.src.id] === 'upload'"
          />
          <q-btn
            unelevated
            no-caps
            color="primary"
            label="Upload"
            :loading="busy[upload.src.id] === 'upload'"
            :disable="!upload.file || !upload.key || !!busy[upload.src.id]"
            @click="doUpload"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from "vue";
import { useQuasar } from "quasar";
import { useStore } from "vuex";
import DialogHeader from "@/components/ui/DialogHeader.vue";
import SettingsPanelHeader from "@/components/modals/coresettings/SettingsPanelHeader.vue";
import SecretInput from "@/components/ui/SecretInput.vue";
import SkippedList from "@/components/importers/SkippedList.vue";
import {
  deleteSource,
  fetchImportedDevices,
  fetchPlan,
  fetchSource,
  fetchSources,
  linkDevices,
  migrateDevices,
  readSource,
  removeOldAgent,
  runImport,
  saveSource,
  uploadSourceFile,
  withdrawRemoval,
} from "@/api/importers";
import ConfirmYesDialog from "@/components/agents/ConfirmYesDialog.vue";
import {
  count,
  importFileError,
  importSummary,
  keptAgentText,
  partNotes,
  partsOffered,
  readOutcome,
  removalAskable,
  removalView,
  removalWaiting,
  saveErrors,
  skippedByPart,
  withoutSiteText,
} from "@/utils/importers";
import { relativeTime } from "@/utils/format";
import { notifyError, notifySuccess, notifyWarning } from "@/utils/notify";
import { SILENT_REQUEST_CONFIG } from "@/constants/constants";

const $q = useQuasar();
const store = useStore();
const formatDate = (v) => store.getters.formatDate(v);

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
const EXPORT_DOCS_URL =
  "https://ulrmm.de/importing-from-another-rmm/#importing-from-a-file";

const kindOptions = Object.entries(kinds).map(([value, k]) => ({
  value,
  label: k.label,
}));

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
  {
    name: "removal",
    label: "Old agent removal",
    field: "remove_state",
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
const removeOld = reactive({});
// {src, file, key, error} while the upload dialog is open; the key lives only here
const upload = ref(null);
const timers = new Set();
let unmounted = false;

// refuses once the page is left, so the polling loops end
function after(ms, fn) {
  if (unmounted) return;
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
      // off unless chosen for this send: the removal cannot be undone
      removeOld[src.id] ??= false;
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
    from_file: !!src?.from_file,
  };
}

const fileForm = computed(
  () => form.value?.kind === "upstream" && form.value.from_file,
);

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
      fileForm.value
        ? { kind: f.kind, name: f.name.trim(), from_file: true }
        : {
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
    const { fields, message } = saveErrors(e?.response?.data, [
      "name",
      "url",
      "secrets",
    ]);
    Object.assign(errs, fields);
    if (message || !Object.keys(fields).length)
      notifyError(message || "The source could not be saved.");
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
    if (busy[src.id]) return;
    busy[src.id] = "delete";
    try {
      await deleteSource(src.id);
      delete plans[src.id];
      delete devices[src.id];
      await load();
    } catch {
      // shown by the axios boot
    }
    busy[src.id] = "";
  });
}

async function loadPlan(src) {
  try {
    plans[src.id] = await fetchPlan(src.id);
    parts[src.id] ??= partsOffered(src.parts)
      .filter(
        (p) =>
          p.part &&
          (plans[src.id][p.key]?.new_count ||
            plans[src.id][p.key]?.to_complete_count),
      )
      .map((p) => p.part);
  } catch {
    // the error toast comes from the axios boot
  }
}

async function loadDevices(src) {
  try {
    devices[src.id] = (await fetchImportedDevices(src.id)).map((d) => ({
      ...d,
      removal: removalView(d, formatDate),
    }));
    // the fresh rows, so the buttons see the current states
    const ids = new Set((selected[src.id] || []).map((s) => s.id));
    selected[src.id] = devices[src.id].filter((d) => ids.has(d.id));
  } catch {
    // shown by the axios boot
  }
}

const sleep = (ms) => new Promise((resolve) => after(ms, resolve));

// the read runs in the background; poll until it is done or failed
async function read(src) {
  busy[src.id] = "fetch";
  try {
    // another tab or user may have read it since the list loaded
    const before = (await fetchSource(src.id).catch(() => src)).last_fetch;
    // a 409 (a read or an import already runs) is shown by the axios boot
    await readSource(src.id);
    for (let tries = 0; tries <= 150; tries++) {
      await sleep(tries ? 2000 : 1000);
      const now = await fetchSource(src.id).catch(() => null);
      const outcome = readOutcome(before, now);
      if (outcome === "running") continue;
      Object.assign(src, now);
      if (outcome === "failed") notifyError(now.last_error);
      else await afterRead(src);
      return;
    }
    notifyError("Reading the source takes too long; refresh later.");
  } catch {
    // shown by the axios boot
  } finally {
    busy[src.id] = "";
  }
}

async function afterRead(src) {
  delete parts[src.id];
  await loadPlan(src);
}

// runs inside the request; a rejected file keeps the dialog open with the reason
async function doUpload() {
  const u = upload.value;
  const src = u.src;
  u.error = importFileError(u.file);
  if (u.error) return;
  busy[src.id] = "upload";
  try {
    Object.assign(src, await uploadSourceFile(src.id, u.file, u.key));
    upload.value = null;
    notifySuccess("File read");
    await afterRead(src);
  } catch (e) {
    u.error =
      saveErrors(e?.response?.data, []).message ||
      "The file could not be read.";
  } finally {
    busy[src.id] = "";
  }
}

function partRows(src) {
  const plan = plans[src.id] || {};
  return partsOffered(src.parts)
    .filter((p) => plan[p.key])
    .map((p) => ({
      ...p,
      ...plan[p.key],
    }));
}

async function doImport(src) {
  busy[src.id] = "import";
  try {
    const r = await runImport(src.id, parts[src.id]);
    done[src.id] = {
      text: importSummary(r, parts[src.id]),
      skipped: skippedByPart(r.skipped, r.skipped_total),
    };
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
    notifySuccess(`${count(linked, "device")} linked`);
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

function removeWarning(src) {
  return (
    `${src.name} is told to uninstall its agent from each device once the device is linked here and has checked in here since the installer was sent, or since the removal was asked for where no installer was sent from here. ` +
    "This happens only while the device is online on both servers and both show the same machine: the same serial number, or the same public and local address while the serial numbers do not differ. " +
    "While a device is offline on the other server it keeps its old agent; the removal is tried again for up to 7 days and then given up. " +
    "Until it is sent it can be withdrawn; once sent it cannot be undone. " +
    "The old uninstaller can also remove the remote-control agent; it is repaired here 5 minutes after the removal and, if that fails, tried again hourly for up to 7 days."
  );
}

// the removal cannot be undone: asked for the way an agent delete is
function confirmRemoval(list, title, okLabel, consequence) {
  return $q.dialog({
    component: ConfirmYesDialog,
    componentProps: {
      hostname:
        list.length === 1 ? list[0].hostname : count(list.length, "device"),
      actionVerb: "removal of the old agent",
      requireTotp: true,
      title,
      okLabel,
      consequence,
    },
  });
}

function doMigrate(src) {
  const list = sendable(src);
  const title = `Send the installer to ${count(list.length, "device")}?`;
  const send = async (withRemoval, code) => {
    busy[src.id] = "migrate";
    try {
      const { queued, remove_requested } = await migrateDevices(
        src.id,
        list.map((d) => d.id),
        withRemoval,
        code,
      );
      notifySuccess(
        withRemoval
          ? `Sending to ${count(queued, "device")}; the old agent is removed from ${remove_requested} of them once they are online here`
          : `Sending to ${count(queued, "device")}`,
      );
      removeOld[src.id] = false;
      watchSend(src, new Set(list.map((d) => d.id)));
    } catch {
      // shown by the axios boot
    }
    busy[src.id] = "";
  };
  if (removeOld[src.id]) {
    confirmRemoval(
      list,
      title,
      "Send",
      `${src.name} runs the ulrmm agent installer on them. ${removeWarning(src)}`,
    ).onOk((code) => send(true, code));
    return;
  }
  $q.dialog({
    title,
    message: `${src.name} runs the ulrmm agent installer on them. ${keptAgentText(list)}`,
    cancel: true,
    ok: { label: "Send", color: "primary", flat: true },
  }).onOk(() => send(false));
}

function askable(src) {
  return (selected[src.id] || []).filter(removalAskable);
}

function doRemoveOld(src) {
  const list = askable(src);
  confirmRemoval(
    list,
    `Remove the old agent from ${count(list.length, "device")}`,
    "Remove old agent",
    removeWarning(src),
  ).onOk(async (code) => {
    busy[src.id] = "remove";
    try {
      const { remove_requested } = await removeOldAgent(
        src.id,
        list.map((d) => d.id),
        code,
      );
      notifySuccess(
        `Removal of the old agent asked for on ${count(remove_requested, "device")}`,
      );
      await loadDevices(src);
    } catch {
      // shown by the axios boot
    }
    busy[src.id] = "";
  });
}

// the server clears the state of queued devices and the source's error;
// poll until each device has a state again, or the send failed as a whole
function watchSend(src, ids, tries = 0) {
  after(4000, async () => {
    const [now] = await Promise.all([
      fetchSource(src.id).catch(() => null),
      loadDevices(src),
    ]);
    if (now) Object.assign(src, now);
    if (now?.last_error) {
      notifyError(now.last_error);
      return;
    }
    const open = (devices[src.id] || []).some(
      (d) => ids.has(d.id) && !d.agent_id && !d.migrate_state,
    );
    if (open && tries < 90) watchSend(src, ids, tries + 1);
  });
}

function withdrawable(src) {
  return (selected[src.id] || []).filter(removalWaiting);
}

async function doWithdraw(src) {
  busy[src.id] = "withdraw";
  try {
    const { withdrawn, in_flight } = await withdrawRemoval(
      src.id,
      withdrawable(src).map((d) => d.id),
    );
    notifySuccess(`Removal withdrawn on ${count(withdrawn, "device")}`);
    if (in_flight)
      notifyWarning(
        `The removal on ${count(in_flight, "device")} had already started and could not be withdrawn.`,
        6000,
      );
    await loadDevices(src);
  } catch {
    // shown by the axios boot
  }
  busy[src.id] = "";
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
onBeforeUnmount(() => {
  unmounted = true;
  timers.forEach(clearTimeout);
});
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
