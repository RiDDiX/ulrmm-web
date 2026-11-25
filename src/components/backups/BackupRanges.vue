<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<script setup>
import { rangeText } from "./backups";

const props = defineProps({
  modelValue: { type: Array, default: () => [] },
  disabled: Boolean,
  // bandwidth rules carry a rate in kbps
  kbps: Boolean,
  max: { type: Number, default: 28 },
  label: { type: String, required: true },
});
const emit = defineEmits(["update:modelValue"]);
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(
  (label, index) => ({ label, value: index + 1 }),
);

const change = (index, patch) =>
  emit(
    "update:modelValue",
    props.modelValue.map((range, i) =>
      i === index ? { ...range, ...patch } : range,
    ),
  );
const add = () =>
  emit("update:modelValue", [
    ...props.modelValue,
    {
      days: [1, 2, 3, 4, 5],
      start: "22:00",
      end: "06:00",
      ...(props.kbps ? { kbps: 2000 } : {}),
    },
  ]);
const remove = (index) =>
  emit(
    "update:modelValue",
    props.modelValue.filter((_, i) => i !== index),
  );
</script>

<template>
  <div role="group" :aria-label="label">
    <div
      v-for="(range, index) in modelValue"
      :key="index"
      class="row items-center q-gutter-xs q-mb-xs"
    >
      <q-option-group
        :model-value="range.days"
        :options="DAYS"
        type="checkbox"
        inline
        dense
        :disable="disabled"
        :aria-label="`Days of ${label} ${index + 1}`"
        @update:model-value="change(index, { days: $event })"
      />
      <q-input
        :model-value="range.start"
        type="time"
        dense
        outlined
        label="From"
        :disable="disabled"
        @update:model-value="change(index, { start: $event })"
      />
      <q-input
        :model-value="range.end"
        type="time"
        dense
        outlined
        label="To"
        :disable="disabled"
        @update:model-value="change(index, { end: $event })"
      />
      <q-input
        v-if="kbps"
        :model-value="range.kbps"
        type="number"
        min="0"
        max="10000000"
        dense
        outlined
        label="kbps, 0 = unlimited"
        :disable="disabled"
        @update:model-value="change(index, { kbps: Number($event) })"
      />
      <q-btn
        flat
        dense
        round
        size="sm"
        icon="delete_outline"
        :aria-label="`Remove ${label} ${index + 1}`"
        :disable="disabled"
        @click="remove(index)"
      />
      <span class="text-caption rmm-muted">{{ rangeText(range) }}</span>
    </div>
    <q-btn
      flat
      dense
      no-caps
      icon="add"
      :label="`Add ${label}`"
      :disable="disabled || modelValue.length >= max"
      @click="add"
    />
  </div>
</template>
