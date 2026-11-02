<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <div class="settings-panel-header">
    <div class="settings-panel-header__copy">
      <div class="settings-panel-header__title">
        {{ title }}
        <span
          v-if="count !== undefined"
          class="settings-panel-header__count rmm-num"
          >{{ count }}</span
        >
      </div>
      <div v-if="text" class="settings-panel-header__text">{{ text }}</div>
    </div>
    <div v-if="$slots.default" class="settings-panel-header__actions">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
// Global Settings tab: title, one line on what it does, actions.
defineProps<{
  title: string;
  text?: string;
  count?: number;
}>();
</script>

<style scoped>
.settings-panel-header {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--rmm-border);
}

/* actions drop below the text once it would get narrower than 240px */
.settings-panel-header__copy {
  flex: 1 1 240px;
  min-width: 0;
}

.settings-panel-header__title {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--rmm-text);
  font-size: var(--rmm-fs-lg);
  font-weight: 600;
  letter-spacing: -0.01em;
  line-height: 1.3;
}

.settings-panel-header__count {
  padding: 0 8px;
  border-radius: 999px;
  color: var(--rmm-text-muted);
  background: var(--rmm-surface-3);
  font-size: var(--rmm-fs-xs);
  font-weight: 600;
  line-height: 20px;
}

.settings-panel-header__text {
  margin-top: 2px;
  color: var(--rmm-text-muted);
  font-size: var(--rmm-fs-sm);
  line-height: 1.4;
}

.settings-panel-header__actions {
  display: flex;
  flex-shrink: 0;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
</style>
