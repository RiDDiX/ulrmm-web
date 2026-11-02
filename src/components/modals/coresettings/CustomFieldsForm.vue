<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide">
    <q-card class="q-dialog-plugin rmm-dialog--md">
      <DialogHeader
        :title="editing ? 'Edit Custom Field' : 'Add Custom Field'"
        subtitle="An extra field on clients, sites or agents that scripts can read"
      />
      <q-form @submit="save">
        <SchemaForm v-model="entry" :fields="fields" compact>
          <template v-slot:field-flags>
            <div class="column q-gutter-xs">
              <template v-for="flag in flags" :key="flag.key">
                <div v-if="!flag.hideFor || entry.type !== flag.hideFor">
                  <q-toggle
                    v-model="entry[flag.key]"
                    :label="flag.label"
                    color="primary"
                  />
                  <div class="cf-hint">{{ flag.hint }}</div>
                </div>
              </template>
            </div>
          </template>
        </SchemaForm>
        <q-card-actions align="right">
          <q-btn flat label="Cancel" v-close-popup />
          <q-btn unelevated label="Save" color="primary" type="submit" />
        </q-card-actions>
      </q-form>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { computed, ref } from "vue";
import axios from "axios";
import { useDialogPluginComponent, useQuasar } from "quasar";
import { notifySuccess } from "@/utils/notify";
import DialogHeader from "@/components/ui/DialogHeader.vue";
import SchemaForm from "@/components/ui/SchemaForm.vue";

const props = defineProps({ field: Object, model: String });
defineEmits([...useDialogPluginComponent.emits]);

const $q = useQuasar();
const { dialogRef, onDialogHide, onDialogOK } = useDialogPluginComponent();

const editing = !!props.field;
const required = [(val) => !!val || "*Required"];
const choices = (pairs) => pairs.map(([value, label]) => ({ value, label }));

// what a type change throws away
const blankDefaults = () => ({
  options: [],
  required: false,
  // plain value for text, number, datetime and single
  default_value_string: "",
  default_values_multiple: [],
  default_value_bool: false,
});

// an existing field overrides the blanks; the tab it was opened from
// decides the target
const startEntry = () => ({
  name: "",
  type: "",
  model: "",
  hide_in_ui: false,
  hide_in_summary: false,
  ...blankDefaults(),
  ...props.field,
  ...(props.model ? { model: props.model } : {}),
});
const entry = ref(startEntry());

function resetType() {
  Object.assign(entry.value, blankDefaults());
}

function resetDefaults() {
  entry.value.default_value_string = "";
  entry.value.default_values_multiple = [];
}

const hasOptions = (m) => m.type === "single" || m.type === "multiple";
const chipInput = {
  "use-input": true,
  "use-chips": true,
  "hide-dropdown-icon": true,
  "input-debounce": "0",
  "new-value-mode": "add-unique",
};

function defaultField(m) {
  const common = {
    hint: "Used wherever no value has been set",
    rules: m.required
      ? [(val) => !!val || "Default Value needs to be set for required fields"]
      : [],
  };
  const rules = { "reactive-rules": true };
  switch (m.type) {
    case "datetime":
      return {
        ...common,
        key: "default_value_string",
        type: "datetime",
        label: "Default Value",
        props: rules,
      };
    case "checkbox":
      return {
        key: "default_value_bool",
        type: "toggle",
        label: "Default Value",
        hint: "Used wherever no value has been set.",
        props: { color: "primary" },
      };
    case "single":
      return {
        ...common,
        key: "default_value_string",
        type: "select",
        label: "Default Value",
        options: m.options,
        props: rules,
      };
    case "multiple":
      return {
        ...common,
        key: "default_values_multiple",
        type: "select",
        label: "Default Value(s)",
        multiple: true,
        options: m.options,
        props: rules,
      };
    default:
      return {
        ...common,
        key: "default_value_string",
        type: m.type === "text" ? "text" : "number",
        label: "Default Value",
        props: { ...rules, autogrow: true },
      };
  }
}

const fields = computed(() => [
  {
    key: "model",
    type: "select",
    label: "Target",
    options: choices([
      ["client", "Client"],
      ["site", "Site"],
      ["agent", "Agent"],
    ]),
    disable: editing,
    hint: editing
      ? "The target cannot be changed after the field is created"
      : "Whether the field is added to clients, sites or agents",
    rules: required,
  },
  {
    key: "name",
    type: "text",
    label: "Name",
    hint: "Scripts read it by name, e.g. {{agent.Asset Tag}} for an agent field called Asset Tag",
    rules: required,
  },
  {
    key: "type",
    type: "select",
    label: "Field Type",
    options: choices([
      ["text", "Text"],
      ["number", "Number"],
      ["single", "Dropdown Single"],
      ["multiple", "Dropdown Multiple"],
      ["datetime", "DateTime"],
      ["checkbox", "Checkbox"],
    ]),
    disable: editing,
    hint: editing
      ? "The type cannot be changed after the field is created"
      : "Changing the type clears the options, default value and Required",
    rules: required,
    props: { "onUpdate:modelValue": resetType },
  },
  {
    key: "options",
    type: "select",
    label: "Input Options",
    hint: "Type an option and press Enter to add it; changing them clears the default",
    multiple: true,
    show: hasOptions,
    props: { ...chipInput, "onUpdate:modelValue": resetDefaults },
  },
  { ...defaultField(entry.value), show: (m) => !!m.type },
  { key: "flags", type: "text" },
]);

const flags = [
  {
    key: "required",
    label: "Required",
    hint: "The edit forms cannot be saved without a value; needs a default value.",
    hideFor: "checkbox",
  },
  {
    key: "hide_in_ui",
    label: "Hide in dashboard",
    hint: "Left out of the client, site and agent edit forms; scripts can still use it.",
  },
  {
    key: "hide_in_summary",
    label: "Hide in Summary Tab",
    hint: "Not listed on the agent Summary tab.",
  },
];

async function save() {
  $q.loading.show();
  const body = { ...entry.value };
  try {
    if (editing) {
      await axios.put(`/core/customfields/${body.id}/`, body);
    } else {
      await axios.post("/core/customfields/", body);
    }
    $q.loading.hide();
    onDialogOK();
    notifySuccess(editing ? "Custom field edited!" : "Custom field added!");
  } catch {
    $q.loading.hide();
  }
}
</script>

<style scoped>
.cf-hint {
  padding-left: 56px;
  color: var(--rmm-text-muted);
  font-size: var(--rmm-fs-xs);
  line-height: 1.4;
}
</style>
