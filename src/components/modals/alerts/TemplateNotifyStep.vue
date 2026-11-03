<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <div class="scroll" style="max-height: calc(100vh - 260px)">
    <q-card flat>
      <div class="tpl-section">Alert failure settings</div>
      <div class="tpl-caption">{{ copy.failure }} {{ triStateHelp }}</div>
      <q-card-section class="q-pt-sm">
        <template v-for="(c, i) in CHANNELS" :key="c.suffix">
          <q-toggle
            v-model="t[`${kind}_always_${c.suffix}`]"
            :label="c.label"
            left-label
            toggle-indeterminate
          />
          <span
            class="text-caption rmm-muted"
            :class="{ 'q-mr-md': i < CHANNELS.length - 1 }"
            >{{ stateText(t[`${kind}_always_${c.suffix}`]) }}</span
          >
        </template>
      </q-card-section>

      <template v-if="copy.dashboardHint">
        <div class="tpl-section">Severities that notify</div>
        <div class="tpl-caption">
          Only alerts with a selected severity send that notification. Global
          Settings can also turn off informational and warning emails and SMS.
        </div>
        <q-card-section class="q-gutter-y-md">
          <q-select
            v-for="s in severityPickers"
            :key="s.field"
            v-model="t[`${kind}_${s.field}_alert_severity`]"
            :label="s.label"
            :hint="s.hint"
            :options="SEVERITIES"
            outlined
            dense
            options-dense
            multiple
            use-chips
            emit-value
            map-options
          />
        </q-card-section>
      </template>

      <q-card-section>
        <q-input
          v-model.number="t[`${kind}_periodic_alert_days`]"
          label="Alert again if not resolved after (days)"
          hint="Repeats the email and SMS after this many days while the alert stays open; 0 sends them once"
          type="number"
          outlined
          dense
          :rules="[(val) => val >= 0 || 'Periodic days must be 0 or greater']"
        />
      </q-card-section>

      <div class="tpl-section">Alert resolved settings</div>
      <div class="tpl-caption">{{ copy.resolved }}</div>
      <q-card-section class="q-pt-sm">
        <q-toggle
          v-for="c in CHANNELS.slice(0, 2)"
          :key="c.suffix"
          v-model="t[`${kind}_${c.suffix}_on_resolved`]"
          :label="c.label"
          left-label
        />
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
import { computed, toRef } from "vue";

const props = defineProps({
  template: { type: Object, required: true },
  kind: { type: String, required: true },
});
const t = toRef(props, "template");

const CHANNELS = [
  { suffix: "email", label: "Email" },
  { suffix: "text", label: "Text" },
  { suffix: "alert", label: "Dashboard" },
];

const SEVERITIES = [
  { label: "Error", value: "error" },
  { label: "Warning", value: "warning" },
  { label: "Informational", value: "info" },
];

const COPY = {
  agent: {
    failure: "Notifications when an agent is overdue (offline too long).",
    resolved:
      "Also notify when an overdue agent is back online. Agents with their own overdue email or SMS turned on always get it.",
  },
  check: {
    failure:
      "Notifications when a check fails; network monitor alerts use these check settings too.",
    resolved: "Also notify when a failed check passes again.",
    dashboardHint: "Empty means error, warning and informational",
  },
  task: {
    failure: "Notifications when an automated task fails.",
    resolved: "Also notify when a failed task succeeds again.",
    dashboardHint: "Empty means error and warning",
  },
};
const copy = computed(() => COPY[props.kind]);

const severityPickers = computed(() => [
  {
    field: "email",
    label: "Only email on alert severity",
    hint: "Empty means error and warning",
  },
  {
    field: "text",
    label: "Only text on alert severity",
    hint: "Empty means error and warning",
  },
  {
    field: "dashboard",
    label: "Only show dashboard alert on severity",
    hint: copy.value.dashboardHint,
  },
]);

function stateText(val) {
  if (val === true) return "Always";
  if (val === false) return "Never";
  return "Inherit";
}

// the server treats Always as force-on; Never adds nothing, so the
// agent, check or task setting still wins
const triStateHelp = computed(
  () =>
    `Always sends it even when the ${props.kind}'s own setting is off. Inherit uses the ${props.kind}'s own setting. Never does not add it from this template.`,
);
</script>
