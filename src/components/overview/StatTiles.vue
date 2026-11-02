<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <dl class="stat-tiles">
    <div
      v-for="tile in tiles"
      :key="tile.label"
      class="stat-tile"
      :class="{ 'stat-tile--muted': tile.muted }"
    >
      <dt class="stat-tile__label">
        <span
          v-if="tile.dot"
          class="stat-tile__dot"
          :style="{ background: tile.dot }"
          aria-hidden="true"
        />{{ tile.label }}
      </dt>
      <dd class="stat-tile__value">
        <button
          v-if="tile.onClick"
          type="button"
          class="stat-tile__button"
          :aria-label="`${tile.label}: ${formatCount(tile.value)}. ${tile.action}`"
          @click="tile.onClick"
        >
          {{ formatCount(tile.value) }}
          <q-tooltip>{{ tile.action }}</q-tooltip>
        </button>
        <template v-else>{{ formatCount(tile.value) }}</template>
      </dd>
      <dd v-if="tile.hint" class="stat-tile__hint">{{ tile.hint }}</dd>
    </div>
  </dl>
</template>

<script setup lang="ts">
import { formatCount } from "@/utils/overview";

export interface Tile {
  label: string;
  value: number | null | undefined;
  // css colour of the state dot
  dot?: string;
  hint?: string;
  // zero that needs no attention
  muted?: boolean;
  onClick?: () => void;
  action?: string;
}

defineProps<{ tiles: Tile[] }>();
</script>

<style scoped>
.stat-tiles {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(104px, 1fr));
  gap: 8px;
  margin: 0;
}

.stat-tile {
  min-width: 0;
  padding: 10px 12px;
  border: 1px solid var(--rmm-border);
  border-radius: var(--rmm-radius);
  background: var(--rmm-surface-2);
}

.stat-tile dd {
  margin: 0;
}

.stat-tile__label {
  color: var(--rmm-text-muted);
  font-size: var(--rmm-fs-xs);
  line-height: 1.35;
  overflow-wrap: anywhere;
}

.stat-tile__dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  margin-right: 6px;
  border-radius: 50%;
  vertical-align: 0;
}

.stat-tile__value {
  color: var(--rmm-text);
  font-size: 1.375rem;
  font-weight: 600;
  line-height: 1.3;
}

.stat-tile--muted .stat-tile__value {
  color: var(--rmm-text-muted);
}

.stat-tile__button {
  padding: 0;
  border: 0;
  border-radius: 4px;
  color: var(--rmm-accent-text);
  background: none;
  font: inherit;
  cursor: pointer;
}

.stat-tile__button:hover {
  text-decoration: underline;
}

.stat-tile__button:focus-visible {
  outline: 2px solid var(--rmm-focus);
  outline-offset: 2px;
}

.stat-tile__hint {
  color: var(--rmm-text-muted);
  font-size: var(--rmm-fs-xs);
  overflow-wrap: anywhere;
}
</style>
