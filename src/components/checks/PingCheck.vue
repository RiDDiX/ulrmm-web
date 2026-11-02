<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-dialog
    ref="dialogRef"
    @hide="onDialogHide"
    aria-labelledby="ping-check-title"
  >
    <CheckCard
      title-id="ping-check-title"
      :title="check ? 'Edit ping check' : 'Add ping check'"
      subtitle="The agent pings an address 3 times; any lost reply fails the check"
      :loading="loading"
      @save="save"
    >
      <q-card-section class="q-gutter-y-sm">
        <div class="rmm-label">Target</div>
        <q-input
          v-model="state.name"
          label="Descriptive name"
          :rules="[(val) => !!val || 'Required']"
          outlined
          dense
        />
        <q-input
          v-model="state.ip"
          label="Hostname or IP"
          hint="Pinged from the agent's device, so it must be reachable from that network"
          :rules="[(val) => !!val || 'Required']"
          outlined
          dense
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
import { useCheckDialog } from "./useCheckDialog";
import CheckCard from "./CheckCard.vue";
import CheckSchedule from "./CheckSchedule.vue";

const props = defineProps({
  check: Object,
  parent: Object, // {agent: agent.agent_id} or {policy: policy.id}
});
defineEmits(["ok", "hide"]);

const {
  dialogRef,
  onDialogHide,
  state,
  loading,
  save,
  failOptions,
  severityOptions,
} = useCheckDialog(props, {
  check_type: "ping",
  ...{ name: null, ip: null },
  ...{ alert_severity: "warning", fails_b4_alert: 1, run_interval: 0 },
});
</script>
