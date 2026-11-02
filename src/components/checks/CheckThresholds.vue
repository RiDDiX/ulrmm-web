<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-card-section class="q-gutter-y-sm">
    <div class="rmm-label">{{ heading }}</div>
    <q-input
      v-for="f in fields"
      :key="f.key"
      v-model.number="s[f.key]"
      type="number"
      :label="f.label"
      :hint="f.hint"
      :rules="customRules || rules"
      reactive-rules
      dense
      outlined
      hide-bottom-space
    />
  </q-card-section>
</template>

<script setup>
import { toRef } from "vue";

// `falling` flips the order check for free-space style values
const props = defineProps({
  state: { type: Object, required: true },
  heading: { type: String, default: "Thresholds" },
  fields: { type: Array, required: true },
  falling: Boolean,
  customRules: Array,
});

const s = toRef(props, "state");

const ordered = (warn, err) => (props.falling ? warn >= err : warn <= err);
const orderMsg = props.falling
  ? "Warning threshold must be more than error threshold"
  : "Warning threshold must be less than error threshold";

const rules = [
  (val) => val >= 0 || "Minimum threshold is 0",
  (val) => val < 100 || "Maximum threshold is 99",
  () =>
    s.value.warning_threshold > 0 ||
    s.value.error_threshold > 0 ||
    "Set a warning or error threshold",
  () =>
    s.value.warning_threshold === 0 ||
    s.value.error_threshold === 0 ||
    ordered(s.value.warning_threshold, s.value.error_threshold) ||
    orderMsg,
];
</script>
