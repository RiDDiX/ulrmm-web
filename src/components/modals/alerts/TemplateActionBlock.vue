<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-card-section class="q-gutter-y-sm">
    <q-option-group
      v-model="t[key('action_type')]"
      :options="actionTypeOptions"
      dense
      inline
    />

    <rmm-select
      :key="type"
      v-model="t[picker.model]"
      :label="picker.label"
      :hint="picker.hint"
      :options="picker.options"
      :rules="picker.rules"
      outlined
      clearable
      mapOptions
      filterable
    />

    <div v-if="vars.length" class="rmm-label">{{ labels.inputs }}</div>
    <ScriptVariablesForm
      v-model="t[key('action_env_vars')]"
      :variables="vars"
      stored-in="alert template"
      :missing-ok="editing"
    />

    <template v-if="type !== 'rest'">
      <q-select
        v-model="t[key('action_args')]"
        :label="labels.args"
        placeholder="Type an argument and press Enter"
        hint="One entry per argument; {{alert.severity}} or {{agent.hostname}} are filled in when it runs"
        v-bind="chips"
      />

      <q-select
        v-model="t[key('action_env_vars')]"
        :label="labels.env"
        placeholder="Type KEY=value and press Enter"
        :hint="envHint"
        :option-label="envLabel"
        v-bind="chips"
      />

      <q-input
        v-model.number="t[key('action_timeout')]"
        :label="labels.timeout"
        hint="The script is stopped after this many seconds"
        type="number"
        outlined
        dense
        :rules="[(val) => !!val || labels.timeoutRequired]"
      />
    </template>
  </q-card-section>
</template>

<script setup>
import { computed, toRef } from "vue";
import RmmSelect from "@/components/ui/RmmSelect.vue";
import ScriptVariablesForm from "@/components/scripts/ScriptVariablesForm.vue";

const props = defineProps({
  template: { type: Object, required: true },
  // "" for the failure action, "resolved_" for the resolved one
  prefix: { type: String, default: "" },
  labels: { type: Object, required: true },
  scriptRequired: Boolean,
  vars: { type: Array, default: () => [] },
  envLabel: { type: Function, required: true },
  editing: Boolean,
  actionTypeOptions: { type: Array, required: true },
  scriptOptions: { type: Array, default: () => [] },
  serverScriptOptions: { type: Array, default: () => [] },
  restActionOptions: { type: Array, default: () => [] },
});

const t = toRef(props, "template");
const key = (name) => props.prefix + name;
const type = computed(() => t.value[key("action_type")]);

const chips = {
  dense: true,
  outlined: true,
  "use-input": true,
  "use-chips": true,
  multiple: true,
  "hide-dropdown-icon": true,
  "input-debounce": "0",
  "new-value-mode": "add",
};

const envHint = computed(() =>
  props.vars.length
    ? "Includes the script inputs above. One extra KEY=value pair per entry"
    : "One KEY=value pair per entry",
);

const picker = computed(() => {
  if (type.value === "rest") {
    return {
      model: key("action_rest"),
      label: props.labels.hook,
      hint: "Web hooks are set up in Global Settings > Web Hooks",
      options: props.restActionOptions,
    };
  }
  const onServer = type.value === "server";
  return {
    model: key("action"),
    label: props.labels.script,
    hint: onServer
      ? "Runs on the UniversalLocal RMM server; the script needs a shebang line"
      : "Runs on the alerting agent, or on another online agent if it is offline",
    options: onServer ? props.serverScriptOptions : props.scriptOptions,
    rules:
      props.scriptRequired && !onServer
        ? [(val) => !!val || "*Required"]
        : undefined,
  };
});
</script>
