<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <div class="scroll" style="height: 60vh; max-height: 60vh">
    <q-form @submit.prevent ref="formRef">
      <q-card-section>
        <div id="task-trigger-label" class="rmm-label">Task run type</div>
        <q-option-group
          v-model="task.task_type"
          label="Task run type"
          aria-labelledby="task-trigger-label"
          :options="runTypeChoices"
          dense
          inline
          @update:model-value="formRef.resetValidation()"
        />
        <div class="text-caption rmm-muted q-mt-sm">
          {{ runTypeHelp[task.task_type] }}
        </div>
      </q-card-section>

      <q-card-section v-if="hasStart" class="row items-start q-pt-none">
        <q-input
          v-model="task.run_time_date"
          :label="posixRecurring ? 'Run at' : 'Start time'"
          :hint="
            posixRecurring
              ? 'Agent timezone will be used. On Linux, macOS and FreeBSD, the selected date is ignored—only the hour and minute are used.'
              : 'Agent timezone will be used'
          "
          :rules="[(v) => !!v || 'Required']"
          class="col-12 col-sm-6 q-pa-sm"
          type="datetime-local"
          stack-label
          outlined
          dense
          hide-bottom-space
        />
        <q-input
          v-if="!posix"
          v-model="task.expire_date"
          class="col-12 col-sm-6 q-pa-sm"
          type="datetime-local"
          label="Expires on"
          hint="Agent timezone will be used. The task stops starting after this; leave empty for no end"
          stack-label
          outlined
          dense
          hide-bottom-space
        />
      </q-card-section>

      <q-card-section
        v-if="['onboarding', 'runonce'].includes(task.task_type)"
        class="row q-pt-none"
      >
        <span class="text-body2">
          {{
            task.task_type === "onboarding"
              ? "This task will run as soon as it's created on the agent."
              : "Start Time must be in the future for run once tasks."
          }}
        </span>
      </q-card-section>

      <q-card-section
        v-if="!posix && task.task_type === 'daily'"
        class="row q-pt-none"
      >
        <q-input
          v-model.number="task.daily_interval"
          :rules="intervalRules('Daily', 255)"
          class="col-12 col-sm-6 q-pa-sm"
          type="number"
          label="Run every"
          hint="1 runs every day, 2 every other day, and so on"
          outlined
          dense
          hide-bottom-space
        >
          <template #append>
            <span class="text-body2">days</span>
          </template>
        </q-input>
        <div class="col-12 col-sm-6 q-pa-sm"></div>
      </q-card-section>

      <q-card-section v-if="task.task_type === 'weekly'" class="row q-pt-none">
        <q-input
          v-if="!posix"
          v-model="task.weekly_interval"
          :rules="intervalRules('Weekly', 52)"
          class="col-12 col-sm-6 q-pa-sm"
          label="Run every"
          hint="1 runs every week, 2 every other week, and so on"
          outlined
          dense
          hide-bottom-space
        >
          <template #append>
            <span class="text-body2">weeks</span>
          </template>
        </q-input>
        <div class="col-12 col-sm-6 q-pa-sm"></div>

        <div class="col-12 q-pa-sm">
          <!-- QOptionGroup takes no rules, see checkWeekdays -->
          <div id="task-weekdays-label" class="text-body2">Run on Days:</div>
          <q-option-group
            v-model="task.run_time_bit_weekdays"
            :options="weekdayChoices"
            aria-labelledby="task-weekdays-label"
            type="checkbox"
            inline
            dense
          />
          <div
            v-if="weekdaysMissing"
            class="text-caption text-negative"
            role="alert"
          >
            Select at least one day
          </div>
        </div>
      </q-card-section>

      <q-card-section v-if="task.task_type === 'monthly'" class="row q-pt-none">
        <div class="col-12 q-pa-sm">
          <q-option-group
            v-model="monthlyType"
            :options="monthlyKinds"
            aria-label="Monthly schedule type"
            inline
          />
          <div class="text-caption rmm-muted">
            {{
              monthlyType === "days"
                ? "Runs on the chosen dates in the chosen months."
                : "Runs on the chosen weekdays of the chosen weeks, e.g. the first Monday."
            }}
          </div>
        </div>

        <TaskMultiSelect
          v-model="task.monthly_months_of_year"
          :options="monthChoices"
          class="col-12 col-sm-4 q-pa-sm"
          label="Run on months"
          all-label="All months"
        />
        <template v-if="monthlyType === 'days'">
          <TaskMultiSelect
            v-model="task.monthly_days_of_month"
            :options="monthDayChoices"
            class="col-12 col-sm-4 q-pa-sm"
            label="Run on days"
            all-label="All days"
          />
          <div class="col-12 col-sm-4"></div>
        </template>
        <template v-else>
          <TaskMultiSelect
            v-model="task.monthly_weeks_of_month"
            :options="weekChoices"
            class="col-12 col-sm-4 q-pa-sm"
            label="Run on weeks"
          />
          <TaskMultiSelect
            v-model="task.run_time_bit_weekdays"
            :options="weekdayChoices"
            class="col-12 col-sm-4 q-pa-sm"
            label="Run on days"
            all-label="All days"
          />
        </template>
      </q-card-section>

      <q-card-section v-if="hasAdvanced" class="row items-start">
        <div v-if="!posix" class="col-12 q-px-sm">
          <div class="rmm-label">Advanced Settings (Windows only)</div>
          <div class="text-caption rmm-muted">
            Durations are 1 to 3 digits followed by d, h, m or s, e.g. 30m.
          </div>
        </div>
        <template v-if="!posix">
          <q-input
            v-for="f in periodFields.slice(0, 2)"
            :key="f.key"
            v-model="task[f.key]"
            :label="f.label"
            :hint="f.hint"
            :placeholder="f.placeholder"
            :disable="f.disable"
            :rules="f.rules"
            class="col-12 col-sm-6 q-pa-sm"
            outlined
            dense
            hide-bottom-space
            lazy-rules
          />

          <div class="col-12 col-sm-6 q-pa-sm row items-center no-wrap">
            <q-checkbox
              v-model="task.stop_task_at_duration_end"
              :disable="!task.task_repetition_interval"
              label="Stop all tasks at the end of duration"
              dense
            />
            <HelpTip
              class="q-ml-xs"
              text="Stops a run that is still going when the repeat duration ends. Needs Repeat task every."
            />
          </div>
          <div class="col-12 col-sm-6"></div>
          <q-input
            v-for="f in periodFields.slice(2)"
            :key="f.key"
            v-model="task[f.key]"
            :label="f.label"
            :hint="f.hint"
            :placeholder="f.placeholder"
            :disable="f.disable"
            :rules="f.rules"
            class="col-12 col-sm-6 q-pa-sm"
            outlined
            dense
            hide-bottom-space
            lazy-rules
          />

          <div class="col-12 col-sm-6"></div>

          <div class="col-12 col-sm-6 q-pa-sm row items-center no-wrap">
            <q-checkbox
              v-model="task.remove_if_not_scheduled"
              :disable="!task.expire_date"
              label="Delete the task after it expires"
              dense
            >
              <q-tooltip
                >Needs an expire date. The task is deleted from Windows and from
                the RMM after it expires</q-tooltip
              >
            </q-checkbox>
          </div>
          <div class="col-12 col-sm-6"></div>

          <div class="col-12 col-sm-6 q-pa-sm row items-center no-wrap">
            <q-checkbox
              v-model="task.run_asap_after_missed"
              :disable="task.task_type === 'runonce'"
              label="Run task ASAP after a scheduled start is missed"
              dense
            >
              <q-tooltip v-if="task.task_type === 'runonce'"
                >Run once tasks always run as soon as possible after a missed
                start</q-tooltip
              >
            </q-checkbox>
            <HelpTip
              class="q-ml-xs"
              text="If the device was off or asleep at the start time, the task runs as soon as it can"
            />
          </div>
          <div class="col-12 col-sm-6"></div>

          <rmm-select
            v-model="task.task_instance_policy"
            :options="instancePolicyChoices"
            :hint="`If the task is due while it still runs: ${
              instancePolicyHelp[task.task_instance_policy] ?? ''
            }`"
            class="col-12 col-sm-6 q-pa-sm"
            label="Task instance policy"
            outlined
            mapOptions
            hide-bottom-space
          />
        </template>
      </q-card-section>

      <q-card-section v-else-if="task.task_type === 'checkfailure'" class="row">
        <rmm-select
          v-model="task.assigned_check"
          :options="checkOptions"
          :rules="[(v) => !!v || 'Required']"
          class="col-12 col-sm-6 q-pa-sm"
          label="Select Check"
          hint="The task runs every time this check fails"
          outlined
          mapOptions
          filterable
        />
      </q-card-section>
    </q-form>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, toRef } from "vue";
import { useCheckDropdown } from "@/composables/checks";
import { validateTimePeriod } from "@/utils/validation";
import { convertPeriodToSeconds } from "@/utils/format";
import RmmSelect from "@/components/ui/RmmSelect.vue";
import HelpTip from "@/components/ui/HelpTip.vue";
import TaskMultiSelect from "@/components/tasks/TaskMultiSelect.vue";

const props = defineProps({
  draft: { type: Object, required: true },
  parent: Object,
  posix: Boolean,
});
const task = toRef(props, "draft");
const monthlyType = defineModel("monthlyType", { type: String });

const runTypeChoices = [
  ["daily", "Daily"],
  ["weekly", "Weekly"],
  ["monthly", "Monthly"],
  ["runonce", "Run Once"],
  ["checkfailure", "On check failure"],
  ["onboarding", "Onboarding"],
  ["manual", "Manual"],
].map(([value, label]) => ({ label, value }));
const runTypeHelp = {
  daily: "Runs every day, or every few days, at the start time.",
  weekly: "Runs on the chosen weekdays at the start time.",
  monthly: "Runs in the chosen months, on set dates or on set weekdays.",
  runonce: "Runs one time at the start time.",
  checkfailure: "Runs every time the check chosen below fails.",
  onboarding:
    "Runs once as soon as the task is created on an agent, e.g. when a new agent joins the policy.",
  manual: "Only runs when someone starts it from the agent's task list.",
};
const monthlyKinds = [
  { label: "On Days", value: "days" },
  { label: "On Weeks", value: "weeks" },
];

// the weekday values are bit flags, Sunday is the lowest bit
const weekdayChoices = [
  ["Monday", 0x2],
  ["Tuesday", 0x4],
  ["Wednesday", 0x8],
  ["Thursday", 0x10],
  ["Friday", 0x20],
  ["Saturday", 0x40],
  ["Sunday", 0x1],
].map(([label, value]) => ({ label, value }));

const monthChoices = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
].map((label, i) => ({ label, value: 1 << i }));

const monthDayChoices = [
  ...Array.from({ length: 31 }, (_, i) => ({
    label: String(i + 1),
    value: 1 << i,
  })),
  { label: "Last Day", value: 0x80000000 },
];

const weekChoices = ["First", "Second", "Third", "Fourth", "Last"].map(
  (name, i) => ({ label: `${name} Week`, value: 1 << i }),
);

const instancePolicyChoices = [
  { label: "Run in Parallel", value: 0 },
  { label: "Queue Task", value: 1 },
  { label: "Ignore", value: 2 },
  { label: "Stop Existing", value: 3 },
];
// indexed like the policy value
const instancePolicyHelp = [
  "a second copy starts next to it",
  "the new run starts after the running one ends",
  "the new start is skipped",
  "the running copy is stopped and a new one starts",
];

const { checkOptions, getCheckOptions } = useCheckDropdown(props.parent);
onMounted(() => getCheckOptions(props.parent));

const formRef = ref(null);
const weekdaysMissing = ref(false);

const hasStart = computed(() =>
  ["runonce", "daily", "weekly", "monthly"].includes(task.value.task_type),
);
const posixRecurring = computed(
  () => props.posix && task.value.task_type !== "runonce",
);
const hasAdvanced = computed(
  () =>
    !["checkfailure", "manual", "onboarding"].includes(task.value.task_type),
);

const intervalRules = (unit, max) => [
  (v) => !!v || "Required",
  (v) => (v > 0 && v <= max) || `${unit} interval must be between 1 and ${max}`,
];

const badPeriod = "Valid values are 1-3 digits followed by (D|d|H|h|M|m|S|s)";
const optionalPeriod = (v) => !v || validateTimePeriod(v) || badPeriod;

const periodFields = computed(() => [
  {
    key: "task_repetition_interval",
    label: "Repeat task every",
    hint: "Starts the task again at this interval after each start",
    placeholder: "e.g. 30m (30 minutes) or 1h (1 hour)",
    rules: [optionalPeriod],
  },
  {
    key: "task_repetition_duration",
    label: "Task repeat duration",
    hint: task.value.task_repetition_interval
      ? "How long the repeating goes on; must be longer than the interval"
      : "Set Repeat task every first",
    placeholder: "e.g. 6h (6 hours) or 1d (1 day)",
    disable: !task.value.task_repetition_interval,
    rules: [
      (v) => validateTimePeriod(v) || badPeriod,
      (v) => (task.value.task_repetition_interval ? !!v : true),
      (v) =>
        convertPeriodToSeconds(v) >=
          convertPeriodToSeconds(task.value.task_repetition_interval) ||
        "Repetition duration must be greater than repetition interval",
    ],
  },
  {
    key: "random_task_delay",
    label: "Random task delay",
    hint: "Delays each start by a random time up to this, to spread the load",
    placeholder: "e.g. 2m (2 minutes) or 1h (1 hour)",
    rules: [optionalPeriod],
  },
]);

async function validate() {
  const ok = await formRef.value.validate();
  weekdaysMissing.value =
    task.value.task_type === "weekly" &&
    task.value.run_time_bit_weekdays.length === 0;
  return ok && !weekdaysMissing.value;
}

defineExpose({ validate });
</script>
