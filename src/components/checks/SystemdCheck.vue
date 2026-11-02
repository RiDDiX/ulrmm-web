<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-dialog
    ref="dialogRef"
    @hide="onDialogHide"
    aria-labelledby="systemd-check-title"
  >
    <CheckCard
      title-id="systemd-check-title"
      :title="check ? 'Edit service check' : 'Add service check'"
      subtitle="Passes while the service is running and fails when it is not. Linux (systemd) and FreeBSD (rc.d)"
      :loading="loading"
      @save="save"
    >
      <SchemaForm v-model="state" :fields="fields" compact />
      <datalist :id="listId">
        <option v-for="u in unitOptions" :key="u" :value="u" />
      </datalist>
      <CheckSchedule
        :state="state"
        :fail-options="failOptions"
        :severity-options="severityOptions"
      />
    </CheckCard>
  </q-dialog>
</template>

<script setup>
import { onMounted, ref } from "vue";
import { fetchAgentState } from "@/api/metrics";
import { SILENT_REQUEST_CONFIG } from "@/constants/constants";
import { useCheckDialog } from "./useCheckDialog";
import CheckCard from "./CheckCard.vue";
import CheckSchedule from "./CheckSchedule.vue";
import SchemaForm from "../ui/SchemaForm.vue";

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
  check_type: "systemd",
  ...{ svc_name: "", restart_if_stopped: false, pass_if_svc_not_exist: false },
  ...{ alert_severity: "warning", fails_b4_alert: 1, run_interval: 0 },
});

// older checks can hold null, which a checkbox shows as indeterminate
state.value.restart_if_stopped = !!state.value.restart_if_stopped;
state.value.pass_if_svc_not_exist = !!state.value.pass_if_svc_not_exist;

const listId = `systemd-units-${Math.random().toString(36).slice(2)}`;
const unitOptions = ref([]);

const fields = [
  {
    key: "svc_name",
    label: "Unit",
    hint: "For example nginx.service on Linux, where .service is added when the name has no suffix, or sshd on FreeBSD",
    rules: [
      (val) => !!val || "Required",
      (val) =>
        (/^[A-Za-z0-9@._:\\-]{1,255}$/.test(val) && !val.startsWith("-")) ||
        "Letters, digits and @ . _ : - only, not starting with -",
    ],
    props: { list: listId, autocomplete: "off" },
  },
  {
    key: "restart_if_stopped",
    type: "checkbox",
    label: "Start the unit when it is not active",
    hint: "The agent starts it once (systemctl start on Linux, service on FreeBSD); the check passes if it runs afterwards",
  },
  {
    key: "pass_if_svc_not_exist",
    type: "checkbox",
    label: "Pass when the unit does not exist",
    hint: "Devices without this unit, or without systemd or rc.d, pass instead of failing. Useful for policy checks",
  },
];

// units the agent listed as failed or starting, offered as suggestions
onMounted(async () => {
  const agent = props.parent?.agent;
  if (!agent) return;
  try {
    const { system } = await fetchAgentState(agent, SILENT_REQUEST_CONFIG);
    const units = Array.isArray(system?.units) ? system.units : [];
    unitOptions.value = units.map((u) => u?.name).filter(Boolean);
  } catch {
    // no state yet: the unit is typed in
  }
});
</script>
