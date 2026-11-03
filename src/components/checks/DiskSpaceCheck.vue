<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-dialog
    ref="dialogRef"
    @hide="onDialogHide"
    aria-labelledby="disk-check-title"
  >
    <CheckCard
      title-id="disk-check-title"
      :title="check ? 'Edit disk space check' : 'Add disk space check'"
      subtitle="Fails when a disk runs low on free space or is not found"
      :loading="loading"
      @save="save"
    >
      <q-card-section class="q-gutter-y-sm">
        <div class="rmm-label">Disk</div>
        <q-select
          v-model="state.disk"
          :options="diskOptions"
          label="Disk"
          :hint="diskHint"
          :disable="!!check"
          :rules="[(val) => !!val || 'Required']"
          dense
          outlined
          use-input
          fill-input
          hide-selected
          hide-bottom-space
          new-value-mode="add-unique"
          input-debounce="0"
          @filter="filterDisks"
        />
      </q-card-section>
      <CheckThresholds
        :state="state"
        :fields="fields"
        heading="Thresholds (free space left)"
        falling
      />
      <CheckSchedule :state="state" :fail-options="failOptions" />
    </CheckCard>
  </q-dialog>
</template>

<script setup>
import { computed, ref } from "vue";
import { useCheckDialog } from "./useCheckDialog";
import CheckCard from "./CheckCard.vue";
import CheckThresholds from "./CheckThresholds.vue";
import CheckSchedule from "./CheckSchedule.vue";

const props = defineProps({
  check: Object,
  parent: Object, // {agent: agent.agent_id} or {policy: policy.id} only when adding
});
defineEmits(["ok", "hide"]);

const {
  dialogRef,
  onDialogHide,
  state,
  loading,
  save,
  failOptions,
  diskOptions: allDisks,
} = useCheckDialog(props, {
  check_type: "diskspace",
  disk: null,
  ...{ warning_threshold: 25, error_threshold: 10 },
  ...{ fails_b4_alert: 1, run_interval: 0 },
});

const fields = [
  {
    key: "warning_threshold",
    label: "Warning threshold remaining (%)",
    hint: "The check fails as a warning when less free space than this is left; 0 turns it off",
  },
  {
    key: "error_threshold",
    label: "Error threshold remaining (%)",
    hint: "The check fails as an error when less free space than this is left; 0 turns it off",
  },
];

const diskHint = computed(() =>
  props.check
    ? "The disk of an existing check cannot be changed"
    : "Agent checks list the real devices. For a policy, type the drive letter (C:) or the mount point (/, /var)",
);

// keep the agent's real device list, but let a policy check target anything
// the operator types: a posix mount point is not in the drive letter list
const diskOptions = ref(allDisks.value);
function filterDisks(val, update) {
  update(() => {
    const needle = val.toLowerCase();
    diskOptions.value = val
      ? allDisks.value.filter((d) => d.toLowerCase().includes(needle))
      : allDisks.value;
  });
}
</script>
