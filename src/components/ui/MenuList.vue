<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <!-- one item list feeds both the context menu and the row actions menu -->
  <q-list dense style="min-width: 220px">
    <template v-for="(item, index) in items" :key="index">
      <q-separator v-if="item.separator" />
      <q-item-label v-else-if="item.header" header class="q-py-sm">
        {{ item.label }}
      </q-item-label>
      <q-item
        v-else
        clickable
        v-close-popup
        :disable="item.disabled"
        :class="{ 'text-negative': item.negative }"
        @click="item.action?.()"
      >
        <q-item-section
          v-if="item.icon"
          :side="!avatarIcons"
          :avatar="avatarIcons"
        >
          <q-icon
            :name="item.icon"
            :color="item.negative ? 'negative' : undefined"
          />
        </q-item-section>
        <q-item-section>
          <q-item-label>{{ item.label }}</q-item-label>
          <q-item-label v-if="item.caption" caption>
            {{ item.caption }}
          </q-item-label>
        </q-item-section>
      </q-item>
    </template>
    <template v-if="withClose">
      <q-separator />
      <q-item clickable v-close-popup>
        <q-item-section>Close</q-item-section>
      </q-item>
    </template>
  </q-list>
</template>

<script setup lang="ts">
import type { MenuItem } from "@/types/menu";

defineProps<{
  items: MenuItem[];
  withClose?: boolean;
  avatarIcons?: boolean;
}>();
</script>
