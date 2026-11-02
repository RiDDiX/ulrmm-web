<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <EmptyState
    v-if="!text.trim()"
    icon="sticky_note_2"
    title="No note yet"
    text="Keep reminders, contacts or runbook pointers here."
  >
    <q-btn
      outline
      dense
      no-caps
      color="primary"
      class="q-px-sm"
      label="Write a note"
      @click="emit('edit')"
    />
  </EmptyState>
  <div v-else class="notes-widget">{{ text }}</div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import EmptyState from "@/components/ui/EmptyState.vue";
import type { Widget } from "@/utils/overview";

const props = defineProps<{ widget: Widget }>();
const emit = defineEmits<{ edit: [] }>();

const text = computed(() =>
  typeof props.widget.settings.text === "string"
    ? props.widget.settings.text
    : "",
);
</script>

<style scoped>
.notes-widget {
  color: var(--rmm-text);
  font-size: var(--rmm-fs-md);
  line-height: 1.5;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}
</style>
