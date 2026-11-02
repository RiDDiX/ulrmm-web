<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <div v-if="!selectedAgent" class="q-pa-sm rmm-muted">No agent selected</div>
  <div v-else>
    <DebugLog :agent="selectedAgent" :tab-height="tabHeight" />
  </div>
</template>

<script setup>
import { computed } from "vue";
import { useStore } from "vuex";
import DebugLog from "@/components/logs/DebugLog.vue";

defineOptions({ name: "DebugTab" });

const store = useStore();
const selectedAgent = computed(() => store.state.selectedRow);
const tabHeight = computed(() => store.state.tabHeight);
</script>
