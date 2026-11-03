<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-dialog
    ref="dialogRef"
    @hide="onDialogHide"
    persistent
    :maximized="$q.screen.lt.md"
    aria-labelledby="task-form-title"
  >
    <!-- a column, so the stepper fills a maximized card down to the buttons -->
    <q-card
      class="q-dialog-plugin column no-wrap"
      :style="
        $q.screen.lt.md ? null : 'width: min(960px, 95vw); max-width: 95vw'
      "
    >
      <DialogHeader
        title-id="task-form-title"
        :title="
          task ? `Edit automated task: ${task.name}` : 'Add automated task'
        "
        subtitle="Runs scripts or commands on a schedule, once, or when a check fails"
      />
      <!-- phones show the step numbers only, the labels take a third of the height -->
      <q-stepper
        v-model="step"
        ref="stepper"
        class="col-grow"
        color="primary"
        animated
        :contracted="$q.screen.lt.sm"
      >
        <q-step
          :name="1"
          prefix="1"
          title="Task details"
          caption="Name, output and alerting"
          :done="step > 1"
          :error="!stepOk[1]"
        >
          <TaskStepDetails
            ref="detailsStep"
            :draft="draft"
            :agent-task="agentTask"
          />
        </q-step>

        <q-step
          :name="2"
          prefix="2"
          title="Actions"
          caption="Scripts and commands to run"
          :done="step > 2"
          :error="!stepOk[2]"
        >
          <TaskStepActions :draft="draft" />
        </q-step>

        <q-step
          :name="3"
          prefix="3"
          title="Schedule"
          caption="When the task runs"
          :error="!stepOk[3]"
        >
          <TaskStepSchedule
            ref="scheduleStep"
            v-model:monthly-type="monthlyType"
            :draft="draft"
            :parent="parent"
            :posix="posix"
          />
        </q-step>
      </q-stepper>

      <q-card-actions align="right">
        <q-btn v-close-popup flat label="Cancel" />
        <q-btn v-if="step > 1" flat label="Back" @click="stepper.previous()" />
        <q-btn
          v-if="step < 3"
          color="primary"
          label="Next"
          unelevated
          @click="goNext"
        />
        <q-btn
          v-else
          :label="task ? 'Save task' : 'Add task'"
          color="primary"
          :loading="saving"
          unelevated
          @click="goNext"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { computed, reactive, ref, watch } from "vue";
import { extend, useDialogPluginComponent } from "quasar";
import { updateTask, saveTask } from "@/api/tasks";
import { notifyError, notifySuccess } from "@/utils/notify";
import {
  convertFromBitArray as packBits,
  convertToBitArray as unpackBits,
  formatDateInputField,
} from "@/utils/format";
import DialogHeader from "@/components/ui/DialogHeader.vue";
import TaskStepDetails from "@/components/tasks/TaskStepDetails.vue";
import TaskStepActions from "@/components/tasks/TaskStepActions.vue";
import TaskStepSchedule from "@/components/tasks/TaskStepSchedule.vue";

defineOptions({ name: "AddAutomatedTask" });
defineEmits([...useDialogPluginComponent.emits]);

const props = defineProps({
  parent: Object, // policy or agent the task belongs to
  task: Object, // set when editing
  plat: String,
});

const { dialogRef, onDialogHide, onDialogOK } = useDialogPluginComponent();

const agentTask = !!props.plat;

const BIT_FIELDS = [
  "run_time_bit_weekdays",
  "monthly_months_of_year",
  "monthly_days_of_month",
  "monthly_weeks_of_month",
];

const fill = (keys, make) => Object.fromEntries(keys.map((k) => [k, make()]));

// everything that belongs to one run type
const scheduleDefaults = () => ({
  ...fill(BIT_FIELDS, () => []),
  ...fill(
    [
      "assigned_check",
      "expire_date",
      "task_repetition_interval",
      "task_repetition_duration",
      "random_task_delay",
    ],
    () => null,
  ),
  ...fill(["weekly_interval", "daily_interval"], () => 1),
  ...fill(
    ["remove_if_not_scheduled", "stop_task_at_duration_end"],
    () => false,
  ),
  task_instance_policy: 0,
});

const blankTask = () => ({
  ...props.parent,
  ...scheduleDefaults(),
  actions: [],
  custom_field: null,
  name: null,
  run_time_date: formatDateInputField(Date.now()),
  ...fill(["run_asap_after_missed", "continue_on_error"], () => true),
  task_type: "daily",
  alert_severity: "info",
  collector_all_output: false,
  task_supported_platforms: [],
});

const draft = reactive(props.task ? extend(true, {}, props.task) : blankTask());
const monthlyType = ref("days");

const POSIX = ["linux", "darwin", "freebsd"];
const posix = computed(
  () =>
    (!!props.plat && props.plat !== "windows") ||
    !!draft.task_supported_platforms?.some((p) => POSIX.includes(p)),
);

// new tasks start with the platform of the agent, policies with windows
function defaultPlatforms() {
  if (props.task) return props.task.task_supported_platforms;
  if (!props.plat || !posix.value) return ["windows"];
  return POSIX.includes(props.plat) ? [props.plat] : [];
}
draft.task_supported_platforms = defaultPlatforms();

// editing: translate stored bit masks and dates into what the inputs expect
function loadStored() {
  for (const k of BIT_FIELDS) {
    draft[k] = draft[k] ? unpackBits(draft[k]) : [];
  }
  draft.run_time_date = formatDateInputField(draft.run_time_date, true);
  if (draft.expire_date) {
    draft.expire_date = formatDateInputField(draft.expire_date, true);
  }
  if (draft.task_type === "monthlydow") {
    draft.task_type = "monthly";
    monthlyType.value = "weeks";
  }
}
if (props.task) loadStored();

function payload() {
  const out = { ...draft };
  for (const k of BIT_FIELDS) {
    out[k] = draft[k].length ? packBits(draft[k]) : null;
  }
  out.run_time_date += "Z";
  if (draft.expire_date) out.expire_date += "Z";
  if (draft.task_type === "monthly" && monthlyType.value === "weeks") {
    out.task_type = "monthlydow";
  }
  return out;
}

// switching the run type drops everything that belonged to the old one
watch(
  () => draft.task_type,
  () => {
    Object.assign(draft, scheduleDefaults());
  },
);

const step = ref(1);
const stepper = ref(null);
const detailsStep = ref(null);
const scheduleStep = ref(null);
const saving = ref(false);
const stepOk = reactive({ 1: true, 2: true, 3: true });

async function save() {
  saving.value = true;
  try {
    const result = props.task
      ? await updateTask(draft.id, payload())
      : await saveTask(payload());
    notifySuccess(result);
    onDialogOK();
  } catch (e) {
    console.error("task save failed", e?.response?.status);
  }
  saving.value = false;
}

async function goNext() {
  if (step.value === 1 && draft.task_supported_platforms.length === 0) {
    return notifyError("There must be at least one supported platform");
  }

  if (step.value === 2) {
    stepOk[2] = draft.actions.length > 0;
    if (!stepOk[2]) return notifyError("There must be at least one action");
    return stepper.value.next();
  }

  if (step.value === 1) {
    stepOk[1] = await detailsStep.value.validate();
    if (stepOk[1]) stepper.value.next();
  } else {
    stepOk[3] = await scheduleStep.value.validate();
    if (stepOk[3]) save();
  }
}
</script>
