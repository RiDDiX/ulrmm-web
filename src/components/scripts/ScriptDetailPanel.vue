<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <aside
    class="script-detail"
    :aria-labelledby="`script-detail-title-${script.id}`"
    :data-script-id="script.id"
  >
    <div class="script-detail__head">
      <div class="script-detail__identity">
        <h2
          :id="`script-detail-title-${script.id}`"
          class="script-detail__title"
        >
          {{ script.name }}
        </h2>
        <div class="script-detail__tags">
          <span class="script-pill">{{
            community ? "Community" : "Your script"
          }}</span>
          <span v-if="script.hidden" class="script-pill">Hidden</span>
        </div>
      </div>
      <div class="script-detail__tools">
        <q-btn
          flat
          round
          dense
          :icon="script.favorite ? 'star' : 'star_outline'"
          :class="{ 'script-detail__star--on': script.favorite }"
          :aria-label="
            script.favorite ? 'Remove from favorites' : 'Add to favorites'
          "
          :aria-pressed="script.favorite"
          @click="$emit('favorite')"
        >
          <q-tooltip>{{
            script.favorite ? "Remove from favorites" : "Add to favorites"
          }}</q-tooltip>
        </q-btn>
        <RowActions :label="`More actions for ${script.name}`">
          <ScriptActionsMenu
            :script="script"
            @view="$emit('view')"
            @clone="$emit('clone')"
            @edit="$emit('edit')"
            @delete="$emit('delete')"
            @favorite="$emit('favorite')"
            @download="$emit('download')"
            @hide="$emit('hide')"
          />
        </RowActions>
        <q-btn
          flat
          round
          dense
          icon="close"
          aria-label="Close details"
          data-test="close-detail"
          @click="$emit('close')"
        >
          <q-tooltip>Close details (Esc)</q-tooltip>
        </q-btn>
      </div>
    </div>

    <div class="script-detail__actions">
      <q-btn
        unelevated
        no-caps
        color="primary"
        icon="play_arrow"
        label="Run on a device"
        class="script-detail__run"
        data-test="run-on-device"
      >
        <q-menu
          v-model="runMenu"
          anchor="bottom left"
          self="top left"
          class="script-run-menu"
          @show="openRunMenu"
        >
          <div class="script-run-menu__search">
            <q-input
              v-model="agentSearch"
              dense
              outlined
              autofocus
              placeholder="Find a device"
              aria-label="Find a device"
            >
              <template #prepend><q-icon name="search" /></template>
            </q-input>
            <div class="script-run-menu__hint">
              {{ platformHint }}
            </div>
          </div>
          <div v-if="agentsState === 'loading'" class="script-run-menu__state">
            <q-spinner size="18px" /> Loading devices
          </div>
          <div
            v-else-if="agentsState === 'error'"
            class="script-run-menu__state"
          >
            Could not load devices.
            <q-btn flat dense no-caps label="Retry" @click="fetchAgentList" />
          </div>
          <q-list v-else dense class="script-run-menu__list">
            <q-item
              v-for="a in shownAgents"
              :key="a.agent_id"
              clickable
              v-close-popup
              :disable="a.status !== 'online'"
              :data-agent="a.agent_id"
              @click="$emit('run', a)"
            >
              <q-item-section avatar>
                <q-icon :name="platformMeta(a.plat).icon" size="20px" />
              </q-item-section>
              <q-item-section>
                <q-item-label>{{ deviceName(a) }}</q-item-label>
                <q-item-label caption
                  >{{ a.client_name }} / {{ a.site_name }}</q-item-label
                >
              </q-item-section>
              <q-item-section side>
                <span
                  class="script-run-menu__status"
                  :class="`script-run-menu__status--${agentStatusMeta(a.status).state}`"
                  >{{ agentStatusLabel(a) }}</span
                >
              </q-item-section>
            </q-item>
            <q-item v-if="!shownAgents.length">
              <q-item-section class="rmm-muted">{{
                agentSearch.trim()
                  ? "No device matches your search."
                  : "No device runs this script's platform."
              }}</q-item-section>
            </q-item>
            <q-item v-if="matchingAgents.length > shownAgents.length">
              <q-item-section class="rmm-muted text-caption">
                Showing {{ shownAgents.length }} of {{ matchingAgents.length }};
                type to narrow the list.
              </q-item-section>
            </q-item>
          </q-list>
        </q-menu>
      </q-btn>
      <div class="script-detail__actions-row">
        <template v-if="community">
          <q-btn
            outline
            no-caps
            icon="content_copy"
            label="Clone to edit"
            @click="$emit('clone')"
          />
          <q-btn
            outline
            no-caps
            icon="code"
            label="View code"
            @click="$emit('view')"
          />
        </template>
        <template v-else>
          <q-btn
            outline
            no-caps
            icon="edit"
            label="Edit"
            @click="$emit('edit')"
          />
          <q-btn
            outline
            no-caps
            icon="content_copy"
            label="Clone"
            @click="$emit('clone')"
          />
        </template>
      </div>
      <div class="script-detail__actions-row">
        <q-btn
          flat
          no-caps
          :icon="script.hidden ? 'visibility' : 'visibility_off'"
          :label="script.hidden ? 'Show in pickers' : 'Hide from pickers'"
          @click="$emit('hide')"
        />
        <q-btn
          flat
          no-caps
          icon="download"
          label="Download"
          @click="$emit('download')"
        />
      </div>
    </div>

    <div class="script-detail__body">
      <p v-if="script.description" class="script-detail__desc">
        {{ script.description }}
      </p>
      <p v-else class="script-detail__desc rmm-muted">No description.</p>

      <dl class="script-detail__facts">
        <div>
          <dt>Platforms</dt>
          <dd class="script-detail__plats">
            <span v-for="p in platforms" :key="p" class="script-detail__plat">
              <q-icon :name="platformIcon(p)" size="16px" />
              {{ platformLabel(p) }}
            </span>
          </dd>
        </div>
        <div>
          <dt>Language</dt>
          <dd><ShellChip :shell="script.shell" /></dd>
        </div>
        <div>
          <dt>Category</dt>
          <dd>{{ script.category || "Uncategorized" }}</dd>
        </div>
        <div>
          <dt>Timeout</dt>
          <dd class="rmm-num">{{ script.default_timeout }} seconds</dd>
        </div>
        <div>
          <dt>Runs as</dt>
          <dd>
            {{ script.run_as_user ? "Logged-in user (Windows)" : "System" }}
            <HelpTip
              :text="
                script.run_as_user
                  ? 'Always runs as the logged-in Windows user, overriding the option in run dialogs. Runs as SYSTEM when nobody is logged in.'
                  : 'Runs as SYSTEM on Windows unless a run dialog picks the logged-in user, and as root on Linux, macOS and FreeBSD.'
              "
            />
          </dd>
        </div>
        <div v-if="script.filename">
          <dt>File</dt>
          <dd class="rmm-mono">{{ script.filename }}</dd>
        </div>
      </dl>

      <section v-if="script.syntax" class="script-detail__section">
        <h3 class="script-detail__h3">Syntax</h3>
        <pre class="script-detail__syntax">{{ script.syntax }}</pre>
      </section>

      <section class="script-detail__section">
        <h3 class="script-detail__h3">
          Inputs
          <span class="rmm-muted rmm-num">{{ variables.length }}</span>
        </h3>
        <p v-if="!variables.length" class="rmm-muted q-ma-none">
          This script takes no typed inputs.
        </p>
        <ul v-else class="script-detail__vars">
          <li v-for="v in variables" :key="v.name" class="script-var">
            <div class="script-var__top">
              <span class="script-var__label">{{ v.label || v.name }}</span>
              <span class="script-pill">{{
                v.required ? "Required" : "Optional"
              }}</span>
            </div>
            <div class="script-var__meta">
              <span class="rmm-mono">{{ v.name }}</span>
              <span>{{ typeLabel(v.type) }}</span>
              <span v-if="v.default && v.type !== 'password'"
                >Default <span class="rmm-mono">{{ v.default }}</span></span
              >
            </div>
            <div v-if="v.options?.length" class="script-var__meta">
              Options: {{ v.options.join(", ") }}
            </div>
            <div v-if="v.help" class="script-var__help">{{ v.help }}</div>
          </li>
        </ul>
      </section>

      <section v-if="script.env_vars?.length" class="script-detail__section">
        <h3 class="script-detail__h3">Default environment</h3>
        <ul class="script-detail__env">
          <li v-for="(e, i) in script.env_vars" :key="i" class="rmm-mono">
            {{ envLabel(e) }}
          </li>
        </ul>
      </section>

      <section v-if="script.args?.length" class="script-detail__section">
        <h3 class="script-detail__h3">Default arguments</h3>
        <ul class="script-detail__env">
          <li v-for="(a, i) in script.args" :key="i" class="rmm-mono">
            {{ a }}
          </li>
        </ul>
      </section>

      <section class="script-detail__section">
        <h3 class="script-detail__h3">Code</h3>
        <div v-if="codeState === 'loading'" class="script-detail__code-state">
          <q-skeleton v-for="n in 6" :key="n" type="text" />
        </div>
        <div
          v-else-if="codeState === 'error'"
          class="script-detail__code-state"
        >
          Could not load the code.
          <q-btn flat dense no-caps label="Retry" @click="fetchCode" />
        </div>
        <pre
          v-else
          class="script-detail__code"
          tabindex="0"
          aria-label="Script code"
          >{{ code || "(empty)" }}</pre
        >
      </section>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import RowActions from "@/components/ui/RowActions.vue";
import HelpTip from "@/components/ui/HelpTip.vue";
import ShellChip from "@/components/scripts/ShellChip.vue";
import ScriptActionsMenu from "@/components/scripts/ScriptActionsMenu.vue";
import { VARIABLE_TYPES, envMasker } from "@/utils/scriptVariables";
import {
  agentStatusLabel,
  agentStatusMeta,
  platformMeta,
} from "@/utils/format";
import { deviceName } from "@/utils/deviceName";
import {
  ANY_PLATFORM,
  PLATFORM_FACETS,
  isCommunity,
  platformLabel,
  scriptPlatforms,
} from "@/utils/scriptLibrary";
import type { Script } from "@/types/scripts";
import type { RunTarget } from "@/utils/scriptLibrary";

const MAX_AGENTS = 50;

const props = defineProps<{
  script: Script;
  loadCode: (id: number) => Promise<string>;
  loadAgents: () => Promise<RunTarget[]>;
}>();

defineEmits([
  "close",
  "run",
  "view",
  "clone",
  "edit",
  "delete",
  "favorite",
  "download",
  "hide",
]);

const community = computed(() => isCommunity(props.script));
const platforms = computed(() => scriptPlatforms(props.script));
const variables = computed(() => props.script.variables ?? []);
const envLabel = computed(() => envMasker(variables.value));

const typeLabel = (type: string) =>
  VARIABLE_TYPES.find((t) => t.value === type)?.label ?? type;
const platformIcon = (p: string) =>
  PLATFORM_FACETS.find((f) => f.value === p)?.icon ?? "devices";

// code preview. loaded per script, cached by the manager
const code = ref("");
const codeState = ref<"loading" | "ready" | "error">("loading");
let codeSeq = 0;

async function fetchCode() {
  const seq = ++codeSeq;
  codeState.value = "loading";
  try {
    const text = await props.loadCode(props.script.id as number);
    if (seq !== codeSeq) return;
    code.value = text;
    codeState.value = "ready";
  } catch {
    if (seq === codeSeq) codeState.value = "error";
  }
}

// watch the object, not the id. a reload gives new objects after an edit
watch(() => props.script, fetchCode, { immediate: true });

// device picker
const runMenu = ref(false);
const agentSearch = ref("");
const agents = ref<RunTarget[]>([]);
const agentsState = ref<"idle" | "loading" | "ready" | "error">("idle");

// keep the list visible during a refresh
async function fetchAgentList() {
  if (agentsState.value !== "ready") agentsState.value = "loading";
  try {
    agents.value = await props.loadAgents();
    agentsState.value = "ready";
  } catch {
    agentsState.value = "error";
  }
}

function openRunMenu() {
  agentSearch.value = "";
  fetchAgentList();
}

const platformHint = computed(() =>
  platforms.value.includes(ANY_PLATFORM)
    ? "All platforms. Offline devices cannot run scripts."
    : `${platforms.value.map(platformLabel).join(", ")} devices only. Offline devices cannot run scripts.`,
);

const matchingAgents = computed(() => {
  const plats = platforms.value;
  const terms = agentSearch.value.toLowerCase().split(/\s+/).filter(Boolean);
  return agents.value
    .filter((a) => plats.includes(ANY_PLATFORM) || plats.includes(a.plat))
    .filter((a) => {
      if (!terms.length) return true;
      const text =
        `${deviceName(a)} ${a.hostname} ${a.client_name ?? ""} ${a.site_name ?? ""}`.toLowerCase();
      return terms.every((t) => text.includes(t));
    })
    .sort(
      (a, b) =>
        Number(b.status === "online") - Number(a.status === "online") ||
        deviceName(a).localeCompare(deviceName(b)),
    );
});

const shownAgents = computed(() => matchingAgents.value.slice(0, MAX_AGENTS));
</script>

<style scoped>
.script-detail {
  display: flex;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  border-left: 1px solid var(--rmm-border);
  background: var(--rmm-surface);
  color: var(--rmm-text);
}

.script-detail__head {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 16px 12px 0 20px;
}

.script-detail__identity {
  min-width: 0;
  flex: 1;
}

.script-detail__title {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  line-height: 1.3;
  letter-spacing: -0.01em;
  overflow-wrap: anywhere;
}

.script-detail__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 6px;
}

.script-detail__tools {
  display: flex;
  flex-shrink: 0;
  gap: 2px;
}

.script-detail__star--on {
  color: var(--rmm-status-warning);
}

.script-detail__actions {
  display: grid;
  gap: 8px;
  padding: 14px 20px 8px;
}

.script-detail__actions .q-btn {
  min-height: 36px;
}

.script-detail__actions-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.script-detail__body {
  min-height: 0;
  flex: 1;
  overflow-y: auto;
  padding: 8px 20px 20px;
  border-top: 1px solid var(--rmm-border);
}

.script-detail__desc {
  margin: 8px 0 14px;
  font-size: 13px;
  line-height: 1.5;
}

.script-detail__facts {
  display: grid;
  gap: 8px;
  margin: 0 0 6px;
  font-size: 13px;
}

.script-detail__facts > div {
  display: grid;
  grid-template-columns: 96px minmax(0, 1fr);
  gap: 8px;
  align-items: center;
}

.script-detail__facts dt {
  color: var(--rmm-text-muted);
}

.script-detail__facts dd {
  min-width: 0;
  margin: 0;
  overflow-wrap: anywhere;
}

.script-detail__plats {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.script-detail__plat {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.script-detail__section {
  margin-top: 18px;
}

.script-detail__h3 {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0 0 8px;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.4;
}

.script-detail__vars,
.script-detail__env {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.script-detail__env {
  gap: 2px;
  font-size: 12px;
  overflow-wrap: anywhere;
}

.script-var {
  padding: 8px 10px;
  border: 1px solid var(--rmm-border);
  border-radius: var(--rmm-radius-sm);
  background: var(--rmm-surface-2);
  font-size: 13px;
}

.script-var__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.script-var__label {
  font-weight: 600;
  overflow-wrap: anywhere;
}

.script-var__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
  margin-top: 2px;
  color: var(--rmm-text-muted);
  font-size: 12px;
  overflow-wrap: anywhere;
}

.script-var__help {
  margin-top: 4px;
  font-size: 12px;
}

.script-detail__syntax,
.script-detail__code {
  margin: 0;
  padding: 10px 12px;
  border: 1px solid var(--rmm-border);
  border-radius: var(--rmm-radius-sm);
  background: var(--rmm-surface-2);
  font-family: var(--rmm-mono);
  font-size: 12px;
  line-height: 1.5;
}

.script-detail__syntax {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.script-detail__code {
  max-height: 420px;
  overflow: auto;
  white-space: pre;
  tab-size: 4;
}

.script-detail__code:focus-visible {
  outline: 2px solid var(--rmm-focus);
  outline-offset: -2px;
}

.script-detail__code-state {
  display: grid;
  gap: 4px;
  color: var(--rmm-text-muted);
  font-size: 13px;
}

.script-pill {
  display: inline-flex;
  min-height: 20px;
  align-items: center;
  padding: 0 8px;
  border: 1px solid var(--rmm-border-strong);
  border-radius: 999px;
  color: var(--rmm-text-muted);
  background: var(--rmm-surface-2);
  font-size: var(--rmm-fs-xs);
  font-weight: 500;
  white-space: nowrap;
}

.script-run-menu__search {
  padding: 8px 8px 4px;
}

.script-run-menu__hint {
  margin-top: 4px;
  color: var(--rmm-text-muted);
  font-size: var(--rmm-fs-xs);
}

.script-run-menu__state {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  color: var(--rmm-text-muted);
}

.script-run-menu__list {
  max-height: 320px;
  overflow-y: auto;
}

.script-run-menu__status {
  font-size: var(--rmm-fs-xs);
  font-weight: 600;
}

.script-run-menu__status--positive {
  color: var(--rmm-status-positive);
}

.script-run-menu__status--warning {
  color: var(--rmm-status-warning);
}

.script-run-menu__status--negative {
  color: var(--rmm-status-negative);
}

.script-run-menu__status--info {
  color: var(--rmm-status-info);
}

.script-run-menu__status--neutral {
  color: var(--rmm-text-muted);
}
</style>

<style>
/* menu is teleported, so it is outside this component's scoped css */
.script-run-menu {
  width: 360px;
  max-width: calc(100vw - 32px);
}
</style>
