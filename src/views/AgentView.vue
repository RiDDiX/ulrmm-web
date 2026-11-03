<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-page :style-fn="pageStyle" class="device-page"><SummaryTab /></q-page>
</template>

<script setup>
import { useRoute } from "vue-router";
import { useStore } from "vuex";
import { provide, watch } from "vue";

import SummaryTab from "@/components/agents/SummaryTab.vue";

const store = useStore();
const route = useRoute();

// the action menu asks the dashboard to reload after an edit; on this
// page the summary is what needs reloading
provide("refreshDashboard", () => store.commit("setRefreshSummaryTab", true));

// the URL is the source of the selected agent; a change re-fetches
// through SummaryTab's selectedRow watcher. the param goes undefined
// while this view is being left, which must not clear the selection
// the dashboard is about to restore
watch(
  () => route.params.agent_id,
  (agentId) => {
    if (agentId) store.commit("setActiveRow", agentId);
  },
  { immediate: true },
);

// exactly the viewport minus the app header (and the offline banner
// when it shows), so the hero and the tab panel inside share the rest
function pageStyle(offset) {
  const height = `calc(100vh - ${offset}px)`;
  return { height, minHeight: height };
}
</script>

<style scoped>
/* the page only scrolls itself when a window is too short for the hero
   plus the panel minimum */
.device-page {
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  color: var(--rmm-text);
  background: var(--rmm-bg);
}
</style>
