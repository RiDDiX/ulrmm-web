<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-list dense :style="{ minWidth: `${width}px` }">
    <template v-for="(item, i) in entries" :key="item.label">
      <q-separator v-if="i > 0 && item.gap" />
      <!-- a wrapper keeps the tooltip alive while the item is disabled -->
      <div v-if="item.tip">
        <RowMenuEntry :item="item" />
        <q-tooltip>{{ item.tip }}</q-tooltip>
      </div>
      <RowMenuEntry v-else :item="item" />
    </template>
  </q-list>
</template>

<script setup>
import { computed } from "vue";
import RowMenuEntry from "./RowMenuEntry.vue";

// Row actions as a menu list. Each item is { label, icon, run, danger, gap,
// caption, disable, tip }; gap draws a separator above it, tip is a tooltip
// (shown on hover even while the item is disabled). withClose appends a Close
// entry (context menus), which only dismisses the menu.
const props = defineProps({
  items: { type: Array, required: true },
  withClose: Boolean,
  width: { type: Number, default: 200 },
});

const entries = computed(() =>
  props.withClose
    ? [...props.items, { label: "Close", gap: true }]
    : props.items,
);
</script>
