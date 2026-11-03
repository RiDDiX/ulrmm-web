<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <div
    v-if="selectedAgent"
    class="column no-wrap"
    :style="{ height: tabHeight, overflow: 'auto' }"
  >
    <LocalAdminCard :agent-id="selectedAgent" class="q-ma-sm col-auto" />
    <VaultPanel
      scope="agent"
      :scope-key="selectedAgent"
      :style="{ flex: '1 0 320px', minHeight: 0 }"
    />
  </div>
</template>

<script setup>
import { computed } from "vue";
import { useStore } from "vuex";
import VaultPanel from "@/components/vault/VaultPanel.vue";
import LocalAdminCard from "@/components/laps/LocalAdminCard.vue";

const store = useStore();
const selectedAgent = computed(() => store.state.selectedRow);
const tabHeight = computed(() => store.state.tabHeight);
</script>
