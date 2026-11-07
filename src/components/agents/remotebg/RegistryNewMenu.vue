<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-item :style="itemStyle" clickable>
    <q-item-section>New</q-item-section>
    <q-item-section side><q-icon name="chevron_right" /></q-item-section>
    <q-menu v-bind="flyout">
      <q-list dense style="min-width: 220px">
        <q-item
          v-for="entry in registryValueTypes"
          :key="entry.type"
          v-close-popup
          clickable
          @click="emit('pick', entry.type)"
        >
          <q-item-section>{{ entry.label }}</q-item-section>
        </q-item>
      </q-list>
    </q-menu>
  </q-item>
</template>

<script setup lang="ts">
import { registryValueTypes } from "@/constants/constants";

withDefaults(defineProps<{ itemStyle?: string }>(), {
  itemStyle: "padding-right: 4px !important",
});
const flyout = {
  anchor: "top end",
  self: "top start",
  transitionShow: "jump-right",
  transitionHide: "jump-left",
} as const;
const emit = defineEmits<{ (e: "pick", type: string): void }>();
</script>
