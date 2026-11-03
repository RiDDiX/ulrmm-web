<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <div>
    <slot />
    <q-tooltip v-if="offline && offlineTip">{{ offlineTip }}</q-tooltip>
    <q-tooltip v-else-if="hint" anchor="center right" self="center left">
      {{ hint }}
    </q-tooltip>
  </div>
</template>

<script setup>
defineProps({
  offline: Boolean,
  offlineTip: String,
  hint: String,
});
</script>
