<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-card-actions align="right">
    <q-btn flat label="Cancel" :dense="dense" v-close-popup />
    <q-btn
      v-if="!noSubmit"
      type="submit"
      :color="color"
      unelevated
      :dense="dense"
      :icon="icon"
      :label="label"
      :disable="disable"
      :loading="loading"
    />
  </q-card-actions>
</template>

<script setup>
// Cancel and the submit button at the foot of a form dialog
defineProps({
  label: { type: String, default: "Save" },
  disable: Boolean,
  loading: Boolean,
  dense: Boolean,
  noSubmit: Boolean,
  icon: String,
  color: { type: String, default: "primary" },
});
</script>
