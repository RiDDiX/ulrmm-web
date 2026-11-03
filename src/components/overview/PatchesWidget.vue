<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <div class="patches-widget">
    <StatTiles :tiles="tiles" />
    <p v-if="!data.pending_updates" class="widget-note">
      No approved updates are waiting to install.
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import StatTiles from "./StatTiles.vue";
import { STATE_DOT } from "@/utils/overview";

const props = defineProps<{
  data: {
    pending_agents: number;
    failed_agents: number;
    pending_updates: number;
    failed_updates: number;
  };
}>();

const devices = (n: number) => `on ${n} ${n === 1 ? "device" : "devices"}`;

// failed updates are approved ones that are not installed yet too
const tiles = computed(() => [
  {
    label: "Failed",
    value: props.data.failed_updates,
    dot: props.data.failed_updates ? STATE_DOT.negative : undefined,
    hint: devices(props.data.failed_agents),
    muted: !props.data.failed_updates,
  },
  {
    label: "Waiting to install",
    value: props.data.pending_updates,
    dot: props.data.pending_updates ? STATE_DOT.warning : undefined,
    hint: devices(props.data.pending_agents),
    muted: !props.data.pending_updates,
  },
]);
</script>

<style scoped>
.patches-widget {
  display: grid;
  gap: 10px;
}
</style>
