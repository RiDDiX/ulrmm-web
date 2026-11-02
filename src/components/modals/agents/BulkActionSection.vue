<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-card-section class="q-pb-none">
    <div class="bulk-section-title">Action</div>
    <div
      v-if="mode === 'suspend' || mode === 'wake'"
      class="text-body2 rmm-muted"
    >
      {{ actionText }}.
    </div>
  </q-card-section>

  <q-card-section v-if="mode === 'package'" class="q-pb-none">
    <rmm-select
      v-model="state.package"
      :options="packageOptions"
      :rules="required"
      label="Select package"
      outlined
      mapOptions
      filterable
    />
    <div
      v-if="selectedPackage?.allow_unsigned"
      class="text-caption text-warning q-pl-sm q-mt-xs"
    >
      {{
        selectedPackage.kind === "driver"
          ? "This package also installs unsigned driver catalogs."
          : "This package also installs an unsigned installer."
      }}
    </div>
  </q-card-section>
  <q-card-section
    v-if="
      selectedPackage?.plat === 'windows' &&
      !['driver', 'archive'].includes(selectedPackage.kind)
    "
  >
    <BulkChoice
      v-model="state.run_as"
      :options="RUN_AS_OPTIONS"
      title="Run as"
    />
    <div
      v-if="state.run_as === 'user'"
      class="text-caption rmm-muted q-pl-sm q-mt-xs"
    >
      Runs in the logged-in user's session, with admin rights only if that user
      is an administrator. Agents where nobody is logged in are refused.
    </div>
  </q-card-section>

  <q-card-section v-if="mode === 'script'" class="q-gutter-y-sm q-pb-none">
    <rmm-select
      v-model="state.script"
      :options="scriptChoices"
      :rules="required"
      label="Select script"
      outlined
      mapOptions
      filterable
    >
      <template v-if="syntax" #after>
        <HelpTip class="q-mr-xs" :text="`Usage: ${syntax}`" />
      </template>
    </rmm-select>
    <div v-if="variables.length" class="rmm-label">Script inputs</div>
    <ScriptVariablesForm
      v-model="state.env_vars"
      v-model:valid="varsValid"
      :variables="variables"
    />
    <rmm-select
      v-model="state.args"
      v-bind="chipSelect"
      label="Script arguments"
      hint="Press Enter after each argument. {{agent.hostname}}-style values are filled in per agent"
    />
    <rmm-select
      v-model="state.env_vars"
      v-bind="chipSelect"
      :option-label="envLabel"
      :hint="
        variables.length
          ? 'Includes the script inputs above. Press Enter after each extra KEY=value pair'
          : 'Press Enter after each KEY=value pair'
      "
      label="Environment variables"
    />
  </q-card-section>

  <q-card-section v-if="mode === 'command'" class="q-pb-none">
    <BulkChoice
      v-model="state.shell"
      :options="shellChoices"
      title="Shell"
      @update:model-value="state.custom_shell = null"
    />
  </q-card-section>
  <q-card-section v-if="state.shell === 'custom'" class="q-pb-none">
    <q-input
      v-model="state.custom_shell"
      :rules="required"
      label="Custom shell"
      placeholder="/usr/bin/python3"
      hint="Full path of the interpreter that runs the command"
      outlined
      dense
      stack-label
      hide-bottom-space
    />
  </q-card-section>
  <q-card-section v-if="mode === 'command'" class="q-pb-none">
    <q-input
      v-model="state.cmd"
      :placeholder="cmdPlaceholder(state.shell)"
      :rules="required"
      label="Command"
      outlined
      stack-label
    />
  </q-card-section>
  <q-card-section v-if="runAsUserAllowed" class="q-pb-none">
    <div class="row items-center no-wrap">
      <q-checkbox v-model="state.run_as_user" label="Run as user" />
      <HelpTip
        class="q-ml-xs"
        :text="
          mode === 'command'
            ? 'Runs as the logged-in user instead of SYSTEM; fails where nobody is logged in'
            : runAsUserToolTip
        "
      />
    </div>
  </q-card-section>

  <q-card-section v-if="mode === 'script'" class="q-pb-none">
    <div class="rmm-label">Save results</div>
    <div class="q-gutter-sm">
      <q-checkbox
        v-model="collector"
        label="Save results to custom field"
        @update:model-value="
          state.custom_field = null;
          state.collector_all_output = false;
        "
      />
      <q-checkbox
        v-model="state.save_to_agent_note"
        label="Save results to agent note"
      />
    </div>
  </q-card-section>

  <q-card-section v-if="mode === 'script' && collector" class="q-pb-none">
    <rmm-select
      v-model="state.custom_field"
      :options="customFieldOptions"
      :rules="required"
      label="Select custom field"
      outlined
      mapOptions
      filterable
    />
    <q-checkbox v-model="state.collector_all_output" label="Save all output">
      <q-tooltip
        >Saves the whole output instead of only its last line</q-tooltip
      >
    </q-checkbox>
  </q-card-section>

  <q-card-section v-if="mode === 'script' || mode === 'command'">
    <q-input
      v-model.number="state.timeout"
      :rules="[
        (v) => !!v || 'Required',
        (v) => v >= 5 || 'Minimum is 5 seconds',
      ]"
      type="number"
      label="Timeout (seconds)"
      hint="Each agent stops it after this long"
      style="max-width: 220px"
      outlined
      dense
      stack-label
      hide-bottom-space
    />
  </q-card-section>

  <q-card-section v-if="mode === 'patch'">
    <BulkChoice
      v-model="state.patchMode"
      :options="patchChoices"
      title="Action"
      aria-label="Patch action"
    />
    <div class="text-caption rmm-muted q-pl-sm q-mt-xs">{{ actionText }}.</div>
  </q-card-section>
</template>

<script setup>
import { computed, toRef } from "vue";
import { cmdPlaceholder } from "@/composables/agents";
import { runAsUserToolTip } from "@/constants/constants";
import { RUN_AS_OPTIONS } from "@/utils/packages";
import { envMasker } from "@/utils/scriptVariables";
import RmmSelect from "@/components/ui/RmmSelect.vue";
import HelpTip from "@/components/ui/HelpTip.vue";
import ScriptVariablesForm from "@/components/scripts/ScriptVariablesForm.vue";
import BulkChoice from "@/components/modals/agents/BulkChoice.vue";

const props = defineProps({
  draft: { type: Object, required: true },
  mode: String,
  actionText: String,
  selectedPackage: Object,
  packageOptions: Array,
  scriptChoices: Array,
  customFieldOptions: Array,
  syntax: String,
  variables: { type: Array, default: () => [] },
});
const state = toRef(props, "draft");
const varsValid = defineModel("valid", { type: Boolean, default: true });
const collector = defineModel("collector", { type: Boolean, default: false });

const required = [(v) => !!v || "Required"];
const patchChoices = [
  { label: "Scan", value: "scan" },
  { label: "Install", value: "install" },
];
const chipSelect = {
  useInput: true,
  multiple: true,
  hideDropdownIcon: true,
  inputDebounce: "0",
  newValueMode: "add",
  hideBottomSpace: true,
  outlined: true,
};

const shellChoices = computed(() =>
  state.value.osType === "windows"
    ? [
        { label: "CMD", value: "cmd" },
        { label: "PowerShell", value: "powershell" },
      ]
    : [
        state.value.osType === "freebsd"
          ? { label: "sh", value: "/bin/sh" }
          : { label: "Bash", value: "/bin/bash" },
        { label: "Custom", value: "custom" },
      ],
);

const runAsUserAllowed = computed(
  () =>
    state.value.osType === "windows" &&
    ["script", "command"].includes(state.value.mode),
);

// password values stay hidden in the chips
const envLabel = computed(() => envMasker(props.variables));
</script>
