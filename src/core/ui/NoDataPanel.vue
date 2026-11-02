<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <div
    v-if="!loading"
    class="full-width column flex-center q-gutter-sm q-py-md"
  >
    <template v-if="error">
      <q-icon name="error_outline" color="negative" size="24px" />
      <div>{{ error }}</div>
      <q-btn
        outline
        dense
        color="primary"
        label="Retry"
        @click="emit('retry')"
      />
    </template>
    <EmptyState
      v-else
      class="full-width"
      :icon="icon"
      :title="title"
      :text="text"
    >
      <template v-if="$slots.default" #default><slot /></template>
    </EmptyState>
  </div>
</template>

<script setup>
import EmptyState from "@/components/ui/EmptyState.vue";

// Body of a table's no-data slot: a retry prompt when loading failed,
// otherwise the empty state (its action buttons go in the default slot).
defineProps({
  loading: Boolean,
  error: String,
  icon: String,
  title: String,
  text: String,
});
const emit = defineEmits(["retry"]);
</script>
