<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-dialog
    ref="dialogRef"
    @hide="onDialogHide"
    aria-labelledby="winsvc-check-title"
  >
    <CheckCard
      title-id="winsvc-check-title"
      :title="check ? 'Edit service check' : 'Add service check'"
      subtitle="Passes while a Windows service is running and fails when it is not"
      :loading="loading"
      @save="save"
    >
      <q-card-section class="q-gutter-y-sm">
        <div class="rmm-label">Service</div>
        <template v-if="isPolicy">
          <div v-if="!check">
            <q-radio
              v-for="m in modes"
              :key="m.val"
              v-model="state.svc_policy_mode"
              :val="m.val"
              :label="m.label"
            />
          </div>
          <!-- older policy checks have no mode, they show like a default one -->
          <q-select
            v-if="
              state.svc_policy_mode === 'default' ||
              (check && state.svc_policy_mode !== 'manual')
            "
            v-model="state.svc_name"
            :options="serviceOptions"
            label="Service"
            :hint="
              check
                ? 'The service of an existing check cannot be changed'
                : undefined
            "
            :disable="!!check"
            :rules="required"
            dense
            outlined
            options-dense
            map-options
            emit-value
            hide-bottom-space
          />
          <template v-if="state.svc_policy_mode === 'manual'">
            <q-input
              v-model="state.svc_name"
              label="Service name"
              hint="The short service name, e.g. Spooler, not the display name"
              :rules="required"
              outlined
              dense
              hide-bottom-space
            />
            <q-input
              v-model="state.svc_display_name"
              label="Display name"
              hint="Shown in the check list, e.g. Print Spooler"
              :rules="required"
              outlined
              dense
              hide-bottom-space
            />
          </template>
        </template>
        <!-- an existing check keeps its service -->
        <q-select
          v-if="isAgent"
          v-model="state.svc_name"
          :options="serviceOptions"
          label="Service"
          :hint="
            check
              ? 'The service of an existing check cannot be changed'
              : undefined
          "
          :rules="required"
          :disable="!!check"
          dense
          outlined
          options-dense
          map-options
          emit-value
          hide-bottom-space
        />
      </q-card-section>
      <q-card-section class="q-pt-none q-gutter-y-sm">
        <div class="rmm-label">Options</div>
        <div v-for="o in options" :key="o.key" class="row items-center no-wrap">
          <q-checkbox v-model="state[o.key]" :label="o.label" dense />
          <HelpTip class="q-ml-xs" :text="o.tip" />
        </div>
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
import { computed, watch } from "vue";
import { useCheckDialog } from "./useCheckDialog";
import CheckCard from "./CheckCard.vue";
import CheckSchedule from "./CheckSchedule.vue";
import HelpTip from "../ui/HelpTip.vue";

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
  serviceOptions,
} = useCheckDialog(props, {
  check_type: "winsvc",
  svc_name: null,
  svc_display_name: null,
  // a new policy check opens on the default list instead of an empty choice
  svc_policy_mode: props.parent?.policy ? "default" : null,
  ...{ pass_if_start_pending: false, pass_if_svc_not_exist: false },
  ...{ restart_if_stopped: false, alert_severity: "warning" },
  ...{ fails_b4_alert: 1, run_interval: 0 },
});

const required = [(val) => !!val || "Required"];

const modes = [
  { val: "default", label: "Choose from defaults" },
  { val: "manual", label: "Enter manually" },
];

const options = [
  {
    key: "pass_if_start_pending",
    label: "PASS if service is in 'Start Pending' mode",
    tip: "A service that is still starting counts as running instead of failing the check",
  },
  {
    key: "pass_if_svc_not_exist",
    label: "PASS if service doesn't exist",
    tip: "Devices without this service pass instead of failing, useful for policy checks",
  },
  {
    key: "restart_if_stopped",
    label: "Restart service if it's stopped",
    tip: "The agent starts the service again; the check passes if the start works",
  },
];

watch(
  () => state.value.svc_name,
  (name) => {
    // manual mode has no matching option
    const hit = serviceOptions.value.find((i) => i.value === name);
    if (hit) state.value.svc_display_name = hit.label;
  },
);

watch(
  () => state.value.svc_policy_mode,
  () => {
    state.value.svc_name = null;
    state.value.svc_display_name = null;
  },
);

const isPolicy = computed(() =>
  props.check ? !!props.check.policy : !!props.parent.policy,
);
const isAgent = computed(() =>
  props.check ? !!props.check.agent : !!props.parent.agent,
);
</script>
