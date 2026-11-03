<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-dialog
    ref="dialogRef"
    persistent
    aria-labelledby="core-schedule-form-title"
    @hide="onDialogHide"
  >
    <q-card class="q-dialog-plugin rmm-dialog--md">
      <DialogHeader
        title-id="core-schedule-form-title"
        :title="schedule ? 'Edit schedule' : 'New schedule'"
        subtitle="A reusable time plan that report schedules run on"
      />

      <q-form @submit.prevent="submit">
        <q-card-section class="q-pb-none">
          <q-input
            v-model="form.name"
            label="Name"
            :rules="required"
            outlined
            dense
          />
        </q-card-section>

        <q-card-section class="q-pb-none">
          <div class="row items-center q-gutter-xs q-mb-xs">
            <span id="core-schedule-type-label" class="rmm-label">Repeat</span>
            <HelpTip
              text="Changing this clears the days, weeks and months picked below"
            />
          </div>
          <q-option-group
            v-model="form.schedule_type"
            :options="REPEAT"
            aria-labelledby="core-schedule-type-label"
            dense
            inline
          />
        </q-card-section>

        <q-card-section>
          <q-input
            v-model="form.run_time"
            type="time"
            label="Run at"
            hint="In the report schedule's time zone, or the server default when it has none"
            :rules="required"
            stack-label
            outlined
            dense
          />
        </q-card-section>

        <q-card-section
          v-if="form.schedule_type === 'weekly'"
          class="q-pt-none"
        >
          <span class="rmm-label">Run on days</span>
          <span v-if="weekdaysMissing" class="text-negative q-ml-xs"
            >*Required</span
          >
          <q-option-group
            v-model="form.run_time_weekdays"
            :options="WEEKDAYS"
            type="checkbox"
            inline
            dense
          />
        </q-card-section>

        <q-card-section
          v-if="form.schedule_type === 'monthly'"
          class="row q-pt-none"
        >
          <div class="col-12 row items-center no-wrap q-px-sm">
            <q-option-group
              v-model="form.monthly_type"
              :options="MONTHLY_KINDS"
              inline
            />
            <HelpTip
              text="On days: dates like the 1st or the last day. On weeks: e.g. the second Tuesday"
            />
          </div>

          <ScheduleMultiSelect
            v-model="form.monthly_months_of_year"
            label="Run on months"
            all-label="All months"
            :options="MONTHS"
          />

          <template v-if="form.monthly_type === 'days'">
            <ScheduleMultiSelect
              v-model="form.monthly_days_of_month"
              label="Run on days"
              hint="29 to 31 are skipped in shorter months; Last Day runs every month"
              all-label="All days"
              :options="MONTH_DAYS"
            />
            <div class="col-4"></div>
          </template>

          <template v-else>
            <ScheduleMultiSelect
              v-model="form.monthly_weeks_of_month"
              label="Run on weeks"
              hint="Last Week is day 29 to the end; in a 28-day February, days 22 to 28"
              :options="WEEKS"
            />
            <ScheduleMultiSelect
              v-model="form.run_time_weekdays"
              label="Run on days"
              all-label="All days"
              :options="WEEKDAYS"
            />
          </template>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn v-close-popup label="Cancel" flat dense />
          <q-btn
            color="primary"
            :loading="saving"
            label="Save"
            type="submit"
            unelevated
            dense
          />
        </q-card-actions>
      </q-form>
    </q-card>
  </q-dialog>
</template>

<script lang="ts" setup>
import { reactive, ref, watch } from "vue";
import { date, useDialogPluginComponent } from "quasar";
import { until } from "@vueuse/shared";

import { useScheduleShared } from "../api";
import HelpTip from "@/components/ui/HelpTip.vue";
import DialogHeader from "@/components/ui/DialogHeader.vue";
import ScheduleMultiSelect from "./ScheduleMultiSelect.vue";

import type { Schedule } from "../types";

interface Props {
  schedule?: Schedule;
}
const props = defineProps<Props>();
defineEmits(useDialogPluginComponent.emits);

const { onDialogHide, onDialogOK, dialogRef } = useDialogPluginComponent();
const {
  isLoading: saving,
  isError,
  addSchedule,
  editSchedule,
} = useScheduleShared;

const required = [(val: string) => !!val || "*Required"];

// value = position in the list plus `first`
const numbered = (labels: string[], first: number) =>
  labels.map((label, i) => ({ label, value: i + first }));

const REPEAT = [
  { label: "Daily", value: "daily" },
  { label: "Weekly", value: "weekly" },
  { label: "Monthly", value: "monthly" },
];
const MONTHLY_KINDS = [
  { label: "On days", value: "days" },
  { label: "On weeks", value: "weeks" },
];
// the server counts weekdays from Monday = 0
const WEEKDAYS = numbered(
  "Monday Tuesday Wednesday Thursday Friday Saturday Sunday".split(" "),
  0,
);
const MONTHS = numbered(
  "January February March April May June July August September October November December".split(
    " ",
  ),
  1,
);
const WEEKS = numbered(
  ["First", "Second", "Third", "Fourth", "Last"].map((w) => `${w} Week`),
  1,
);
// 1..31, then 32 stands for the last day
const MONTH_DAYS = numbered(
  [...Array.from({ length: 31 }, (_, i) => `${i + 1}`), "Last Day"],
  1,
);

const form = reactive<Schedule>(
  props.schedule
    ? { ...props.schedule }
    : {
        id: 0,
        name: "",
        run_time: date.formatDate(Date.now(), "HH:mm"),
        schedule_type: "daily",
        monthly_type: "days",
        run_time_weekdays: [],
        monthly_months_of_year: [],
        monthly_days_of_month: [],
        monthly_weeks_of_month: [],
      },
);

// another repeat type starts with no days, weeks or months picked
watch(
  () => form.schedule_type,
  () => {
    form.run_time_weekdays = [];
    form.monthly_months_of_year = [];
    form.monthly_days_of_month = [];
    form.monthly_weeks_of_month = [];
  },
);

// the weekday checkboxes have no rules of their own
const weekdaysMissing = ref(false);
watch(
  () => form.run_time_weekdays,
  () => {
    weekdaysMissing.value = false;
  },
);

async function submit() {
  if (form.schedule_type === "weekly" && form.run_time_weekdays.length === 0) {
    weekdaysMissing.value = true;
    return;
  }

  if (props.schedule) editSchedule(props.schedule.id, form);
  else addSchedule(form);

  await until(saving).not.toBeTruthy();
  if (isError.value) return;

  onDialogOK();
}
</script>
