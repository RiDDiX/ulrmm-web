<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-dialog
    ref="dialogRef"
    @hide="onDialogHide"
    aria-labelledby="health-check-title"
  >
    <CheckCard
      title-id="health-check-title"
      :title="check ? `Edit ${meta.title}` : `Add ${meta.title}`"
      :loading="loading"
      @save="save"
    >
      <q-card-section class="text-caption rmm-muted">{{
        meta.help
      }}</q-card-section>
      <CheckThresholds
        :state="state"
        :fields="fields"
        class="q-pt-none"
        :custom-rules="thresholdRules"
      />
      <CheckSchedule
        :state="state"
        :fail-options="failOptions"
        interval-hint="0 = every 900 seconds. The server runs it at most every 300 seconds."
        :interval-rules="[
          (val) => val === 0 || val >= 300 || 'Minimum is 300 (or 0)',
        ]"
      />
    </CheckCard>
  </q-dialog>
</template>

<script setup>
import { useCheckDialog } from "./useCheckDialog";
import CheckCard from "./CheckCard.vue";
import CheckThresholds from "./CheckThresholds.vue";
import CheckSchedule from "./CheckSchedule.vue";

// security=defender sig age (d), hwhealth=battery wear (%)
const TYPES = {
  security: {
    title: "security check",
    unit: "days",
    warning: 3,
    error: 7,
    help: "Fails when no antivirus or no firewall is on (Windows Security Center first, macOS XProtect and application firewall). The thresholds are the Microsoft Defender signature age, used only when Defender protects the device. Linux and FreeBSD are reported, not alerted.",
    subject: "the Defender signatures are older than this",
  },
  hwhealth: {
    title: "hardware health check",
    unit: "% battery wear",
    warning: 20,
    error: 30,
    help: "Fails on a failing or warning disk and on temperatures at the limits the device reports. The thresholds are the battery wear.",
    subject: "the battery wear reaches this",
  },
};

const props = defineProps({
  check: Object,
  parent: Object, // {agent} or {policy}
  checkType: String,
});
defineEmits(["ok", "hide"]);

const type = props.check ? props.check.check_type : props.checkType;
const meta = TYPES[type] || TYPES.security;

const { dialogRef, onDialogHide, state, loading, save, failOptions } =
  useCheckDialog(props, {
    check_type: type,
    warning_threshold: meta.warning,
    ...{ error_threshold: meta.error, fails_b4_alert: 1, run_interval: 900 },
  });

const thresholdRules = [
  (val) => val >= 0 || "Minimum threshold is 0",
  (val) => val < 100 || "Maximum threshold is 99",
  () =>
    !state.value.warning_threshold ||
    !state.value.error_threshold ||
    state.value.warning_threshold < state.value.error_threshold ||
    "Warning threshold must be less than error threshold",
];

const fields = ["Warning", "Error"].map((level) => ({
  key: `${level.toLowerCase()}_threshold`,
  label: `${level} threshold (${meta.unit})`,
  hint: `${level} when ${meta.subject}; 0 turns it off`,
}));
</script>
