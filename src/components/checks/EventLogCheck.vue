<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-dialog
    ref="dialogRef"
    @hide="onDialogHide"
    aria-labelledby="eventlog-check-title"
  >
    <CheckCard
      title-id="eventlog-check-title"
      :title="check ? 'Edit event log check' : 'Add event log check'"
      subtitle="Searches a Windows event log for matching events"
      :loading="loading"
      @save="beforeSubmit"
    >
      <q-card-section class="q-gutter-y-sm">
        <div class="rmm-label">Search</div>
        <q-input
          v-model="state.name"
          label="Descriptive name"
          :rules="[(val) => !!val || 'Required']"
          dense
          outlined
          hide-bottom-space
        />
        <q-select
          outlined
          v-model="state.log_name"
          label="Event log to query"
          :options="logNameOptions"
          v-bind="compact"
        />
        <q-input
          v-model.number="state.search_last_days"
          label="How many previous days to search"
          hint="0 searches the entire log"
          :rules="[
            (val) => !!val.toString() || 'Required',
            (val) => val >= 0 || 'Minimum is 0',
            (val) => val <= 9999 || 'Maximum is 9999',
          ]"
          dense
          outlined
          hide-bottom-space
        />
      </q-card-section>
      <q-card-section class="q-gutter-y-sm q-pt-none">
        <div class="rmm-label">Match events</div>
        <div>
          <div id="eventlog-type-label" class="rmm-label">Event type</div>
          <div
            role="radiogroup"
            aria-labelledby="eventlog-type-label"
            class="q-gutter-sm"
          >
            <q-radio
              v-for="t in eventTypes"
              :key="t.val"
              v-model="state.event_type"
              :val="t.val"
              :label="t.label"
              dense
            />
          </div>
        </div>
        <q-input
          v-model="state.event_id"
          label="Event ID"
          hint="One event ID, or * to match every event ID"
          :rules="[(val) => validateEventID(val) || 'Invalid Event ID']"
          dense
          outlined
          hide-bottom-space
        />
        <div v-for="f in textFilters" :key="f.key">
          <q-checkbox v-model="enabled[f.key]" :label="f.label" dense />
          <q-input
            v-model="state[f.key]"
            :disable="!enabled[f.key]"
            :aria-label="f.label"
            :hint="f.hint"
            class="q-mt-xs"
            dense
            outlined
            hide-bottom-space
          />
        </div>
      </q-card-section>
      <q-card-section class="q-gutter-y-sm">
        <div class="rmm-label">Fail condition</div>
        <q-select
          v-model="state.fail_when"
          :options="failWhenOptions"
          label="Fail when"
          :hint="
            notContains
              ? 'The check fails when too few matching events are found'
              : 'The check fails when matching events are found'
          "
          v-bind="compact"
          emit-value
          map-options
          hide-bottom-space
        />
        <q-input
          v-model.number="state.number_of_events_b4_alert"
          type="number"
          label="Number of events found before alert"
          :hint="
            notContains
              ? 'Fails when fewer matching events than this are found'
              : 'Fails once at least this many matching events are found'
          "
          :rules="[(val) => val >= 1 || 'Minimum is 1']"
          dense
          outlined
          hide-bottom-space
        />
      </q-card-section>
      <CheckSchedule
        :state="state"
        :fail-options="failOptions"
        :severity-options="severityOptions"
      />
    </CheckCard>
  </q-dialog>
</template>

<script setup>
import { computed, reactive, watch } from "vue";
import { useCheckDialog } from "./useCheckDialog";
import { validateEventID } from "@/utils/validation";
import CheckCard from "./CheckCard.vue";
import CheckSchedule from "./CheckSchedule.vue";

const props = defineProps({
  check: Object,
  parent: Object, // {agent: agent.agent_id} or {policy: policy.id}
});
defineEmits(["ok", "hide"]);

const dlg = useCheckDialog(props, {
  check_type: "eventlog",
  ...{ log_name: "Application", event_type: "INFO", fail_when: "contains" },
  ...{ event_id: null, event_source: null, event_message: null },
  ...{ event_id_is_wildcard: false, search_last_days: 1 },
  ...{ number_of_events_b4_alert: 1, alert_severity: "warning" },
  ...{ fails_b4_alert: 1, run_interval: 0 },
});
const { dialogRef, onDialogHide, state, loading, save } = dlg;
const { failOptions, logNameOptions, failWhenOptions, severityOptions } = dlg;

const compact = { dense: true, outlined: true, "options-dense": true };

const eventTypes = [
  { val: "INFO", label: "Information" },
  { val: "WARNING", label: "Warning" },
  { val: "ERROR", label: "Error" },
  { val: "AUDIT_SUCCESS", label: "Success Audit" },
  { val: "AUDIT_FAILURE", label: "Failure Audit" },
];

const textFilters = [
  {
    key: "event_source",
    label: "Event source",
    hint: "Matches when the event source contains this text (case-sensitive)",
  },
  {
    key: "event_message",
    label: "Message contains string",
    hint: "Matches when the event message contains this text (case-sensitive)",
  },
];

const notContains = computed(() => state.value.fail_when === "not_contains");

const enabled = reactive({ event_source: false, event_message: false });

if (props.check) {
  if (state.value.event_id_is_wildcard) state.value.event_id = "*";
  for (const { key } of textFilters) enabled[key] = !!state.value[key];
}

// switching a filter on or off clears its text
for (const { key } of textFilters) {
  watch(
    () => enabled[key],
    () => {
      state.value[key] = null;
    },
  );
}

function beforeSubmit() {
  const s = state.value;
  s.event_id_is_wildcard = s.event_id === "*";
  if (s.event_source === "") s.event_source = null;
  if (s.event_message === "") s.event_message = null;

  save();
}
</script>
