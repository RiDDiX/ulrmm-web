<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <div class="rule-builder">
    <div class="row items-center q-gutter-sm">
      <span id="rule-match-label" class="rmm-label">Devices must match</span>
      <q-btn-toggle
        :model-value="modelValue.match"
        :options="MATCH_OPTIONS"
        aria-labelledby="rule-match-label"
        no-caps
        unelevated
        toggle-color="primary"
        class="rule-builder__toggle"
        @update:model-value="emitRules({ match: $event })"
      />
    </div>

    <ol class="rule-builder__rows" aria-label="Conditions">
      <li
        v-for="(c, i) in modelValue.conditions"
        :key="keys[i]"
        class="rule-row"
        :class="{ 'rule-row--cf': c.field === 'custom_field' }"
      >
        <span class="rule-row__join rmm-muted">{{
          i === 0 ? "Where" : modelValue.match === "any" ? "or" : "and"
        }}</span>
        <q-select
          :model-value="c.field"
          :options="FIELD_OPTIONS"
          :aria-label="`Condition ${i + 1} field`"
          class="rule-row__field"
          emit-value
          map-options
          outlined
          dense
          options-dense
          @update:model-value="setField(i, $event)"
        />
        <q-select
          v-if="c.field === 'custom_field'"
          :model-value="c.custom_field"
          :options="customFieldOptions"
          :aria-label="`Condition ${i + 1} custom field`"
          label="Field"
          class="rule-row__field"
          emit-value
          map-options
          outlined
          dense
          options-dense
          @update:model-value="setCustomField(i, $event)"
        />
        <q-select
          :model-value="c.op"
          :options="opOptions(c.field)"
          :aria-label="`Condition ${i + 1} comparison`"
          class="rule-row__op"
          emit-value
          map-options
          outlined
          dense
          options-dense
          @update:model-value="setOp(i, $event)"
        />
        <div class="rule-row__value">
          <q-select
            v-if="valueKind(c) === 'choice'"
            :model-value="c.value"
            :options="CHOICES[c.field]"
            :multiple="c.op === 'in'"
            :use-chips="c.op === 'in'"
            :aria-label="`Condition ${i + 1} value`"
            :label="
              c.value === null || c.value?.length === 0 ? 'Value' : undefined
            "
            emit-value
            map-options
            outlined
            dense
            options-dense
            @update:model-value="setValue(i, $event)"
          />
          <rmm-select
            v-else-if="['client', 'site', 'tag'].includes(valueKind(c))"
            :model-value="c.value"
            :options="pickOptions[valueKind(c)]"
            :multiple="c.op === 'in'"
            :aria-label="`Condition ${i + 1} value`"
            :label="FIELDS[c.field].label"
            map-options
            filterable
            @update:model-value="setValue(i, $event)"
          />
          <q-select
            v-else-if="valueKind(c) === 'bool'"
            :model-value="c.value"
            :options="BOOL_OPTIONS"
            :aria-label="`Condition ${i + 1} value`"
            emit-value
            map-options
            outlined
            dense
            options-dense
            @update:model-value="setValue(i, $event)"
          />
          <q-input
            v-else
            :model-value="c.value ?? ''"
            :aria-label="`Condition ${i + 1} value`"
            :placeholder="FIELDS[c.field].hint || 'Value'"
            :maxlength="MAX_TEXT"
            outlined
            dense
            @update:model-value="setValue(i, $event)"
          />
        </div>
        <q-btn
          flat
          round
          dense
          icon="delete"
          class="rule-row__remove"
          :aria-label="`Remove condition ${i + 1}`"
          @click="removeCondition(i)"
        >
          <q-tooltip>Remove this condition</q-tooltip>
        </q-btn>
        <div v-if="rowError(c, i)" class="rule-row__error">
          {{ rowError(c, i) }}
        </div>
      </li>
    </ol>

    <div class="row items-center q-gutter-sm">
      <q-btn
        outline
        dense
        no-caps
        color="primary"
        icon="add"
        label="Add condition"
        class="q-pl-sm q-pr-md"
        :disable="modelValue.conditions.length >= MAX_CONDITIONS"
        @click="addCondition"
      />
      <span class="rmm-muted text-caption">
        {{ modelValue.conditions.length }} of {{ MAX_CONDITIONS }}
      </span>
    </div>
    <div v-if="showErrors && rulesError(modelValue)" class="rule-row__error">
      {{ rulesError(modelValue) }}
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from "vue";
import RmmSelect from "@/components/ui/RmmSelect.vue";
import {
  CHOICES,
  FIELDS,
  FIELD_OPTIONS,
  MAX_CONDITIONS,
  MAX_TEXT,
  conditionError,
  newCondition,
  opLabel,
  rulesError,
  withOp,
} from "@/utils/groupRules";

const props = defineProps({
  // {match, conditions}
  modelValue: { type: Object, required: true },
  // {clientOptions, siteOptions, tags, customFields}
  lookups: { type: Object, required: true },
  // every message, not only the rows already touched (after a save attempt)
  showErrors: { type: Boolean, default: false },
});
const emit = defineEmits(["update:modelValue"]);

const MATCH_OPTIONS = [
  { value: "all", label: "All conditions" },
  { value: "any", label: "Any condition" },
];
const BOOL_OPTIONS = [
  { value: true, label: "Yes" },
  { value: false, label: "No" },
];

// stable row keys; conditions have no ids
let nextKey = 0;
const keys = ref(props.modelValue.conditions.map(() => nextKey++));
const touched = ref(new Set());

const cfTypes = computed(() =>
  Object.fromEntries(props.lookups.customFields.map((f) => [f.id, f.type])),
);
const customFieldOptions = computed(() =>
  props.lookups.customFields.map((f) => ({ value: f.id, label: f.name })),
);
const pickOptions = computed(() => ({
  client: props.lookups.clientOptions,
  site: props.lookups.siteOptions,
  tag: props.lookups.tags.map((t) => ({ value: t.id, label: t.name })),
}));

function opOptions(field) {
  return FIELDS[field].ops.map((op) => ({
    value: op,
    label: opLabel(field, op),
  }));
}

// a checkbox custom field takes yes/no
function valueKind(c) {
  if (c.field === "custom_field")
    return cfTypes.value[c.custom_field] === "checkbox" ? "bool" : "text";
  return FIELDS[c.field].kind;
}

function rowError(c, i) {
  if (!props.showErrors && !touched.value.has(keys.value[i])) return "";
  return conditionError(c, cfTypes.value);
}

function emitRules(patch) {
  emit("update:modelValue", { ...props.modelValue, ...patch });
}

function setCondition(i, condition) {
  touched.value.add(keys.value[i]);
  const conditions = [...props.modelValue.conditions];
  conditions[i] = condition;
  emitRules({ conditions });
}

function setField(i, field) {
  setCondition(i, newCondition(field));
}

function setCustomField(i, id) {
  const checkbox = cfTypes.value[id] === "checkbox";
  setCondition(i, {
    ...props.modelValue.conditions[i],
    custom_field: id,
    op: "eq",
    value: checkbox ? true : "",
  });
}

function setOp(i, op) {
  setCondition(i, withOp(props.modelValue.conditions[i], op));
}

function setValue(i, value) {
  setCondition(i, { ...props.modelValue.conditions[i], value });
}

function addCondition() {
  keys.value.push(nextKey++);
  emitRules({
    conditions: [...props.modelValue.conditions, newCondition("plat")],
  });
}

function removeCondition(i) {
  keys.value.splice(i, 1);
  emitRules({
    conditions: props.modelValue.conditions.filter((_, n) => n !== i),
  });
}
</script>

<style scoped>
.rule-builder {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.rule-builder__toggle {
  border: 1px solid var(--rmm-border-strong);
  border-radius: var(--rmm-radius-sm);
}

.rule-builder__rows {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.rule-row {
  display: grid;
  grid-template-columns:
    48px minmax(150px, 1fr) minmax(130px, 0.8fr) minmax(160px, 1.4fr)
    auto;
  align-items: start;
  gap: 8px;
  padding: 8px;
  border: 1px solid var(--rmm-border);
  border-radius: var(--rmm-radius-sm);
  background: var(--rmm-surface-2);
}

/* one more column for the custom field picker */
.rule-row--cf {
  grid-template-columns:
    48px minmax(130px, 1fr) minmax(130px, 1fr) minmax(110px, 0.7fr)
    minmax(140px, 1.2fr) auto;
}

.rule-row__join {
  padding-top: 9px;
  font-size: var(--rmm-fs-xs);
  font-weight: 600;
  text-align: right;
}

/* centred on the 40px dense fields */
.rule-row__remove {
  margin-top: 3px;
  color: var(--rmm-text-muted);
}

.rule-row__error {
  grid-column: 2 / -1;
  color: var(--rmm-status-negative);
  font-size: var(--rmm-fs-xs);
}

@media (max-width: 760px) {
  .rule-row,
  .rule-row--cf {
    grid-template-columns: minmax(0, 1fr) auto;
  }
  .rule-row__join {
    grid-column: 1 / -1;
    padding: 0;
    text-align: left;
  }
  .rule-row > :not(.rule-row__join):not(.rule-row__remove) {
    grid-column: 1;
  }
  .rule-row__remove {
    grid-column: 2;
    grid-row: 1;
  }
  .rule-row__error {
    grid-column: 1 / -1;
  }
}
</style>
