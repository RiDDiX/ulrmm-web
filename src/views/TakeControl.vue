<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <div>
    <AgentIdentityBar
      :hostname="identity.hostname"
      :client="identity.client"
      :site="identity.site"
      :status="status"
      :power-event="identity.power"
      tool="Take Control"
    />
    <q-bar class="take-control-bar">
      <span class="take-control-bar__hint rmm-muted">Desktop not loading?</span>
      <q-btn
        v-if="plat === 'windows'"
        v-bind="barBtn"
        color="primary"
        label="Restart connection"
        icon="refresh"
        @click="restartMeshService"
      >
        <q-tooltip>Restart the Mesh Agent service on the device</q-tooltip>
      </q-btn>
      <q-btn
        v-bind="barBtn"
        :color="negativeColor"
        label="Recover connection"
        icon="fas fa-first-aid"
        @click="repairMeshCentral"
      >
        <q-tooltip
          >Reinstall the Mesh Agent (Windows) or restart it (Linux, macOS,
          FreeBSD) if a restart does not help</q-tooltip
        >
      </q-btn>
    </q-bar>
    <div v-if="headless" class="take-control-notice" role="status">
      <q-icon name="terminal" size="18px" class="rmm-muted" />
      <span v-if="desktop">
        This server has no graphical desktop, so the desktop view may stay
        empty.
      </span>
      <span v-else>
        This server has no graphical desktop, so a text console opens instead.
      </span>
      <q-btn
        v-if="!desktop && !terminal"
        v-bind="noticeBtn"
        label="Unlock console"
        @click="unlockConsole"
      >
        <q-tooltip>Enter a two-factor code to open the console</q-tooltip>
      </q-btn>
      <q-btn
        v-bind="noticeBtn"
        :label="toggleLabel"
        :aria-label="toggleLabel"
        @click="desktop = !desktop"
      >
        <q-tooltip>{{
          desktop
            ? "Switch back to the text console"
            : "Open the remote desktop view instead of the console"
        }}</q-tooltip>
      </q-btn>
    </div>
    <div
      class="q-video"
      :style="{ height: `${$q.screen.height - (headless ? 103 : 67)}px` }"
    >
      <iframe
        v-show="frameSrc"
        :src="frameSrc"
        :title="headless && !desktop ? 'Remote console' : 'Remote desktop'"
        frameborder="0"
        allowfullscreen
        allow="clipboard-read; clipboard-write"
      ></iframe>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from "vue";
import { useStore } from "vuex";
import { useRoute } from "vue-router";
import { useQuasar, useMeta } from "quasar";

import {
  fetchAgentMeshCentralURLs,
  fetchAgentMeshConsoleURLs,
  sendAgentRecoverMesh,
} from "@/api/agents";
import { fetchDashboardInfo } from "@/api/core";
import { sendAgentServiceAction } from "@/api/services";
import { ensureConsoleStepUp } from "@/composables/accounts";
import { notifySuccess } from "@/utils/notify";
import { deviceName } from "@/utils/deviceName";
import AgentIdentityBar from "@/components/ui/AgentIdentityBar.vue";

const $q = useQuasar();
const store = useStore();
const route = useRoute();

const barBtn = { outline: true, dense: true, "no-caps": true, size: "sm" };
const noticeBtn = {
  flat: true,
  dense: true,
  "no-caps": true,
  color: "primary",
};

const negativeColor = computed(() => store.state.dash_negative_color);

const status = ref(null);
// restarting the service by name works on Windows only
const plat = ref("");
const identity = ref({ hostname: "", client: "", site: "" });
const control = ref("");
const terminal = ref("");
// linux servers without a graphical session open the console instead
const headless = ref(false);
const desktop = ref(false);

const frameSrc = computed(() =>
  headless.value && !desktop.value ? terminal.value : control.value,
);
const toggleLabel = computed(() =>
  desktop.value ? "Back to console" : "Try desktop anyway",
);

async function loadMeshUrls() {
  $q.loading.show();
  try {
    const data = await fetchAgentMeshCentralURLs(route.params.agent_id);
    const hostname = deviceName(data);
    control.value = data.control;
    headless.value = data.display === "absent";
    status.value = data.status;
    plat.value = data.plat;
    identity.value = {
      hostname,
      client: data.client,
      site: data.site,
      power: data,
    };
    useMeta({
      title: `${hostname} - ${data.client} - ${data.site} | Take Control`,
    });
  } catch (e) {
    console.error(e);
  }
  $q.loading.hide();
  if (headless.value) await unlockConsole();
}

// mesh terminal, after the step-up
async function unlockConsole() {
  try {
    if (!(await ensureConsoleStepUp($q))) return;
    const urls = await fetchAgentMeshConsoleURLs(route.params.agent_id);
    terminal.value = urls.terminal;
  } catch (e) {
    console.error(e);
  }
}

async function applyTheme() {
  const info = await fetchDashboardInfo();
  $q.dark.set(info.dark_mode);
  $q.loadingBar.setDefaults({ color: info.loading_bar_color });
}

// failures are only logged here
async function withOverlay(message, action) {
  $q.loading.show({ message });
  try {
    await action();
  } catch (err) {
    console.error(err);
  } finally {
    $q.loading.hide();
  }
}

function repairMeshCentral() {
  control.value = "";
  terminal.value = "";
  return withOverlay("Attempting to repair Mesh Agent", async () => {
    const message = await sendAgentRecoverMesh(route.params.agent_id);
    await loadMeshUrls();
    setTimeout(() => notifySuccess(message), 500);
  });
}

function restartMeshService() {
  return withOverlay("Restarting Mesh Agent", async () => {
    const body = { sv_action: "restart" };
    await sendAgentServiceAction(route.params.agent_id, "mesh agent", body);
    setTimeout(() => notifySuccess("Mesh agent service was restarted"), 500);
  });
}

onMounted(() => {
  store.dispatch("getDashInfo", false);
  applyTheme();
  loadMeshUrls();
});
</script>

<style scoped>
.take-control-bar {
  justify-content: center;
  gap: 8px;
  border-bottom: 1px solid var(--rmm-border);
  color: var(--rmm-text);
  background: var(--rmm-surface-2);
}

.take-control-bar__hint {
  font-size: var(--rmm-fs-xs);
}

.take-control-notice {
  display: flex;
  min-height: 36px;
  align-items: center;
  gap: 10px;
  padding: 0 12px;
  border-bottom: 1px solid var(--rmm-border);
  color: var(--rmm-text);
  background: var(--rmm-accent-soft);
  font-size: var(--rmm-fs-sm);
}
</style>
