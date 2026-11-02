<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-input
    outlined
    dense
    :model-value="modelValue"
    :type="shown ? 'text' : 'password'"
    @update:model-value="(v) => emit('update:modelValue', v)"
  >
    <template v-slot:append>
      <q-btn
        round
        dense
        flat
        size="sm"
        :icon="shown ? 'visibility_off' : 'visibility'"
        :aria-label="toggleLabel"
        @click="emit('update:shown', !shown)"
      >
        <q-tooltip>{{ toggleLabel }}</q-tooltip>
      </q-btn>
    </template>
  </q-input>
</template>

<script setup>
import { computed } from "vue";

// several fields can share `shown`
const props = defineProps({
  modelValue: String,
  shown: Boolean,
});
const emit = defineEmits(["update:modelValue", "update:shown"]);

const toggleLabel = computed(() =>
  props.shown ? "Hide password" : "Show password",
);
</script>
