<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <component
    :is="policy ? QForm : 'div'"
    class="q-pa-md"
    @submit.prevent="submit"
  >
    <div v-if="scheduleCaption" class="text-caption rmm-muted q-mb-sm">
      {{ scheduleCaption }}
    </div>

    <div class="rmm-label">Auto Approval</div>
    <q-separator class="q-mt-xs q-mb-sm" />
    <div class="text-caption rmm-muted q-mb-sm">
      Approve: new updates of that severity are approved and installed on the
      schedule below. Manual and Ignore: nothing is approved automatically, you
      approve updates yourself in the agent's Patches tab.
      <template v-if="agent">
        Inherit: the automation policy's setting applies.</template
      >
    </div>
    <div class="row q-col-gutter-sm">
      <div v-for="s in severities" :key="s.key" class="col-12 col-sm-6">
        <q-select
          v-model="rules[s.key]"
          :options="severityChoices"
          :label="s.label"
          :hint="s.hint"
          :hide-bottom-space="!!s.hint"
          outlined
          dense
          emit-value
          map-options
        />
      </div>
      <div class="col-12 col-sm-6">
        <q-select
          v-model="drivers"
          :options="driverChoices"
          label="Driver updates"
          hint="Drivers have no severity: Include lets them follow Other. Excluded drivers can still be approved by hand."
          outlined
          dense
          emit-value
          map-options
          hide-bottom-space
        />
      </div>
    </div>

    <div class="rmm-label q-mt-lg">Installation Schedule</div>
    <q-separator class="q-mt-xs q-mb-sm" />
    <div class="row q-col-gutter-sm">
      <div class="col-12 col-sm-6">
        <q-select
          v-model="rules.run_time_frequency"
          :options="frequencyChoices"
          :hint="
            inherited
              ? 'The automation policy sets the days and time'
              : 'Daily/Weekly runs on the days ticked below, Monthly on one day'
          "
          label="Schedule Frequency"
          outlined
          dense
          emit-value
          map-options
          hide-bottom-space
        />
      </div>
      <div
        v-if="rules.run_time_frequency === 'monthly'"
        class="col-12 col-sm-6"
      >
        <q-select
          v-model="rules.run_time_day"
          :options="monthDays"
          label="Day of month to run"
          outlined
          dense
          emit-value
          map-options
        />
      </div>
      <div v-show="!inherited" class="col-12 col-sm-6">
        <q-select
          v-model="rules.run_time_hour"
          :options="scheduledTimes"
          label="Scheduled Time"
          hint="Device time zone as set in the RMM (or the global default)"
          outlined
          dense
          emit-value
          map-options
          hide-bottom-space
        />
      </div>
    </div>
    <div v-if="rules.run_time_frequency === 'daily'" class="q-mt-sm">
      <div id="patch-policy-days" class="text-body2">Days to install on</div>
      <q-field
        :model-value="rules.run_time_days"
        :rules="[weekdayRule]"
        borderless
        dense
        hide-bottom-space
      >
        <div
          class="q-gutter-sm"
          role="group"
          aria-labelledby="patch-policy-days"
        >
          <q-checkbox
            v-for="(day, i) in weekdayNames"
            :key="day"
            v-model="rules.run_time_days"
            :val="i"
            :label="day"
          />
        </div>
      </q-field>
    </div>

    <div class="rmm-label q-mt-lg">Reboot After Installation</div>
    <q-separator class="q-mt-xs q-mb-sm" />
    <div class="row q-col-gutter-sm">
      <div class="col-12 col-sm-8">
        <q-select
          v-model="rules.reboot_after_install"
          :options="rebootChoices"
          label="Reboot"
          hint="Applies the moment an install finishes, whether scheduled or started manually"
          outlined
          dense
          emit-value
          map-options
          hide-bottom-space
        />
      </div>
    </div>

    <div class="rmm-label q-mt-lg">Failed Patches</div>
    <q-separator class="q-mt-xs q-mb-sm" />
    <div class="text-caption rmm-muted">
      Schedules and maintenance windows retry a failed update only when
      reprocessing is on, up to the given number of times. Install now always
      tries every approved update.
    </div>
    <div v-if="!policy" class="q-mt-sm">
      <q-checkbox
        v-model="rules.reprocess_failed_inherit"
        label="Inherit failed patch settings"
      />
    </div>
    <div
      v-show="!rules.reprocess_failed_inherit"
      class="row items-start q-col-gutter-sm q-mt-xs"
    >
      <div class="col-12 col-sm-5">
        <q-checkbox
          v-model="rules.reprocess_failed"
          label="Reprocess failed patches"
        />
      </div>
      <div class="col-12 col-sm-3">
        <q-input
          v-model.number="rules.reprocess_failed_times"
          :disable="!rules.reprocess_failed"
          :rules="[(v) => v > 0 || 'Must be greater than 0']"
          type="number"
          label="Times"
          outlined
          dense
        />
      </div>
      <div class="col-12">
        <q-checkbox
          v-model="rules.email_if_fail"
          label="Send an email when patch installation fails"
        />
      </div>
    </div>

    <q-card-actions v-if="policy" align="right">
      <q-btn
        v-if="editing"
        flat
        label="Remove Policy"
        class="text-negative"
        @click="deletePolicy"
      />
      <q-space />
      <q-btn flat label="Cancel" @click="$emit('hide')" />
      <q-btn unelevated color="primary" label="Submit" type="submit" />
    </q-card-actions>
  </component>
</template>

<script setup>
import { computed, ref } from "vue";
import { QForm, useQuasar } from "quasar";
import axios from "axios";
import { scheduledTimes, monthDays } from "@/mixins/data";
import { notifySuccess } from "@/utils/notify";
import { scheduleSummary } from "@/utils/patchSchedule";

defineOptions({ name: "PatchPolicyForm" });
const emit = defineEmits(["close", "hide"]);

const props = defineProps({
  policy: Object,
  agent: Object,
});

const $q = useQuasar();

const severities = [
  { key: "critical", label: "Critical" },
  { key: "important", label: "Important" },
  { key: "moderate", label: "Moderate" },
  { key: "low", label: "Low" },
  { key: "other", label: "Other", hint: "Updates without a severity" },
];
const weekdayNames = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

// an agent can also defer each setting to its policy
const INHERIT = { label: "Inherit", value: "inherit" };
// policy rows created before the form set a value still hold "inherit"
const NOT_SET = { label: "Not set", value: "inherit" };
const withInherit = (choices) =>
  props.agent && !props.policy ? [...choices, INHERIT] : [...choices, NOT_SET];

const severityChoices = withInherit([
  { label: "Manual", value: "manual" },
  { label: "Approve", value: "approve" },
  { label: "Ignore", value: "ignore" },
]);
const driverChoices = [
  { label: "Exclude", value: "exclude" },
  { label: "Include", value: "include" },
  ...(props.agent && !props.policy ? [INHERIT] : []),
];
const frequencyChoices = withInherit([
  { label: "Daily/Weekly", value: "daily" },
  { label: "Monthly", value: "monthly" },
]);
const rebootChoices = withInherit([
  { label: "Never reboot automatically", value: "never" },
  { label: "Reboot immediately when required", value: "required" },
  { label: "Always reboot immediately after install", value: "always" },
]);

function newRules() {
  return {
    run_time_frequency: "daily",
    run_time_hour: 3,
    ...Object.fromEntries(severities.map((s) => [s.key, "ignore"])),
    run_time_day: 1,
    run_time_days: [],
    reboot_after_install: "never",
    drivers: "exclude",
    reprocess_failed_inherit: false,
    reprocess_failed: false,
    reprocess_failed_times: 5,
    email_if_fail: false,
  };
}

// rules is edited in place; the policy and the agent hand over their own
// object so the callers see the changes
const editing = ref(true);
const rules = ref({});

function loadRules() {
  const { policy, agent } = props;
  if (policy?.winupdatepolicy[0]) {
    rules.value = policy.winupdatepolicy[0];
  } else if (policy) {
    rules.value = { ...newRules(), policy: policy.id };
    editing.value = false;
  } else if (agent) {
    rules.value = agent.winupdatepolicy[0];
  }
}
loadRules();

const inherited = computed(() => rules.value.run_time_frequency === "inherit");

// a policy has no parent: its "inherit" (the default of older rows) means
// exclude
const drivers = computed({
  get: () => {
    const value = rules.value.drivers;
    if (value === "include" || value === "exclude") return value;
    return props.agent && !props.policy ? "inherit" : "exclude";
  },
  set: (value) => (rules.value.drivers = value),
});

const scheduleCaption = computed(() => {
  if (!rules.value?.run_time_frequency) return "";
  // only the agent form shows this; there "inherit" means the policy decides
  if (props.agent && inherited.value) return "Inherited from policy";
  return scheduleSummary(rules.value);
});

function weekdayRule(days) {
  if (rules.value.run_time_frequency !== "daily") return true;
  return (days && days.length > 0) || "Select at least one day";
}

async function saveWith(request, message) {
  $q.loading.show();
  try {
    await request();
    $q.loading.hide();
    emit("close");
    notifySuccess(message);
  } catch {
    $q.loading.hide();
  }
}

function submit() {
  if (!props.policy) return;
  if (editing.value) {
    saveWith(
      () =>
        axios.put(`/automation/patchpolicy/${rules.value.id}/`, rules.value),
      "Patch policy was edited successfully!",
    );
  } else {
    saveWith(
      () => axios.post("/automation/patchpolicy/", rules.value),
      "Patch policy was created successfully!",
    );
  }
}

function deletePolicy() {
  $q.dialog({
    title: "Delete patch policy?",
    cancel: true,
    ok: { label: "Delete", color: "negative" },
  }).onOk(() =>
    saveWith(
      () => axios.delete(`/automation/patchpolicy/${rules.value.id}/`),
      "Patch policy was deleted successfully!",
    ),
  );
}
</script>
