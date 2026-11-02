<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <div>
    <div class="rmm-label">{{ title }}</div>
    <q-option-group
      v-model="picked"
      :options="options"
      :aria-label="ariaLabel || title"
      class="q-pl-sm"
      color="primary"
      inline
      dense
    />
  </div>
</template>

<script setup>
defineProps({
  options: { type: Array, required: true },
  title: { type: String, required: true },
  ariaLabel: String,
});
const picked = defineModel();
</script>
