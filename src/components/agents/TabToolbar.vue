<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <div class="rmm-toolbar full-width tab-toolbar">
    <div class="tab-toolbar__title">
      {{ title }}
      <span v-if="count !== null" class="tab-toolbar__count rmm-num">
        {{ count }}
      </span>
    </div>
    <slot />
  </div>
</template>

<script setup>
// Agent-tab header: title, count, slot for that tab's actions.
defineProps({
  title: { type: String, required: true },
  count: { type: Number, default: null },
});
</script>

<style scoped>
.tab-toolbar {
  flex-wrap: wrap;
}

.tab-toolbar__title {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-right: 8px;
  color: var(--rmm-text);
  font-size: var(--rmm-fs-md);
  font-weight: 600;
  white-space: nowrap;
}

.tab-toolbar__count {
  min-width: 22px;
  padding: 0 7px;
  border-radius: 999px;
  color: var(--rmm-text-muted);
  background: var(--rmm-surface-3);
  font-size: var(--rmm-fs-xs);
  line-height: 20px;
  text-align: center;
}
</style>
