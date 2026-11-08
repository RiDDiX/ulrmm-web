<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <section class="rmm-card deploy-export" aria-labelledby="iso-build-title">
    <div class="rmm-card__header">
      <h3 id="iso-build-title" class="rmm-card__title">Full bootable ISO</h3>
      <HelpTip
        text="The server copies the base image, adds the answer file and the agent, and keeps the result until you discard it. Nothing leaves the server except the download."
      />
      <q-space />
      <q-btn
        flat
        dense
        no-caps
        icon="folder_open"
        label="Manage library"
        @click="libraryOpen = true"
      />
    </div>
    <div class="rmm-card__body column q-gutter-y-sm">
      <RmmSelect
        v-model="baseId"
        map-options
        emit-value
        dense
        label="Base image"
        :options="options"
        :loading="dl.loading"
        :disable="!!busy"
      />

      <q-card
        v-if="!candidates.length && !shown"
        flat
        bordered
        class="q-pa-md column q-gutter-y-sm"
        role="region"
        aria-label="Base image missing"
      >
        <div class="row items-center no-wrap q-gutter-x-sm">
          <q-icon name="cloud_off" size="28px" color="warning" />
          <div class="text-h6">Base image missing</div>
        </div>
        <div class="rmm-muted">
          No ready {{ isWindows ? "Windows" : "Linux" }} image in the library.
          Download one now; the server fetches and verifies it.
        </div>
        <q-select
          v-if="downloads.length"
          v-model="mirror"
          dense
          outlined
          emit-value
          map-options
          label="Mirror"
          :options="mirrorOptions"
        />
        <template v-else>
          <q-input
            v-model="customUrl"
            dense
            outlined
            label="Image URL (https)"
            :error="!!customUrl && !urlOk"
            error-message="Enter an https:// URL"
          />
          <q-input
            v-model="customSha"
            dense
            outlined
            label="SHA-256 (optional)"
            :error="!!customSha && !shaOk"
            error-message="64 hex characters"
          />
        </template>
        <div class="row items-center q-gutter-sm">
          <q-btn
            unelevated
            no-caps
            color="primary"
            icon="download"
            label="Download base image now"
            :loading="starting"
            :disable="!canStart"
            @click="startDownload"
          />
          <span class="text-caption rmm-muted"
            >or upload one on the Images page</span
          >
        </div>
      </q-card>

      <q-card
        v-if="shown"
        flat
        bordered
        class="q-pa-md column q-gutter-y-sm"
        role="region"
        aria-label="Base image download"
      >
        <template v-if="shown.status === 'error'">
          <div class="text-negative" role="alert">
            {{ shown.error || "The download failed." }}
          </div>
          <div>
            <q-btn
              unelevated
              no-caps
              color="primary"
              icon="refresh"
              label="Retry"
              @click="dl.retry(shown.id)"
            />
          </div>
        </template>
        <template v-else>
          <div class="text-caption rmm-muted">{{ shown.filename }}</div>
          <div class="text-h3">{{ Math.round(dl.percent(shown)) }}%</div>
          <q-linear-progress
            rounded
            size="12px"
            color="primary"
            animation-speed="900"
            :value="dl.percent(shown) / 100"
            :indeterminate="shown.status === 'verifying'"
            aria-label="Base image download progress"
          />
          <div class="row q-gutter-x-md text-caption rmm-muted">
            <span
              >{{ fmtBytes(shown.downloadedBytes) }} /
              {{ fmtBytes(shown.totalBytes) }}</span
            >
            <span>{{ fmtRate(shown.speedBytesPerSec) }}</span>
            <span v-if="shown.etaSeconds != null"
              >ETA {{ fmtEta(shown.etaSeconds) }}</span
            >
          </div>
          <div aria-live="polite">
            {{
              shown.status === "verifying"
                ? "SHA-256 integrity check…"
                : "Downloading…"
            }}
          </div>
          <q-toggle
            v-model="autoQueue"
            label="Build the ISO automatically when the download finishes"
          />
          <div>
            <q-btn
              flat
              no-caps
              color="negative"
              icon="close"
              label="Cancel"
              @click="dl.cancel(shown.id)"
            />
          </div>
        </template>
      </q-card>
      <div
        v-if="selected"
        class="deploy-badges"
        aria-label="Base image details"
      >
        <q-chip dense square :label="selected.os || 'unknown'" />
        <q-chip v-if="selected.label" dense square :label="selected.label" />
        <q-chip dense square :label="fmtBytes(selected.size)" />
        <q-chip v-if="selected.bios" dense square label="BIOS" />
        <q-chip v-if="selected.efi" dense square label="UEFI" />
      </div>

      <div v-if="planError" class="text-negative" role="alert">
        {{ planError }}
      </div>
      <div v-else-if="plan" class="deploy-detail">
        <div>
          Volume label
          <code>{{ plan.label || "kept from the base image" }}</code>
          · {{ plan.agent ? `agent ${plan.agent}` : "no agent build" }}
          <template v-if="plan.size_hint">
            · about {{ fmtBytes(plan.size_hint) }}
          </template>
        </div>
        <pre v-if="plan.files.length" class="deploy-command q-mt-sm">{{
          plan.files.join("\n")
        }}</pre>
        <q-banner
          v-for="n in plan.notes"
          :key="n"
          class="bg-info q-mt-sm"
          role="status"
          rounded
          dense
        >
          <template #avatar><q-icon name="info" /></template>
          {{ n }}
        </q-banner>
      </div>

      <q-banner v-if="failure" class="bg-negative" role="alert" rounded dense>
        <template #avatar><q-icon name="error_outline" /></template>
        {{ failure }}
        <template #action>
          <q-btn
            flat
            no-caps
            label="Retry"
            :disable="!baseId || !!busy"
            @click="build"
          />
        </template>
      </q-banner>

      <div class="row items-center q-gutter-sm">
        <q-btn
          unelevated
          no-caps
          color="primary"
          icon="album"
          :label="waiting ? 'Waiting for download…' : 'Build ISO'"
          :loading="busy === 'build'"
          :disable="!baseId || !!busy || building"
          @click="build"
        >
          <q-tooltip v-if="waiting"
            >The button unlocks when the base image is ready.</q-tooltip
          >
        </q-btn>
      </div>

      <div v-if="status && status.state !== 'error'" style="max-width: 420px">
        <q-linear-progress
          rounded
          size="6px"
          color="primary"
          :value="status.state === 'done' ? 1 : status.pct / 100"
          :indeterminate="status.state === 'queued'"
          aria-label="ISO build progress"
        />
        <div class="text-caption rmm-muted q-mt-xs" aria-live="polite">
          <template v-if="status.state === 'done'">Build finished.</template>
          <template v-else
            >{{ Math.round(status.pct) }}% · {{ status.text }}</template
          >
        </div>
      </div>

      <div v-if="status?.state === 'done'" class="deploy-detail">
        <div class="text-weight-medium">{{ status.name }}</div>
        <div class="deploy-field__note">
          {{ fmtBytes(status.size) }}
          <template v-if="status.label"> · label {{ status.label }}</template>
        </div>
        <div v-if="status.sha256" class="deploy-line q-mt-xs">
          <span class="deploy-field__note">SHA-256</span>
          <code class="deploy-line__code">{{ status.sha256 }}</code>
          <q-btn
            flat
            dense
            no-caps
            icon="content_copy"
            label="Copy"
            aria-label="Copy the SHA-256 of the ISO"
            @click="copyOutput(status.sha256)"
          />
        </div>
        <q-banner
          v-for="n in status.notes"
          :key="n"
          class="bg-info q-mt-sm"
          role="status"
          rounded
          dense
        >
          <template #avatar><q-icon name="info" /></template>
          {{ n }}
        </q-banner>
        <div class="row items-center q-gutter-sm q-mt-xs">
          <q-btn
            unelevated
            no-caps
            color="primary"
            icon="download"
            label="Download ISO"
            :loading="busy === 'download'"
            :disable="!!busy || !status.iso"
            @click="download"
          />
          <q-btn
            flat
            no-caps
            icon="delete_outline"
            label="Discard"
            :loading="busy === 'discard'"
            :disable="!!busy"
            @click="discard"
          />
        </div>
      </div>
    </div>

    <q-dialog v-model="libraryOpen" aria-labelledby="iso-lib-title">
      <IsoLibrary @changed="dl.refresh" />
    </q-dialog>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { openURL, useQuasar } from "quasar";
import { ensureConsoleStepUp } from "@/composables/accounts";
import IsoLibrary from "@/components/deploy/IsoLibrary.vue";
import HelpTip from "@/components/ui/HelpTip.vue";
import RmmSelect from "@/components/ui/RmmSelect.vue";
import { fmtEta, fmtRate, useIsoDownloads } from "@/stores/isoDownloads";
import { fmtBytes } from "@/utils/format";
import { copyOutput, isWebUrl } from "@/utils/helpers";
import { notifySuccess } from "@/utils/notify";
import { failureText, retryAfterStepUp } from "@/utils/deploy";
import {
  buildIso,
  discardIsoJob,
  fetchIsoJob,
  isoDownloadLink,
  isoFitsFamily,
  planIso,
  type BaseIso,
  type IsoJob,
  type IsoPlan,
  type RenderRequest,
  type Target,
} from "@/api/deploy";

const props = defineProps<{ request: RenderRequest; target: Target }>();

const $q = useQuasar();

const dl = useIsoDownloads();
const library = computed(() => dl.library);
const libraryOpen = ref(false);
const baseId = ref<number | null>(null);

const plan = ref<IsoPlan | null>(null);
const planError = ref("");

const job = ref("");
const status = ref<IsoJob | null>(null);
const failure = ref("");
const busy = ref<"" | "build" | "download" | "discard">("");
let timer: ReturnType<typeof setTimeout> | undefined;
let gone = false;
let planSeq = 0;

// Windows media for Windows targets, anything else for Linux targets; built
// images are never a base
const candidates = computed(() =>
  library.value.filter(
    (i) =>
      i.status === "ready" &&
      i.kind === "base" &&
      isoFitsFamily(i.os, props.target.family),
  ),
);
const isWindows = computed(() => props.target.family === "windows");
const downloads = computed(() => props.target.downloads ?? []);
const mirror = ref("");
const customUrl = ref("");
const customSha = ref("");
const starting = ref(false);
const autoQueue = ref(false);
const mirrorOptions = computed(() =>
  downloads.value.map((d) => ({
    label: d.size ? `${d.label} · ${d.size}` : d.label,
    value: d.url,
  })),
);
const urlOk = computed(() => /^https:\/\/\S+$/i.test(customUrl.value.trim()));
const shaOk = computed(() => /^[0-9a-f]{64}$/i.test(customSha.value.trim()));
const canStart = computed(() =>
  downloads.value.length
    ? !!mirror.value
    : urlOk.value && (!customSha.value || shaOk.value),
);
// downloads of this target's mirrors, or started elsewhere for the same family
const watchedUrls = computed(() => [
  ...downloads.value.map((d) => d.url),
  ...library.value
    .filter(
      (i) =>
        i.kind === "base" &&
        sameOs(i) &&
        ["downloading", "verifying"].includes(i.status),
    )
    .map((i) => i.source_url),
]);
// a row has no os before inspection, so match the target it was started for
const sameOs = (i: BaseIso) =>
  (i.os && isoFitsFamily(i.os, props.target.family)) ||
  i.target === props.target.id ||
  i.target.startsWith(props.target.group + "-") ||
  downloads.value.some((d) => d.url === i.source_url);
const active = computed(() => dl.activeFor(watchedUrls.value));
const failedRow = computed(() =>
  library.value.find(
    (i) => i.kind === "base" && i.status === "error" && sameOs(i),
  ),
);
const shown = computed(
  () =>
    active.value ??
    (failedRow.value
      ? {
          ...(dl.progress[failedRow.value.id] ?? failedRow.value.progress),
          id: failedRow.value.id,
          status: "error" as const,
          error: failedRow.value.error,
        }
      : undefined),
);
const waiting = computed(() => !!active.value && !candidates.value.length);

async function startDownload() {
  starting.value = true;
  try {
    if (downloads.value.length) {
      const d = downloads.value.find((x) => x.url === mirror.value);
      await dl.start(mirror.value, {
        sha256_url: d?.sha256_url,
        target: props.target.id,
      });
    } else {
      await dl.start(customUrl.value.trim(), {
        sha256: customSha.value.trim() || undefined,
        target: props.target.id,
      });
    }
  } catch (e) {
    failure.value = await failureText(e);
  }
  starting.value = false;
}

const options = computed(() =>
  candidates.value.map((i) => ({
    label: `${i.name} (${i.os || "unknown"}, ${fmtBytes(i.size)})`,
    value: i.id,
  })),
);
const selected = computed(
  () => candidates.value.find((i) => i.id === baseId.value) ?? null,
);
const building = computed(
  () => status.value?.state === "queued" || status.value?.state === "running",
);

async function loadPlan() {
  const seq = ++planSeq;
  plan.value = null;
  planError.value = "";
  if (baseId.value === null) return;
  try {
    const next = await planIso({
      ...props.request,
      mode: "full",
      base: baseId.value,
    });
    if (seq === planSeq) plan.value = next;
  } catch (e) {
    if (seq === planSeq) planError.value = await failureText(e);
  }
}

function reset() {
  clearTimeout(timer);
  job.value = "";
  status.value = null;
  failure.value = "";
}

async function poll(id: string) {
  clearTimeout(timer);
  try {
    const next = await fetchIsoJob(id);
    if (job.value !== id) return;
    status.value = next;
    if (next.state === "error")
      failure.value = next.error || "The build failed.";
    else if (next.state !== "done" && !gone)
      timer = setTimeout(() => poll(id), 1500);
  } catch (e) {
    if (job.value === id) failure.value = await failureText(e);
  }
}

async function build() {
  const base = baseId.value;
  if (base === null) return;
  reset();
  busy.value = "build";
  try {
    const started = await retryAfterStepUp(
      () => buildIso({ ...props.request, base }),
      () => ensureConsoleStepUp($q),
    );
    job.value = started.job;
    poll(started.job);
  } catch (e) {
    failure.value = await failureText(e);
  }
  busy.value = "";
}

// the browser fetches the file itself, so a large image never sits in memory
async function download() {
  const iso = status.value?.iso;
  if (!iso) return;
  busy.value = "download";
  failure.value = "";
  try {
    const { url } = await retryAfterStepUp(
      () => isoDownloadLink(iso),
      () => ensureConsoleStepUp($q),
    );
    if (!isWebUrl(url)) throw new Error("not a download link");
    openURL(url);
    notifySuccess("Download started");
  } catch (e) {
    failure.value = await failureText(e);
  }
  busy.value = "";
}

// removes the image from the library and the server as well
function discard() {
  $q.dialog({
    title: "Discard the ISO?",
    message: "The image is removed from the library and from the server.",
    cancel: true,
    ok: { color: "negative", label: "Discard" },
  }).onOk(async () => {
    busy.value = "discard";
    try {
      await discardIsoJob(job.value);
      reset();
      notifySuccess("ISO discarded");
    } catch (e) {
      failure.value = await failureText(e);
    }
    busy.value = "";
  });
}

watch(() => [baseId.value, props.target.id], loadPlan);
watch(() => props.target.id, reset);
watch(
  downloads,
  (d) => {
    if (!d.some((x) => x.url === mirror.value)) mirror.value = d[0]?.url ?? "";
  },
  { immediate: true },
);
// unlock the build without a reload; optionally start it once
watch(
  candidates,
  (now, before) => {
    if (!selected.value) baseId.value = now[0]?.id ?? null;
    if (
      autoQueue.value &&
      now.length > (before?.length ?? 0) &&
      !building.value
    ) {
      autoQueue.value = false;
      build();
    }
  },
  { immediate: true },
);
onMounted(dl.refresh);
onBeforeUnmount(() => {
  gone = true;
  clearTimeout(timer);
});
onBeforeUnmount(dl.stop);
</script>
