<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-dialog
    ref="dialogRef"
    persistent
    :maximized="maximized"
    aria-labelledby="run-script-title"
    @hide="onDialogHide"
    @keydown.esc="onDialogHide"
  >
    <q-card class="dialog-plugin" style="min-width: 60vw">
      <DialogHeader
        title-id="run-script-title"
        :title="`Run a script on ${deviceName(agent)}`"
        subtitle="Runs one of your scripts on this agent now"
      >
        <template #actions>
          <q-btn
            v-for="b in sizeButtons"
            :key="b.label"
            :icon="b.icon"
            :aria-label="b.label"
            :disable="maximized === b.target"
            dense
            flat
            @click="maximized = b.target"
          >
            <q-tooltip v-if="maximized !== b.target">{{ b.tip }}</q-tooltip>
          </q-btn>
        </template>
      </DialogHeader>
      <q-form @submit.prevent="sendScript">
        <q-card-section class="q-gutter-y-sm">
          <rmm-select
            v-model="form.script"
            :options="scriptChoices"
            :rules="[(v: number) => !!v || 'Required']"
            label="Select script"
            outlined
            mapOptions
            filterable
            hide-bottom-space
          >
            <template v-if="syntax || form.script" #after>
              <HelpTip
                v-if="syntax"
                class="q-mr-xs"
                :text="`Usage: ${syntax}`"
              />
              <q-btn
                v-if="form.script"
                :loading="viewing"
                size="sm"
                icon="code"
                aria-label="View the script code"
                round
                dense
                flat
                @click="viewCode"
              >
                <q-tooltip>View the script code</q-tooltip>
              </q-btn>
            </template>
          </rmm-select>
          <div v-if="variables.length" class="rmm-label">Script inputs</div>
          <ScriptVariablesForm
            v-model="form.env_vars"
            v-model:valid="varsValid"
            :variables="variables"
          />
          <rmm-select
            v-model="form.args"
            v-bind="chipSelect"
            label="Script arguments"
            hint="Press Enter after each argument. {{agent.hostname}}-style values are filled in per agent"
          />
          <rmm-select
            v-model="form.env_vars"
            v-bind="chipSelect"
            :option-label="envLabel"
            :hint="
              variables.length
                ? 'Includes the script inputs above. Press Enter after each extra KEY=value pair'
                : 'Press Enter after each KEY=value pair'
            "
            label="Environment variables"
          />
          <q-input
            v-model.number="form.timeout"
            :rules="[
              (v) => !!v || 'Required',
              (v) => v >= 5 || 'Minimum is 5 seconds',
            ]"
            type="number"
            label="Timeout (seconds)"
            hint="The script is stopped after this long"
            style="max-width: 220px"
            outlined
            dense
            stack-label
            hide-bottom-space
          />
        </q-card-section>

        <q-card-section
          v-if="windowsUser || !hosted"
          class="q-pt-none q-gutter-y-sm"
        >
          <div class="rmm-label">Run options</div>
          <div v-if="windowsUser" class="row items-center no-wrap">
            <q-checkbox v-model="form.run_as_user" label="Run as user" dense />
            <HelpTip class="q-ml-xs" :text="runAsUserToolTip" />
          </div>
          <q-checkbox
            v-if="!hosted"
            v-model="form.run_on_server"
            :disable="!serverScripts"
            dense
            label="Run on server"
            @update:model-value="result = null"
          >
            <q-tooltip v-if="!serverScripts"
              >Enable server side scripts globally to activate this
              feature.</q-tooltip
            >
            <q-tooltip v-else
              >Run the script on the UniversalLocal RMM server in the context of
              this agent.</q-tooltip
            >
          </q-checkbox>
        </q-card-section>

        <q-card-section v-if="!form.run_on_server" class="q-pt-none">
          <div id="run-script-output-label" class="rmm-label">Output</div>
          <q-option-group
            v-model="form.output"
            :options="outputChoices"
            aria-labelledby="run-script-output-label"
            color="primary"
            inline
            dense
          />
          <div class="run-script__hint q-mt-xs">{{ outputHint }}</div>
        </q-card-section>

        <template v-if="form.output === 'email'">
          <q-card-section class="q-pt-none">
            <div class="q-gutter-sm">
              <q-radio
                v-for="m in emailModes"
                :key="m.value"
                v-model="form.emailMode"
                :val="m.value"
                :label="m.label"
                dense
              />
            </div>
          </q-card-section>
          <q-card-section v-if="form.emailMode === 'custom'" class="q-pt-none">
            <rmm-select
              v-model="form.emails"
              v-bind="chipSelect"
              label="Email recipients"
              hint="Press Enter after each email address"
            />
          </q-card-section>
        </template>

        <q-card-section v-if="form.output === 'collector'" class="q-pt-none">
          <rmm-select
            v-model="form.custom_field"
            :options="customFieldOptions"
            :rules="[(v: number) => !!v || 'Required']"
            label="Select custom field"
            outlined
            mapOptions
            filterable
          />
          <q-checkbox v-model="form.save_all_output" label="Save all output">
            <q-tooltip
              >Saves the whole output instead of only its last line</q-tooltip
            >
          </q-checkbox>
        </q-card-section>

        <FormButtons label="Run" :loading="loading" />

        <RunScriptResult
          v-if="result !== null"
          :result="result"
          :on-server="form.run_on_server"
        />
      </q-form>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useStore } from "vuex";
import { useDialogPluginComponent, useQuasar } from "quasar";
import { runScript } from "@/api/agents";
import { fetchScripts as loadScripts } from "@/api/scripts";
import { useCustomFieldDropdown } from "@/composables/core";
import { useScriptDropdown } from "@/composables/scripts";
import { withStepUp } from "@/components/vault/stepUp";
import { notifyError, notifySuccess } from "@/utils/notify";
import { runAsUserToolTip } from "@/constants/constants";
import { envMasker } from "@/utils/scriptVariables";
import { deviceName } from "@/utils/deviceName";
import RmmSelect from "@/components/ui/RmmSelect.vue";
import ScriptVariablesForm from "@/components/scripts/ScriptVariablesForm.vue";
import ScriptFormModal from "@/components/scripts/ScriptFormModal.vue";
import DialogHeader from "@/components/ui/DialogHeader.vue";
import HelpTip from "@/components/ui/HelpTip.vue";
import FormButtons from "@/components/agents/FormButtons.vue";
import RunScriptResult from "@/components/modals/agents/RunScriptResult.vue";

import type { Agent } from "@/types/agents";

const props = defineProps<{
  agent: Agent;
  script?: number; // preselected script id
}>();
defineEmits([...useDialogPluginComponent.emits]);
const { dialogRef, onDialogHide } = useDialogPluginComponent();

const store = useStore();
const serverScripts = computed(() => store.state.server_scripts_enabled);
const hosted = computed(() => store.state.hosted);
const $q = useQuasar();

const sizeButtons = [
  {
    label: "Minimize",
    icon: "minimize",
    target: false,
    tip: "Restore the normal size",
  },
  {
    label: "Maximize",
    icon: "crop_square",
    target: true,
    tip: "Fill the whole window",
  },
];

// what each output mode does; the picker lists them in this order
const outputModes: Record<string, { label: string; help: string }> = {
  wait: {
    label: "Wait for output",
    help: "Waits for the script to finish and shows its output here.",
  },
  forget: {
    label: "Fire and forget",
    help: "Starts the script and closes this dialog. The output is saved to the agent's history.",
  },
  email: {
    label: "Email results",
    help: "Runs in the background and emails the output when it finishes.",
  },
  collector: {
    label: "Save results to custom field",
    help: "Waits for the script and saves the last line of its output to a custom field.",
  },
  note: {
    label: "Save results to agent notes",
    help: "Waits for the script and saves its output as an agent note.",
  },
};
const outputChoices = Object.entries(outputModes).map(([value, m]) => ({
  value,
  label: m.label,
}));
const emailModes = [
  { value: "default", label: "Use email addresses from global settings" },
  { value: "custom", label: "Custom emails" },
];
const chipSelect = {
  useInput: true,
  multiple: true,
  hideDropdownIcon: true,
  inputDebounce: "0",
  newValueMode: "add",
  hideBottomSpace: true,
};

const { customFieldOptions } = useCustomFieldDropdown({ onMount: true });
const {
  script,
  syntax,
  variables,
  defaultArgs: argList,
  defaultEnvVars: envList,
  defaultTimeout: timeoutSecs,
  filterByPlatformOptions: scriptChoices,
} = useScriptDropdown({
  onMount: true,
  script: props.script,
  plat: props.agent.plat,
});
// password values stay hidden in the chips
const envLabel = computed(() => envMasker(variables.value));

const form = ref({
  script,
  output: "wait",
  args: argList,
  env_vars: envList,
  emails: [],
  emailMode: "default",
  custom_field: null,
  timeout: timeoutSecs,
  save_all_output: false,
  run_as_user: false,
  run_on_server: false,
});

const result = ref(null);
const loading = ref(false);
const maximized = ref(false);
const varsValid = ref(true);
const viewing = ref(false);

const windowsUser = computed(
  () => props.agent.plat === "windows" && !form.value.run_on_server,
);
const outputHint = computed(() =>
  form.value.output === "collector" && form.value.save_all_output
    ? "Waits for the script and saves its whole output to a custom field."
    : outputModes[form.value.output].help,
);

async function sendScript() {
  if (!varsValid.value) {
    return notifyError("Some script inputs are missing or invalid");
  }
  result.value = null;
  loading.value = true;
  try {
    result.value = await withStepUp($q, (config) =>
      runScript(props.agent.agent_id, form.value, config),
    );
    if (!result.value) return;
  } catch (e) {
    console.error("run failed", e?.response?.status);
    return;
  } finally {
    loading.value = false;
  }

  if (form.value.output === "forget") {
    onDialogHide();
    notifySuccess(result.value);
  }
}

// picker rows lack name, description and category, so fetch the full script
async function viewCode() {
  viewing.value = true;
  try {
    const scripts = await loadScripts({
      showCommunityScripts: true,
      showHiddenScripts: true,
    });
    const full = scripts.find(
      (s: { id: number }) => s.id === form.value.script,
    );
    if (!full) return notifyError("This script no longer exists");
    $q.dialog({
      component: ScriptFormModal,
      componentProps: { script: full, readonly: true },
    });
  } catch (e) {
    console.error("loading the script failed", e?.response?.status);
  } finally {
    viewing.value = false;
  }
}

// the recipients only make sense for the mode they were typed in
watch([() => form.value.output, () => form.value.emailMode], () => {
  form.value.emails = [];
});
</script>

<style scoped>
.run-script__hint {
  color: var(--rmm-text-muted);
  font-size: var(--rmm-fs-xs);
  line-height: 1.4;
}
</style>
