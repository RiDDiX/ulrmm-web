<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <div class="q-gutter-y-md">
    <q-banner v-if="error" class="bg-negative" role="alert" rounded dense>
      <template #avatar><q-icon name="error_outline" /></template>
      {{ error }}
    </q-banner>

    <section class="rmm-card" aria-labelledby="iso-add-title">
      <div class="rmm-card__header">
        <h3 id="iso-add-title" class="rmm-card__title">Add base images</h3>
      </div>
      <div class="rmm-card__body row q-col-gutter-md">
        <div class="col-12">
          <div class="deploy-line">
            <q-file
              v-model="file"
              class="col"
              accept=".iso"
              label="Upload from this computer"
              hint="One .iso file up to 14 GiB. Starting and finishing the upload need the 60-minute two-factor unlock."
              :max-file-size="MAX_UPLOAD"
              :disable="!!uploader"
              outlined
              dense
              @rejected="
                error = 'Only one .iso file up to 14 GiB can be uploaded.'
              "
            >
              <template #prepend><q-icon name="upload_file" /></template>
            </q-file>
            <q-btn
              unelevated
              no-caps
              color="primary"
              icon="upload"
              :label="uploadLabel"
              :loading="uploading || finishing"
              :disable="!file || verifying"
              @click="upload"
            />
            <q-btn
              v-if="uploading"
              flat
              no-caps
              icon="pause"
              label="Pause"
              :disable="up.state === 'pausing'"
              @click="uploader?.pause()"
            />
            <q-btn
              v-if="uploader"
              flat
              no-caps
              icon="close"
              label="Cancel"
              :disable="finishing"
              @click="confirmCancel"
            />
          </div>
          <div v-if="uploader || verifying" class="q-mt-sm" aria-live="polite">
            <q-linear-progress
              :value="up.total ? up.sent / up.total : 0"
              :color="up.state === 'failed' ? 'negative' : 'primary'"
              :indeterminate="verifying"
              rounded
              :aria-label="`Upload ${percent} %`"
            />
            <div
              class="text-caption q-mt-xs"
              :class="up.state === 'failed' ? 'text-negative' : 'rmm-muted'"
              :role="up.state === 'failed' ? 'alert' : undefined"
            >
              {{ progressText }}
            </div>
          </div>
        </div>
        <div class="col-12 col-md-6">
          <div class="deploy-line">
            <q-input
              v-model="filename"
              class="col"
              label="Add from server folder"
              hint="ISO file name inside the server's private/iso folder"
              spellcheck="false"
              autocomplete="off"
              outlined
              dense
              @keyup.enter="addFile"
            />
            <q-btn
              outline
              no-caps
              color="primary"
              icon="add"
              label="Add"
              :loading="busy === 'file'"
              :disable="!filename.trim() || !!busy"
              @click="addFile"
            />
            <q-btn
              flat
              no-caps
              color="primary"
              icon="manage_search"
              label="Scan folder"
              :loading="busy === 'scan'"
              :disable="!!busy"
              @click="scan"
            >
              <q-tooltip>
                Picks up every ISO copied into the server's private/iso folder
              </q-tooltip>
            </q-btn>
          </div>
        </div>
        <div class="col-12 col-md-6">
          <div class="deploy-line">
            <q-input
              v-model="url"
              class="col"
              type="url"
              label="Add from URL"
              hint="https:// link, downloaded by the server"
              spellcheck="false"
              autocomplete="off"
              outlined
              dense
              @keyup.enter="addUrl"
            />
            <q-btn
              outline
              no-caps
              color="primary"
              icon="cloud_download"
              label="Download"
              :loading="busy === 'url'"
              :disable="!/^https:\/\//i.test(url.trim()) || !shaOk || !!busy"
              @click="addUrl"
            />
          </div>
          <q-input
            v-model="sha"
            class="q-mt-sm"
            label="Expected SHA-256 (optional)"
            hint="Checked once the download is complete"
            :error="!shaOk"
            error-message="64 hex characters"
            spellcheck="false"
            autocomplete="off"
            outlined
            dense
            @keyup.enter="addUrl"
          />
        </div>
      </div>
    </section>

    <q-btn-toggle
      v-model="kind"
      :options="KIND_OPTIONS"
      dense
      no-caps
      unelevated
      toggle-color="primary"
      padding="3px 10px"
      role="group"
      aria-label="Filter by kind"
    />

    <q-table
      dense
      flat
      class="rmm-table"
      row-key="id"
      :rows="shown"
      :columns="columns"
      :loading="loading"
      :pagination="{ rowsPerPage: 0 }"
      hide-pagination
    >
      <template #no-data>
        <EmptyState
          class="full-width"
          :icon="kind === 'built' ? 'album' : 'folder_open'"
          :title="kind === 'built' ? 'No built images yet' : 'No images yet'"
          :text="
            kind === 'built'
              ? 'Build one in the deployment builder.'
              : 'Upload an ISO, copy one into the server folder and scan it, or add a URL.'
          "
        >
          <q-btn
            v-if="kind === 'built' && builder"
            outline
            no-caps
            color="primary"
            icon="rocket_launch"
            label="Deployment builder"
            @click="emit('build')"
          />
        </EmptyState>
      </template>
      <template #body-cell-kind="cell">
        <q-td :props="cell">
          <q-chip
            dense
            square
            :label="cell.row.kind === 'built' ? 'Built' : 'Base'"
          />
        </q-td>
      </template>
      <template #body-cell-os="cell">
        <q-td :props="cell">
          <q-chip dense square :label="cell.row.os || 'unknown'" />
        </q-td>
      </template>
      <template #body-cell-boot="cell">
        <q-td :props="cell">
          <q-chip v-if="cell.row.bios" dense square label="BIOS" />
          <q-chip v-if="cell.row.efi" dense square label="UEFI" />
          <q-chip v-if="cell.row.udf" dense square label="UDF" />
        </q-td>
      </template>
      <template #body-cell-sha256="cell">
        <q-td :props="cell">
          <template v-if="cell.row.sha256">
            <code>{{ cell.row.sha256.slice(0, 12) }}</code>
            <q-btn
              flat
              round
              v-bind="iconBtn"
              icon="content_copy"
              :aria-label="`Copy the SHA-256 of ${cell.row.name}`"
              @click="copyOutput(cell.row.sha256)"
            >
              <q-tooltip>Copy the SHA-256</q-tooltip>
            </q-btn>
          </template>
        </q-td>
      </template>
      <template #body-cell-status="cell">
        <q-td :props="cell">
          <q-chip
            dense
            square
            :color="STATUS_COLOR[cell.row.status as BaseIso['status']]"
            text-color="white"
            :label="cell.row.status"
          >
            <q-tooltip v-if="cell.row.error">{{ cell.row.error }}</q-tooltip>
          </q-chip>
          <span v-if="cell.row.error" class="sr-only">{{
            cell.row.error
          }}</span>
        </q-td>
      </template>
      <template #body-cell-actions="cell">
        <q-td :props="cell" class="text-right no-wrap">
          <q-btn
            flat
            round
            v-bind="iconBtn"
            icon="download"
            :aria-label="`Download ${cell.row.name}`"
            :loading="working === cell.row.id"
            :disable="cell.row.status !== 'ready'"
            @click="download(cell.row)"
          >
            <q-tooltip>Download the image</q-tooltip>
          </q-btn>
          <q-btn
            flat
            round
            v-bind="iconBtn"
            icon="verified"
            :aria-label="`Verify ${cell.row.name}`"
            :loading="working === cell.row.id"
            :disable="
              cell.row.status !== 'ready' && cell.row.status !== 'error'
            "
            @click="verify(cell.row)"
          >
            <q-tooltip>Recheck the file and its checksum</q-tooltip>
          </q-btn>
          <q-btn
            flat
            round
            v-bind="iconBtn"
            icon="delete_outline"
            :aria-label="`Delete ${cell.row.name}`"
            :loading="working === cell.row.id"
            @click="confirmDelete(cell.row)"
          >
            <q-tooltip>Delete the image</q-tooltip>
          </q-btn>
        </q-td>
      </template>
    </q-table>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { openURL, useQuasar, type QTableColumn } from "quasar";
import { useStore } from "vuex";
import EmptyState from "@/components/ui/EmptyState.vue";
import { ensureConsoleStepUp } from "@/composables/accounts";
import { useChunkedUpload } from "@/composables/chunkedUpload";
import { stepUpCall } from "@/components/vault/stepUp";
import { copyOutput, isWebUrl } from "@/utils/helpers";
import { fmtBytes } from "@/utils/format";
import { notifySuccess } from "@/utils/notify";
import { failureText, retryAfterStepUp } from "@/utils/deploy";
import type { ChunkApi, ChunkedUpload } from "@/utils/chunkedUpload";
import {
  addIso,
  deleteIso,
  fetchIsoLibrary,
  fetchIsoUpload,
  finishIsoUpload,
  isoDownloadLink,
  putIsoUploadChunk,
  removeIsoUpload,
  scanIsoFolder,
  startIsoUpload,
  verifyIso,
  type BaseIso,
} from "@/api/deploy";

// builder: show the "Deployment builder" button when no built image exists
defineProps<{ builder?: boolean }>();
const emit = defineEmits<{ changed: []; build: [] }>();

const $q = useQuasar();
const store = useStore();

const STATUS_COLOR = {
  downloading: "info",
  verifying: "info",
  inspecting: "info",
  ready: "positive",
  error: "negative",
};

const KIND_OPTIONS = [
  { label: "All", value: "all" },
  { label: "Base", value: "base" },
  { label: "Built", value: "built" },
];
// the same limit the server applies to a download from a URL
const MAX_UPLOAD = 14 * 1024 ** 3;

// row buttons keep their full size on touch screens
const iconBtn = computed(() =>
  $q.platform.has.touch ? {} : { dense: true, size: "sm" },
);

const rows = ref<BaseIso[]>([]);
const kind = ref<"all" | BaseIso["kind"]>("all");
const loading = ref(false);
const error = ref("");
const filename = ref("");
const url = ref("");
const sha = ref("");
const shaOk = computed(
  () => !sha.value.trim() || /^[0-9a-f]{64}$/i.test(sha.value.trim()),
);
const busy = ref<"" | "file" | "scan" | "url">("");
const working = ref<number | null>(null);
let timer: ReturnType<typeof setTimeout> | undefined;
let gone = false;
// the ids and states of the last load, so "changed" fires on real changes
let seen: string | undefined;

const columns = computed<QTableColumn<BaseIso>[]>(() => [
  { name: "name", label: "Name", field: "name", align: "left", sortable: true },
  { name: "kind", label: "Kind", field: "kind", align: "left" },
  { name: "os", label: "OS", field: "os", align: "left" },
  { name: "label", label: "Label", field: "label", align: "left" },
  {
    name: "size",
    label: "Size",
    field: "size",
    align: "right",
    format: (v: number) => fmtBytes(v),
    sortable: true,
  },
  { name: "boot", label: "Boot", field: "efi", align: "left" },
  { name: "sha256", label: "SHA-256", field: "sha256", align: "left" },
  { name: "status", label: "Status", field: "status", align: "left" },
  {
    name: "built_by",
    label: "Built by",
    field: (r) => (r.built_by ? `${r.built_by} · ${r.target}` : ""),
    align: "left",
  },
  {
    name: "added",
    label: "Added",
    field: "added",
    align: "left",
    format: (v: string | null) => store.getters.formatDate(v),
    sortable: true,
  },
  { name: "actions", label: "", field: "id", align: "right" },
]);

const shown = computed(() =>
  kind.value === "all"
    ? rows.value
    : rows.value.filter((i) => i.kind === kind.value),
);

const pending = (list: BaseIso[]) =>
  list.some(
    (i) =>
      i.status === "downloading" ||
      i.status === "verifying" ||
      i.status === "inspecting",
  );

async function load(quiet = false) {
  clearTimeout(timer);
  if (!quiet) loading.value = true;
  try {
    rows.value = await fetchIsoLibrary();
    error.value = "";
    const sig = rows.value.map((i) => `${i.id}:${i.status}`).join();
    if (seen !== undefined && sig !== seen) emit("changed");
    seen = sig;
  } catch (e) {
    error.value = await failureText(e);
  }
  loading.value = false;
  if (!gone && pending(rows.value)) timer = setTimeout(() => load(true), 3000);
}

// one guarded call for every action that ends with a reload
async function run(task: () => Promise<unknown>, done: string) {
  error.value = "";
  try {
    await task();
    notifySuccess(done);
  } catch (e) {
    error.value = await failureText(e);
  }
  await load(true);
}

async function addFile() {
  busy.value = "file";
  await run(() => addIso({ filename: filename.value.trim() }), "Image added");
  filename.value = "";
  busy.value = "";
}

async function addUrl() {
  // Enter in either field skips the Download button's guard
  if (!/^https:\/\//i.test(url.value.trim()) || !shaOk.value || busy.value)
    return;
  busy.value = "url";
  await run(
    () =>
      addIso({ url: url.value.trim(), sha256: sha.value.trim() || undefined }),
    "Download started",
  );
  url.value = "";
  sha.value = "";
  busy.value = "";
}

async function scan() {
  busy.value = "scan";
  await run(scanIsoFolder, "Folder scanned");
  busy.value = "";
}

async function verify(row: BaseIso) {
  working.value = row.id;
  await run(() => verifyIso(row.id), `${row.name} checked`);
  working.value = null;
}

// the browser fetches the file itself, so a large image never sits in memory
async function download(row: BaseIso) {
  working.value = row.id;
  await run(async () => {
    const { url } = await retryAfterStepUp(
      () => isoDownloadLink(row.id),
      () => ensureConsoleStepUp($q),
    );
    if (!isWebUrl(url)) throw new Error("not a download link");
    openURL(url);
  }, `Downloading ${row.name}`);
  working.value = null;
}

function confirmDelete(row: BaseIso) {
  $q.dialog({
    title: `Delete ${row.name}?`,
    message: "The image is removed from the library and from the server.",
    cancel: true,
    ok: { color: "negative", label: "Delete" },
  }).onOk(async () => {
    working.value = row.id;
    await run(() => deleteIso(row.id), `${row.name} deleted`);
    working.value = null;
  });
}

// upload from the browser, in parts like software packages

const file = ref<File | null>(null);
const {
  up,
  uploader,
  percent,
  uploading,
  progressText: uploadText,
  run: runUpload,
} = useChunkedUpload();
const finishing = ref(false);
// the uploaded row until the server has inspected it
const checking = ref<number | null>(null);

const verifying = computed(
  () =>
    finishing.value ||
    rows.value.some(
      (i) => i.id === checking.value && i.status === "inspecting",
    ),
);
const uploadLabel = computed(() =>
  up.state === "paused" || up.state === "failed" ? "Resume" : "Upload",
);
const progressText = computed(() =>
  verifying.value ? "Verifying the image on the server..." : uploadText.value,
);

function chunkApi(f: File): ChunkApi {
  return {
    start: () =>
      stepUpCall($q, (config: object) =>
        startIsoUpload({ filename: f.name, size: f.size }, config),
      ),
    status: (id) => fetchIsoUpload(id),
    put: (id, chunk, start, onProgress) =>
      putIsoUploadChunk(id, chunk, start, f.size, onProgress),
    remove: (id) => removeIsoUpload(id),
  };
}

async function upload() {
  if (!file.value) return;
  error.value = "";
  const done = await runUpload(
    file.value,
    chunkApi(file.value),
    (message) => (error.value = message),
  );
  if (done) return finish(done);
}

async function finish(current: ChunkedUpload) {
  const id = current.id;
  if (id === null) return;
  finishing.value = true;
  try {
    const row = await stepUpCall($q, (config: object) =>
      finishIsoUpload(id, config),
    );
    if (row) {
      // the server owns the file now; nothing left to remove
      uploader.value = null;
      file.value = null;
      checking.value = row.id;
      notifySuccess(`${row.name} uploaded`);
    }
  } catch (e) {
    error.value = await failureText(e);
    // the upload expired or is gone: the next try starts over
    if ((e as { response?: { status?: number } })?.response?.status === 404)
      uploader.value = null;
  }
  finishing.value = false;
  await load(true);
}

function confirmCancel() {
  $q.dialog({
    title: "Cancel the upload?",
    message: "The part already on the server is removed.",
    cancel: true,
    ok: { color: "negative", label: "Cancel upload" },
  }).onOk(async () => {
    const pending = uploader.value;
    uploader.value = null;
    await pending?.cancel();
    notifySuccess("Upload cancelled");
  });
}

defineExpose({ load });

onMounted(load);
onBeforeUnmount(() => {
  gone = true;
  clearTimeout(timer);
  // leaving the page drops the unfinished upload
  uploader.value?.cancel();
});
</script>
