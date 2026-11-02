<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <div v-if="variables && variables.length" class="script-vars">
    <div class="script-vars__grid">
      <div
        v-for="v in variables"
        :key="v.name"
        class="script-vars__field"
        :class="{ 'script-vars__field--wide': v.type === 'text' }"
      >
        <div
          v-if="v.type === 'checkbox' && !asText(v)"
          class="script-vars__check"
        >
          <q-toggle
            :model-value="valueOf(v) === 'true'"
            :label="labelOf(v)"
            :disable="disable"
            dense
            @update:model-value="(val) => setValue(v, val ? 'true' : 'false')"
          />
          <span class="script-vars__hint">{{ hintOf(v) }}</span>
          <q-btn
            flat
            dense
            round
            size="sm"
            icon="data_object"
            :disable="disable"
            :aria-label="`Use a placeholder for ${v.label}`"
            @click="toggleText(v)"
          >
            <q-tooltip>{{ PLACEHOLDER_TIP }}</q-tooltip>
          </q-btn>
        </div>
        <q-select
          v-else-if="v.type === 'select' && !asText(v)"
          :model-value="valueOf(v) || null"
          :options="v.options || []"
          :label="labelOf(v)"
          :hint="hintOf(v)"
          hide-bottom-space
          :error="!!shownError(v)"
          :error-message="shownError(v)"
          :disable="disable"
          :clearable="!v.required"
          outlined
          dense
          options-dense
          @update:model-value="(val) => setValue(v, val ?? '')"
          @blur="touch(v)"
        >
          <template #after>
            <q-btn
              flat
              dense
              round
              size="sm"
              icon="data_object"
              :disable="disable"
              :aria-label="`Use a placeholder for ${v.label}`"
              @click="toggleText(v)"
            >
              <q-tooltip>{{ PLACEHOLDER_TIP }}</q-tooltip>
            </q-btn>
          </template>
        </q-select>
        <template v-else-if="v.type === 'password'">
          <q-input
            :model-value="valueOf(v)"
            :type="revealed.has(v.name) ? 'text' : 'password'"
            autocomplete="new-password"
            :label="labelOf(v)"
            :hint="hintOf(v)"
            hide-bottom-space
            :error="!!shownError(v)"
            :error-message="shownError(v)"
            :disable="disable"
            :input-class="revealed.has(v.name) ? 'script-vars__mono' : ''"
            outlined
            dense
            :data-password-var="v.name"
            @update:model-value="
              (val) => setValue(v, val == null ? '' : String(val))
            "
            @blur="touch(v)"
          >
            <template #append>
              <q-btn
                flat
                dense
                round
                size="sm"
                :icon="revealed.has(v.name) ? 'visibility_off' : 'visibility'"
                :disable="disable"
                :aria-label="`${revealed.has(v.name) ? 'Hide' : 'Show'} ${v.label}`"
                :aria-pressed="revealed.has(v.name)"
                @click="toggleReveal(v)"
              >
                <q-tooltip>{{
                  revealed.has(v.name) ? "Hide the value" : "Show the value"
                }}</q-tooltip>
              </q-btn>
            </template>
          </q-input>
          <div v-if="storedIn" class="script-vars__note">
            <q-icon name="info_outline" size="14px" />
            <span
              >Saved with the {{ storedIn }} and readable by anyone who can edit
              it; a <code>{{ GLOBAL_EXAMPLE }}</code> placeholder avoids
              that.</span
            >
          </div>
        </template>
        <q-input
          v-else
          :key="asText(v) ? 'text' : 'typed'"
          :model-value="valueOf(v)"
          :type="inputType(v)"
          :step="
            v.type === 'decimal'
              ? 'any'
              : v.type === 'integer'
                ? '1'
                : undefined
          "
          :autogrow="v.type === 'text' && !asText(v)"
          :label="labelOf(v)"
          :hint="hintOf(v)"
          hide-bottom-space
          :error="!!shownError(v)"
          :error-message="shownError(v)"
          :disable="disable"
          :stack-label="['date', 'datetime'].includes(v.type)"
          :input-class="v.type === 'ip' || asText(v) ? 'script-vars__mono' : ''"
          outlined
          dense
          @update:model-value="
            (val) => setValue(v, val == null ? '' : String(val))
          "
          @blur="touch(v)"
        >
          <template v-if="v.type !== 'string' && v.type !== 'text'" #after>
            <q-btn
              flat
              dense
              round
              size="sm"
              :icon="asText(v) ? 'undo' : 'data_object'"
              :disable="disable"
              :aria-label="
                asText(v)
                  ? `Back to the ${v.type} input for ${v.label}`
                  : `Use a placeholder for ${v.label}`
              "
              @click="toggleText(v)"
            >
              <q-tooltip>{{
                asText(v) ? "Back to the normal input" : PLACEHOLDER_TIP
              }}</q-tooltip>
            </q-btn>
          </template>
        </q-input>
      </div>
    </div>
    <div
      v-if="missingCount"
      class="script-vars__summary"
      :class="{ 'script-vars__summary--warn': missingOk }"
      role="status"
    >
      <q-icon
        :name="missingOk ? 'warning_amber' : 'error_outline'"
        size="16px"
      />
      {{ missingCount }} required
      {{ missingCount === 1 ? "field is" : "fields are" }} empty{{
        missingOk ? "; saving still works, but the script may fail" : ""
      }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, watch } from "vue";
import type { ScriptVariable } from "@/types/scripts";
import {
  formErrors,
  getEnvValue,
  hasPlaceholder,
  isFormValid,
  normalizeEnv,
  setEnvValue,
} from "@/utils/scriptVariables";

const props = withDefaults(
  defineProps<{
    modelValue: string[];
    variables?: ScriptVariable[];
    disable?: boolean;
    // "check", "task", "alert template": where the values are stored
    storedIn?: string;
    // editing something saved: empty required inputs warn, they do not block
    missingOk?: boolean;
  }>(),
  { variables: () => [], disable: false, storedIn: "", missingOk: false },
);

const emit = defineEmits<{
  (e: "update:modelValue", value: string[]): void;
  (e: "update:valid", value: boolean): void;
}>();

const PLACEHOLDER_TIP =
  "Use a server placeholder instead, e.g. {{client.Field}} or {{global.Key}}";

const GLOBAL_EXAMPLE = "{{global.KeyName}}";

const touched = reactive(new Set<string>());
const textMode = reactive(new Set<string>());
const revealed = reactive(new Set<string>());
// last value each field wrote itself
const typed = reactive(new Map<string, string>());

const errors = computed(() => formErrors(props.variables, props.modelValue));
const valid = computed(() =>
  isFormValid(props.variables, props.modelValue, props.missingOk),
);
const missingCount = computed(
  () => Object.values(errors.value).filter((e) => e === "Required").length,
);

watch(valid, (val) => emit("update:valid", val), { immediate: true });
// one entry per declared name. a typed NAME=value chip fills the field
watch(
  () => normalizeEnv(props.modelValue, props.variables),
  (out) => {
    const env = props.modelValue || [];
    if (out.length !== env.length || out.some((e, i) => e !== env[i]))
      emit("update:modelValue", out);
  },
  { immediate: true },
);
watch(
  () => props.variables,
  () => {
    touched.clear();
    textMode.clear();
    revealed.clear();
    typed.clear();
  },
);
// a value from outside this field (saved object, typed chip) that
// the input cannot show stays as text, with the error
watch(
  errors,
  (errs) => {
    for (const v of props.variables) {
      const value = valueOf(v);
      if (errs[v.name] && value !== "" && typed.get(v.name) !== value)
        textMode.add(v.name);
    }
  },
  { immediate: true },
);

function valueOf(v: ScriptVariable) {
  return getEnvValue(props.modelValue, v.name) ?? "";
}

function setValue(v: ScriptVariable, value: string) {
  touched.add(v.name);
  typed.set(v.name, value);
  emit("update:modelValue", setEnvValue(props.modelValue, v.name, value));
}

function touch(v: ScriptVariable) {
  touched.add(v.name);
}

function asText(v: ScriptVariable) {
  return textMode.has(v.name) || hasPlaceholder(valueOf(v));
}

function toggleText(v: ScriptVariable) {
  if (asText(v)) {
    textMode.delete(v.name);
    // value the typed input cannot show: put the default back
    if (
      valueOf(v) !== "" &&
      (hasPlaceholder(valueOf(v)) || errors.value[v.name])
    )
      setValue(v, v.default || "");
  } else {
    textMode.add(v.name);
  }
}

function toggleReveal(v: ScriptVariable) {
  if (revealed.has(v.name)) revealed.delete(v.name);
  else revealed.add(v.name);
}

function inputType(v: ScriptVariable) {
  if (asText(v)) return "text";
  switch (v.type) {
    case "integer":
    case "decimal":
      return "number";
    case "date":
      return "date";
    case "datetime":
      return "datetime-local";
    case "text":
      return "textarea";
    default:
      return "text";
  }
}

function labelOf(v: ScriptVariable) {
  return v.required ? `${v.label} *` : v.label;
}

function hintOf(v: ScriptVariable) {
  return v.help ? `${v.help} (${v.name})` : v.name;
}

// "Required" waits until the field was touched. bad values show immediately
function shownError(v: ScriptVariable) {
  const msg = errors.value[v.name];
  if (!msg) return "";
  return msg === "Required" && !touched.has(v.name) ? "" : msg;
}

defineExpose({ valid });
</script>

<style scoped>
/* flex, not grid. a field before a full-width one fills the row
   instead of leaving a hole, and the declared order stays */
.script-vars__grid {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
}

.script-vars__field {
  min-width: 0;
  flex: 1 1 240px;
}

.script-vars__field--wide {
  flex-basis: 100%;
}

.script-vars__note {
  display: flex;
  align-items: flex-start;
  gap: 4px;
  margin-top: 4px;
  font-size: 12px;
  line-height: 1.4;
  color: var(--rmm-text-muted);
}

.script-vars__note .q-icon {
  flex-shrink: 0;
  margin-top: 2px;
}

/* toggle and placeholder button, the hint on its own line below */
.script-vars__check {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  justify-items: start;
  align-items: center;
  gap: 0 8px;
  padding: 0 4px 4px;
}

.script-vars__check > .q-toggle {
  min-height: 40px;
}

.script-vars__hint {
  grid-area: 2 / 1 / 3 / -1;
  font-size: 12px;
  line-height: 1.4;
  color: var(--rmm-text-muted);
  overflow-wrap: anywhere;
}

.script-vars__summary {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
  font-size: 13px;
  color: var(--rmm-status-negative);
}

.script-vars__summary--warn {
  color: var(--rmm-status-warning);
}

:deep(.script-vars__mono) {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}
</style>
