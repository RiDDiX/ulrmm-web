<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <div v-if="!selectedAgent" class="q-pa-sm rmm-muted">No agent selected</div>
  <div v-else class="apps-tab">
    <q-table
      class="rmm-table apps-table"
      dense
      flat
      :columns="columns"
      selection="multiple"
      v-model:selected="selected"
      row-key="app_id"
      v-model:pagination="pagination"
      :rows-per-page-options="[0]"
      :loading="loading"
      v-sortable-headers
      virtual-scroll
      binary-state-sort
      :rows="view.rows"
      hide-pagination
      :selected-rows-label="() => ''"
      :style="{ 'max-height': tabHeight }"
    >
      <template #top>
        <div class="full-width">
          <TabToolbar title="App updates" :count="pending.length">
            <PatchSourceToggle v-if="agentPlatform === 'windows'" />
            <div>
              <q-btn
                unelevated
                dense
                no-caps
                color="primary"
                icon="system_update_alt"
                label="Update selected"
                class="apps-tab__primary"
                :disable="!selectedIds.length || !!working || offline"
                :loading="working === 'selected'"
                @click="apply(selectedIds, 'selected')"
              />
              <q-tooltip>{{
                offline
                  ? offlineReason
                  : "Update the ticked apps on the device now"
              }}</q-tooltip>
            </div>
            <div>
              <q-btn
                outline
                dense
                no-caps
                color="primary"
                icon="update"
                label="Update all"
                :disable="!pending.length || !!working || offline"
                :loading="working === 'all'"
                @click="
                  apply(
                    pending.map((r) => r.app_id),
                    'all',
                  )
                "
              />
              <q-tooltip>{{
                offline
                  ? offlineReason
                  : "Update every app that is not excluded"
              }}</q-tooltip>
            </div>
            <q-space />
            <q-select
              v-model="policy"
              :options="POLICY_OPTIONS"
              emit-value
              map-options
              outlined
              dense
              options-dense
              label="Automatic updates"
              class="apps-tab__policy"
              :disable="savingPolicy"
              @update:model-value="savePolicy"
            />
            <div>
              <q-btn
                dense
                no-caps
                outline
                color="primary"
                icon="manage_search"
                label="Check now"
                :disable="offline"
                :loading="collecting"
                @click="collect"
              />
              <q-tooltip>{{
                offline
                  ? offlineReason
                  : "Ask the device for its outdated apps; it must be online"
              }}</q-tooltip>
            </div>
            <q-btn
              dense
              flat
              round
              icon="refresh"
              aria-label="Reload app updates"
              @click="load"
            >
              <q-tooltip>Reload the list</q-tooltip>
            </q-btn>
          </TabToolbar>
          <div class="apps-summary">
            <span
              class="rmm-pill"
              :class="
                view.effective === null
                  ? 'rmm-pill--neutral'
                  : view.effective
                    ? 'rmm-pill--info'
                    : 'rmm-pill--neutral'
              "
              >{{ effectiveText }}</span
            >
            <span v-if="!view.supported" class="rmm-pill rmm-pill--neutral"
              >Not supported on this platform</span
            >
            <span class="apps-summary__meta">
              Last checked
              <span
                v-if="view.lastCollected"
                :title="formatDate(view.lastCollected)"
                >{{ relativeTime(view.lastCollected) }}</span
              ><span v-else>never</span>
            </span>
          </div>
          <q-banner
            v-if="view.error"
            dense
            rounded
            class="rmm-banner-warning q-ma-sm"
          >
            <template #avatar>
              <q-icon name="warning_amber" color="warning" />
            </template>
            The last check failed: {{ view.error }}
          </q-banner>
          <q-banner
            v-if="error && data"
            dense
            rounded
            class="rmm-banner-warning q-ma-sm"
          >
            <template #avatar>
              <q-icon name="warning_amber" color="warning" />
            </template>
            {{ errorMessage }} Showing the list loaded before.
          </q-banner>
        </div>
      </template>

      <template #header-selection>
        <span class="sr-only">Select apps</span>
      </template>

      <template #body-selection="scope">
        <q-checkbox
          dense
          :model-value="scope.selected"
          :disable="
            scope.row.state === 'excluded' ||
            scope.row.excluded_globally ||
            !!working
          "
          :aria-label="`Select ${scope.row.name}`"
          @update:model-value="scope.selected = $event"
        />
      </template>

      <template #body-cell-version="scope">
        <q-td :props="scope">
          <span class="rmm-mono">{{ scope.row.installed || "?" }}</span>
          <q-icon name="arrow_forward" size="14px" class="q-mx-xs rmm-muted" />
          <span class="rmm-mono">{{ scope.row.available || "?" }}</span>
        </q-td>
      </template>

      <template #body-cell-state="scope">
        <q-td :props="scope">
          <span
            class="rmm-pill"
            :class="`rmm-pill--${stateMeta(scope.row.state).tone}`"
            >{{ stateMeta(scope.row.state).label }}</span
          >
          <span
            v-if="scope.row.excluded_globally"
            class="rmm-pill rmm-pill--neutral q-ml-xs"
            >Excluded globally</span
          >
          <q-tooltip v-if="scope.row.last_error">{{
            scope.row.last_error
          }}</q-tooltip>
        </q-td>
      </template>

      <template #body-cell-excluded="scope">
        <q-td :props="scope">
          <q-toggle
            dense
            :model-value="scope.row.state === 'excluded'"
            :disable="
              busy === scope.row.app_id || scope.row.state === 'updating'
            "
            :aria-label="`Exclude ${scope.row.name} from updates`"
            @update:model-value="exclude(scope.row, $event)"
          >
            <q-tooltip>{{
              scope.row.state === "excluded"
                ? "Excluded: skipped by update all and the daily run. Switch off to include it again"
                : "Exclude this app on this device"
            }}</q-tooltip>
          </q-toggle>
        </q-td>
      </template>

      <template #no-data>
        <div v-if="!loading" class="full-width">
          <EmptyState
            v-if="error && !data"
            icon="error_outline"
            title="Unable to load app updates"
            :text="errorMessage"
          >
            <q-btn
              outline
              dense
              no-caps
              color="primary"
              label="Retry"
              @click="load"
            />
          </EmptyState>
          <EmptyState
            v-else
            icon="verified"
            title="No outdated apps known"
            :text="
              view.lastCollected
                ? 'The last check found nothing to update.'
                : 'The device has not been checked yet. Check now asks it for its outdated apps.'
            "
          >
            <div v-if="!view.lastCollected">
              <q-btn
                unelevated
                dense
                no-caps
                color="primary"
                icon="manage_search"
                label="Check now"
                :disable="offline"
                :loading="collecting"
                @click="collect"
              />
              <q-tooltip v-if="offline">{{ offlineReason }}</q-tooltip>
            </div>
          </EmptyState>
        </div>
      </template>
    </q-table>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useStore } from "vuex";
import type { QTableColumn } from "quasar";
import {
  applyAppUpdates,
  collectAppUpdates,
  excludeAppUpdate,
  fetchAppUpdates,
  setAppUpdatePolicy,
} from "@/api/appupdates";
import {
  normalizeAppUpdates,
  pendingRows,
  POLICY_OPTIONS,
  stateMeta,
  type AppPolicy,
  type AppUpdate,
} from "@/utils/appupdates";
import { relativeTime } from "@/utils/format";
import { notifySuccess, notifyWarning } from "@/utils/notify";
import { sortableHeaders as vSortableHeaders } from "@/utils/sortableHeaders";
import TabToolbar from "@/components/agents/TabToolbar.vue";
import PatchSourceToggle from "@/components/agents/PatchSourceToggle.vue";
import EmptyState from "@/components/ui/EmptyState.vue";

const store = useStore();
const selectedAgent = computed(() => store.state.selectedRow);
const agentPlatform = computed(() => store.state.agentPlatform);
const tabHeight = computed(() => store.state.tabHeight);
const formatDate = (value: string) => store.getters.formatDate(value);

const data = ref<unknown>(null);
const loading = ref(false);
const error = ref<{ response?: { status?: number } } | null>(null);
const collecting = ref(false);
const working = ref<"" | "selected" | "all">("");
const busy = ref<string | null>(null);
const savingPolicy = ref(false);
const policy = ref<AppPolicy>("inherit");
const selected = ref<AppUpdate[]>([]);
const pagination = ref({ rowsPerPage: 0, sortBy: null, descending: false });
let generation = 0;
let followUp = 0;

// unknown counts as online, the server refuses an offline agent itself
const availability = computed(() =>
  store.state.agentAvailability?.agent_id === selectedAgent.value
    ? store.state.agentAvailability
    : null,
);
const offline = computed(
  () => !!availability.value && availability.value.status !== "online",
);
const offlineReason = computed(
  () =>
    `Needs the agent online, last seen ${relativeTime(availability.value?.last_seen)}`,
);

const view = computed(() => normalizeAppUpdates(data.value));
const pending = computed(() => pendingRows(view.value.rows));
const selectedIds = computed(() =>
  selected.value.filter((r) => r.state !== "excluded").map((r) => r.app_id),
);
const effectiveText = computed(() => {
  const v = view.value;
  if (v.effective === null) return "Automatic updates: unknown";
  const from = v.effectiveFrom ? ` (set by ${v.effectiveFrom})` : "";
  return `Automatic updates ${v.effective ? "on" : "off"} for this device${from}`;
});
const errorMessage = computed(() =>
  error.value?.response?.status === 403
    ? "Your role cannot view app updates of this device."
    : "App updates could not be loaded.",
);

const leftAligned = (
  col: Omit<QTableColumn<AppUpdate>, "align">,
): QTableColumn<AppUpdate> => ({ ...col, align: "left" });

const columns = (
  [
    { name: "name", label: "App", field: "name", sortable: true },
    { name: "version", label: "Installed → available", field: "installed" },
    { name: "source", label: "Source", field: "source", sortable: true },
    { name: "state", label: "State", field: "state", sortable: true },
    { name: "excluded", label: "Exclude", field: "state" },
  ] satisfies Omit<QTableColumn<AppUpdate>, "align">[]
).map(leftAligned);

function show(result: unknown) {
  data.value = result ?? {};
  policy.value = normalizeAppUpdates(result).policy;
  selected.value = [];
  error.value = null;
}

async function load() {
  const agentId = selectedAgent.value;
  if (!agentId) return;
  const request = ++generation;
  loading.value = true;
  try {
    const result = await fetchAppUpdates(agentId);
    if (request !== generation) return;
    show(result);
  } catch (e) {
    if (request === generation) error.value = e as typeof error.value;
  } finally {
    if (request === generation) loading.value = false;
  }
}

async function collect() {
  const agentId = selectedAgent.value;
  collecting.value = true;
  try {
    const r = await collectAppUpdates(agentId);
    if (agentId !== selectedAgent.value) return;
    show(r);
    notifySuccess("Device checked");
  } catch {
    // the response interceptor shows the error
  } finally {
    collecting.value = false;
  }
}

async function apply(ids: string[], kind: "selected" | "all") {
  if (!ids.length) return;
  const agentId = selectedAgent.value;
  working.value = kind;
  try {
    const r = await applyAppUpdates(selectedAgent.value, ids);
    const skipped = r?.skipped?.length ?? 0;
    notifySuccess(
      `Updating ${r?.queued?.length ?? 0} app(s)` +
        (skipped ? `, ${skipped} skipped` : ""),
    );
    window.clearTimeout(followUp);
    followUp = window.setTimeout(() => {
      if (agentId === selectedAgent.value) void load();
    }, 5000);
    await load();
  } catch {
    // the response interceptor shows the error
  } finally {
    working.value = "";
  }
}

async function exclude(row: AppUpdate, excluded: boolean) {
  busy.value = row.app_id;
  try {
    show(await excludeAppUpdate(selectedAgent.value, row.app_id, excluded));
  } catch {
    // the response interceptor shows the error
  } finally {
    busy.value = null;
  }
}

async function savePolicy(value: AppPolicy) {
  savingPolicy.value = true;
  try {
    await setAppUpdatePolicy(selectedAgent.value, value);
    notifySuccess("Policy saved");
    await load();
  } catch {
    policy.value = view.value.policy;
    notifyWarning("The policy was not changed");
  } finally {
    savingPolicy.value = false;
  }
}

watch(selectedAgent, (agentId) => {
  generation += 1;
  window.clearTimeout(followUp);
  data.value = null;
  error.value = null;
  if (agentId) void load();
});

onMounted(load);
onBeforeUnmount(() => window.clearTimeout(followUp));
</script>

<style scoped>
.apps-tab {
  min-width: 0;
  background: var(--rmm-surface);
}

.apps-table :deep(.q-table__top) {
  padding: 0;
}

.apps-tab__primary {
  padding: 2px 10px;
}

.apps-tab__policy {
  width: 220px;
}

.apps-summary {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 8px;
  padding: 8px 10px;
  border-bottom: 1px solid var(--rmm-border);
  font-size: var(--rmm-fs-sm);
}

.apps-summary__meta {
  color: var(--rmm-text-muted);
}
</style>
