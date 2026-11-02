<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide">
    <q-card style="width: min(1100px, 90vw); max-width: 90vw">
      <DialogHeader
        :title="alertTemplate ? 'Edit alert template' : 'Add alert template'"
        subtitle="Who is notified and what runs when agents, checks or tasks under this template fail"
      />
      <q-stepper
        ref="stepper"
        class="tpl-stepper"
        v-model="step"
        color="primary"
        animated
        header-nav
        alternative-labels
      >
        <q-step
          :name="1"
          :error="!template.name && step > 1"
          title="General settings"
          icon="settings"
        >
          <TemplateGeneralStep :template="template" />
        </q-step>

        <q-step
          :name="2"
          title="Alert actions"
          icon="warning"
          :error="step2Invalid && (attemptedSubmit || step > 2)"
        >
          <TemplateActionsStep
            :template="template"
            :editing="!!alertTemplate"
            :action-type-options="actionTypeOptions"
            :script-options="scriptOptions"
            :server-script-options="serverScriptOptions"
            :resolved-script-options="resolvedScriptOptions"
            :resolved-server-script-options="resolvedServerScriptOptions"
            :rest-action-options="restActionOptions"
            :failure-vars="failureVars"
            :resolved-vars="resolvedVars"
            :failure-env-label="failureEnvLabel"
            :resolved-env-label="resolvedEnvLabel"
          />
        </q-step>

        <q-step
          v-for="(s, i) in notifySteps"
          :key="s.kind"
          :name="i + 3"
          :title="s.title"
          :icon="s.icon"
        >
          <TemplateNotifyStep :template="template" :kind="s.kind" />
        </q-step>

        <template v-slot:navigation>
          <q-stepper-navigation class="row tpl-nav">
            <q-space />
            <!-- same order as the deployment builder: cancel, back, next, save -->
            <q-btn flat label="Cancel" class="q-mr-sm" v-close-popup />
            <q-btn
              v-if="step > 1"
              class="q-mr-xs"
              label="Back"
              :flat="true"
              color="primary"
              @click="goBack"
            />
            <q-btn
              v-if="step < LAST_STEP"
              flat
              color="primary"
              label="Next"
              class="q-mr-sm"
              @click="goNext"
            />
            <q-btn
              color="primary"
              unelevated
              :label="alertTemplate ? 'Save template' : 'Create template'"
              @click="onSubmit"
              :loading="saving"
            />
          </q-stepper-navigation>
        </template>
      </q-stepper>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, nextTick } from "vue";
import { useStore } from "vuex";
import { useDialogPluginComponent, useQuasar, type QStepper } from "quasar";
import { useScriptDropdown } from "@/composables/scripts";
import { useURLActionDropdown } from "@/composables/core";
import { notifySuccess, notifyError } from "@/utils/notify";
import { saveAlertTemplate, addAlertTemplate } from "@/api/alerts";
import { withStepUp } from "@/components/vault/stepUp";
import { isFormValid, envMasker } from "@/utils/scriptVariables";

import DialogHeader from "@/components/ui/DialogHeader.vue";
import TemplateGeneralStep from "@/components/modals/alerts/TemplateGeneralStep.vue";
import TemplateActionsStep from "@/components/modals/alerts/TemplateActionsStep.vue";
import TemplateNotifyStep from "@/components/modals/alerts/TemplateNotifyStep.vue";

import type { AlertSeverity, AlertTemplate } from "@/types/alerts";

interface Props {
  alertTemplate?: AlertTemplate;
}
const props = defineProps<Props>();
defineEmits([...useDialogPluginComponent.emits]);

const $q = useQuasar();
const store = useStore();
const { dialogRef, onDialogHide, onDialogOK } = useDialogPluginComponent();

const notifySteps = [
  { kind: "agent", title: "Agent overdue settings", icon: "devices" },
  { kind: "check", title: "Check settings", icon: "fas fa-check-double" },
  { kind: "task", title: "Automated task settings", icon: "fas fa-tasks" },
];
const LAST_STEP = notifySteps.length + 2;

const step = ref(1);
const stepper = ref<QStepper | null>(null);
const goBack = () => stepper.value?.previous();
const goNext = () => stepper.value?.next();
const saving = ref(false);
const attemptedSubmit = ref(false);

const failure = useScriptDropdown({
  script: props.alertTemplate?.action,
  onMount: true,
});
const resolved = useScriptDropdown({
  script: props.alertTemplate?.resolved_action,
  onMount: true,
});
const { serverScriptOptions, scriptOptions } = failure;
// each list also holds its own saved script when that one is hidden
const {
  serverScriptOptions: resolvedServerScriptOptions,
  scriptOptions: resolvedScriptOptions,
} = resolved;
const { restActionOptions } = useURLActionDropdown({ onMount: true });

function blankTemplate(): AlertTemplate {
  const base: Record<string, unknown> = {
    id: 0,
    name: "",
    is_active: true,
    email_recipients: [] as string[],
    email_from: "",
    text_recipients: [] as string[],
  };
  const actions: [string, typeof failure][] = [
    ["", failure],
    ["resolved_", resolved],
  ];
  for (const [prefix, dd] of actions) {
    base[`${prefix}action_type`] = "script";
    base[`${prefix}action`] = dd.script;
    base[`${prefix}action_rest`] = undefined;
    base[`${prefix}action_args`] = dd.defaultArgs;
    base[`${prefix}action_env_vars`] = dd.defaultEnvVars;
    base[`${prefix}action_timeout`] = dd.defaultTimeout;
  }
  for (const { kind } of notifySteps) {
    base[`${kind}_email_on_resolved`] = false;
    base[`${kind}_text_on_resolved`] = false;
    for (const ch of ["email", "text", "alert"]) {
      base[`${kind}_always_${ch}`] = null;
    }
    base[`${kind}_periodic_alert_days`] = 0;
    base[`${kind}_script_actions`] = true;
    if (kind !== "agent") {
      for (const ch of ["email", "text", "dashboard"]) {
        base[`${kind}_${ch}_alert_severity`] = [] as AlertSeverity[];
      }
    }
  }
  return base as unknown as AlertTemplate;
}

const template: AlertTemplate = reactive(
  props.alertTemplate ? { ...props.alertTemplate } : blankTemplate(),
);

// picking another action type starts that action from scratch
for (const prefix of ["", "resolved_"]) {
  watch(
    () => template[`${prefix}action_type` as "action_type"],
    () => {
      const t = template as unknown as Record<string, unknown>;
      t[`${prefix}action_rest`] = undefined;
      t[`${prefix}action`] = undefined;
      t[`${prefix}action_args`] = [];
      t[`${prefix}action_env_vars`] = [];
      t[`${prefix}action_timeout`] = 30;
    },
  );
}

// declared inputs of the chosen script; webhooks have none
function scriptVars(
  type: string,
  id: number | undefined,
  options = scriptOptions.value,
) {
  if (type === "rest" || !id) return [];
  return options.find((o) => o.value === id)?.variables || [];
}
const failureVars = computed(() =>
  scriptVars(template.action_type, template.action),
);
const resolvedVars = computed(() =>
  scriptVars(
    template.resolved_action_type,
    template.resolved_action,
    resolvedScriptOptions.value,
  ),
);

// chips hide password values. script not in the picker yet: hide
// every value. a saved template shows only declared non-password inputs
function maskerFor(
  type: string,
  id: number | undefined,
  options = scriptOptions.value,
) {
  if (type === "rest" || !id) return envMasker([]);
  const found = options.find((o) => o.value === id);
  return envMasker(found ? found.variables || [] : null, !!props.alertTemplate);
}
const failureEnvLabel = computed(() =>
  maskerFor(template.action_type, template.action),
);
const resolvedEnvLabel = computed(() =>
  maskerFor(
    template.resolved_action_type,
    template.resolved_action,
    resolvedScriptOptions.value,
  ),
);

// editing: copy the script defaults over once the dropdown has loaded them.
// a new template has no saved script yet, so it needs no watcher
if (props.alertTemplate) {
  watch(
    () => template.action,
    (id) => {
      if (!id) return;
      failure.script.value = id;
      nextTick(() => {
        template.action_args = failure.defaultArgs.value;
        template.action_env_vars = failure.defaultEnvVars.value;
        template.action_timeout = failure.defaultTimeout.value;
      });
    },
  );
  watch(
    () => template.resolved_action,
    (id) => {
      if (!id) return;
      resolved.script.value = id;
      nextTick(() => {
        template.resolved_action_args = resolved.defaultArgs.value;
        template.resolved_action_env_vars = resolved.defaultEnvVars.value;
        template.resolved_action_timeout = resolved.defaultTimeout.value;
      });
    },
  );
}

const actionTypeOptions = computed(() => {
  const all = [
    { label: "Send a web hook", value: "rest" },
    { label: "Run script on the agent", value: "script" },
    { label: "Run script on the server", value: "server" },
  ];
  // hosted has no server scripts at all; elsewhere the radio is disabled
  // while the feature is off globally
  if (store.state.hosted) return all.filter((o) => o.value !== "server");
  return all.map((o) =>
    o.value === "server" && !store.state.server_scripts_enabled
      ? { ...o, disable: true }
      : o,
  );
});

const inputsValid = computed(() => {
  const editing = !!props.alertTemplate;
  return (
    isFormValid(failureVars.value, template.action_env_vars, editing) &&
    isFormValid(resolvedVars.value, template.resolved_action_env_vars, editing)
  );
});

const step2Invalid = computed(
  () =>
    (template.action_type === "script" && !template.action) ||
    (template.action_type !== "rest" && !template.action_timeout) ||
    (template.resolved_action_type !== "rest" &&
      !template.resolved_action_timeout) ||
    !inputsValid.value,
);

function step2Message() {
  if (template.action_type === "script" && !template.action) {
    return "A failure script must be selected";
  }
  if (!inputsValid.value) return "Some script inputs are missing or invalid";
  return "A timeout is required for the failure and resolved actions";
}

async function onSubmit() {
  if (!template.name) {
    notifyError("Name needs to be set");
    attemptedSubmit.value = true;
    step.value = 1;
    return;
  }

  if (step2Invalid.value) {
    attemptedSubmit.value = true;
    step.value = 2;
    notifyError(step2Message());
    return;
  }

  saving.value = true;
  const editing = !!props.alertTemplate;
  try {
    // withStepUp shows its own errors and returns null on failure or cancel
    const result = await withStepUp($q, (config) =>
      editing
        ? saveAlertTemplate(template.id, template, config)
        : addAlertTemplate(template, config),
    );
    if (result === null) return;
    notifySuccess(editing ? "Alert template saved" : "Alert template created");
    onDialogOK();
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
:deep(.tpl-section) {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 12px 16px 0;
  font-size: var(--rmm-fs-md);
  font-weight: 600;
}

/* long steps scroll under the actions, which stay in reach */
.tpl-nav {
  position: sticky;
  z-index: 2;
  bottom: 0;
  padding-top: 12px;
  border-top: 1px solid var(--rmm-border);
  background: var(--rmm-surface);
}

:deep(.tpl-caption) {
  padding: 2px 16px 0;
  color: var(--rmm-text-muted);
  font-size: var(--rmm-fs-xs);
}
</style>
