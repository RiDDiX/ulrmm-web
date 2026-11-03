<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-dialog ref="dialogRef" aria-labelledby="vulns-title" @hide="onDialogHide">
    <q-card class="q-dialog-plugin vulns-manager">
      <DialogHeader
        title-id="vulns-title"
        title="Vulnerabilities"
        subtitle="Linux packages (OSV.dev), FreeBSD packages (VuXML), Windows updates (Microsoft MSRC) and third-party apps (NVD)"
      >
        <template #actions>
          <q-btn
            dense
            flat
            icon="refresh"
            aria-label="Reload vulnerabilities"
            @click="reload"
          >
            <q-tooltip>Reload the summary and the findings</q-tooltip>
          </q-btn>
        </template>
      </DialogHeader>

      <div class="vulns-manager__body">
        <div
          class="vulns-tiles"
          role="group"
          aria-label="Open findings with an update"
        >
          <div class="vulns-tile">
            <strong class="rmm-num">{{ tile("needs_update") }}</strong>
            <span>Needs update</span>
          </div>
          <div class="vulns-tile">
            <strong class="rmm-num">{{ tile("no_fix") }}</strong>
            <span>No fix yet</span>
          </div>
          <button
            v-for="level in tileLevels"
            :key="level"
            type="button"
            class="vulns-tile vulns-tile--button"
            :aria-pressed="severity === level ? 'true' : 'false'"
            @click="pickSeverity(level)"
          >
            <strong class="rmm-num">{{ tile(level) }}</strong>
            <span>
              <span
                class="vulns-tile__dot"
                :class="{ 'vulns-tile__dot--solid': severityMeta(level).solid }"
                :style="{ background: severityMeta(level).color }"
                aria-hidden="true"
              />
              {{ severityMeta(level).label }}
            </span>
            <q-tooltip>{{
              severity === level
                ? "Show every severity again"
                : `Show only ${severityMeta(level).label.toLowerCase()} findings that need an update`
            }}</q-tooltip>
          </button>
          <div class="vulns-tile">
            <strong class="rmm-num">{{ tile("agents_affected") }}</strong>
            <span>Devices affected</span>
          </div>
          <div class="vulns-tile">
            <strong
              class="vulns-tile__when"
              :title="
                summary?.last_scan ? formatDate(summary.last_scan) : undefined
              "
              >{{
                summary?.last_scan
                  ? relativeTime(summary.last_scan)
                  : summary
                    ? "Never"
                    : "—"
              }}</strong
            >
            <span>Last check</span>
          </div>
        </div>

        <p class="vulns-manager__note">
          <q-icon name="info" size="16px" aria-hidden="true" />
          Linux and FreeBSD packages, Windows updates and known third-party apps
          are checked.
          <HelpTip v-if="summary?.coverage" :text="summary.coverage" />
        </p>

        <q-banner
          v-if="error && page.findings.length"
          dense
          rounded
          class="rmm-banner-warning q-mb-sm"
        >
          <template #avatar>
            <q-icon name="warning_amber" color="warning" />
          </template>
          {{ errorMessage }} Showing the findings loaded before.
          <template #action>
            <q-btn
              flat
              dense
              no-caps
              color="primary"
              label="Retry"
              @click="reload"
            />
          </template>
        </q-banner>

        <FindingsTable
          class="vulns-manager__table"
          :class="{ 'vulns-manager__table--fill': page.findings.length }"
          show-device
          :rows="page.findings"
          :loading="loading"
          :busy="busy"
          @toggle-ignore="toggleIgnore"
        >
          <template #top>
            <div class="rmm-toolbar full-width vulns-manager__toolbar">
              <q-select
                v-model="severity"
                :options="SEVERITY_OPTIONS"
                emit-value
                map-options
                outlined
                dense
                options-dense
                label="Severity"
                class="vulns-manager__select"
              />
              <q-select
                v-model="status"
                :options="statusOptions"
                emit-value
                map-options
                outlined
                dense
                options-dense
                label="Status"
                class="vulns-manager__select"
              />
              <q-input
                v-model="search"
                outlined
                dense
                clearable
                debounce="400"
                placeholder="Search id, package, summary or device"
                aria-label="Search findings"
                class="vulns-manager__search"
              >
                <template #prepend>
                  <q-icon name="search" class="rmm-muted" />
                </template>
              </q-input>
              <span class="rmm-muted rmm-num" role="status">
                {{ countText }}
              </span>
              <q-space />
              <q-btn
                unelevated
                dense
                no-caps
                color="primary"
                icon="manage_search"
                label="Scan fleet"
                class="vulns-manager__primary"
                :loading="scanning"
                @click="scan"
              >
                <q-tooltip
                  >Check the inventory of every device you can access against
                  the vulnerability sources now</q-tooltip
                >
              </q-btn>
            </div>
          </template>

          <template #no-data>
            <EmptyState
              v-if="error"
              icon="error_outline"
              title="Unable to load vulnerabilities"
              :text="errorMessage"
            >
              <q-btn
                outline
                dense
                no-caps
                color="primary"
                label="Retry"
                @click="reload"
              />
            </EmptyState>
            <EmptyState
              v-else-if="filtersActive"
              icon="filter_alt_off"
              title="No findings match"
              text="Change the severity or status, or clear the search."
            >
              <q-btn
                outline
                dense
                no-caps
                color="primary"
                label="Clear filters"
                @click="clearFilters"
              />
            </EmptyState>
            <EmptyState
              v-else-if="summary && !summary.last_scan"
              icon="manage_search"
              title="Not checked yet"
              text="Devices are checked once a day. Scan fleet checks them right away."
            >
              <q-btn
                unelevated
                dense
                no-caps
                color="primary"
                icon="manage_search"
                label="Scan fleet"
                :loading="scanning"
                @click="scan"
              />
            </EmptyState>
            <EmptyState
              v-else
              icon="verified_user"
              title="Nothing needs an update"
              :text="
                summary?.no_fix
                  ? `No open finding has a fixed version. ${summary.no_fix} open ${summary.no_fix === 1 ? 'finding has' : 'findings have'} no fix yet.`
                  : 'No checked package, update or app has a known, open vulnerability.'
              "
            >
              <q-btn
                v-if="summary?.no_fix"
                outline
                dense
                no-caps
                color="primary"
                label="Show no fix yet"
                @click="status = 'no_fix'"
              />
            </EmptyState>
          </template>
        </FindingsTable>
      </div>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useDialogPluginComponent } from "quasar";
import { useStore } from "vuex";
import {
  fetchVulnFindings,
  fetchVulnSummary,
  scanFleetVulns,
  toggleVulnIgnore,
} from "@/api/vulns";
import {
  SEVERITIES,
  severityMeta,
  STATUS_FILTERS,
  type Finding,
  type Severity,
  type StatusFilter,
} from "@/utils/vulns";
import { relativeTime } from "@/utils/format";
import { notifySuccess } from "@/utils/notify";
import DialogHeader from "@/components/ui/DialogHeader.vue";
import EmptyState from "@/components/ui/EmptyState.vue";
import HelpTip from "@/components/ui/HelpTip.vue";
import FindingsTable from "@/components/vulns/FindingsTable.vue";

// severities and agents_affected count open findings with a fix available
interface Summary {
  agents_affected: number;
  open: number;
  needs_update: number;
  no_fix: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  unknown?: number;
  last_scan: string | null;
  coverage?: string;
}

defineEmits([...useDialogPluginComponent.emits]);
const { dialogRef, onDialogHide } = useDialogPluginComponent();
const store = useStore();
const formatDate = (value: string) => store.getters.formatDate(value);

const SEVERITY_OPTIONS = [
  { value: "", label: "All severities" },
  ...SEVERITIES.map((value) => ({ value, label: severityMeta(value).label })),
];

const summary = ref<Summary | null>(null);
const page = ref<{ count: number; truncated: boolean; findings: Finding[] }>({
  count: 0,
  truncated: false,
  findings: [],
});
const loading = ref(false);
const error = ref<{ response?: { status?: number } } | null>(null);
const scanning = ref(false);
const busy = ref<number | null>(null);
const severity = ref("");
const status = ref<StatusFilter>("needs_update");
const search = ref<string | null>("");
let generation = 0;
let followUp = 0;

const errorMessage = computed(() =>
  error.value?.response?.status === 403
    ? "Your role cannot view vulnerabilities."
    : "Vulnerabilities could not be loaded.",
);
const filtersActive = computed(
  () => !!severity.value || status.value !== "needs_update" || !!search.value,
);
// the summary counts only these two
const statusOptions = computed(() =>
  STATUS_FILTERS.map(({ value, label }) => {
    const n =
      value === "needs_update" || value === "no_fix"
        ? summary.value?.[value]
        : undefined;
    return {
      value,
      label:
        typeof n === "number"
          ? `${label} ${n}`
          : value
            ? label
            : "All statuses",
    };
  }),
);
const tileLevels = computed<Severity[]>(() =>
  summary.value?.unknown
    ? ["critical", "high", "medium", "low", "unknown"]
    : ["critical", "high", "medium", "low"],
);
const countText = computed(() => {
  const { count, truncated, findings } = page.value;
  const noun = count === 1 ? "finding" : "findings";
  return truncated
    ? `${count} ${noun}, showing the worst ${findings.length}`
    : `${count} ${noun}`;
});

function tile(key: keyof Summary) {
  const value = summary.value?.[key];
  return typeof value === "number" ? value : "—";
}

async function loadSummary() {
  try {
    summary.value = await fetchVulnSummary();
  } catch {
    // the findings request reports the same failure
  }
}

async function loadFindings() {
  const request = ++generation;
  loading.value = true;
  const params: Record<string, string> = {};
  if (severity.value) params.severity = severity.value;
  if (status.value) params.status = status.value;
  if (search.value?.trim()) params.search = search.value.trim();
  try {
    const data = await fetchVulnFindings(params);
    if (request !== generation) return;
    page.value = {
      count: Number(data?.count) || 0,
      truncated: !!data?.truncated,
      findings: Array.isArray(data?.findings) ? data.findings : [],
    };
    error.value = null;
  } catch (e) {
    if (request === generation) error.value = e as typeof error.value;
  } finally {
    if (request === generation) loading.value = false;
  }
}

function reload() {
  void loadSummary();
  void loadFindings();
}

function pickSeverity(level: Severity) {
  if (severity.value === level) {
    severity.value = "";
  } else {
    severity.value = level;
    status.value = "needs_update";
  }
}

function clearFilters() {
  severity.value = "";
  status.value = "needs_update";
  search.value = "";
}

async function scan() {
  scanning.value = true;
  try {
    notifySuccess(await scanFleetVulns(), 4000);
    // the check runs on the server; one follow-up reload picks up quick results
    window.clearTimeout(followUp);
    followUp = window.setTimeout(reload, 10000);
  } catch {
    // the response interceptor shows the error
  } finally {
    scanning.value = false;
  }
}

async function toggleIgnore(row: Finding) {
  busy.value = row.id;
  try {
    const result = await toggleVulnIgnore(row.id);
    notifySuccess(
      result.status === "ignored"
        ? `${row.vuln_id} in ${row.package} ignored`
        : `${row.vuln_id} in ${row.package} reopened`,
    );
    // the row may leave the status filter and the open counts change
    reload();
  } catch {
    // the response interceptor shows the error
  } finally {
    busy.value = null;
  }
}

watch([severity, status, search], loadFindings);
onMounted(reload);
onBeforeUnmount(() => window.clearTimeout(followUp));
</script>

<style scoped>
.vulns-manager {
  display: flex;
  width: calc(100vw - 48px);
  max-width: 1500px;
  height: 90vh;
  flex-direction: column;
}

.vulns-manager__body {
  display: flex;
  min-height: 0;
  flex: 1 1 auto;
  flex-direction: column;
  padding: 12px 16px 16px;
}

.vulns-tiles {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(118px, 1fr));
  gap: 10px;
  flex-shrink: 0;
}

.vulns-tile {
  display: grid;
  min-width: 0;
  align-content: center;
  gap: 2px;
  padding: 10px 14px;
  border: 1px solid var(--rmm-border);
  border-radius: var(--rmm-radius-lg);
  color: var(--rmm-text);
  background: var(--rmm-surface);
  font: inherit;
  text-align: left;
}

.vulns-tile--button {
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
}

.vulns-tile--button:hover {
  border-color: var(--rmm-border-strong);
  box-shadow: var(--rmm-shadow-lg);
}

.vulns-tile--button:focus-visible {
  outline: 2px solid var(--rmm-focus);
  outline-offset: 2px;
}

.vulns-tile--button[aria-pressed="true"] {
  border-color: var(--rmm-accent);
  background: var(--rmm-accent-soft);
  box-shadow: inset 0 0 0 1px var(--rmm-accent);
}

.vulns-tile strong {
  font-size: 22px;
  font-weight: 700;
  line-height: 1.2;
}

.vulns-tile strong.vulns-tile__when {
  overflow: hidden;
  font-size: var(--rmm-fs-lg);
  line-height: 27px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.vulns-tile > span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--rmm-text-muted);
  font-size: var(--rmm-fs-sm);
  white-space: nowrap;
}

.vulns-tile__dot {
  width: 10px;
  height: 10px;
  flex-shrink: 0;
  border-radius: 50%;
}

/* critical and high share the red; critical gets a ring */
.vulns-tile__dot--solid {
  box-shadow: 0 0 0 3px
    color-mix(in srgb, var(--rmm-nav-badge-bg) 30%, transparent);
}

.vulns-manager__note {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 6px;
  margin: 12px 0;
  color: var(--rmm-text-muted);
  font-size: var(--rmm-fs-sm);
}

/* rows fill the dialog; an empty state sits right under the header */
.vulns-manager__table {
  min-height: 0;
  flex: 0 1 auto;
  border: 1px solid var(--rmm-border);
  border-radius: var(--rmm-radius);
}

.vulns-manager__table--fill {
  flex: 1 1 auto;
}

.vulns-manager__toolbar {
  flex-wrap: wrap;
}

.vulns-manager__select {
  width: 190px;
}

.vulns-manager__search {
  width: min(320px, 60vw);
}

.vulns-manager__primary {
  padding: 2px 10px;
}
</style>
