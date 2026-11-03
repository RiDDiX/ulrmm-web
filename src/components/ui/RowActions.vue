<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-btn
    flat
    round
    dense
    size="sm"
    icon="more_vert"
    :aria-label="label"
    @click.stop
  >
    <q-tooltip v-if="!open">{{ label }}</q-tooltip>
    <!-- long menus on the last rows flip up; capped so they stay on screen -->
    <q-menu
      v-model="open"
      anchor="bottom right"
      self="top right"
      max-height="70vh"
    >
      <slot />
    </q-menu>
  </q-btn>
</template>

<script>
export default {
  name: "RowActions",
  props: {
    label: {
      type: String,
      required: true,
    },
  },
  data() {
    return {
      open: false,
    };
  },
};
</script>
