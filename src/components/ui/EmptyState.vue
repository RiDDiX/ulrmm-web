<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <div class="empty-state">
    <q-icon :name="icon" size="40px" />
    <div class="empty-state__title">{{ title }}</div>
    <div class="empty-state__text">{{ text }}</div>
    <div v-if="$slots.default" class="empty-state__actions">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  icon: string;
  title: string;
  text: string;
}>();
</script>

<style scoped>
.empty-state {
  display: flex;
  min-height: 180px;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 8px;
  padding: 24px;
  color: var(--rmm-text-subtle);
  text-align: center;
}

.empty-state__title {
  color: var(--rmm-text);
  font-size: var(--rmm-fs-md);
  font-weight: 600;
}

.empty-state__text {
  max-width: 440px;
  color: var(--rmm-text-muted);
}

.empty-state__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
  margin-top: 4px;
}
</style>
