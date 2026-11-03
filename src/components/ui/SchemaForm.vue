<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-card-section
    v-for="(f, i) in shownFields"
    :key="f.key"
    :class="compact && i < shownFields.length - 1 && gapBelow(f)"
  >
    <slot
      :name="`field-${f.key}`"
      :field="f"
      :model="modelValue"
      :set="(v) => set(f.key, v)"
    >
      <q-select
        v-if="f.type === 'select'"
        outlined
        dense
        :label="f.label"
        :hint="f.hint"
        :rules="f.rules"
        :disable="f.disable"
        :readonly="f.readonly"
        :options="f.options"
        :option-label="f.optionLabel"
        :option-value="f.optionValue"
        :multiple="f.multiple"
        :map-options="isObjectList(f.options)"
        :emit-value="isObjectList(f.options)"
        :model-value="modelValue[f.key]"
        @update:model-value="(v) => set(f.key, v)"
        v-bind="f.props"
      />

      <q-option-group
        v-else-if="f.type === 'options'"
        :options="f.options"
        :disable="f.disable"
        :model-value="modelValue[f.key]"
        @update:model-value="(v) => set(f.key, v)"
        v-bind="f.props"
      />

      <div v-else-if="f.type === 'toggle' || f.type === 'checkbox'">
        <component
          :is="f.type === 'toggle' ? QToggle : QCheckbox"
          :label="f.label"
          :disable="f.disable"
          :model-value="modelValue[f.key]"
          @update:model-value="(v) => set(f.key, v)"
          v-bind="f.props"
        />
        <div v-if="f.hint" :class="`schema-form__hint--${f.type}`">
          {{ f.hint }}
        </div>
      </div>

      <q-input
        v-else
        outlined
        dense
        :label="f.label"
        :hint="f.hint"
        :rules="f.rules"
        :disable="f.disable"
        :readonly="f.readonly"
        :type="inputType(f)"
        :stack-label="f.type in dateTypes"
        :model-value="modelValue[f.key]"
        @update:model-value="(v) => set(f.key, v)"
        v-bind="f.props"
      >
        <template v-if="f.type === 'password'" v-slot:append>
          <q-btn
            round
            dense
            flat
            size="sm"
            :icon="revealed[f.key] ? 'visibility_off' : 'visibility'"
            :aria-label="revealLabel(f)"
            @click="revealed[f.key] = !revealed[f.key]"
          >
            <q-tooltip>{{ revealLabel(f) }}</q-tooltip>
          </q-btn>
        </template>
      </q-input>
    </slot>
  </q-card-section>
</template>

<script setup>
// the caller keeps q-form, the card and the buttons
import { computed, reactive } from "vue";
import { QToggle, QCheckbox } from "quasar";

const props = defineProps({
  fields: { type: Array, required: true },
  modelValue: { type: Object, required: true },
  // every section but the last drops its bottom padding, see gapBelow
  compact: { type: Boolean, default: false },
});
const emit = defineEmits(["update:modelValue"]);

const dateTypes = { date: "date", time: "time", datetime: "datetime-local" };
const revealed = reactive({});

const shownFields = computed(() =>
  props.fields.filter((f) => !f.show || f.show(props.modelValue)),
);

function set(key, value) {
  emit("update:modelValue", { ...props.modelValue, [key]: value });
}

// a dialog drops the top padding of every section after the first, so a
// hint would touch the next field
const gapBelow = (f) => (f.hint ? "q-pb-sm" : "q-pb-none");

function isObjectList(options) {
  return typeof options?.[0] === "object";
}

function inputType(f) {
  if (f.type === "password") return revealed[f.key] ? "text" : "password";
  return dateTypes[f.type] || f.type || "text";
}

// f.secret names the thing being hidden, "password" when unset
function revealLabel(f) {
  return `${revealed[f.key] ? "Hide" : "Show"} ${f.secret || "password"}`;
}
</script>

<style scoped>
.schema-form__hint--toggle,
.schema-form__hint--checkbox {
  padding-left: 56px;
  color: var(--rmm-text-muted);
  font-size: var(--rmm-fs-xs);
  line-height: 1.4;
}

.schema-form__hint--checkbox {
  padding-left: 40px;
}
</style>
