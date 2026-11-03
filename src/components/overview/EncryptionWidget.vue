<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <EmptyState
    v-if="!data.agents"
    icon="lock"
    title="No devices yet"
    text="Encryption states show up once devices report them."
  />
  <div v-else class="encryption-widget">
    <StatTiles :tiles="tiles" />
    <p class="widget-note">
      Counted from the last collection per device. Recovery keys are escrowed
      for BitLocker; FileVault keys after a rotation.
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import EmptyState from "@/components/ui/EmptyState.vue";
import StatTiles from "./StatTiles.vue";
import { STATE_DOT } from "@/utils/overview";

const props = defineProps<{
  data: {
    agents: number;
    encrypted: number;
    not_encrypted: number;
    unknown: number;
    keys_escrowed: number;
  };
}>();

const tiles = computed(() => [
  { label: "Encrypted", value: props.data.encrypted, dot: STATE_DOT.positive },
  {
    label: "Not encrypted",
    value: props.data.not_encrypted,
    dot: STATE_DOT.warning,
  },
  { label: "Not reported", value: props.data.unknown, dot: STATE_DOT.neutral },
  { label: "Keys escrowed", value: props.data.keys_escrowed },
]);
</script>

<style scoped>
.encryption-widget {
  display: grid;
  gap: 10px;
}
</style>
