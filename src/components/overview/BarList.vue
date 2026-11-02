<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <ul class="bar-list">
    <li v-for="row in rows" :key="row.key" class="bar-row">
      <div class="bar-row__head">
        <q-icon
          v-if="row.icon"
          :name="row.icon"
          size="16px"
          class="bar-row__icon"
          aria-hidden="true"
        />
        <router-link
          v-if="row.to"
          :to="row.to"
          class="bar-row__label rmm-link"
          :title="row.label"
          >{{ row.label }}</router-link
        >
        <span v-else class="bar-row__label" :title="row.label">{{
          row.label
        }}</span>
        <span class="bar-row__value">{{ row.text }}</span>
      </div>
      <div
        class="bar-row__track"
        :title="row.detail || undefined"
        aria-hidden="true"
      >
        <div
          class="bar-row__fill"
          :class="row.level && `bar-row__fill--${row.level}`"
          :style="{ width: `${width(row.fraction)}%` }"
        />
      </div>
      <div v-if="row.sub" class="bar-row__sub">{{ row.sub }}</div>
    </li>
  </ul>
</template>

<script setup lang="ts">
import type { RouteLocationRaw } from "vue-router";

export interface BarRow {
  key: string;
  label: string;
  // 0..1 of the track
  fraction: number;
  // the value as text, always shown
  text: string;
  icon?: string;
  to?: RouteLocationRaw;
  sub?: string;
  detail?: string;
  level?: "warning" | "negative" | null;
}

defineProps<{ rows: BarRow[] }>();

// above zero still draws at least a 2% bar
function width(fraction: number) {
  if (!Number.isFinite(fraction) || fraction <= 0) return 0;
  return Math.max(2, Math.min(100, fraction * 100));
}
</script>

<style scoped>
/* minmax(0) so a long nowrap line ellipses instead of widening the card */
.bar-list {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.bar-row__head {
  display: flex;
  align-items: baseline;
  gap: 6px;
  min-width: 0;
  font-size: var(--rmm-fs-sm);
}

.bar-row__icon {
  align-self: center;
  color: var(--rmm-text-subtle);
}

.bar-row__label {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  color: var(--rmm-text);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bar-row__label.rmm-link {
  color: var(--rmm-accent-text);
}

.bar-row__value {
  flex-shrink: 0;
  color: var(--rmm-text);
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}

.bar-row__track {
  height: 8px;
  margin-top: 4px;
  overflow: hidden;
  border-radius: 0 4px 4px 0;
  background: var(--rmm-bar-track);
}

.bar-row__fill {
  height: 100%;
  border-radius: 0 4px 4px 0;
  background: var(--rmm-accent);
}

.bar-row__fill--warning {
  background: var(--rmm-dot-warning);
}

.bar-row__fill--negative {
  background: var(--rmm-status-negative);
}

.bar-row__sub {
  margin-top: 2px;
  overflow: hidden;
  color: var(--rmm-text-muted);
  font-size: var(--rmm-fs-xs);
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
