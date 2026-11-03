<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <div class="scroll" style="max-height: 60vh">
    <div class="text-caption rmm-muted q-px-md q-pb-sm">
      Actions run one after another as SYSTEM (root on Linux, macOS and
      FreeBSD). A script set to run as the logged-in user in the Script Manager
      runs as that user.
    </div>
    <q-form @submit.prevent="addAction">
      <div class="row q-py-sm q-px-md q-col-gutter-sm items-start">
        <div class="col-12">
          <div id="task-action-type-label" class="rmm-label">Add an action</div>
          <q-option-group
            v-model="kind"
            :options="kindChoices"
            aria-labelledby="task-action-type-label"
            inline
          />
          <div v-if="noScripts" class="text-caption rmm-muted q-pl-sm">
            No scripts available to this role. Settings -> Script Manager to
            upload one, or use a Command action below.
          </div>
        </div>

        <template v-if="kind === 'script'">
          <rmm-select
            v-model="script"
            :options="scriptOptions"
            class="col-12 col-md-8"
            label="Select script"
            outlined
            mapOptions
            filterable
          />
          <q-input v-bind="timeoutProps" v-model.number="timeoutSecs" />
          <div v-if="variables.length" class="col-12">
            <div class="rmm-label q-mb-sm">Script inputs</div>
            <ScriptVariablesForm
              v-model="envList"
              :variables="variables"
              stored-in="task"
            />
          </div>
          <q-select
            v-model="argList"
            v-bind="chipProps"
            class="col-12 col-md-6"
            label="Script arguments"
            hint="Press Enter after each argument"
          />
          <q-select
            v-model="envList"
            v-bind="chipProps"
            class="col-12 col-md-6"
            label="Environment variables"
            :hint="envHint"
            :option-label="envLabel"
          />
        </template>

        <template v-else>
          <q-input
            v-model="command"
            class="col-12 col-md-8"
            label="Command"
            dense
            outlined
          />
          <q-input v-bind="timeoutProps" v-model.number="timeoutSecs" />
          <div class="col-12">
            <div id="task-shell-label" class="rmm-label">Shell</div>
            <q-option-group
              v-model="shell"
              :options="shellChoices"
              aria-labelledby="task-shell-label"
              inline
            />
          </div>
          <q-input
            v-if="shell === 'custom'"
            v-model="customShell"
            class="col-12 col-md-8"
            label="Custom shell"
            placeholder="/usr/bin/python3"
            hint="Full path of the interpreter"
            stack-label
            outlined
            dense
            hide-bottom-space
          />
        </template>

        <div class="col-12">
          <q-btn
            type="submit"
            icon="add"
            label="Add action"
            color="primary"
            class="q-px-sm"
            outline
            dense
            no-caps
          />
        </div>
      </div>
    </q-form>

    <q-separator class="q-my-sm" />
    <div class="row items-center q-px-md">
      <div class="rmm-label">Actions ({{ task.actions.length }})</div>
      <q-space />
      <q-checkbox
        v-model="task.continue_on_error"
        label="Continue on Errors"
        dense
      />
      <HelpTip
        class="q-ml-xs"
        text="When off, the task stops after a script writes to stderr or a command exits with an error"
      />
    </div>

    <EmptyState
      v-if="task.actions.length === 0"
      icon="playlist_add"
      title="No actions yet"
      text="Add a script or command above. The task runs them from top to bottom; drag to change the order."
    />
    <div v-show="task.actions.length > 0" class="q-pt-sm" style="height: 150px">
      <draggable
        v-model="task.actions"
        class="q-list"
        handle=".handle"
        ghost-class="ghost"
        item-key="index"
      >
        <template #item="{ index, element }">
          <q-item>
            <q-item-section avatar>
              <q-icon
                class="handle task-action__icon"
                style="cursor: move"
                name="drag_handle"
              >
                <q-tooltip>Drag to change the order</q-tooltip>
              </q-icon>
            </q-item-section>
            <q-item-section v-if="element.type === 'script'">
              <q-item-label>
                <q-icon
                  size="sm"
                  name="description"
                  class="task-action__icon"
                />
                &nbsp; {{ element.name }}
              </q-item-label>
              <q-item-label
                v-for="line in scriptDetails(element)"
                :key="line"
                caption
              >
                {{ line }}
              </q-item-label>
            </q-item-section>
            <q-item-section v-else>
              <q-item-label>
                <q-icon size="sm" name="terminal" class="task-action__icon" />
                &nbsp;
                <q-icon
                  size="sm"
                  :name="shellIcon(element.shell)"
                  class="task-action__icon"
                />
                {{ element.command }}
              </q-item-label>
              <q-item-label caption>
                Shell: {{ element.shell }} · Timeout: {{ element.timeout }}
              </q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-btn
                flat
                round
                dense
                size="sm"
                color="negative"
                icon="close"
                aria-label="Remove action"
                @click="task.actions.splice(index, 1)"
              >
                <q-tooltip>Remove this action from the task</q-tooltip>
              </q-btn>
            </q-item-section>
          </q-item>
        </template>
      </draggable>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, toRef, watch } from "vue";
// ES build: the bundled one calls new Function, which the CSP refuses
import draggable from "vuedraggable/src/vuedraggable";
import { useScriptDropdown } from "@/composables/scripts";
import { notifyError } from "@/utils/notify";
import { envMasker, isFormValid } from "@/utils/scriptVariables";
import RmmSelect from "@/components/ui/RmmSelect.vue";
import EmptyState from "@/components/ui/EmptyState.vue";
import HelpTip from "@/components/ui/HelpTip.vue";
import ScriptVariablesForm from "@/components/scripts/ScriptVariablesForm.vue";

const props = defineProps({
  draft: { type: Object, required: true },
});
const task = toRef(props, "draft");

const POSIX = ["linux", "darwin", "freebsd"];
const SHELLS = [
  { label: "CMD", value: "cmd", plats: ["windows"] },
  { label: "PowerShell", value: "powershell", plats: ["windows"] },
  { label: "Bash", value: "/bin/bash", plats: POSIX },
  { label: "Custom", value: "custom" },
];

const timeoutProps = {
  class: "col-12 col-md-4",
  type: "number",
  label: "Timeout (seconds)",
  hint: "The action is stopped after this long",
  outlined: true,
  dense: true,
  hideBottomSpace: true,
};
const chipProps = {
  useInput: true,
  useChips: true,
  multiple: true,
  hideDropdownIcon: true,
  inputDebounce: "0",
  newValueMode: "add",
  hideBottomSpace: true,
  outlined: true,
  dense: true,
};

const {
  script,
  scriptName,
  scriptOptions,
  variables,
  defaultTimeout: timeoutSecs,
  defaultArgs: argList,
  defaultEnvVars: envList,
  reset: resetScript,
} = useScriptDropdown({ onMount: true });
timeoutSecs.value = 30;

// only the shells of the task's platforms
function shellFits({ plats }) {
  const picked = task.value.task_supported_platforms ?? [];
  return !plats || !picked.length || picked.some((p) => plats.includes(p));
}

const kind = ref("script");
const command = ref("");
const shell = ref(SHELLS.find(shellFits).value);
const customShell = ref("");
// a choice that no longer fits stays listed while it is picked
const shellChoices = computed(() =>
  SHELLS.filter((o) => shellFits(o) || o.value === shell.value),
);

const noScripts = computed(() => scriptOptions.value.length === 0);
const kindChoices = computed(() => [
  { label: "Script", value: "script", disable: noScripts.value },
  { label: "Command", value: "cmd" },
]);

// a command-only task is valid, so leave the disabled "Script" choice
watch(
  noScripts,
  (none) => {
    if (none && kind.value === "script") kind.value = "cmd";
  },
  { immediate: true },
);

const envHint = computed(() =>
  variables.value.length
    ? "Includes the script inputs above. Press Enter after each extra KEY=value pair"
    : "Press Enter after each KEY=value pair",
);

// values of password inputs stay hidden in the chips and in the list
const envLabel = computed(() => envMasker(variables.value));
function envText(action) {
  const found = scriptOptions.value.find((o) => o.value === action.script);
  const mask = envMasker(found ? found.variables || [] : null, true);
  return JSON.stringify((action.env_vars || []).map(mask));
}

function shellIcon(name) {
  if (name === "cmd") return "mdi-microsoft-windows";
  if (name === "powershell") return "mdi-powershell";
  return "mdi-console";
}

const scriptDetails = (action) => [
  `Arguments: ${action.script_args}`,
  `Env Vars: ${envText(action)}`,
  `Timeout: ${action.timeout}`,
];

function addAction() {
  const isScript = kind.value === "script";
  if (isScript && (!script.value || !timeoutSecs.value)) {
    return notifyError("Script and timeout must be set");
  }
  if (!isScript && (!command.value || !timeoutSecs.value)) {
    return notifyError("A command and timeout must be set");
  }
  if (!isScript && shell.value === "custom" && !customShell.value.trim()) {
    return notifyError("Enter the custom shell");
  }
  if (isScript && !isFormValid(variables.value, envList.value)) {
    return notifyError("Some script inputs are missing or invalid");
  }

  task.value.actions.push(
    isScript
      ? {
          type: "script",
          name: scriptName.value,
          script: script.value,
          timeout: timeoutSecs.value,
          script_args: argList.value,
          env_vars: envList.value,
        }
      : {
          type: "cmd",
          command: command.value,
          shell:
            shell.value === "custom" ? customShell.value.trim() : shell.value,
          timeout: timeoutSecs.value,
        },
  );

  resetScript();
  command.value = "";
}
</script>

<style scoped>
.ghost {
  opacity: 0.5;
}

.task-action__icon {
  color: var(--rmm-text-subtle);
}
</style>
