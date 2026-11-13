<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <div v-if="!selectedAgent" class="q-pa-sm rmm-muted">No agent selected</div>
  <div v-else class="software-tab">
    <AgentBaseline v-if="view === 'baseline'">
      <template #toolbar>
        <q-btn-toggle v-model="view" v-bind="VIEW_TOGGLE" />
      </template>
    </AgentBaseline>
    <StaleBanner
      v-else-if="error && software.length > 0"
      :message="errorMessage"
      :loaded-at="lastLoadedAt"
      :format-date="formatDate"
      @retry="load"
    />
    <q-table
      v-if="view !== 'baseline'"
      v-model:pagination="pagination"
      v-sortable-headers
      class="tabs-tbl-sticky rmm-table software-table"
      v-bind="denseTable"
      :loading="loading"
      :filter="filter"
      :sort-method="sortSoftware"
      :rows="software"
      :columns="tableColumns"
      :style="{ 'max-height': tabHeight }"
      row-key="name"
    >
      <template #loading>
        <q-inner-loading showing color="primary" />
      </template>

      <template #no-data>
        <div v-if="!loading" class="full-width">
          <LoadFailed
            v-if="error"
            title="Unable to load software"
            :message="errorMessage"
            @retry="load"
          />
          <EmptyState
            v-else-if="filter && software.length > 0"
            icon="filter_alt_off"
            title="No software matches your search"
            text="Clear the search to see the full inventory."
          >
            <q-btn
              label="Clear search"
              outline
              dense
              no-caps
              color="primary"
              @click="filter = ''"
            />
          </EmptyState>
          <EmptyState
            v-else
            icon="inventory_2"
            title="No software reported yet"
            text="Ask the agent for its installed software to fill this list."
          >
            <q-btn
              icon="cloud_sync"
              label="Refresh from agent"
              :loading="loading"
              color="primary"
              unelevated
              dense
              no-caps
              @click="refreshFromAgent"
            />
          </EmptyState>
        </div>
      </template>

      <template #top>
        <TabToolbar title="Software" :count="software.length">
          <q-btn-toggle
            v-if="hasBaselines"
            v-model="view"
            v-bind="VIEW_TOGGLE"
          />
          <q-btn
            v-if="windows"
            class="software-tab__primary"
            icon="add"
            label="Install software"
            color="primary"
            unelevated
            no-caps
            dense
            @click="openInstall"
          >
            <q-tooltip>Install a package from Chocolatey or winget</q-tooltip>
          </q-btn>
          <q-btn
            icon="cloud_sync"
            label="Refresh from agent"
            :loading="loading"
            dense
            flat
            no-caps
            @click="refreshFromAgent"
          >
            <q-tooltip v-if="!windows"
              >Queues a fresh inventory; the list updates once the agent checks
              in</q-tooltip
            >
            <q-tooltip v-else
              >Ask the agent for its installed software and reload the
              list</q-tooltip
            >
          </q-btn>

          <q-space />

          <q-input
            v-model="filter"
            class="software-search"
            placeholder="Search software"
            aria-label="Search software"
            outlined
            dense
            clearable
          >
            <template #prepend>
              <q-icon name="search" class="rmm-muted" />
            </template>
          </q-input>
          <ExportTableBtn :data="software" :columns="exportColumns" />
        </TabToolbar>
      </template>

      <template #body="tr">
        <q-tr :props="tr">
          <q-menu context-menu touch-position>
            <SoftwareRowMenu
              v-bind="menuProps(tr.row)"
              v-on="menuEvents(tr.row)"
            />
          </q-menu>

          <q-td v-for="column in tr.cols" :key="column.name" :props="tr">
            <q-btn
              v-if="column.name === 'actions'"
              :aria-label="`Actions for ${tr.row.name}`"
              icon="more_vert"
              size="sm"
              flat
              round
              dense
            >
              <q-tooltip v-if="menuRow !== tr.row"
                >Uninstall or copy details</q-tooltip
              >
              <q-menu
                anchor="bottom right"
                self="top right"
                @show="menuRow = tr.row"
                @hide="menuRow = null"
              >
                <SoftwareRowMenu
                  v-bind="menuProps(tr.row)"
                  v-on="menuEvents(tr.row)"
                />
              </q-menu>
            </q-btn>
            <span v-else :class="{ 'rmm-muted': isBlank(column.value) }">{{
              isBlank(column.value) ? "—" : column.value
            }}</span>
          </q-td>
        </q-tr>
      </template>
    </q-table>
  </div>
</template>

<script setup>
import { ref, computed, onBeforeUnmount, watch } from "vue";
import { useQuasar } from "quasar";
import { copyOutput } from "@/utils/helpers";
import { formatSoftwareDate, sortSoftware } from "@/utils/software";
import {
  uninstallAgentSoftware,
  fetchAgentSoftware,
  refreshAgentSoftware,
} from "@/api/software";
import { sortableHeaders as vSortableHeaders } from "@/utils/sortableHeaders";
import { notifySuccess } from "@/utils/notify";
import ConfirmSoftwareUninstall from "@/components/software/ConfirmSoftwareUninstall.vue";
import InstallSoftware from "@/components/software/InstallSoftware.vue";
import SoftwareRowMenu from "@/components/software/SoftwareRowMenu.vue";
import UninstallSoftware from "@/components/software/UninstallSoftware.vue";
import ExportTableBtn from "@/components/ui/ExportTableBtn.vue";
import EmptyState from "@/components/ui/EmptyState.vue";
import TabToolbar from "@/components/agents/TabToolbar.vue";
import { denseTable } from "@/components/agents/tableProps";
import StaleBanner from "@/components/agents/StaleBanner.vue";
import LoadFailed from "@/components/agents/LoadFailed.vue";
import { useAgentTab } from "@/components/agents/useAgentTab";
import AgentBaseline from "@/components/baselines/AgentBaseline.vue";

defineOptions({ name: "SoftwareTab" });

const col = (name, label, field, extra = {}) => ({
  name,
  label,
  field,
  align: "left",
  sortable: true,
  ...extra,
});
const windowsColumns = [
  col("name", "Name", "name"),
  col("publisher", "Publisher", "publisher"),
  col("version", "Version", "version"),
  col("install_date", "Installed on", "install_date", {
    format: formatSoftwareDate,
  }),
  col("size", "Size", "size", { align: "right" }),
  col("actions", "", () => "", { align: "right", sortable: false }),
];
// other platforms list the package source instead of a publisher
const posixColumns = windowsColumns.map((column) =>
  column.name === "publisher"
    ? { ...column, name: "source", label: "Source", field: "source" }
    : column,
);

const removableSources = {
  linux: ["dpkg", "rpm", "pacman", "apk", "flatpak", "snap"],
  darwin: ["brew", "brew-cask", "app"],
  freebsd: ["pkg"],
};

// the server only removes bundles that sit directly in /Applications
const appBundle = /^\/Applications\/[^/.][^/]*\.app$/;

function isRemovableAppBundle(location) {
  return (
    typeof location === "string" &&
    location.length <= 1024 &&
    appBundle.test(location) &&
    ![...location].some((char) => {
      const code = char.charCodeAt(0);
      return code < 32 || code === 127;
    })
  );
}

const $q = useQuasar();

const software = ref([]);
const filter = ref("");
// the row whose actions menu is open; the tooltip would cover it
const menuRow = ref(null);
const pagination = ref({ rowsPerPage: 0, sortBy: "name", descending: false });

const {
  selectedAgent,
  tabHeight,
  agentPlatform,
  formatDate,
  loading,
  error,
  errorMessage,
  lastLoadedAt,
  load,
} = useAgentTab({
  fetch: fetchAgentSoftware,
  accept: (rows) => (software.value = rows || []),
  clear: () => (software.value = []),
  forbidden: "Your role cannot view software for this agent.",
  failed: "Software inventory could not be loaded.",
});

const windows = computed(() => agentPlatform.value === "windows");

// installed software, or the baseline items of the agent (no FreeBSD)
const view = ref("installed");
const hasBaselines = computed(() => agentPlatform.value !== "freebsd");
const VIEW_TOGGLE = {
  options: [
    { value: "installed", label: "Installed" },
    { value: "baseline", label: "Baseline" },
  ],
  dense: true,
  noCaps: true,
  unelevated: true,
  toggleColor: "primary",
  padding: "3px 10px",
  role: "group",
  "aria-label": "Software view",
  class: "software-view",
};
const tableColumns = computed(() =>
  windows.value ? windowsColumns : posixColumns,
);
// the menu column holds no data; the uninstall command is export only
const exportColumns = computed(() => {
  const data = tableColumns.value.filter((c) => c.name !== "actions");
  return windows.value
    ? [...data, col("uninstall", "Uninstall", "uninstall", { sortable: false })]
    : data;
});

const isBlank = (value) =>
  value === null || value === undefined || value === "";

let reloadTimer = 0;
const clearReload = () => window.clearTimeout(reloadTimer);
watch(selectedAgent, clearReload);
onBeforeUnmount(clearReload);

async function refreshFromAgent() {
  const agentId = selectedAgent.value;
  loading.value = true;
  try {
    const result = await refreshAgentSoftware(agentId);
    if (windows.value && agentId === selectedAgent.value) {
      await load();
    } else if (result) {
      notifySuccess(result);
      // other platforms only queue the refresh; one reload later catches a
      // fast check-in without polling
      clearReload();
      reloadTimer = window.setTimeout(() => {
        if (agentId === selectedAgent.value) void load();
      }, 8000);
    }
  } catch {
    // the response interceptor shows the error
  } finally {
    loading.value = false;
  }
}

const openInstall = () =>
  $q.dialog({
    component: InstallSoftware,
    componentProps: { agent_id: selectedAgent.value },
  });

function uninstallState(row) {
  if (windows.value) {
    return typeof row.uninstall === "string" && row.uninstall.trim()
      ? { enabled: true, reason: "" }
      : { enabled: false, reason: "No uninstall command is available." };
  }
  const sources = removableSources[agentPlatform.value];
  if (!sources?.includes(row.source)) {
    return {
      enabled: false,
      reason: sources
        ? "This package source cannot be uninstalled."
        : "Uninstall is unavailable for this platform.",
    };
  }
  if (row.source === "app" && !isRemovableAppBundle(row.location)) {
    return {
      enabled: false,
      reason: "Only apps installed in /Applications can be removed.",
    };
  }
  return { enabled: true, reason: "" };
}

async function uninstall(agentId, payload) {
  loading.value = true;
  try {
    notifySuccess(await uninstallAgentSoftware(agentId, payload));
  } catch (e) {
    console.error(e);
  } finally {
    loading.value = false;
  }
}

function openUninstall(row) {
  if (!uninstallState(row).enabled) return;
  const agentId = selectedAgent.value;

  if (windows.value) {
    const lower = row.uninstall.toLowerCase();
    // any UI switch already there wins over /qn
    const hasUi = ["/qn", "/qb", "/qr", "/qf", "/quiet", "/passive"].some(
      (flag) => lower.includes(flag),
    );
    const silent = lower.includes("msiexec")
      ? [...(hasUi ? [] : ["/qn"]), "/norestart"].filter(
          (flag) => !lower.includes(flag),
        )
      : [];
    $q.dialog({
      component: UninstallSoftware,
      componentProps: {
        softwareName: row.name,
        initialUninstallString: [row.uninstall, ...silent].join(" "),
      },
    }).onOk((data) =>
      uninstall(agentId, {
        name: row.name,
        command: data.uninstallString,
        run_as_user: data.run_as_user,
        timeout: data.timeout,
      }),
    );
    return;
  }

  $q.dialog({
    component: ConfirmSoftwareUninstall,
    componentProps: { software: row },
  }).onOk(() =>
    // the same app name can exist in several places, the server picks the row
    // by name and location
    uninstall(agentId, {
      name: row.name,
      source: row.source,
      location: row.location,
    }),
  );
}

const menuProps = (row) => {
  const { enabled, reason } = uninstallState(row);
  return { uninstallEnabled: enabled, uninstallReason: reason };
};
const menuEvents = (row) => ({
  uninstall: () => openUninstall(row),
  copyName: () => copyOutput(row.name || ""),
  copyVersion: () => copyOutput(row.version || ""),
});
</script>

<style scoped>
.software-tab {
  min-width: 0;
  background: var(--rmm-surface);
}

.software-table :deep(.q-table__top) {
  padding: 0;
}

.software-view {
  margin-right: 8px;
  border: 1px solid var(--rmm-border-strong);
  border-radius: var(--rmm-radius-sm);
}

.software-search {
  width: min(260px, 45vw);
}

.software-tab__primary {
  padding: 2px 10px;
}

.software-table :deep(td:last-child),
.software-table :deep(th:last-child) {
  width: 42px;
}
</style>
