// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

import { computed, onMounted, ref, watch } from "vue";
import { useStore } from "vuex";

// replies for another agent or an outdated reload are dropped
export function useAgentTab({ fetch, accept, clear, forbidden, failed }) {
  const store = useStore();
  const formatDate = computed(() => store.getters.formatDate);
  const [selectedAgent, tabHeight, agentPlatform] = [
    "selectedRow",
    "tabHeight",
    "agentPlatform",
  ].map((key) => computed(() => store.state[key]));

  const loading = ref(false);
  const error = ref(null);
  const lastLoadedAt = ref(null);
  let generation = 0;

  const errorMessage = computed(() => {
    if (!error.value) return "";
    return error.value?.response?.status === 403 ? forbidden : failed;
  });

  async function load() {
    const agentId = selectedAgent.value;
    if (!agentId) return;
    const mine = ++generation;
    const stillWanted = () =>
      mine === generation && agentId === selectedAgent.value;
    loading.value = true;
    try {
      const result = await fetch(agentId);
      if (!stillWanted()) return;
      accept(result);
      error.value = null;
      lastLoadedAt.value = new Date();
    } catch (e) {
      console.error(e);
      if (stillWanted()) error.value = e;
    } finally {
      if (stillWanted()) loading.value = false;
    }
  }

  watch(selectedAgent, (agentId) => {
    generation += 1;
    clear();
    error.value = null;
    lastLoadedAt.value = null;
    if (agentId) load();
  });

  onMounted(() => {
    if (selectedAgent.value) load();
  });

  return {
    selectedAgent,
    tabHeight,
    agentPlatform,
    formatDate,
    loading,
    error,
    errorMessage,
    lastLoadedAt,
    load,
  };
}
