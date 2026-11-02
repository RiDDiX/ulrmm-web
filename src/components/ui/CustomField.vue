<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-input
    v-if="field.type === 'text' || field.type === 'number'"
    ref="input"
    :class="longTextClass"
    :type="field.type === 'text' ? 'text' : 'number'"
    :label="field.name"
    :hint="hint"
    :model-value="modelValue"
    :rules="[...validationRules]"
    v-bind="look"
    reactive-rules
    lazy-rules
    :autogrow="field.type === 'text'"
    @update:model-value="relay"
  />

  <div v-else-if="field.type === 'checkbox'">
    <q-toggle
      ref="input"
      :label="field.name"
      :model-value="modelValue"
      @update:model-value="relay"
    />
    <div v-if="hint" class="custom-field__hint">
      {{ hint }}
    </div>
  </div>

  <q-input
    v-else-if="field.type === 'datetime'"
    ref="input"
    type="datetime-local"
    :label="field.name"
    :hint="hint"
    :model-value="modelValue"
    :rules="[...validationRules]"
    stack-label
    v-bind="look"
    reactive-rules
    lazy-rules
    @update:model-value="relay"
  />

  <q-select
    v-else-if="field.type === 'single' || field.type === 'multiple'"
    ref="input"
    :label="field.name"
    :hint="hint"
    :options="field.options"
    :multiple="field.type === 'multiple'"
    :model-value="modelValue"
    :rules="[...validationRules]"
    v-bind="look"
    reactive-rules
    lazy-rules
    clearable
    @update:model-value="relay"
  />
</template>

<script setup>
import { computed, ref } from "vue";
import { truncateText } from "@/utils/format";

defineOptions({ name: "CustomField" });

const props = defineProps(["field", "modelValue"]);
const emit = defineEmits(["update:modelValue"]);

const input = ref(null);
const look = { outlined: true, dense: true };
const relay = (value) => emit("update:modelValue", value);

// parents call validate() on the field through its template ref
defineExpose({ validate: (...args) => input.value.validate(...args) });

const hint = computed(() => {
  const f = props.field;
  let value;
  if (f.type === "multiple") {
    value = f.default_values_multiple?.length
      ? `Default value: ${f.default_values_multiple}`
      : "";
  } else if (f.type === "checkbox") {
    value = f.default_value_bool
      ? `Default value: ${f.default_value_bool}`
      : "";
  } else {
    value = f.default_value_string
      ? `Default value: ${f.default_value_string}`
      : "";
  }
  return value.length > 100 ? truncateText(value, 100) : value;
});

const longTextClass = computed(() => {
  const f = props.field;
  return (f.default_value_string ?? "").length >= 130 ? "q-mb-xl q-mt-xl" : "";
});

const validationRules = computed(() =>
  props.field.required
    ? [(val) => !isEmpty(val) || `${props.field.name} is required`]
    : [],
);

// 0 is a value for a number field, an empty list is none for a multiple one
const isEmpty = (val) => val == null || val.length === 0;
</script>

<style scoped>
.custom-field__hint {
  padding-left: 10px;
  color: var(--rmm-text-muted);
  font-size: var(--rmm-fs-xs);
}
</style>
