<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <div v-if="!selectedAgent" class="q-pa-sm rmm-muted">No agent selected</div>
  <EmptyState
    v-else-if="agentPlatform.toLowerCase() !== 'windows'"
    icon="desktop_access_disabled"
    title="Assets are collected on Windows only"
    text="Hardware details of Linux, macOS and FreeBSD agents are on the summary."
  />
  <div v-else-if="loading" class="q-pa-md flex flex-center">
    <q-spinner color="primary" size="2em" />
  </div>
  <LoadFailed
    v-else-if="error && !hasAssets"
    title="Unable to load assets"
    :message="errorMessage"
    @retry="load"
  />
  <EmptyState
    v-else-if="!hasAssets"
    icon="inventory"
    title="No inventory collected yet"
    text="Use Re-collect on the summary to ask the agent for its hardware details."
  />
  <div v-else class="assets-tab">
    <StaleBanner
      v-if="error"
      :message="errorMessage"
      :loaded-at="lastLoadedAt"
      :format-date="formatDate"
      @retry="load"
    />
    <q-tabs
      v-model="tab"
      class="assets-tab__nav"
      active-color="primary"
      indicator-color="primary"
      align="left"
      dense
      narrow-indicator
      outside-arrows
      mobile-arrows
      no-caps
    >
      <q-tab
        v-for="s in sections"
        :key="s.name"
        :name="s.name"
        :label="s.label"
      >
        <q-tooltip v-if="s.tip">{{ s.tip }}</q-tooltip>
      </q-tab>
    </q-tabs>

    <q-separator />

    <q-tab-panels v-model="tab">
      <q-tab-panel v-for="s in sections" :key="s.name" :name="s.name">
        <WmiDetail :info="assets[s.name]" />
      </q-tab-panel>
    </q-tab-panels>
  </div>
</template>

<script setup>
import { ref, computed } from "vue";
import { useAgentTab } from "@/components/agents/useAgentTab";
import WmiDetail from "@/components/agents/WmiDetail.vue";
import { fetchAgent } from "@/api/agents";
import EmptyState from "@/components/ui/EmptyState.vue";
import StaleBanner from "@/components/agents/StaleBanner.vue";
import LoadFailed from "@/components/agents/LoadFailed.vue";

defineOptions({ name: "AssetsTab" });

// one tab per wmi_detail key, in display order
const sections = [
  { name: "os", label: "Operating system" },
  { name: "cpu", label: "CPU" },
  { name: "mem", label: "Memory" },
  { name: "usb", label: "USB" },
  { name: "bios", label: "BIOS" },
  { name: "disk", label: "Disks" },
  {
    name: "comp_sys",
    label: "Computer system",
    tip: "Make, model, domain and memory of the computer",
  },
  { name: "base_board", label: "Motherboard" },
  {
    name: "comp_sys_prod",
    label: "Computer system product",
    tip: "Vendor, product name, UUID and identifying number",
  },
  { name: "network_config", label: "Network config" },
  { name: "graphics", label: "Graphics" },
  { name: "desktop_monitor", label: "Monitors" },
  { name: "network_adapter", label: "Network adapters" },
];

const assets = ref({});
const tab = ref("os");

const hasAssets = computed(() => {
  const found = assets.value;
  if (!found || typeof found !== "object") return false;
  return Object.values(found).some((v) => (Array.isArray(v) ? v.length : !!v));
});

const {
  selectedAgent,
  agentPlatform,
  formatDate,
  loading,
  error,
  errorMessage,
  lastLoadedAt,
  load,
} = useAgentTab({
  fetch: async (agentId) => (await fetchAgent(agentId)).wmi_detail,
  accept: (detail) => (assets.value = detail || {}),
  clear: () => (assets.value = {}),
  forbidden: "Your role cannot view assets for this agent.",
  failed: "Asset inventory could not be loaded.",
});
</script>

<style scoped>
.assets-tab {
  background: var(--rmm-surface);
}

.assets-tab__nav :deep(.q-tab) {
  padding: 0 10px;
}

/* Quasar sets 14px on the label itself, so the tab's own size never
   reached it and the thirteen sections ran behind the scroll arrows at 1440 px */
.assets-tab__nav :deep(.q-tab__label) {
  font-size: var(--rmm-fs-xs);
}
</style>
