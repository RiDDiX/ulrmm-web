<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-input
    outlined
    dense
    :label="label"
    :hint="hint"
    :model-value="modelValue"
    @update:model-value="(v) => emit('update:modelValue', v)"
  >
    <template v-slot:after>
      <q-btn
        round
        dense
        flat
        size="sm"
        :icon="icon"
        :aria-label="ariaLabel"
        @click="openURL(url)"
      >
        <q-tooltip>{{ tip }}</q-tooltip>
      </q-btn>
    </template>
  </q-input>
</template>

<script setup>
import { openURL } from "quasar";

defineProps({
  modelValue: String,
  label: String,
  hint: String,
  icon: String,
  ariaLabel: String,
  tip: String,
  url: String,
});
const emit = defineEmits(["update:modelValue"]);
</script>
