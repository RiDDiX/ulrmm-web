<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <span v-if="shell" class="shell-chip">
    {{ label }}
    <q-tooltip>{{ tooltip || `Runs with ${label}` }}</q-tooltip>
  </span>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { shellLabel } from "@/utils/scriptLibrary";

const props = defineProps<{
  shell?: string;
  tooltip?: string;
}>();

const label = computed(() => shellLabel(props.shell));
</script>

<style scoped>
.shell-chip {
  display: inline-flex;
  min-height: 22px;
  align-items: center;
  padding: 1px 8px;
  border: 1px solid var(--rmm-border-strong);
  border-radius: 999px;
  color: var(--rmm-text-muted);
  background: var(--rmm-surface-2);
  font-size: var(--rmm-fs-xs);
  font-weight: 500;
  white-space: nowrap;
}
</style>
