<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-form @submit.prevent ref="formRef">
    <q-card-section class="q-gutter-y-sm">
      <q-input
        v-model="task.name"
        :rules="[(v) => !!v || 'Required']"
        label="Descriptive name of task"
        outlined
        dense
        hide-bottom-space
      />
    </q-card-section>

    <q-card-section v-show="!agentTask" class="q-pt-none">
      <div class="row items-center q-gutter-x-xs">
        <div id="task-platforms-label" class="rmm-label">
          Supported Platforms
        </div>
        <HelpTip
          text="Only agents on these platforms get the task; Linux, macOS or FreeBSD limits the schedule"
        />
      </div>
      <q-option-group
        v-model="task.task_supported_platforms"
        :options="platformChoices"
        aria-labelledby="task-platforms-label"
        type="checkbox"
        inline
      />
    </q-card-section>

    <q-card-section class="q-pt-none">
      <div class="row items-center no-wrap">
        <q-checkbox
          v-model="collector"
          label="Collector Task"
          class="q-py-sm"
          dense
          @update:model-value="resetCollector"
        />
        <HelpTip
          class="q-ml-xs"
          text="Saves the output to a custom field; the task then fails only if it writes to stderr"
        />
      </div>
      <template v-if="collector">
        <rmm-select
          v-model="task.custom_field"
          :options="customFieldOptions"
          :rules="[(v) => !!v || 'Required']"
          :hint="collectorHint"
          label="Custom Field to update"
          outlined
          mapOptions
          filterable
        />
        <q-checkbox
          v-model="task.collector_all_output"
          label="Save all output"
          class="q-py-sm"
          dense
        />
      </template>
    </q-card-section>

    <q-card-section class="q-pt-none">
      <rmm-select
        v-model="task.alert_severity"
        :options="severityChoices"
        :rules="[(v) => !!v || 'Required']"
        label="Alert Severity"
        hint="Severity of the alert raised when the task fails"
        outlined
        mapOptions
      />
    </q-card-section>
  </q-form>
</template>

<script setup>
import { computed, ref, toRef } from "vue";
import { useCustomFieldDropdown } from "@/composables/core";
import RmmSelect from "@/components/ui/RmmSelect.vue";
import HelpTip from "@/components/ui/HelpTip.vue";

const props = defineProps({
  draft: { type: Object, required: true },
  agentTask: Boolean,
});

const task = toRef(props, "draft");

const platformChoices = [
  { label: "Windows", value: "windows" },
  { label: "Linux", value: "linux" },
  { label: "macOS", value: "darwin" },
  { label: "FreeBSD", value: "freebsd" },
];
const severityChoices = [
  { label: "Informational", value: "info" },
  { label: "Warning", value: "warning" },
  { label: "Error", value: "error" },
];

const { customFieldOptions } = useCustomFieldDropdown({ onMount: true });

const formRef = ref(null);
const collector = ref(!!task.value.custom_field);
const collectorHint = computed(() =>
  task.value.collector_all_output
    ? "All script output will be saved to custom field selected"
    : "The last line of script output will be saved to custom field selected",
);

function resetCollector() {
  task.value.custom_field = null;
  task.value.collector_all_output = false;
}

defineExpose({ validate: () => formRef.value.validate() });
</script>
