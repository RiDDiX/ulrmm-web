<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-dialog
    ref="dialogRef"
    @hide="onDialogHide"
    aria-labelledby="container-check-title"
  >
    <CheckCard
      title-id="container-check-title"
      :title="check ? 'Edit container check' : 'Add container check'"
      subtitle="Passes while a container or virtual machine is running and fails when it is not"
      :loading="loading"
      @save="save"
    >
      <SchemaForm v-model="state" :fields="fields" compact />
      <datalist :id="listId">
        <option v-for="c in containerOptions" :key="c" :value="c" />
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
import { computed, onMounted, ref } from "vue";
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
  check_type: "container",
  ...{ container: "", container_kind: "", pass_if_svc_not_exist: false },
  ...{ alert_severity: "warning", fails_b4_alert: 1, run_interval: 0 },
});

const KINDS = [
  ["", "Any kind"],
  ["docker", "Docker container"],
  ["podman", "Podman container"],
  ["lxc", "LXC container"],
  ["lxd", "LXD instance"],
  ["incus", "Incus instance"],
  ["pve-qemu", "Proxmox VM"],
  ["pve-lxc", "Proxmox container"],
  ["hyperv", "Hyper-V VM"],
].map(([value, label]) => ({ value, label }));

// older checks can hold null, which a checkbox shows as indeterminate
state.value.pass_if_svc_not_exist = !!state.value.pass_if_svc_not_exist;

const listId = `containers-${Math.random().toString(36).slice(2)}`;
const items = ref([]);

const containerOptions = computed(() => [
  ...new Set(
    items.value
      .filter(
        (c) =>
          !state.value.container_kind || c.kind === state.value.container_kind,
      )
      .map((c) => c.name)
      .filter(Boolean),
  ),
]);

const fields = [
  {
    key: "container_kind",
    type: "select",
    label: "Kind",
    options: KINDS,
    props: { "options-dense": true },
  },
  {
    key: "container",
    label: "Name or ID",
    hint: "The container or VM name, or its ID (at least the first 12 characters)",
    rules: [
      (val) => !!val?.trim() || "Required",
      (val) =>
        /^[A-Za-z0-9@._:/\\-]{1,255}$/.test(val) ||
        "Letters, digits and @ . _ : / - only",
    ],
    props: { list: listId, autocomplete: "off" },
  },
  {
    key: "pass_if_svc_not_exist",
    type: "checkbox",
    label: "Pass when it does not exist",
    hint: "Devices without this container or VM pass instead of failing. Useful for policy checks",
  },
];

onMounted(async () => {
  const agent = props.parent?.agent;
  if (!agent) return;
  try {
    const { containers } = await fetchAgentState(agent, SILENT_REQUEST_CONFIG);
    items.value = Array.isArray(containers?.items) ? containers.items : [];
  } catch {
    // no state yet: the name is typed in
  }
});
</script>
