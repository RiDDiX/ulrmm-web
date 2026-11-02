<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-dialog
    ref="dialogRef"
    persistent
    aria-labelledby="pkg-form-title"
    @hide="onDialogHide"
  >
    <q-card class="q-dialog-plugin rmm-dialog--md">
      <DialogHeader
        title-id="pkg-form-title"
        :title="pkg ? `Edit ${pkg.name}` : 'Upload package'"
        :subtitle="
          pkg
            ? 'The installer file itself cannot be replaced; upload a new package for that'
            : 'Keeps the installer on the RMM server so agents can install it'
        "
      />
      <q-form @submit="submit">
        <q-card-section class="q-gutter-y-sm pkg-form__body">
          <div class="text-subtitle2">Installer</div>
          <q-file
            v-if="!pkg"
            v-model="file"
            label="Installer"
            :accept="accept || PACKAGE_ACCEPT"
            :hint="
              accept
                ? `${accept.split(',').join(' ')} files`
                : 'Windows .exe .msi .msix .appx and bundles, Windows driver packages .zip .cab with INF files, macOS .pkg, Linux .deb .rpm, archives .zip .7z .tar.gz with a setup inside; any size the server has room for'
            "
            dense
            outlined
            :disable="!!uploader"
            :error="!!err('file')"
            :error-message="err('file')"
            :rules="[(v) => !!v || 'Required']"
            @update:model-value="onFile"
            @rejected="onRejected"
          >
            <template #prepend><q-icon name="attach_file" /></template>
          </q-file>
          <div v-else class="pkg-file-summary text-caption">
            <span class="rmm-mono">{{ pkg.filename }}</span> ·
            {{ PLAT_LABELS[pkg.plat] ?? pkg.plat }} · SHA-256
            <span class="rmm-mono">{{ pkg.sha256 }}</span>
          </div>
          <div v-if="zipChoice">
            <div id="pkg-zip-label" class="rmm-label">The .zip holds</div>
            <q-option-group
              v-model="zipKind"
              :options="ZIP_KINDS"
              aria-labelledby="pkg-zip-label"
              color="primary"
              dense
              :disable="!!uploader"
            />
            <div
              v-if="zipMissing"
              class="text-caption text-negative"
              role="alert"
            >
              Choose what the .zip holds
            </div>
          </div>
          <q-select
            v-if="!pkg && kind === 'archive'"
            v-model="plat"
            :options="PLAT_OPTIONS"
            emit-value
            map-options
            dense
            outlined
            options-dense
            label="Platform"
            hint="Only agents on this platform can install it"
            :disable="!!uploader"
            :error="!!err('plat')"
            :error-message="err('plat')"
            :rules="[(v) => !!v || 'Required']"
          />
          <q-input
            v-model="form.name"
            label="Name"
            maxlength="255"
            dense
            outlined
            :error="!!err('name')"
            :error-message="err('name')"
            :rules="[(v) => !!v?.trim() || 'Required']"
          />
          <div class="row q-col-gutter-sm">
            <q-input
              v-model="form.vendor"
              class="col-6"
              label="Vendor (optional)"
              maxlength="255"
              dense
              outlined
              :error="!!err('vendor')"
              :error-message="err('vendor')"
            />
            <q-input
              v-model="form.version"
              class="col-6"
              label="Version (optional)"
              maxlength="64"
              dense
              outlined
              :error="!!err('version')"
              :error-message="err('version')"
            />
          </div>

          <div class="text-subtitle2 q-pt-sm">How it runs</div>
          <template v-if="kind === 'archive'">
            <q-input
              v-model="form.command"
              label="Command"
              :hint="`A path inside the archive, e.g. setup/Setup.exe, or ${ARCHIVE_COMMANDS.join(', ')}`"
              input-class="rmm-mono"
              maxlength="1024"
              dense
              outlined
              :error="!!err('command')"
              :error-message="err('command')"
              :rules="[
                (v) => !archiveCommandError(v) || archiveCommandError(v),
              ]"
            />
          </template>
          <q-input
            v-if="takesArgs(kind)"
            v-model="form.default_args"
            :label="
              kind === 'archive'
                ? 'Arguments (optional)'
                : 'Installer arguments (optional)'
            "
            :hint="
              kind === 'msi'
                ? 'msiexec already gets /i /qn /norestart, add only extra options such as ALLUSERS=1'
                : kind === 'archive'
                  ? 'Passed to the command, e.g. --silent or /quiet /norestart'
                  : 'The silent switches of this setup, e.g. /S or /quiet /norestart'
            "
            maxlength="1024"
            dense
            outlined
            :error="!!err('default_args')"
            :error-message="err('default_args')"
          />
          <div v-else-if="kind === 'driver'" class="text-caption rmm-muted">
            Driver package: every INF file inside is added with pnputil and
            installed on matching devices, as system and without arguments.
            Needs Windows 10 1607 or later.
          </div>
          <div v-else-if="kind" class="text-caption rmm-muted">
            Installer arguments are only used for .exe and .msi files and
            archives.
          </div>
          <div v-if="kind === 'archive'" class="row q-col-gutter-sm">
            <q-input
              v-model="form.success_codes"
              class="col-6"
              label="Success exit codes"
              hint="Comma separated"
              dense
              outlined
              :error="!!err('success_codes')"
              :error-message="err('success_codes')"
              :rules="[codesRule]"
            />
            <q-input
              v-model="form.reboot_codes"
              class="col-6"
              label="Reboot exit codes"
              hint="Success, the device needs a reboot"
              dense
              outlined
              :error="!!err('reboot_codes')"
              :error-message="err('reboot_codes')"
              :rules="[(v) => !String(v).trim() || codesRule(v)]"
            />
          </div>
          <q-input
            v-model.number="form.timeout"
            type="number"
            label="Timeout"
            :hint="`60 to ${maxTimeout} seconds for download and install; a longer install is stopped and marked failed`"
            suffix="seconds"
            min="60"
            :max="maxTimeout"
            dense
            outlined
            :error="!!err('timeout')"
            :error-message="err('timeout')"
            :rules="[
              (v) =>
                (v >= 60 && v <= maxTimeout) || `60 to ${maxTimeout} seconds`,
            ]"
          />

          <div class="text-subtitle2 q-pt-sm">Detection</div>
          <DetectionEditor
            v-model="form.detection"
            :plat="packagePlat"
            :error="err('detection')"
          />
          <div class="text-caption rmm-muted">
            Software baselines use it to check that the package really is
            installed.
          </div>

          <template v-if="kind !== 'archive'">
            <div class="text-subtitle2 q-pt-sm">Signature</div>
            <div class="row items-center no-wrap">
              <q-checkbox
                v-model="form.allow_unsigned"
                :label="
                  kind === 'driver'
                    ? 'Allow unsigned driver catalogs'
                    : 'Allow an unsigned installer'
                "
              />
              <HelpTip
                :text="
                  kind === 'driver'
                    ? 'Normally every .cat catalog in the package needs a valid signature; this also lets a package with unsigned or no catalogs install'
                    : 'Normally only files with a valid signature install; this also lets unsigned files run'
                "
              />
            </div>
            <div v-if="kind === 'deb'" class="text-caption rmm-muted">
              .deb files carry no signature the endpoint can check, they only
              install with this option.
            </div>
            <q-banner
              v-if="form.allow_unsigned"
              dense
              rounded
              class="rmm-banner-warning"
              role="status"
            >
              Nothing then proves who built the file, and it runs as SYSTEM or
              root on every agent it is installed on. Tampered or untrusted
              signatures are refused either way.
            </q-banner>
          </template>
          <div v-else class="text-caption rmm-muted">
            The agent checks the archive against its SHA-256 before it unpacks
            it, and runs the command as SYSTEM or root.
          </div>
          <div class="row items-start no-wrap q-gutter-x-sm pkg-stepup">
            <q-icon name="lock" size="16px" class="q-mt-xs" />
            <div class="text-caption">
              {{
                pkg
                  ? "Saving needs the same 60-minute two-factor unlock as terminal and file access. If it is not open, you will be asked for a 2FA code."
                  : "Starting and finishing the upload need the same 60-minute two-factor unlock as terminal and file access. If it is not open at either point, you will be asked for a 2FA code."
              }}
            </div>
          </div>
          <div v-if="uploader" aria-live="polite">
            <q-linear-progress
              :value="up.total ? up.sent / up.total : 0"
              :color="up.state === 'failed' ? 'negative' : 'primary'"
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
        </q-card-section>
        <q-card-actions align="right">
          <q-btn
            v-if="canPause"
            flat
            no-caps
            icon="pause"
            label="Pause"
            :disable="up.state === 'pausing'"
            @click="uploader.pause()"
          />
          <q-space />
          <q-btn flat label="Cancel" :disable="saving" @click="cancel" />
          <q-btn
            unelevated
            color="primary"
            :label="submitLabel"
            type="submit"
            :loading="busy"
          />
        </q-card-actions>
      </q-form>
    </q-card>
  </q-dialog>
</template>

<script setup>
import DialogHeader from "@/components/ui/DialogHeader.vue";
import {
  ref,
  shallowRef,
  reactive,
  computed,
  watch,
  onBeforeUnmount,
} from "vue";
import { useQuasar, useDialogPluginComponent } from "quasar";
import HelpTip from "@/components/ui/HelpTip.vue";
import DetectionEditor from "@/components/baselines/DetectionEditor.vue";
import {
  fetchUpload,
  finishUpload,
  putUploadChunk,
  removeUpload,
  startUpload,
  updatePackage,
} from "@/api/packages";
import { serverErrors, stepUpCall } from "@/components/vault/stepUp";
import { bytes2Human } from "@/utils/format";
import { notifyError, notifySuccess } from "@/utils/notify";
import { PLAT_OPTIONS, cleanDetection } from "@/utils/baselines";
import { createChunkedUpload } from "@/utils/chunkedUpload";
import {
  ARCHIVE_COMMANDS,
  DEFAULT_REBOOT_CODES,
  DEFAULT_SUCCESS_CODES,
  PACKAGE_ACCEPT,
  PLAT_LABELS,
  archiveCommandError,
  packageKind,
  parseCodes,
  takesArgs,
  timeoutMax,
} from "@/utils/packages";

const props = defineProps({
  // null => upload
  pkg: { type: Object, default: null },
  // narrows the file picker, e.g. ".zip,.cab" for driver packages
  accept: { type: String, default: "" },
});
defineEmits([...useDialogPluginComponent.emits]);
const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } =
  useDialogPluginComponent();
const $q = useQuasar();

const ZIP_KINDS = [
  { value: "driver", label: "Windows driver files (INF), added with pnputil" },
  { value: "archive", label: "A setup that runs with a command" },
];
const KIND_PLATS = { pkg: "darwin", deb: "linux", rpm: "linux" };

function onRejected() {
  notifyError("This file type cannot be installed.");
}

const codesText = (codes, fallback) => (codes ?? fallback).join(", ");
const form = reactive({
  name: props.pkg?.name ?? "",
  vendor: props.pkg?.vendor ?? "",
  version: props.pkg?.version ?? "",
  default_args: props.pkg?.default_args ?? "",
  timeout: props.pkg?.timeout ?? 1800,
  allow_unsigned: props.pkg?.allow_unsigned ?? false,
  command: props.pkg?.command ?? "",
  success_codes: codesText(props.pkg?.success_codes, DEFAULT_SUCCESS_CODES),
  reboot_codes: codesText(props.pkg?.reboot_codes, DEFAULT_REBOOT_CODES),
  detection: props.pkg?.detection ?? { type: "none" },
});
const file = ref(null);
// .zip: driver or archive; preset when the picker only takes drivers
const zipKind = ref(props.accept === ".zip,.cab" ? "driver" : null);
const zipMissing = ref(false);
const plat = ref(null);
const errors = ref({});
const saving = ref(false);

const extKind = computed(() => packageKind(file.value?.name));
const zipChoice = computed(
  () =>
    !props.pkg &&
    props.accept !== ".zip,.cab" &&
    /\.zip$/i.test(file.value?.name ?? ""),
);
const kind = computed(() => {
  if (props.pkg) return props.pkg.kind;
  return zipChoice.value ? zipKind.value : extKind.value;
});
const packagePlat = computed(() => {
  if (props.pkg) return props.pkg.plat;
  if (kind.value === "archive") return plat.value ?? "";
  return KIND_PLATS[kind.value] ?? "windows";
});
const maxTimeout = computed(() => timeoutMax(kind.value));
// registry rules only exist on windows
watch(packagePlat, (p) => {
  if (p !== "windows" && form.detection?.type === "registry")
    form.detection = { type: "none" };
});

const codesRule = (v) =>
  !!parseCodes(v)?.length || "Whole numbers, separated by commas";

// "text", or a nested {index: ["text"]} of a list field
function err(key) {
  const e = errors.value[key];
  if (!e) return "";
  if (typeof e === "string") return e;
  const first = Object.values(e)[0];
  return String((Array.isArray(first) ? first[0] : first) ?? "");
}

// name follows the file until it is edited by hand
let prefill = "";
function onFile(f) {
  zipMissing.value = false;
  errors.value = {};
  if (/\.(7z|zip)$/i.test(f?.name ?? "")) plat.value ??= "windows";
  if (/\.(tar\.gz|tgz)$/i.test(f?.name ?? "")) plat.value ??= "linux";
  if (!f || (form.name && form.name !== prefill)) return;
  form.name = prefill = f.name.replace(/(\.tar)?\.[^.]+$/i, "");
}

const up = reactive({
  state: "idle",
  sent: 0,
  total: 0,
  retry: 0,
  error: null,
});
// set while an upload exists on the server and is not a package yet
const uploader = shallowRef(null);

const percent = computed(() =>
  up.total ? Math.floor((up.sent / up.total) * 100) : 0,
);
const busy = computed(
  () => saving.value || ["uploading", "retrying", "pausing"].includes(up.state),
);
const canPause = computed(() =>
  ["uploading", "retrying", "pausing"].includes(up.state),
);
const submitLabel = computed(() => {
  if (props.pkg) return "Save";
  if (up.state === "paused" || up.state === "failed") return "Resume";
  return up.state === "uploaded" ? "Finish" : "Upload";
});
const progressText = computed(() => {
  const amount = `${bytes2Human(up.sent)} of ${bytes2Human(up.total)} (${percent.value} %)`;
  switch (up.state) {
    case "retrying":
      return `Connection problem, try ${up.retry} of 3 for this part... ${amount}`;
    case "pausing":
      return `Pausing after the current part... ${amount}`;
    case "paused":
      return `Paused at ${amount}. Resume continues from there.`;
    case "failed":
      return `${serverErrors(up.error).message} Resume continues at ${bytes2Human(up.sent)}.`;
    case "uploaded":
      return saving.value
        ? "Checking the file on the server..."
        : `${bytes2Human(up.total)} uploaded.`;
    default:
      return `Uploading ${amount}`;
  }
});

function chunkApi(f) {
  return {
    start: () =>
      stepUpCall($q, (config) =>
        startUpload({ filename: f.name, size: f.size }, config),
      ),
    status: (id) => fetchUpload(id),
    put: (id, chunk, start, onProgress) =>
      putUploadChunk(id, chunk, start, f.size, onProgress),
    remove: (id) => removeUpload(id),
  };
}

function payload() {
  const body = {
    name: form.name.trim(),
    vendor: form.vendor.trim(),
    version: form.version.trim(),
    default_args: takesArgs(kind.value) ? form.default_args.trim() : "",
    timeout: form.timeout,
    allow_unsigned: kind.value === "archive" ? false : form.allow_unsigned,
    detection: cleanDetection(form.detection),
  };
  if (kind.value === "archive") {
    body.command = form.command.trim();
    body.success_codes = parseCodes(form.success_codes);
    body.reboot_codes = parseCodes(form.reboot_codes) ?? [];
  }
  if (!props.pkg && zipChoice.value) body.kind = zipKind.value;
  if (!props.pkg && kind.value === "archive") {
    body.kind = "archive";
    body.plat = plat.value;
  }
  return body;
}

// field errors go to their fields, anything else into a toast
function showErrors(e) {
  const { fields, message } = serverErrors(e);
  errors.value = fields;
  const known = [
    "name",
    "vendor",
    "version",
    "default_args",
    "timeout",
    "command",
    "success_codes",
    "reboot_codes",
    "detection",
    "plat",
  ];
  if (!Object.keys(fields).some((k) => known.includes(k))) notifyError(message);
}

async function save() {
  saving.value = true;
  errors.value = {};
  try {
    const body = payload();
    const saved = await stepUpCall($q, (config) =>
      updatePackage(props.pkg.id, body, config),
    );
    if (!saved) return;
    notifySuccess(`${body.name} was saved`);
    onDialogOK(saved);
  } catch (e) {
    showErrors(e);
  } finally {
    saving.value = false;
  }
}

async function finish() {
  saving.value = true;
  try {
    const body = payload();
    const saved = await stepUpCall($q, (config) =>
      finishUpload(uploader.value.id, body, config),
    );
    if (!saved) return;
    // the server owns the file now; nothing left to remove
    uploader.value = null;
    notifySuccess(`${body.name} was uploaded`);
    onDialogOK(saved);
  } catch (e) {
    showErrors(e);
    // the upload expired or is gone: the next try starts over
    if (e?.response?.status === 404) uploader.value = null;
  } finally {
    saving.value = false;
  }
}

async function submit() {
  if (props.pkg) return save();
  if (zipChoice.value && !zipKind.value) {
    zipMissing.value = true;
    return;
  }
  errors.value = {};
  const current = (uploader.value ??= createChunkedUpload(
    file.value,
    chunkApi(file.value),
    (p) => Object.assign(up, p),
  ));
  const done = await current.run();
  // cancelled meanwhile
  if (uploader.value !== current) return;
  if (done) return finish();
  // nothing stored yet: the code prompt was cancelled or the server refused
  // the upload (e.g. no room); the file can be changed again
  if (current.id === null && up.state !== "paused") {
    if (up.state === "failed")
      errors.value = { file: serverErrors(up.error).message };
    uploader.value = null;
  }
}

async function cancel() {
  const pending = uploader.value;
  uploader.value = null;
  onDialogCancel();
  await pending?.cancel();
}

// closed from the header: drop the unfinished upload
onBeforeUnmount(() => {
  uploader.value?.cancel();
});
</script>

<style scoped>
.pkg-file-summary {
  padding: 8px 10px;
  border: 1px solid var(--rmm-border);
  border-radius: var(--rmm-radius-sm);
  color: var(--rmm-text-muted);
  background: var(--rmm-surface-2);
  word-break: break-all;
}

.pkg-form__body {
  max-height: 70vh;
  overflow-y: auto;
}

.pkg-stepup {
  color: var(--rmm-text-muted);
}
</style>
