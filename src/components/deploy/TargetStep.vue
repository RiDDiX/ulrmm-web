<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <div class="deploy-step">
    <h2 id="deploy-step-2" tabindex="-1" class="deploy-step__title">Target</h2>
    <p class="deploy-step__lead">
      An agent installer for devices that already run, or an OS image answer
      file that installs the agent on first boot, before anyone signs in.
      <span v-if="matrix?.agent_version"
        >Agent {{ matrix.agent_version }}.</span
      >
    </p>

    <div v-if="loading" class="deploy-cards" aria-busy="true">
      <q-skeleton v-for="n in 6" :key="n" height="64px" />
    </div>

    <NoDataPanel
      v-else-if="error || !matrix"
      :error="error || 'The build matrix could not be loaded.'"
      icon="error_outline"
      title=""
      text=""
      @retry="$emit('retry')"
    />

    <template v-else>
      <q-banner
        v-if="!matrix.dist_ok"
        class="bg-warning q-mb-md"
        role="status"
        rounded
        dense
      >
        <template #avatar><q-icon name="warning" /></template>
        The agent build does not carry the current enrollment key yet. Run
        update.sh on the server; until then installers and links answer with an
        error.
      </q-banner>

      <fieldset class="deploy-choices">
        <legend class="deploy-legend">Agent installer</legend>
        <div class="deploy-cards">
          <label
            v-for="i in matrix.installers"
            :key="i.fmt"
            class="deploy-option"
          >
            <input
              v-model="t.choice"
              :value="`inst:${i.fmt}`"
              type="radio"
              name="deploy-target"
              class="sr-only"
              @change="pickInstaller(i)"
            />
            <q-icon
              :name="platformMeta(i.plat).icon"
              size="24px"
              aria-hidden="true"
            />
            <span class="deploy-option__text">
              <span class="deploy-option__title">{{ i.label }}</span>
              <span class="deploy-option__meta">
                {{ platformMeta(i.plat).label }} · .{{ i.fmt }}
              </span>
            </span>
            <q-icon
              :name="mark(`inst:${i.fmt}`)"
              class="deploy-option__mark"
              size="20px"
              aria-hidden="true"
            />
          </label>
        </div>
      </fieldset>

      <fieldset class="deploy-choices">
        <legend class="deploy-legend">OS image</legend>
        <div class="deploy-cards">
          <label v-for="g in groups" :key="g.group" class="deploy-option">
            <input
              v-model="t.choice"
              :value="`os:${g.group}`"
              type="radio"
              name="deploy-target"
              class="sr-only"
              @change="pickGroup(g)"
            />
            <q-icon
              :name="platformMeta(g.family).icon"
              size="24px"
              aria-hidden="true"
            />
            <span class="deploy-option__text">
              <span class="deploy-option__title">{{
                groupLabel(g.group)
              }}</span>
              <span class="deploy-option__meta">
                {{ g.targets.length }}
                {{ g.targets.length === 1 ? "edition" : "editions" }}
              </span>
              <span class="deploy-iso">
                <span class="deploy-iso__row">
                  <span class="rmm-pill" :class="badge(g).cls">{{
                    badge(g).label
                  }}</span>
                  <q-btn
                    v-if="info(g).active"
                    flat
                    dense
                    round
                    size="xs"
                    icon="close"
                    aria-label="Cancel download"
                    @click.stop.prevent="cancelActive(g)"
                  />
                  <q-btn
                    v-else-if="needsFile(g) && info(g).downloads.length === 1"
                    flat
                    dense
                    no-caps
                    size="sm"
                    color="primary"
                    :label="info(g).state === 'error' ? 'Retry' : 'Download'"
                    @click.stop.prevent="download(g, info(g).downloads[0]!)"
                  />
                  <q-btn-dropdown
                    v-else-if="needsFile(g) && info(g).downloads.length > 1"
                    flat
                    dense
                    no-caps
                    size="sm"
                    color="primary"
                    :label="info(g).state === 'error' ? 'Retry' : 'Download'"
                    @click.stop
                  >
                    <q-list dense>
                      <q-item
                        v-for="d in info(g).downloads"
                        :key="d.url"
                        v-close-popup
                        clickable
                        @click.stop.prevent="download(g, d)"
                      >
                        <q-item-section>{{
                          d.size ? `${d.label} · ${d.size}` : d.label
                        }}</q-item-section>
                      </q-item>
                    </q-list>
                  </q-btn-dropdown>
                  <q-btn
                    v-else-if="needsFile(g)"
                    flat
                    dense
                    no-caps
                    size="sm"
                    color="primary"
                    label="Add ISO URL"
                    @click.stop.prevent="openAdd(g)"
                  />
                </span>
                <template v-if="info(g).active">
                  <q-linear-progress
                    :value="dl.percent(info(g).active) / 100"
                    :indeterminate="info(g).state === 'verifying'"
                    size="6px"
                    rounded
                    class="q-mt-xs"
                  />
                  <span class="deploy-option__meta">
                    {{ fmtBytes(info(g).active!.downloadedBytes) }} /
                    {{ fmtBytes(info(g).active!.totalBytes) }} ·
                    {{ fmtRate(info(g).active!.speedBytesPerSec) }} ·
                    {{ fmtEta(info(g).active!.etaSeconds) }}
                  </span>
                </template>
              </span>
            </span>
            <q-icon
              :name="mark(`os:${g.group}`)"
              class="deploy-option__mark"
              size="20px"
              aria-hidden="true"
            />
          </label>
        </div>
      </fieldset>

      <section v-if="installer" class="deploy-detail" aria-live="polite">
        <fieldset class="deploy-choices">
          <legend class="deploy-legend">Architecture</legend>
          <div class="deploy-chips">
            <label v-for="a in archOptions" :key="a.value" class="deploy-chip">
              <input
                v-model="t.arch"
                :value="a.value"
                type="radio"
                name="deploy-arch"
                class="sr-only"
              />
              <span>{{ a.label }}</span>
            </label>
          </div>
        </fieldset>
        <ul v-if="installerNotes.length" class="deploy-notes">
          <li v-for="n in installerNotes" :key="n">{{ n }}</li>
        </ul>
      </section>

      <section v-else-if="group" class="deploy-detail" aria-live="polite">
        <fieldset class="deploy-choices">
          <legend class="deploy-legend">Edition</legend>
          <div class="deploy-chips">
            <label v-for="x in group.targets" :key="x.id" class="deploy-chip">
              <input
                v-model="t.target"
                :value="x.id"
                type="radio"
                name="deploy-edition"
                class="sr-only"
              />
              <span>{{ editionLabel(x) }}</span>
              <span
                v-if="releaseBadge(x)"
                :class="['rmm-pill', `rmm-pill--${releaseBadge(x)?.tone}`]"
                >{{ releaseBadge(x)?.text }}</span
              >
            </label>
          </div>
        </fieldset>

        <template v-if="target">
          <div
            v-if="capabilities.length"
            class="deploy-badges"
            role="list"
            aria-label="Edition capabilities"
          >
            <span
              v-for="c in capabilities"
              :key="c.key"
              role="listitem"
              :class="[
                'rmm-pill',
                c.on ? 'rmm-pill--positive' : 'rmm-pill--neutral',
              ]"
            >
              <q-icon
                :name="c.on ? 'check' : 'block'"
                size="14px"
                aria-hidden="true"
              />
              {{ c.label }}
              <span class="sr-only">{{
                c.on ? "supported" : "not supported"
              }}</span>
            </span>
          </div>
          <div v-if="target.formats?.length" class="rmm-muted q-mt-sm">
            Output:
            <span class="rmm-mono">{{ target.formats.join(", ") }}</span>
          </div>
          <ul v-if="target.notes?.length" class="deploy-notes">
            <li v-for="n in target.notes" :key="n">{{ n }}</li>
          </ul>
        </template>
      </section>
    </template>

    <q-dialog v-model="addOpen">
      <q-card style="min-width: 320px; max-width: 480px; width: 100%">
        <DialogHeader
          title="Add ISO URL"
          subtitle="Evaluation or corporate mirror link, or import a local file on the Images page"
        />
        <q-card-section class="q-gutter-y-sm">
          <q-input
            v-model="addUrl"
            dense
            outlined
            autofocus
            label="https URL"
            :rules="[
              (v: string) => /^https:\/\/\S+$/i.test(v) || 'Enter an https URL',
            ]"
          />
          <q-input
            v-model="addSha"
            dense
            outlined
            label="SHA-256 (optional)"
            :rules="[
              (v: string) =>
                !v || /^[0-9a-f]{64}$/i.test(v) || '64 hex characters',
            ]"
          />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn v-close-popup flat no-caps label="Cancel" />
          <q-btn
            unelevated
            no-caps
            color="primary"
            label="Download"
            :disable="!addValid"
            :loading="addBusy"
            @click="submitAdd"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, toRef } from "vue";
import { fmtEta, fmtRate, useIsoDownloads } from "@/stores/isoDownloads";
import NoDataPanel from "@/core/ui/NoDataPanel.vue";
import { fmtBytes, platformMeta } from "@/utils/format";
import { notifyError } from "@/utils/notify";
import DialogHeader from "@/components/ui/DialogHeader.vue";
import {
  capabilityLabel,
  editionLabel,
  failureText,
  groupLabel,
  groupTargets,
  isRequirement,
  releaseBadge,
  type TargetGroup,
  type TargetState,
} from "@/utils/deploy";
import {
  type InstallerKind,
  type Matrix,
  type TargetDownload,
} from "@/api/deploy";

const props = defineProps<{
  state: TargetState;
  matrix: Matrix | null;
  loading: boolean;
  error: string;
}>();
defineEmits<{ (e: "retry"): void }>();

const t = toRef(props, "state");

const groups = computed(() => groupTargets(props.matrix?.targets ?? []));
const installer = computed(() =>
  props.matrix?.installers.find((i) => t.value.choice === `inst:${i.fmt}`),
);
const group = computed(() =>
  groups.value.find((g) => t.value.choice === `os:${g.group}`),
);
const target = computed(() =>
  group.value?.targets.find((x) => x.id === t.value.target),
);

const ARCH_LABELS: Record<string, string> = {
  amd64: "64 bit (amd64)",
  "386": "32 bit (386)",
  arm64: "ARM 64 bit (arm64)",
  arm: "ARM 32 bit (arm)",
};
// only the shell script can pick its architecture on the device
const archOptions = computed(() => [
  ...(installer.value?.fmt === "sh"
    ? [{ value: "", label: "Detect on the device (uname -m)" }]
    : []),
  ...(installer.value?.arches ?? []).map((a) => ({
    value: a,
    label: ARCH_LABELS[a] ?? a,
  })),
]);

const installerNotes = computed(() => {
  const notes: string[] = [];
  if (installer.value?.fmt === "exe" && !props.matrix?.win_signed)
    notes.push(
      "This server does not sign the setup exe, so Windows SmartScreen warns before it runs.",
    );
  return notes;
});

// requirements such as a disk device are not features to badge
const capabilities = computed(() =>
  Object.entries(target.value?.capabilities ?? {})
    .filter(([key]) => !isRequirement(key))
    .map(([key, value]) => ({
      key,
      label: capabilityLabel(key),
      on: value !== false && value != null,
    })),
);

const mark = (value: string) =>
  t.value.choice === value ? "radio_button_checked" : "radio_button_unchecked";

function pickInstaller(i: InstallerKind) {
  const choices = [...(i.fmt === "sh" ? [""] : []), ...i.arches];
  if (!choices.includes(t.value.arch)) t.value.arch = choices[0] ?? "";
}

const dl = useIsoDownloads();
onMounted(() => dl.refresh());
onBeforeUnmount(dl.stop);

function info(g: TargetGroup) {
  const seen = new Map<string, TargetDownload>();
  for (const x of g.targets)
    for (const d of x.downloads ?? []) seen.set(d.url, d);
  const downloads = [...seen.values()];
  const urls = downloads.map((d) => d.url);
  return {
    downloads,
    urls,
    state: dl.stateFor(urls, g.family),
    active: dl.activeFor(urls),
  };
}

const needsFile = (g: TargetGroup) => {
  const s = info(g).state;
  return s === "missing" || s === "error";
};

function badge(g: TargetGroup) {
  const { state, active } = info(g);
  // status pills keep 4.5:1 text in both themes, the grey badge did not
  if (state === "ready") return { cls: "rmm-pill--positive", label: "Cached" };
  if (state === "verifying")
    return { cls: "rmm-pill--info", label: "Verifying" };
  if (state === "downloading")
    return {
      cls: "rmm-pill--info",
      label: `Downloading ${Math.round(dl.percent(active))}%`,
    };
  if (state === "error") return { cls: "rmm-pill--negative", label: "Error" };
  return { cls: "rmm-pill--neutral", label: "Not downloaded" };
}

async function run(job: () => Promise<unknown>) {
  try {
    await job();
    return true;
  } catch (e) {
    notifyError(await failureText(e));
    return false;
  }
}

function download(g: TargetGroup, d: TargetDownload) {
  const failed = dl.rowFor(d.url)?.status === "error";
  const row = failed ? dl.rowFor(d.url) : undefined;
  return run(() =>
    row
      ? dl.retry(row.id)
      : dl.start(d.url, {
          sha256_url: d.sha256_url,
          target: g.targets[0]?.id,
        }),
  );
}

function cancelActive(g: TargetGroup) {
  const id = info(g).active?.id;
  if (id != null) run(() => dl.cancel(id));
}

const addOpen = ref(false);
const addBusy = ref(false);
const addUrl = ref("");
const addSha = ref("");
let addGroup: TargetGroup | null = null;
const addValid = computed(
  () =>
    /^https:\/\/\S+$/i.test(addUrl.value.trim()) &&
    (!addSha.value.trim() || /^[0-9a-f]{64}$/i.test(addSha.value.trim())),
);

function openAdd(g: TargetGroup) {
  addGroup = g;
  addUrl.value = "";
  addSha.value = "";
  addOpen.value = true;
}

async function submitAdd() {
  addBusy.value = true;
  const sha = addSha.value.trim().toLowerCase();
  const ok = await run(() =>
    dl.start(addUrl.value.trim(), {
      ...(sha ? { sha256: sha } : {}),
      target: addGroup?.targets[0]?.id,
    }),
  );
  addBusy.value = false;
  if (ok) addOpen.value = false;
}

function pickGroup(g: TargetGroup) {
  if (!g.targets.some((x) => x.id === t.value.target))
    t.value.target = g.targets[0]?.id ?? "";
}
</script>

<style scoped>
.deploy-iso {
  display: flex;
  flex-direction: column;
  margin-top: 4px;
}

.deploy-iso__row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.deploy-iso__row .rmm-pill {
  white-space: nowrap;
}
</style>
