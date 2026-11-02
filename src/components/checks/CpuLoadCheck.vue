<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-dialog
    ref="dialogRef"
    @hide="onDialogHide"
    aria-labelledby="cpu-check-title"
  >
    <CheckCard
      title-id="cpu-check-title"
      :title="check ? 'Edit CPU load check' : 'Add CPU load check'"
      subtitle="Fails when the average CPU load of the last 15 readings is too high"
      :loading="loading"
      @save="save"
    >
      <CheckThresholds :state="state" :fields="fields" />
      <CheckSchedule :state="state" :fail-options="failOptions" />
    </CheckCard>
  </q-dialog>
</template>

<script setup>
import { useCheckDialog } from "./useCheckDialog";
import CheckCard from "./CheckCard.vue";
import CheckThresholds from "./CheckThresholds.vue";
import CheckSchedule from "./CheckSchedule.vue";

const props = defineProps({
  check: Object,
  parent: Object, // {agent: agent.agent_id} or {policy: policy.id}
});
defineEmits(["ok", "hide"]);

const { dialogRef, onDialogHide, state, loading, save, failOptions } =
  useCheckDialog(props, {
    check_type: "cpuload",
    ...{ warning_threshold: 70, error_threshold: 90 },
    ...{ fails_b4_alert: 1, run_interval: 0 },
  });

const fields = [
  {
    key: "warning_threshold",
    label: "Warning threshold (%)",
    hint: "The check fails as a warning above this average load; 0 turns it off",
  },
  {
    key: "error_threshold",
    label: "Error threshold (%)",
    hint: "The check fails as an error above this average load; 0 turns it off",
  },
];
</script>
