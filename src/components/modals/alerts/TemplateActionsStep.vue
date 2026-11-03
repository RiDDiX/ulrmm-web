<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <div class="scroll" style="max-height: calc(100vh - 260px)">
    <q-card flat>
      <div class="tpl-section">
        Alert failure settings
        <HelpTip
          text="The selected action runs once when an alert is triggered."
        />
      </div>
      <div class="tpl-caption">
        A script can run on the agent or on the server, or a web hook can be
        sent. Turn off the types it should not run for under Run actions only
        on.
      </div>
      <TemplateActionBlock
        v-bind="shared"
        script-required
        :vars="failureVars"
        :env-label="failureEnvLabel"
        :labels="FAILURE_LABELS"
      />

      <div class="tpl-section">
        Alert resolved settings
        <HelpTip
          text="The selected action runs once when an alert is resolved."
        />
      </div>
      <TemplateActionBlock
        v-bind="shared"
        :script-options="resolvedScriptOptions"
        :server-script-options="resolvedServerScriptOptions"
        prefix="resolved_"
        :vars="resolvedVars"
        :env-label="resolvedEnvLabel"
        :labels="RESOLVED_LABELS"
      />

      <div class="tpl-section">
        Run actions only on
        <HelpTip
          text="The failure and resolved actions only run for the alert types turned on here."
        />
      </div>
      <q-card-section class="q-pt-sm">
        <q-toggle
          v-for="g in GATES"
          :key="g.key"
          v-model="t[g.key]"
          :label="g.label"
          left-label
        >
          <q-tooltip>{{ g.tip }}</q-tooltip>
        </q-toggle>
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
import { computed, toRef } from "vue";
import HelpTip from "@/components/ui/HelpTip.vue";
import TemplateActionBlock from "@/components/modals/alerts/TemplateActionBlock.vue";

const props = defineProps({
  template: { type: Object, required: true },
  editing: Boolean,
  actionTypeOptions: { type: Array, required: true },
  scriptOptions: { type: Array, default: () => [] },
  serverScriptOptions: { type: Array, default: () => [] },
  resolvedScriptOptions: { type: Array, default: () => [] },
  resolvedServerScriptOptions: { type: Array, default: () => [] },
  restActionOptions: { type: Array, default: () => [] },
  failureVars: { type: Array, default: () => [] },
  resolvedVars: { type: Array, default: () => [] },
  failureEnvLabel: { type: Function, required: true },
  resolvedEnvLabel: { type: Function, required: true },
});

const t = toRef(props, "template");

const GATES = [
  { key: "agent_script_actions", label: "Agents", tip: "Agent overdue alerts" },
  {
    key: "check_script_actions",
    label: "Checks",
    tip: "Check alerts, including network monitors",
  },
  { key: "task_script_actions", label: "Tasks", tip: "Automated task alerts" },
];

const FAILURE_LABELS = {
  script: "Failure script",
  hook: "Failure web hook",
  inputs: "Failure script inputs",
  args: "Failure script arguments",
  env: "Failure script environment vars",
  timeout: "Failure script timeout (seconds)",
  timeoutRequired: "Failure script timeout is required",
};
const RESOLVED_LABELS = {
  script: "Resolved script",
  hook: "Resolved web hook",
  inputs: "Resolved script inputs",
  args: "Resolved script arguments",
  env: "Resolved action environment vars",
  timeout: "Resolved script timeout (seconds)",
  timeoutRequired: "Resolved script timeout is required",
};

const shared = computed(() => ({
  template: props.template,
  editing: props.editing,
  actionTypeOptions: props.actionTypeOptions,
  scriptOptions: props.scriptOptions,
  serverScriptOptions: props.serverScriptOptions,
  restActionOptions: props.restActionOptions,
}));
</script>
