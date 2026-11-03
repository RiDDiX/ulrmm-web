<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <EmptyState icon="error_outline" :title="title" :text="message">
    <q-btn
      outline
      dense
      no-caps
      color="primary"
      label="Retry"
      @click="$emit('retry')"
    />
  </EmptyState>
</template>

<script setup>
import EmptyState from "@/components/ui/EmptyState.vue";

defineProps({
  title: String,
  message: String,
});
defineEmits(["retry"]);
</script>
