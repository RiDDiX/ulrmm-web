<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-dialog
    ref="dialogRef"
    @hide="onDialogHide"
    aria-labelledby="script-check-title"
  >
    <CheckCard
      title-id="script-check-title"
      :title="check ? 'Edit script check' : 'Add script check'"
      subtitle="Runs a script and judges the result by its exit code"
      :loading="loading"
      :blank="filterByPlatformOptions.length === 0"
      @save="save"
    >
      <template #blank>
        <EmptyState
          icon="code"
          title="No scripts available"
          text="A script check runs one of your scripts. Add one for this platform under Settings > Script Manager."
        />
      </template>
      <q-card-section class="q-gutter-y-sm">
        <div class="rmm-label">Script</div>
        <rmm-select
          v-model="state.script"
          :options="filterByPlatformOptions"
          label="Select script"
          :hint="
            check
              ? 'The script of an existing check cannot be changed'
              : undefined
          "
          :rules="[(val) => !!val || 'Required']"
          :disable="!!check"
          outlined
          mapOptions
          filterable
        />
        <div v-if="variables.length" class="rmm-label">Script inputs</div>
        <ScriptVariablesForm
          v-model="state.env_vars"
          v-model:valid="varsValid"
          :variables="variables"
          :missing-ok="!!check"
          stored-in="check"
        />
        <q-select
          v-model="state.script_args"
          label="Script arguments"
          hint="Press Enter after each argument. {{agent.hostname}}-style values are filled in per agent"
          v-bind="chipSelect"
        />
        <q-select
          v-model="state.env_vars"
          label="Environment variables"
          :hint="
            variables.length
              ? 'Includes the script inputs above. Press Enter after each extra KEY=value pair'
              : 'Press Enter after each KEY=value pair'
          "
          :option-label="envLabel"
          v-bind="chipSelect"
        />
        <q-input
          v-model.number="state.timeout"
          type="number"
          label="Script timeout (seconds)"
          hint="How long the script may run before the agent stops it"
          :rules="[
            (val) => (val !== null && val !== '') || 'Required',
            (val) => val > 0 || 'Timeout must be greater than 0',
          ]"
          outlined
          dense
          hide-bottom-space
        />
      </q-card-section>
      <q-card-section class="q-gutter-y-sm q-pt-none">
        <div class="rmm-label">Exit codes</div>
        <div class="text-caption rmm-muted">
          Exit code 0 passes and any other code fails the check as an error,
          unless the code is listed below. Press Enter after each code.
        </div>
        <rmm-select
          v-for="c in codeLists"
          :key="c.key"
          v-model="state[c.key]"
          :label="c.label"
          :hint="c.hint"
          v-bind="codeSelect"
          @new-value="validateRetcode"
        />
      </q-card-section>
      <CheckSchedule :state="state" :fail-options="failOptions" />
    </CheckCard>
  </q-dialog>
</template>

<script setup>
import { computed, ref } from "vue";
import { useCheckDialog } from "./useCheckDialog";
import { useScriptDropdown } from "@/composables/scripts";
import { validateRetcode } from "@/utils/validation";
import { notifyError } from "@/utils/notify";
import { envMasker } from "@/utils/scriptVariables";
import RmmSelect from "@/components/ui/RmmSelect.vue";
import EmptyState from "@/components/ui/EmptyState.vue";
import ScriptVariablesForm from "@/components/scripts/ScriptVariablesForm.vue";
import CheckCard from "./CheckCard.vue";
import CheckSchedule from "./CheckSchedule.vue";

const props = defineProps({
  check: Object,
  parent: Object, // {agent: agent.agent_id} or {policy: policy.id}
  plat: String,
});
defineEmits(["ok", "hide"]);

const scripts = useScriptDropdown({
  script: props.check?.script,
  plat: props.plat,
  onMount: true,
});
const { filterByPlatformOptions, variables } = scripts;

const {
  dialogRef,
  onDialogHide,
  state,
  loading,
  submit,
  onDialogOK,
  failOptions,
} = useCheckDialog(props, {
  check_type: "script",
  script: scripts.script,
  script_args: scripts.defaultArgs,
  env_vars: scripts.defaultEnvVars,
  timeout: scripts.defaultTimeout,
  ...{
    info_return_codes: [],
    warning_return_codes: [],
    success_return_codes: [],
  },
  ...{ fails_b4_alert: 1, run_interval: 0 },
});

const chipSelect = {
  dense: true,
  filled: true,
  multiple: true,
  "use-input": true,
  "use-chips": true,
  "hide-dropdown-icon": true,
  "hide-bottom-space": true,
  "new-value-mode": "add",
};
const codeSelect = {
  filled: true,
  multiple: true,
  "use-input": true,
  "hide-dropdown-icon": true,
  "hide-bottom-space": true,
  "input-debounce": "0",
  "new-value-mode": "add-unique",
};
const codeLists = [
  {
    key: "info_return_codes",
    label: "Informational return codes",
    hint: "These codes fail the check as informational",
  },
  {
    key: "warning_return_codes",
    label: "Warning return codes",
    hint: "These codes fail the check as a warning",
  },
  {
    key: "success_return_codes",
    label: "Success return codes",
    hint: "These codes pass the check",
  },
];

// an edit keeps its saved env_vars. the form only shows them
const varsValid = ref(true);
// chips hide password values. until the script list loads, hide
// every value. then only declared non-password inputs stay visible
const envLabel = computed(() =>
  envMasker(
    filterByPlatformOptions.value.length ? variables.value : null,
    !!props.check,
  ),
);

function save() {
  if (!varsValid.value) {
    notifyError("Some script inputs are missing or invalid");
    return;
  }
  submit(onDialogOK);
}
</script>
