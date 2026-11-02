<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-banner dense rounded class="rmm-banner-warning q-mb-sm">
    <template #avatar>
      <q-icon name="warning_amber" color="warning" />
    </template>
    {{ message }} Showing the last successful result from
    {{ formatDate(loadedAt) }}.
    <template #action>
      <q-btn
        flat
        dense
        no-caps
        color="primary"
        label="Retry"
        @click="$emit('retry')"
      />
    </template>
  </q-banner>
</template>

<script setup>
defineProps({
  message: String,
  loadedAt: [Date, Number, String],
  formatDate: { type: Function, required: true },
});
defineEmits(["retry"]);
</script>
