<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <div>
    <AgentIdentityBar
      :hostname="identity.hostname"
      :client="identity.client"
      :site="identity.site"
      :status="identity.status"
      :power-event="identity.power"
      tool="Remote Background"
    />
    <q-tabs
      v-model="tab"
      align="left"
      indicator-color="primary"
      class="remote-bg-tabs"
      dense
      active-color="primary"
      narrow-indicator
      inline-label
    >
      <q-tab
        v-for="t in tabs"
        :key="t.name"
        :name="t.name"
        :icon="t.icon"
        :label="t.label"
      />
    </q-tabs>
    <q-separator />
    <q-tab-panels v-model="tab">
      <q-tab-panel name="terminal" class="q-pa-none">
        <EmptyState
          v-if="consoleLocked"
          icon="lock"
          title="The terminal is locked"
          text="Opening a terminal needs a two-factor code. It stays unlocked for 60 minutes."
        >
          <q-btn v-bind="unlockBtn" @click="unlockConsole" />
        </EmptyState>
        <TerminalManager
          v-else-if="terminalMode === 'new'"
          :agent_id="agent_id"
          :agentPlatform="platform"
          :terminalDefaults="terminalDefaults"
          @connect-failed="relockConsole"
        />
        <EmptyState
          v-else-if="meshError"
          icon="error_outline"
          title="Could not load the terminal session"
          :text="meshErrorText"
        >
          <q-btn v-bind="retryBtn" @click="unlockConsole" />
        </EmptyState>
        <iframe
          v-else
          :src="terminal"
          :style="frameStyle"
          title="Remote terminal"
          allow="clipboard-read; clipboard-write"
        ></iframe>
      </q-tab-panel>
      <q-tab-panel name="filebrowser" class="q-pa-none">
        <EmptyState
          v-if="consoleLocked"
          icon="lock"
          title="The file browser is locked"
          text="Browsing files needs a two-factor code. It stays unlocked for 60 minutes."
        >
          <q-btn v-bind="unlockBtn" @click="unlockConsole" />
        </EmptyState>
        <EmptyState
          v-else-if="meshError"
          icon="error_outline"
          title="Could not load the file browser session"
          :text="meshErrorText"
        >
          <q-btn v-bind="retryBtn" @click="unlockConsole" />
        </EmptyState>
        <iframe
          v-else
          :src="file"
          :style="frameStyle"
          title="Remote file browser"
          allow="clipboard-read; clipboard-write"
        ></iframe>
      </q-tab-panel>
      <q-tab-panel v-if="isWindows || posix" name="services" class="q-pa-none">
        <NixServicesManager v-if="posix" :agent_id="agent_id" />
        <ServicesManager
          v-else
          :agent_id="agent_id"
          :agentPlatform="platform"
        />
      </q-tab-panel>
      <q-tab-panel name="processes" class="q-pa-none">
        <ProcessManager :agent_id="agent_id" />
      </q-tab-panel>
      <q-tab-panel v-if="isWindows" name="eventlog" class="q-pa-none">
        <EventLogManager :agent_id="agent_id" :agentPlatform="platform" />
      </q-tab-panel>
      <q-tab-panel v-if="posix" name="logs" class="q-pa-none">
        <NixLogViewer :agent_id="agent_id" :agentPlatform="platform" />
      </q-tab-panel>
      <q-tab-panel v-if="isWindows" name="registry" class="q-pa-none">
        <RegistryManager :agent_id="agent_id" />
      </q-tab-panel>
    </q-tab-panels>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { useMeta, useQuasar } from "quasar";

import {
  fetchAgentMeshCentralURLs,
  fetchAgentMeshConsoleURLs,
  fetchAgentTerminalDefaults,
  meshFailure,
} from "@/api/agents";
import { fetchConsoleStepUp } from "@/api/accounts";
import { fetchDashboardInfo } from "@/api/core";
import { ensureConsoleStepUp } from "@/composables/accounts";
import { notifyError, notifyWarning } from "@/utils/notify";
import { deviceName } from "@/utils/deviceName";

import ProcessManager from "@/components/agents/remotebg/ProcessManager.vue";
import ServicesManager from "@/components/agents/remotebg/ServicesManager.vue";
import NixServicesManager from "@/components/agents/remotebg/NixServicesManager.vue";
import NixLogViewer from "@/components/agents/remotebg/NixLogViewer.vue";
import EventLogManager from "@/components/agents/remotebg/EventLogManager.vue";
import RegistryManager from "@/components/agents/remotebg/RegistryManager.vue";
import TerminalManager from "@/components/agents/remotebg/TerminalManager.vue";
import AgentIdentityBar from "@/components/ui/AgentIdentityBar.vue";
import EmptyState from "@/components/ui/EmptyState.vue";

const $q = useQuasar();
const route = useRoute();

const agent_id = computed(() => route.params.agent_id);
// a link without ?agentPlatform falls back to the plat the terminal
// defaults report; the terminal waits for them anyway
const platform = ref(route.query.agentPlatform);
const isWindows = computed(() => platform.value === "windows");
const posix = computed(() =>
  ["linux", "darwin", "freebsd"].includes(platform.value),
);

const unlockBtn = {
  unelevated: true,
  "no-caps": true,
  color: "primary",
  icon: "lock_open",
  label: "Unlock",
};
const retryBtn = {
  outline: true,
  "no-caps": true,
  color: "primary",
  icon: "refresh",
  label: "Retry",
};

const tab = ref("terminal");
const terminalMode = ref("legacy");
const meshError = ref(false);
const meshErrorText = ref("");
const terminalDefaults = ref(null);
const terminal = ref("");
const file = ref("");
const consoleLocked = ref(true);
const identity = ref({ hostname: "", client: "", site: "", status: "" });

const tabs = computed(() =>
  [
    { name: "terminal", icon: "fas fa-terminal", label: "Terminal" },
    { name: "filebrowser", icon: "far fa-folder-open", label: "File Browser" },
    isWindows.value || posix.value
      ? { name: "services", icon: "fas fa-cogs", label: "Services" }
      : null,
    { name: "processes", icon: "fas fa-chart-area", label: "Processes" },
    isWindows.value
      ? { name: "eventlog", icon: "fas fa-clipboard-list", label: "Event Log" }
      : null,
    posix.value
      ? { name: "logs", icon: "fas fa-clipboard-list", label: "Logs" }
      : null,
    isWindows.value
      ? { name: "registry", icon: "mdi-file-tree", label: "Registry" }
      : null,
  ].filter(Boolean),
);

const frameStyle = computed(() => ({
  height: `${$q.screen.height - 71}px`,
  width: `${$q.screen.width}px`,
}));

async function loadIdentity() {
  try {
    const data = await fetchAgentMeshCentralURLs(route.params.agent_id);
    const hostname = deviceName(data);
    identity.value = {
      hostname,
      client: data.client,
      site: data.site,
      status: data.status,
      power: data,
    };
    useMeta({
      title: `${hostname} - ${data.client} - ${data.site} | Remote Background`,
    });
  } catch (e) {
    console.error(e);
  }
}

// both terminals and the file browser need the step-up
async function unlockConsole() {
  meshError.value = false;
  try {
    if (!(await ensureConsoleStepUp($q))) return;
    consoleLocked.value = false;
    const urls = await fetchAgentMeshConsoleURLs(route.params.agent_id);
    terminal.value = urls.terminal;
    file.value = urls.file;
  } catch (e) {
    console.error(e);
    meshErrorText.value = meshFailure(e);
    meshError.value = true;
  }
}

// after 60 min the next open asks again
async function relockConsole() {
  if (consoleLocked.value) return;
  try {
    const { remaining } = await fetchConsoleStepUp();
    if (remaining > 0) return;
  } catch (e) {
    console.error(e);
    return;
  }
  consoleLocked.value = true;
  unlockConsole();
}

watch(tab, (name) => {
  if (name === "terminal" || name === "filebrowser") relockConsole();
});

async function applyTheme() {
  try {
    const info = await fetchDashboardInfo();
    $q.loadingBar.setDefaults({ size: "0px" });
    $q.dark.set(info.dark_mode);
  } catch (err) {
    console.error(err);
  }
}

async function loadTerminalMode() {
  const legacyNote =
    "New terminal mode requires agent version 2.11.0 or higher. Reverting to legacy terminal mode. Please update the agent to use the new terminal.";
  try {
    const defaults = await fetchAgentTerminalDefaults(route.params.agent_id);
    terminalDefaults.value = defaults;
    platform.value ||= defaults?.plat;

    // agents older than the new terminal cannot honour the setting
    const wanted = defaults?.terminal_mode === "new";
    const capable = defaults?.supports_new_terminal === true;
    terminalMode.value = wanted && capable ? "new" : "legacy";
    if (wanted && !capable) notifyWarning(legacyNote, 6000);
  } catch (err) {
    terminalMode.value = "legacy";
    notifyError(
      err?.response?.data?.detail || "Failed to load terminal settings",
    );
  }
}

onMounted(() => {
  applyTheme();
  loadIdentity();
  loadTerminalMode();
  unlockConsole();
});
</script>

<style scoped>
.remote-bg-tabs {
  background: var(--rmm-surface);
}

/* Quasar's 24px dwarfs the labels */
.remote-bg-tabs :deep(.q-tab__icon) {
  font-size: 18px;
}
</style>
