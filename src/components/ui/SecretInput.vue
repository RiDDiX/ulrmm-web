<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-input
    outlined
    dense
    :model-value="modelValue"
    @update:model-value="$emit('update:modelValue', $event as string)"
    :type="visible ? 'text' : 'password'"
    :readonly="clear"
    :placeholder="
      stored && !clear ? 'Leave empty to keep the stored value' : ''
    "
    :hint="hint"
  >
    <template v-slot:append>
      <q-btn
        v-if="clear"
        flat
        dense
        no-caps
        size="sm"
        label="Undo"
        aria-label="Keep the stored value"
        @click="$emit('update:clear', false)"
      >
        <q-tooltip>Keep the stored value instead of removing it</q-tooltip>
      </q-btn>
      <template v-else>
        <q-btn
          round
          dense
          flat
          size="sm"
          :icon="visible ? 'visibility_off' : 'visibility'"
          :aria-label="visible ? 'Hide secret' : 'Show secret'"
          @click="visible = !visible"
        >
          <q-tooltip>{{ visible ? "Hide secret" : "Show secret" }}</q-tooltip>
        </q-btn>
        <q-btn
          v-if="stored"
          round
          dense
          flat
          size="sm"
          icon="delete_outline"
          aria-label="Remove the stored value"
          @click="onClear"
        >
          <q-tooltip
            >Remove the stored value when you save; Undo keeps it</q-tooltip
          >
        </q-btn>
      </template>
    </template>
  </q-input>
</template>

<script setup lang="ts">
// One masked input for every stored secret (ADM-15): show/hide toggle with a
// named aria-label, and a "stored" hint driven by the server's *_set flag
// instead of relying on the placeholder alone, which disappears once the
// field is focused. An empty submit keeps the stored value; removing it is a
// separate, undoable decision that the caller sends as the field's *_clear
// flag on save.
import { computed, ref } from "vue";

const props = defineProps<{
  modelValue: string;
  stored?: boolean;
  clear?: boolean;
}>();
const emit = defineEmits<{
  (e: "update:modelValue", value: string): void;
  (e: "update:clear", value: boolean): void;
}>();

const visible = ref(false);

const hint = computed(() => {
  if (props.clear) return "The stored value is removed when you save.";
  return props.stored ? "A value is stored on the server." : undefined;
});

function onClear() {
  emit("update:modelValue", "");
  emit("update:clear", true);
}
</script>
