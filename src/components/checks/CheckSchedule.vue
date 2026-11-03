<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-card-section class="q-gutter-y-sm">
    <div class="rmm-label">Alerting and schedule</div>
    <q-select
      v-if="severityOptions"
      v-model="s.alert_severity"
      :options="severityOptions"
      label="Alert severity"
      hint="Severity of the alert raised when this check fails"
      dense
      outlined
      options-dense
      emit-value
      map-options
      hide-bottom-space
    />
    <q-select
      v-model="s.fails_b4_alert"
      :options="failOptions"
      label="Number of consecutive failures before alert"
      hint="A passing run resets the count"
      dense
      outlined
      options-dense
      hide-bottom-space
    />
    <q-input
      v-model.number="s.run_interval"
      type="number"
      label="Run this check every (seconds)"
      :hint="intervalHint"
      :rules="intervalRules"
      dense
      outlined
      hide-bottom-space
    />
  </q-card-section>
</template>

<script setup>
import { toRef } from "vue";

const props = defineProps({
  state: { type: Object, required: true },
  failOptions: Array,
  severityOptions: Array,
  // the agent runs its checks at most every 15 seconds
  intervalRules: {
    type: Array,
    default: () => [
      (val) =>
        (Number.isInteger(val) && (val === 0 || val >= 15)) ||
        "0, or at least 15 seconds",
    ],
  },
  intervalHint: {
    type: String,
    default:
      "0 uses the agent's 'Run checks every' setting; any other value overrides it",
  },
});

// the parent owns the form object; fields are edited in place
const s = toRef(props, "state");
</script>
