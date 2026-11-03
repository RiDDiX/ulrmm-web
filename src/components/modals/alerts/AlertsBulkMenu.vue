<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-btn-dropdown flat no-caps label="Bulk Actions" :disable="!!blocker">
    <q-list dense>
      <q-item
        v-for="bulk in actions"
        :key="bulk.title"
        v-close-popup
        clickable
        @click="bulk.run(selected)"
      >
        <q-item-section avatar>
          <q-icon :name="bulk.icon" />
        </q-item-section>
        <q-item-section>
          <q-item-label>{{ bulk.title }}</q-item-label>
          <q-item-label caption>{{ bulk.caption }}</q-item-label>
        </q-item-section>
      </q-item>
    </q-list>
    <template #label>
      <q-tooltip v-if="blocker">{{ blocker }}</q-tooltip>
    </template>
  </q-btn-dropdown>
</template>

<script setup>
// bulk menu of the alerts overview; off while resolved alerts are loaded
// or nothing is selected, with the reason as tooltip
import { computed } from "vue";

const props = defineProps({
  actions: { type: Array, required: true },
  selected: { type: Array, required: true },
  resolvedLoaded: Boolean,
});

const blocker = computed(() => {
  if (props.resolvedLoaded)
    return "Turn off Include resolved to use bulk actions";
  if (props.selected.length === 0)
    return "Select alerts with the checkboxes first";
  return "";
});
</script>
