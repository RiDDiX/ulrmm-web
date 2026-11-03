<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <div v-if="!selectedAgent" class="q-pa-sm rmm-muted">No agent selected</div>
  <div v-else class="vulns-tab">
    <FindingsTable
      :rows="findings"
      :loading="loading"
      :busy="busy"
      :style="{ 'max-height': tabHeight }"
      @toggle-ignore="toggleIgnore"
    >
      <template #top>
        <div class="full-width">
          <TabToolbar title="Vulnerabilities" :count="counts.all">
            <q-btn-toggle
              v-if="counts.all"
              v-model="status"
              :options="statusOptions"
              dense
              no-caps
              unelevated
              toggle-color="primary"
              role="group"
              aria-label="Show findings by status"
            />
            <q-space />
            <q-input
              v-if="counts.all"
              v-model="search"
              outlined
              dense
              clearable
              debounce="400"
              placeholder="Search findings"
              aria-label="Search findings"
              class="vulns-tab__search"
            >
              <template #prepend>
                <q-icon name="search" class="rmm-muted" />
              </template>
            </q-input>
            <q-btn
              v-if="data?.supported"
              unelevated
              dense
              no-caps
              color="primary"
              icon="manage_search"
              label="Scan now"
              class="vulns-tab__primary"
              :loading="scanning"
              @click="scan"
            >
              <q-tooltip v-if="agentPlatform === 'freebsd'"
                >Ask the device for a package scan; pkg audit runs there and the
                findings arrive when it reports back</q-tooltip
              >
              <q-tooltip v-else
                >Check the stored inventory against the vulnerability sources
                now; the device does not need to be online</q-tooltip
              >
            </q-btn>
            <q-btn
              dense
              flat
              round
              icon="refresh"
              aria-label="Reload vulnerabilities"
              @click="load"
            >
              <q-tooltip>Reload the findings</q-tooltip>
            </q-btn>
          </TabToolbar>

          <div v-if="data?.supported && data.last_scan" class="vulns-summary">
            <span class="vulns-summary__label">Needs update</span>
            <span v-if="!summaryLevels.length">none</span>
            <SeverityPill
              v-for="level in summaryLevels"
              :key="level"
              :level="level"
              >{{ bySeverity[level] }}
              {{ severityMeta(level).label.toLowerCase() }}</SeverityPill
            >
            <span class="vulns-summary__meta">
              Checked
              <span :title="formatDate(data.last_scan)">{{
                relativeTime(data.last_scan)
              }}</span>
              · {{ data.packages }} {{ data.ecosystem ? "packages" : "items"
              }}<template v-if="data.ecosystem">
                · {{ data.ecosystem }}</template
              >
            </span>
            <HelpTip :text="COVERAGE" />
            <span v-if="unmapped" class="vulns-summary__meta">
              {{ unmapped }} {{ unmapped === 1 ? "app" : "apps" }} without
              mapping, not checked
            </span>
            <span
              v-if="data.unchecked"
              class="vulns-summary__warning"
              role="status"
            >
              <q-icon name="warning_amber" size="16px" aria-hidden="true" />
              {{ data.unchecked }}
              {{ data.unchecked === 1 ? "package" : "packages" }} could not be
              checked in the last run
            </span>
          </div>

          <q-banner
            v-if="error && data"
            dense
            rounded
            class="rmm-banner-warning q-ma-sm"
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
                @click="load"
              />
            </template>
          </q-banner>
          <q-banner
            v-if="data?.truncated"
            dense
            rounded
            class="rmm-banner-warning q-ma-sm"
          >
            <template #avatar>
              <q-icon name="warning_amber" color="warning" />
            </template>
            Showing the first {{ findings.length }} of {{ data.count }}
            findings, worst first.
          </q-banner>
        </div>
      </template>

      <template #no-data>
        <EmptyState
          v-if="error && !data"
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
            @click="load"
          />
        </EmptyState>
        <template v-else-if="data">
          <EmptyState
            v-if="!data.supported"
            icon="desktop_access_disabled"
            title="This device is not covered"
            :text="
              data.reason ||
              'Its operating system or distribution has no vulnerability source yet.'
            "
          />
          <EmptyState
            v-else-if="!data.last_scan"
            icon="manage_search"
            title="Not checked yet"
            text="The daily check has not reached this device yet. Scan now checks its inventory right away."
          >
            <q-btn
              unelevated
              dense
              no-caps
              color="primary"
              icon="manage_search"
              label="Scan now"
              :loading="scanning"
              @click="scan"
            />
          </EmptyState>
          <EmptyState
            v-else-if="!data.packages"
            icon="inventory_2"
            title="No package inventory"
            :text="
              data.reason ||
              'The device has not reported its installed packages yet. Refresh its software list, then scan again.'
            "
          >
            <q-btn
              outline
              dense
              no-caps
              color="primary"
              icon="inventory_2"
              label="Open software"
              :to="{ query: { ...route.query, tab: 'software' } }"
              replace
            />
          </EmptyState>
          <EmptyState
            v-else-if="!counts.all"
            icon="verified_user"
            title="No known vulnerabilities"
            :text="`None of the ${data.packages} checked items has a known vulnerability.`"
          />
          <EmptyState
            v-else-if="status === 'needs_update' && !search"
            icon="verified_user"
            title="Nothing needs an update"
            :text="`No finding has a fixed version yet. ${counts.no_fix} open ${counts.no_fix === 1 ? 'finding is' : 'findings are'} under No fix yet.`"
          >
            <q-btn
              outline
              dense
              no-caps
              color="primary"
              label="Show no fix yet"
              @click="status = 'no_fix'"
            />
          </EmptyState>
          <EmptyState
            v-else
            icon="filter_alt_off"
            title="No findings match"
            text="Show all statuses or clear the search to see every finding."
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
        </template>
      </template>
    </FindingsTable>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useStore } from "vuex";
import { useRoute } from "vue-router";
import { fetchAgentVulns, scanAgentVulns, toggleVulnIgnore } from "@/api/vulns";
import {
  SEVERITIES,
  severityMeta,
  STATUS_FILTERS,
  unmappedApps,
  type Finding,
  type Severity,
  type StatusFilter,
} from "@/utils/vulns";
import { relativeTime } from "@/utils/format";
import { notifySuccess } from "@/utils/notify";
import TabToolbar from "@/components/agents/TabToolbar.vue";
import EmptyState from "@/components/ui/EmptyState.vue";
import HelpTip from "@/components/ui/HelpTip.vue";
import FindingsTable from "@/components/vulns/FindingsTable.vue";
import SeverityPill from "@/components/vulns/SeverityPill.vue";

interface AgentVulns {
  supported: boolean;
  ecosystem: string | null;
  reason: string;
  last_scan: string | null;
  packages: number;
  unchecked: number;
  count: number;
  truncated: boolean;
  findings: Finding[];
  // over the device's whole set, independent of the filter
  counts: Record<
    "needs_update" | "no_fix" | "open" | "ignored" | "fixed" | "all",
    number
  >;
  // open findings with a fix available
  by_severity: Record<Severity, number>;
}

const NO_COUNTS = {
  needs_update: 0,
  no_fix: 0,
  open: 0,
  ignored: 0,
  fixed: 0,
  all: 0,
};
const NO_SEVERITIES = { critical: 0, high: 0, medium: 0, low: 0, unknown: 0 };

// other platforms get the Linux text
const COVERAGE_TEXT: Record<string, string> = {
  windows:
    "Pending Windows security updates are matched to CVEs through Microsoft MSRC and known third-party apps through NVD, once a day. Apps without a mapping are not checked.",
  darwin:
    "Known third-party apps are matched to CVEs through NVD once a day. Apps without a mapping are not checked.",
  freebsd:
    "Installed packages are checked with pkg audit against the FreeBSD VuXML database during each package scan on the device. VuXML has no severity scores, so findings show as Unknown.",
};
const COVERAGE = computed(
  () =>
    COVERAGE_TEXT[agentPlatform.value] ??
    "Installed distribution packages (dpkg, apk, rpm) are checked against OSV.dev once a day. Snap, flatpak and other binaries are not checked.",
);

const route = useRoute();
const store = useStore();
const formatDate = (value: string) => store.getters.formatDate(value);
const tabHeight = computed(() => store.state.tabHeight);
const agentPlatform = computed(() => store.state.agentPlatform);
const selectedAgent = computed(() => store.state.selectedRow);

const data = ref<AgentVulns | null>(null);
const loading = ref(false);
const error = ref<{ response?: { status?: number } } | null>(null);
const scanning = ref(false);
const busy = ref<number | null>(null);
const status = ref<StatusFilter>("needs_update");
const search = ref<string | null>("");
let generation = 0;
let followUp = 0;

const errorMessage = computed(() =>
  error.value?.response?.status === 403
    ? "Your role cannot view vulnerabilities of this device."
    : "Vulnerabilities could not be loaded.",
);

const unmapped = computed(() => unmappedApps(data.value) || 0);
const findings = computed(() => data.value?.findings ?? []);
const counts = computed(() => data.value?.counts ?? NO_COUNTS);
const bySeverity = computed(() => data.value?.by_severity ?? NO_SEVERITIES);
const summaryLevels = computed(() =>
  SEVERITIES.filter((level) => bySeverity.value[level] > 0),
);
const statusOptions = computed(() =>
  STATUS_FILTERS.map(({ value, label }) => ({
    value,
    label: `${label} ${counts.value[value || "all"]}`,
  })),
);

async function load() {
  const agentId = selectedAgent.value;
  if (!agentId) return;
  const request = ++generation;
  loading.value = true;
  const params: Record<string, string> = {};
  if (status.value) params.status = status.value;
  if (search.value?.trim()) params.search = search.value.trim();
  try {
    const result = await fetchAgentVulns(agentId, params);
    if (request !== generation) return;
    data.value = {
      ...result,
      findings: Array.isArray(result?.findings) ? result.findings : [],
      counts: { ...NO_COUNTS, ...result?.counts },
      by_severity: { ...NO_SEVERITIES, ...result?.by_severity },
    };
    error.value = null;
  } catch (e) {
    if (request === generation) error.value = e as typeof error.value;
  } finally {
    if (request === generation) loading.value = false;
  }
}

async function scan() {
  const agentId = selectedAgent.value;
  scanning.value = true;
  try {
    notifySuccess(await scanAgentVulns(agentId));
    // the check runs on the server; one follow-up reload picks up a quick result
    window.clearTimeout(followUp);
    followUp = window.setTimeout(() => {
      if (agentId === selectedAgent.value) void load();
    }, 10000);
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
    // the row may leave the filter and the counts change
    void load();
  } catch {
    // the response interceptor shows the error
  } finally {
    busy.value = null;
  }
}

function clearFilters() {
  status.value = "";
  search.value = "";
}

watch([status, search], () => void load());

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
.vulns-tab {
  min-width: 0;
  background: var(--rmm-surface);
}

.vulns-tab__search {
  width: min(240px, 40vw);
}

.vulns-tab__primary {
  padding: 2px 10px;
}

.vulns-summary {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 8px;
  padding: 8px 10px;
  border-bottom: 1px solid var(--rmm-border);
  font-size: var(--rmm-fs-sm);
}

.vulns-summary__label {
  color: var(--rmm-text-muted);
  font-weight: 600;
}

.vulns-summary__meta {
  margin-left: 4px;
  color: var(--rmm-text-muted);
}

.vulns-summary__warning {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--rmm-status-warning);
}
</style>
