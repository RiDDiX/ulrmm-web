<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-card-actions align="right">
    <q-btn flat label="Cancel" @click="emit('cancel')" />
    <q-btn
      type="submit"
      :label="submitLabel"
      color="primary"
      :unelevated="true"
      :loading="loading"
    />
  </q-card-actions>
</template>

<script setup>
defineProps({
  submitLabel: { type: String, default: "Save" },
  loading: { type: Boolean, default: false },
});
const emit = defineEmits(["cancel"]);
</script>
