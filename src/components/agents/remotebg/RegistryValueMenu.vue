<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-list dense style="min-width: 180px">
    <q-item v-close-popup clickable @click="emit('modify')">
      <q-item-section>Modify</q-item-section>
    </q-item>
    <q-item v-if="renamable" v-close-popup clickable @click="emit('rename')">
      <q-item-section>Rename</q-item-section>
    </q-item>
    <q-separator />
    <q-item
      v-close-popup
      clickable
      class="text-negative"
      @click="emit('remove')"
    >
      <q-item-section>Delete</q-item-section>
    </q-item>
  </q-list>
</template>

<script setup lang="ts">
defineProps<{ renamable: boolean }>();
const emit = defineEmits<{
  (e: "modify"): void;
  (e: "rename"): void;
  (e: "remove"): void;
}>();
</script>
