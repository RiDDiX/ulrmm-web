<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<script setup>
import { wholeNumberIn } from "@/utils/validation";
import { scheduleDefaults, scheduleSummary } from "./backups";

const props = defineProps({
  modelValue: { type: Object, default: () => ({ kind: "none" }) },
  disabled: Boolean,
});
const emit = defineEmits(["update:modelValue"]);

const KINDS = [
  { value: "none", label: "Manual only" },
  { value: "daily", label: "Daily" },
  { value: "interval", label: "Every N hours" },
  { value: "calendar", label: "Calendar" },
  { value: "cron", label: "Cron expression" },
];
const FREQUENCIES = [
  { value: "once", label: "On dates" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];
// the calendar rule counts weekdays from Monday = 0
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(
  (label, value) => ({ label, value }),
);
const WEEKS = [
  { value: 1, label: "First" },
  { value: 2, label: "Second" },
  { value: 3, label: "Third" },
  { value: 4, label: "Fourth" },
  { value: -1, label: "Last" },
];
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const set = (patch) =>
  emit("update:modelValue", { ...props.modelValue, ...patch });
const orNull = (value) => (value === "" || value === undefined ? null : value);
</script>

<template>
  <div class="q-gutter-sm">
    <q-select
      :model-value="modelValue.kind"
      :options="KINDS"
      emit-value
      map-options
      outlined
      dense
      label="Schedule"
      :hint="scheduleSummary(modelValue)"
      :disable="disabled"
      @update:model-value="emit('update:modelValue', scheduleDefaults($event))"
    />
    <q-input
      v-if="modelValue.kind === 'daily'"
      :model-value="modelValue.time"
      type="time"
      outlined
      dense
      label="Time"
      :disable="disabled"
      @update:model-value="set({ time: $event })"
    />
    <q-input
      v-else-if="modelValue.kind === 'interval'"
      :model-value="modelValue.hours"
      type="number"
      min="1"
      max="720"
      :rules="[wholeNumberIn(1, 720)]"
      outlined
      dense
      label="Hours after the last verified point"
      :disable="disabled"
      @update:model-value="set({ hours: Number($event) })"
    />
    <q-input
      v-else-if="modelValue.kind === 'cron'"
      :model-value="modelValue.expr"
      outlined
      dense
      input-class="rmm-mono"
      label="Minute hour day month weekday"
      hint="Sunday is 0; day of month and weekday must both match"
      :disable="disabled"
      @update:model-value="set({ expr: ($event ?? '').trim() })"
    />
    <template v-else-if="modelValue.kind === 'calendar'">
      <div class="row q-gutter-sm">
        <q-select
          :model-value="modelValue.frequency"
          :options="FREQUENCIES"
          emit-value
          map-options
          outlined
          dense
          label="Repeats"
          :disable="disabled"
          @update:model-value="set({ frequency: $event })"
        />
        <q-input
          :model-value="modelValue.run_time"
          type="time"
          outlined
          dense
          label="Time"
          :disable="disabled"
          @update:model-value="set({ run_time: $event })"
        />
      </div>
      <q-option-group
        v-if="modelValue.frequency === 'weekly'"
        :model-value="modelValue.weekdays"
        :options="WEEKDAYS"
        type="checkbox"
        inline
        dense
        aria-label="Weekdays"
        :disable="disabled"
        @update:model-value="set({ weekdays: $event })"
      />
      <div v-if="modelValue.frequency === 'monthly'" class="row q-gutter-sm">
        <q-input
          :model-value="modelValue.month_day"
          type="number"
          min="1"
          max="31"
          outlined
          dense
          clearable
          label="Day of month"
          hint="Or leave empty and pick a weekday"
          :disable="disabled"
          @update:model-value="
            set({ month_day: $event ? Number($event) : null })
          "
        />
        <q-select
          :model-value="modelValue.month_week"
          :options="WEEKS"
          emit-value
          map-options
          outlined
          dense
          clearable
          label="Week"
          :disable="disabled || !!modelValue.month_day"
          @update:model-value="set({ month_week: orNull($event) })"
        />
        <q-select
          :model-value="modelValue.month_weekday"
          :options="WEEKDAYS"
          emit-value
          map-options
          outlined
          dense
          clearable
          label="Weekday"
          :disable="disabled || !!modelValue.month_day"
          @update:model-value="set({ month_weekday: orNull($event) })"
        />
      </div>
      <q-select
        v-if="modelValue.frequency === 'once'"
        :model-value="modelValue.dates"
        multiple
        use-input
        use-chips
        hide-dropdown-icon
        input-debounce="0"
        new-value-mode="add-unique"
        max-values="32"
        outlined
        dense
        label="Dates (YYYY-MM-DD)"
        :rules="[
          (list) =>
            (list ?? []).every((d) => DATE.test(d)) || 'Use YYYY-MM-DD.',
        ]"
        :disable="disabled"
        @update:model-value="set({ dates: $event ?? [] })"
      />
      <q-select
        :model-value="modelValue.excluded_dates"
        multiple
        use-input
        use-chips
        hide-dropdown-icon
        input-debounce="0"
        new-value-mode="add-unique"
        outlined
        dense
        label="Skipped dates (YYYY-MM-DD)"
        :rules="[
          (list) =>
            (list ?? []).every((d) => DATE.test(d)) || 'Use YYYY-MM-DD.',
        ]"
        :disable="disabled"
        @update:model-value="set({ excluded_dates: $event ?? [] })"
      />
      <div class="row q-gutter-sm">
        <q-input
          :model-value="modelValue.start_date"
          type="date"
          outlined
          dense
          stack-label
          label="From"
          :disable="disabled"
          @update:model-value="set({ start_date: orNull($event) })"
        />
        <q-input
          :model-value="modelValue.end_date"
          type="date"
          outlined
          dense
          stack-label
          label="Until"
          :disable="disabled"
          @update:model-value="set({ end_date: orNull($event) })"
        />
      </div>
    </template>
  </div>
</template>
