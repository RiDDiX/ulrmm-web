<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-card-actions align="right">
    <slot />
    <q-space v-if="$slots.default" />
    <q-btn v-close-popup flat label="Cancel" />
    <q-btn
      :label="label"
      :loading="loading"
      :disable="disable"
      :icon-right="iconRight"
      :type="submit ? 'submit' : 'button'"
      color="primary"
      unelevated
      @click="$emit('go')"
    />
  </q-card-actions>
</template>

<script setup>
defineProps({
  label: { type: String, required: true },
  loading: Boolean,
  disable: Boolean,
  iconRight: String,
  // a submit button leaves the work to the surrounding q-form
  submit: { type: Boolean, default: true },
});
defineEmits(["go"]);
</script>
