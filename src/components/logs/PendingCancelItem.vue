<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-item
    v-close-popup
    clickable
    class="text-negative"
    :disable="row.status === 'completed'"
  >
    <q-item-section side>
      <q-icon name="fas fa-trash-alt" size="xs" color="negative" />
    </q-item-section>
    <q-item-section>
      <q-item-label>Cancel action</q-item-label>
      <q-item-label caption>{{ caption }}</q-item-label>
    </q-item-section>
  </q-item>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({ row: { type: Object, required: true } });

const caption = computed(() => {
  if (props.row.status === "completed") return "Already ran";
  if (props.row.action_type === "schedreboot")
    return "Deletes the scheduled reboot on the device";
  return "Removes it from the queue";
});
</script>
