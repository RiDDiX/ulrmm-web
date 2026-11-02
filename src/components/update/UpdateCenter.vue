<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <div class="uc-grid">
    <q-card flat class="rmm-card uc-version">
      <div class="rmm-card__header">
        <div class="rmm-card__title">Server version</div>
        <q-space />
        <q-btn
          flat
          dense
          no-caps
          icon="refresh"
          label="Check again"
          :loading="refreshing"
          :disable="running"
          @click="load(true)"
        />
      </div>
      <div class="rmm-card__body">
        <div v-if="loading" aria-busy="true">
          <q-skeleton height="48px" class="q-mb-md" />
          <q-skeleton height="160px" />
        </div>
        <template v-else-if="info">
          <div class="uc-versions">
            <div>
              <div class="rmm-label">Installed</div>
              <div class="uc-version-no">{{ info.current_version }}</div>
            </div>
            <q-icon name="arrow_forward" size="sm" class="rmm-muted" />
            <div>
              <div class="rmm-label">Available</div>
              <div class="uc-version-no">{{ nextVersion || "–" }}</div>
            </div>
            <span v-if="upToDate" class="rmm-pill rmm-pill--positive"
              >Up to date</span
            >
          </div>

          <q-banner
            v-if="!info.runner_installed"
            dense
            rounded
            class="rmm-banner-warning q-mt-md"
          >
            <template #avatar><q-icon name="warning" /></template>
            The update runner is not installed on this server yet. Run update.sh
            once on the server; after that, updates can be started from here.
          </q-banner>
          <q-banner
            v-else-if="info.busy && !running"
            dense
            rounded
            class="rmm-banner-warning q-mt-md"
          >
            <template #avatar><q-icon name="hourglass_top" /></template>
            Another server task ({{ info.busy }}) is running.
          </q-banner>

          <div class="text-subtitle2 q-mt-md q-mb-xs">What changes</div>
          <q-tabs
            v-model="tab"
            dense
            no-caps
            align="left"
            active-color="primary"
            indicator-color="primary"
          >
            <q-tab name="server" label="Server" />
            <q-tab name="web" label="Web interface" />
          </q-tabs>
          <q-separator />
          <q-scroll-area class="uc-changelog">
            <div v-if="currentPending.error" class="q-pa-md rmm-muted">
              Changelog not available: {{ currentPending.error }}
            </div>
            <div
              v-else-if="!currentPending.releases?.length"
              class="q-pa-md rmm-muted"
            >
              No new entries.
            </div>
            <div
              v-for="r in currentPending.releases || []"
              :key="r.version"
              class="q-px-sm q-py-sm"
            >
              <div class="text-weight-medium">
                {{ r.version }}
                <span v-if="r.date" class="text-caption q-ml-sm">{{
                  r.date
                }}</span>
              </div>
              <ul class="q-my-xs">
                <li v-for="(item, i) in r.items" :key="i">{{ item }}</li>
              </ul>
            </div>
          </q-scroll-area>
          <p class="text-caption rmm-muted q-mt-sm q-mb-md">
            The signed release is downloaded and verified first, then a backup
            is taken. The dashboard is unavailable for a few minutes while the
            services restart.
          </p>

          <div class="row items-center q-gutter-sm">
            <q-btn
              unelevated
              no-caps
              color="primary"
              icon="system_update_alt"
              :label="
                nextVersion ? `Install v${nextVersion}` : 'Install latest'
              "
              :disable="!canStart || olderThanInstalled"
              :loading="starting === 'release'"
              @click="
                start({ mode: 'release', version: releaseVersion || null })
              "
            />
          </div>
          <q-expansion-item
            dense
            switch-toggle-side
            label="Advanced"
            class="q-mt-sm"
          >
            <div class="q-pa-sm">
              <p class="text-caption rmm-muted q-mb-sm">
                Pull the current branch from git instead of a signed release. No
                signature or checksum is checked on this path.
              </p>
              <q-btn
                outline
                no-caps
                color="primary"
                icon="code"
                label="Update from git"
                :disable="!canStart"
                :loading="starting === 'git'"
                @click="start({ mode: 'git' })"
              />
            </div>
          </q-expansion-item>
        </template>
        <div v-else class="rmm-muted">
          The update status could not be loaded.
        </div>
      </div>
    </q-card>

    <UpdateSources ref="sources" class="uc-sources" />

    <div class="uc-progress">
      <q-banner
        v-if="outcome === 'done'"
        dense
        rounded
        class="uc-banner-ok q-mb-md"
        role="status"
      >
        <template #avatar><q-icon name="check_circle" /></template>
        The update finished{{ target ? ` and v${target} is running` : "" }}.
        Reload to use the new version.
        <template #action>
          <q-btn flat no-caps label="Reload" @click="reloadPage" />
        </template>
      </q-banner>
      <q-banner
        v-else-if="outcome === 'signedout'"
        dense
        rounded
        class="uc-banner-ok q-mb-md"
        role="status"
      >
        <template #avatar><q-icon name="login" /></template>
        The update finished and signed everyone out. Sign in again to use the
        new version.
        <template #action>
          <q-btn flat no-caps label="Sign in again" @click="reloadPage" />
        </template>
      </q-banner>
      <q-banner
        v-else-if="outcome === 'failed'"
        dense
        rounded
        class="bg-negative q-mb-md"
        role="alert"
      >
        <template #avatar><q-icon name="error" /></template>
        The update stopped with an error. The log shows where.
      </q-banner>
      <q-banner
        v-else-if="outcome === 'stalled'"
        dense
        rounded
        class="bg-negative q-mb-md"
        role="alert"
      >
        <template #avatar><q-icon name="error" /></template>
        The server has not answered for
        {{ Math.round(HEALTH_GIVEUP_MS / 60000) }}
        minutes. Check the service on the server, or keep waiting.
        <template #action>
          <q-btn flat no-caps label="Keep waiting" @click="keepWaiting" />
        </template>
      </q-banner>
      <UpdateStepper
        :phase="phase"
        :last-step="lastStep"
        :progress="progress"
        :waiting="waiting"
        :active="running"
        :log="log"
      />
    </div>

    <AgentFleetCard class="uc-fleet" />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useQuasar } from "quasar";
import type { AxiosRequestConfig } from "axios";
import AgentFleetCard from "./AgentFleetCard.vue";
import UpdateSources from "./UpdateSources.vue";
import UpdateStepper from "./UpdateStepper.vue";
import { withStepUp } from "@/components/vault/stepUp";
import { isNewer } from "@/utils/helpers";
import { notifyError } from "@/utils/notify";
import {
  fetchHealth,
  fetchServerUpdate,
  fetchTaskLog,
  fetchUpdateProgress,
  startServerUpdate,
  type ServerUpdateInfo,
  type UpdateMode,
  type UpdatePhase,
  type UpdateProgress,
} from "@/api/server";

type RequestConfig = AxiosRequestConfig & { silent?: boolean };

const PROGRESS_MS = 1500;
const HEALTH_MS = 2000;
const HEALTH_SLOW_MS = 5000;
const HEALTH_SLOW_AFTER = 10;
const HEALTH_GIVEUP_MS = 15 * 60 * 1000;
const STEPS: UpdatePhase[] = [
  "preflight",
  "download",
  "verify",
  "backup",
  "apply",
  "migrate",
  "restart",
  "health",
];

const $q = useQuasar();

const loading = ref(true);
const refreshing = ref(false);
const starting = ref<"release" | "git" | null>(null);
const info = ref<ServerUpdateInfo | null>(null);
const tab = ref<"server" | "web">("server");
const sources = ref<InstanceType<typeof UpdateSources> | null>(null);

type Outcome =
  | "running"
  | "reconnect"
  | "done"
  | "failed"
  | "signedout"
  | "stalled";
const outcome = ref<Outcome | null>(null);
const phase = ref<UpdatePhase | null>(null);
const lastStep = ref<UpdatePhase | null>(null);
const progress = ref<UpdateProgress | null>(null);
const target = ref<string | null>(null);
const waiting = ref<number | null>(null);
const log = ref("");
let offset = 0;
let healthMisses = 0;
let lastSeen = 0;
let release = false;
let timer: ReturnType<typeof setTimeout> | null = null;
let stopped = false;

const currentPending = computed(() => info.value?.pending?.[tab.value] || {});
// the newest signed release over all sources (an added alpha repository
// included) decides; the git changelog only fills in while they load
const releaseVersion = computed(() => sources.value?.data?.latest || "");
const nextVersion = computed(
  () =>
    releaseVersion.value ||
    info.value?.pending?.server?.next ||
    info.value?.latest_version ||
    "",
);
const upToDate = computed(
  () =>
    !!nextVersion.value &&
    !isNewer(nextVersion.value, info.value?.current_version || ""),
);
// an installed alpha is newer than the public release: no downgrade button
const olderThanInstalled = computed(
  () =>
    !!nextVersion.value &&
    isNewer(info.value?.current_version || "", nextVersion.value),
);
const running = computed(
  () => outcome.value === "running" || outcome.value === "reconnect",
);
const canStart = computed(
  () => !!info.value?.runner_installed && !info.value?.busy && !running.value,
);

async function load(refresh = false) {
  refreshing.value = refresh;
  try {
    info.value = await fetchServerUpdate(refresh);
    if (refresh) sources.value?.load(true);
    // an update started elsewhere (another tab, the shell) is shown live
    if (info.value.state.state === "running" && !running.value) follow(null);
  } catch {
    notifyError("The update status could not be loaded.");
  } finally {
    loading.value = false;
    refreshing.value = false;
  }
}

async function start(body: UpdateMode) {
  starting.value = body.mode;
  const ok = await withStepUp($q, (config: RequestConfig) =>
    startServerUpdate(body, config),
  );
  starting.value = null;
  if (ok === null) return;
  follow(body.mode === "release" ? body.version : null, body.mode);
}

function follow(version: string | null, mode: UpdateMode["mode"] = "git") {
  target.value = version;
  release = mode === "release";
  lastSeen = Date.now();
  outcome.value = "running";
  phase.value = null;
  lastStep.value = null;
  progress.value = null;
  waiting.value = null;
  log.value = "";
  offset = 0;
  schedule(tick, 0);
}

function schedule(fn: () => void, ms: number) {
  if (timer) clearTimeout(timer);
  timer = stopped ? null : setTimeout(fn, ms);
}

function applyProgress(p: UpdateProgress) {
  progress.value = p;
  if (p.phase) phase.value = p.phase;
  if (p.phase && STEPS.includes(p.phase)) lastStep.value = p.phase;
  if (p.version && !target.value) target.value = p.version;
}

function status(e: unknown) {
  return (e as { response?: { status?: number } })?.response?.status;
}

// no response at all: the API is down for the restart
const isNetwork = (e: unknown) => !(e as { response?: unknown })?.response;

function finishBy(state: string) {
  if (state === "done") {
    phase.value = "done";
    outcome.value = "done";
  } else {
    if (phase.value !== "rollback") phase.value = "failed";
    outcome.value = "failed";
  }
}

async function tick() {
  timer = null;
  const [prog, tail] = await Promise.allSettled([
    fetchUpdateProgress(),
    fetchTaskLog("update", offset),
  ]);
  if (stopped) return;

  if (tail.status === "fulfilled") {
    lastSeen = Date.now();
    if (tail.value.offset < offset) log.value = "";
    log.value += tail.value.text;
    offset = tail.value.offset;
  }

  if (prog.status === "fulfilled") {
    lastSeen = Date.now();
    applyProgress(prog.value);
    const st = prog.value.state?.state;
    if (["done", "failed", "interrupted"].includes(st)) {
      finishBy(st);
      return;
    }
    if (prog.value.phase === "restart") return reconnect();
    return schedule(tick, PROGRESS_MS);
  }

  if (status(prog.reason) === 401) {
    outcome.value = "signedout";
    return;
  }
  const past = lastStep.value ? STEPS.indexOf(lastStep.value) : -1;
  if (isNetwork(prog.reason) && past >= STEPS.indexOf("apply")) {
    return reconnect();
  }
  if (Date.now() - lastSeen >= HEALTH_GIVEUP_MS) {
    outcome.value = "stalled";
    return;
  }
  schedule(tick, isNetwork(prog.reason) ? HEALTH_SLOW_MS : PROGRESS_MS);
}

function reconnect() {
  if (outcome.value !== "reconnect") {
    outcome.value = "reconnect";
    waiting.value = 0;
    healthMisses = 0;
    if (lastStep.value !== "restart") {
      lastStep.value = "restart";
      phase.value = "restart";
    }
  }
  schedule(
    healthTick,
    healthMisses >= HEALTH_SLOW_AFTER ? HEALTH_SLOW_MS : HEALTH_MS,
  );
}

async function healthTick() {
  timer = null;
  const ms = healthMisses >= HEALTH_SLOW_AFTER ? HEALTH_SLOW_MS : HEALTH_MS;
  waiting.value = (waiting.value ?? 0) + Math.round(ms / 1000);
  // only a 2xx health answer counts: nginx answers 502/503 while daphne
  // starts, and health itself is 503 while degraded
  let version = "";
  try {
    const h = await fetchHealth();
    if (!h || typeof h !== "object") throw new Error("empty health");
    version = h.version || "";
  } catch {
    if (stopped) return;
    return notBack();
  }
  if (stopped) return;
  lastSeen = Date.now();

  // the API answers again: the run may still be going (health phase, rollback)
  let p: UpdateProgress;
  try {
    p = await fetchUpdateProgress();
  } catch (e) {
    if (stopped) return;
    if (status(e) === 401) {
      outcome.value = "signedout";
      return;
    }
    return notBack();
  }
  if (stopped) return;
  applyProgress(p);
  const st = p.state?.state;
  if (st === "failed" || st === "interrupted") return finishBy(st);
  const landed =
    release && !!target.value && version === target.value && st !== "running";
  if (st === "done" || landed) return finishBy("done");
  outcome.value = "running";
  waiting.value = null;
  return schedule(tick, PROGRESS_MS);
}

function notBack() {
  healthMisses++;
  if (Date.now() - lastSeen >= HEALTH_GIVEUP_MS) {
    outcome.value = "stalled";
    return;
  }
  reconnect();
}

function keepWaiting() {
  outcome.value = "reconnect";
  lastSeen = Date.now();
  schedule(healthTick, HEALTH_MS);
}

function reloadPage() {
  window.location.reload();
}

onMounted(() => load());
onBeforeUnmount(() => {
  stopped = true;
  if (timer) clearTimeout(timer);
  timer = null;
});
</script>

<style scoped>
.uc-grid {
  display: grid;
  grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
  grid-template-areas:
    "version sources"
    "progress progress"
    "fleet fleet";
  gap: 16px;
}
.uc-version {
  grid-area: version;
}
.uc-sources {
  grid-area: sources;
}
.uc-progress {
  grid-area: progress;
}
.uc-fleet {
  grid-area: fleet;
}
.uc-versions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 16px;
}
.uc-version-no {
  font-family: var(--rmm-mono);
  font-size: var(--rmm-fs-lg);
}
.uc-banner-ok {
  color: var(--rmm-status-positive);
  background: color-mix(in srgb, var(--q-positive) 8%, var(--rmm-surface));
}
.uc-changelog {
  height: 220px;
}
@media (max-width: 1023px) {
  .uc-grid {
    grid-template-columns: minmax(0, 1fr);
    grid-template-areas:
      "version"
      "sources"
      "progress"
      "fleet";
  }
}
</style>
