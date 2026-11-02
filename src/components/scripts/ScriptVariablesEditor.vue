<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <div class="vars-editor" data-testid="variables-editor">
    <div v-if="!modelValue.length" class="vars-editor__empty rmm-muted">
      No variables yet. Each variable becomes a field in the run dialog and
      reaches the script as an environment variable.
    </div>
    <div
      v-for="(row, i) in modelValue"
      :key="row.key"
      class="vars-editor__row"
      :data-variable-row="i"
    >
      <div class="vars-editor__row-head">
        <span class="vars-editor__index">{{ i + 1 }}</span>
        <span class="vars-editor__title">{{
          row.label || row.name || "New variable"
        }}</span>
        <template v-if="!readonly">
          <q-btn
            v-for="b in rowButtons(i)"
            :key="b.icon"
            flat
            dense
            round
            size="sm"
            :icon="b.icon"
            :color="b.color"
            :disable="b.disable"
            :aria-label="`${b.label}: ${row.label || row.name || 'variable ' + (i + 1)}`"
            @click="b.action"
          >
            <q-tooltip>{{ b.label }}</q-tooltip>
          </q-btn>
        </template>
      </div>
      <div class="vars-editor__fields">
        <q-input
          :model-value="row.label"
          label="Label"
          outlined
          dense
          :maxlength="MAX_LABEL"
          :readonly="readonly"
          :error="!!issue(i, 'label')"
          :error-message="issue(i, 'label')"
          hide-bottom-space
          @update:model-value="(val) => setLabel(i, String(val ?? ''))"
        />
        <q-input
          :model-value="row.name"
          label="Name"
          outlined
          dense
          input-class="rmm-mono"
          :readonly="readonly"
          :hint="
            row.nameEdited ? undefined : 'Follows the label until you edit it'
          "
          :error="!!issue(i, 'name')"
          :error-message="issue(i, 'name')"
          hide-bottom-space
          @update:model-value="
            (val) => patch(i, { name: String(val ?? ''), nameEdited: true })
          "
        />
        <div
          v-if="isInheritedName(row.name) && !issue(i, 'name')"
          class="vars-editor__msg vars-editor__msg--warn"
          role="status"
          data-testid="inherited-name"
        >
          <q-icon name="warning_amber" size="16px" />
          <span
            >Every process already has a variable named {{ row.name }}; left
            empty, the script reads that one. Pick another name, for example
            TARGET_USER.</span
          >
        </div>
        <div class="vars-editor__pair">
          <q-select
            :model-value="row.type"
            :options="VARIABLE_TYPES"
            label="Type"
            outlined
            dense
            options-dense
            emit-value
            map-options
            :readonly="readonly"
            :error="!!issue(i, 'type')"
            :error-message="issue(i, 'type')"
            hide-bottom-space
            @update:model-value="(val) => patch(i, { type: val, default: '' })"
          />
          <q-checkbox
            :model-value="!!row.required"
            label="Required"
            dense
            :disable="readonly"
            @update:model-value="(val) => patch(i, { required: val })"
          />
        </div>
        <q-input
          v-if="row.type === 'select'"
          :model-value="(row.options || []).join('\n')"
          label="Options, one per line"
          type="textarea"
          autogrow
          outlined
          dense
          :readonly="readonly"
          :error="!!issue(i, 'options')"
          :error-message="issue(i, 'options')"
          hide-bottom-space
          @update:model-value="
            (val) => patch(i, { options: String(val ?? '').split('\n') })
          "
        />
        <q-select
          v-if="row.type === 'checkbox' || row.type === 'select'"
          :model-value="row.default || ''"
          :options="defaultOptions(row)"
          label="Default"
          outlined
          dense
          options-dense
          emit-value
          map-options
          :readonly="readonly"
          :error="!!issue(i, 'default')"
          :error-message="issue(i, 'default')"
          hide-bottom-space
          @update:model-value="(val) => patch(i, { default: val || '' })"
        />
        <div
          v-else-if="row.type === 'password'"
          class="vars-editor__msg"
          :class="{ 'vars-editor__msg--error': !!issue(i, 'default') }"
          :role="issue(i, 'default') ? 'alert' : undefined"
        >
          <q-icon
            :name="issue(i, 'default') ? 'error_outline' : 'lock'"
            size="16px"
          />
          <span>{{
            issue(i, "default") ||
            `No default: the value is typed at run time. For a stored secret use ${GLOBAL_EXAMPLE} from the global key store.`
          }}</span>
        </div>
        <q-input
          v-else
          :model-value="row.default"
          label="Default"
          outlined
          dense
          :type="defaultInputType(row.type)"
          :autogrow="row.type === 'text'"
          :stack-label="row.type === 'date' || row.type === 'datetime'"
          :readonly="readonly"
          :error="!!issue(i, 'default')"
          :error-message="issue(i, 'default')"
          hide-bottom-space
          @update:model-value="
            (val) => patch(i, { default: val == null ? '' : String(val) })
          "
        />
        <q-input
          :model-value="row.help"
          label="Help text"
          outlined
          dense
          :maxlength="MAX_HELP"
          :readonly="readonly"
          :error="!!issue(i, 'help')"
          :error-message="issue(i, 'help')"
          hide-bottom-space
          @update:model-value="(val) => patch(i, { help: String(val ?? '') })"
        />
      </div>
    </div>
    <q-btn
      v-if="!readonly"
      flat
      no-caps
      icon="add"
      label="Add variable"
      color="primary"
      class="vars-editor__add"
      @click="add"
    />

    <div
      v-if="previewVars.length"
      class="vars-editor__preview script-variables-preview"
    >
      <div class="rmm-label">Run form preview</div>
      <div class="text-caption rmm-muted q-mb-sm">
        What the run dialog shows; values here are not saved.
      </div>
      <div data-testid="variables-preview">
        <ScriptVariablesForm v-model="previewEnv" :variables="previewVars" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import ScriptVariablesForm from "@/components/scripts/ScriptVariablesForm.vue";
import {
  MAX_HELP,
  MAX_LABEL,
  VARIABLE_TYPES,
  applyVariableDefaults,
  cleanDefinitions,
  isInheritedName,
  suggestVariableName,
  type VariableIssue,
} from "@/utils/scriptVariables";
import { toBuilderVariable, type BuilderVariable } from "@/utils/scriptBlocks";
import type { ScriptVariableType } from "@/types/scripts";

const props = withDefaults(
  defineProps<{
    modelValue: BuilderVariable[];
    issues?: VariableIssue[];
    readonly?: boolean;
  }>(),
  { issues: () => [], readonly: false },
);

const emit = defineEmits<{
  (e: "update:modelValue", value: BuilderVariable[]): void;
}>();

const GLOBAL_EXAMPLE = "{{global.KeyName}}";

// a new row shows errors once the user starts filling it
const fresh = reactive(new Set<number>());

function issue(index: number, field: VariableIssue["field"]) {
  if (fresh.has(props.modelValue[index]?.key)) return "";
  return (
    props.issues.find((x) => x.index === index && x.field === field)?.message ||
    ""
  );
}

function patch(index: number, change: Partial<BuilderVariable>) {
  const rows = [...props.modelValue];
  fresh.delete(rows[index].key);
  rows[index] = { ...rows[index], ...change };
  emit("update:modelValue", rows);
}

function setLabel(index: number, label: string) {
  const row = props.modelValue[index];
  patch(
    index,
    row.nameEdited ? { label } : { label, name: suggestVariableName(label) },
  );
}

function move(index: number, by: number) {
  const rows = [...props.modelValue];
  const [row] = rows.splice(index, 1);
  rows.splice(index + by, 0, row);
  emit("update:modelValue", rows);
}

function remove(index: number) {
  emit(
    "update:modelValue",
    props.modelValue.filter((_, i) => i !== index),
  );
}

function add() {
  const row = toBuilderVariable({}, false);
  fresh.add(row.key);
  emit("update:modelValue", [...props.modelValue, row]);
}

function rowButtons(i: number) {
  const last = props.modelValue.length - 1;
  return [
    {
      icon: "arrow_upward",
      label: "Move up",
      disable: i === 0,
      action: () => move(i, -1),
    },
    {
      icon: "arrow_downward",
      label: "Move down",
      disable: i === last,
      action: () => move(i, 1),
    },
    {
      icon: "delete",
      label: "Remove variable",
      color: "negative",
      disable: false,
      action: () => remove(i),
    },
  ];
}

function defaultOptions(row: BuilderVariable) {
  const none = { label: "No default", value: "" };
  if (row.type === "checkbox")
    return [
      none,
      { label: "Checked (true)", value: "true" },
      { label: "Unchecked (false)", value: "false" },
    ];
  const opts = (row.options || []).map((o) => o.trim()).filter(Boolean);
  return [none, ...[...new Set(opts)].map((o) => ({ label: o, value: o }))];
}

function defaultInputType(type: ScriptVariableType) {
  switch (type) {
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

// skip rows whose definition is broken
const previewVars = computed(() => {
  const bad = new Set(
    props.issues
      .filter((x) => x.field === "name" || x.field === "options")
      .map((x) => x.index),
  );
  return cleanDefinitions(props.modelValue.filter((_, i) => !bad.has(i)));
});

defineExpose({ revealErrors: () => fresh.clear() });

const previewEnv = ref<string[]>([]);
watch(
  () => JSON.stringify(previewVars.value),
  () => {
    previewEnv.value = applyVariableDefaults([], previewVars.value);
  },
  { immediate: true },
);
</script>

<style scoped>
.vars-editor {
  display: grid;
  gap: 10px;
}

.vars-editor__empty {
  font-size: var(--rmm-fs-sm);
}

.vars-editor__row {
  padding: 8px 10px 10px;
  border: 1px solid var(--rmm-border);
  border-radius: var(--rmm-radius);
  background: var(--rmm-surface);
}

.vars-editor__row-head {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
}

.vars-editor__index {
  display: inline-grid;
  width: 22px;
  height: 22px;
  flex-shrink: 0;
  place-items: center;
  border-radius: 50%;
  background: var(--rmm-tile-icon-bg);
  color: var(--rmm-tile-icon-text);
  font-size: var(--rmm-fs-xs);
  font-weight: 600;
}

.vars-editor__title {
  overflow: hidden;
  flex: 1;
  min-width: 0;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.vars-editor__fields {
  display: grid;
  gap: 8px;
}

.vars-editor__pair {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
}

.vars-editor__msg {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  padding: 0 2px;
  font-size: 12px;
  line-height: 1.4;
  color: var(--rmm-text-muted);
}

.vars-editor__msg .q-icon {
  flex-shrink: 0;
  margin-top: 1px;
}

.vars-editor__msg--warn {
  color: var(--rmm-status-warning);
}

.vars-editor__msg--error {
  color: var(--rmm-status-negative);
}

.vars-editor__add {
  justify-self: start;
}

.vars-editor__preview {
  padding: 10px;
  border: 1px dashed var(--rmm-border-strong);
  border-radius: var(--rmm-radius);
  background: var(--rmm-surface-2);
}
</style>
