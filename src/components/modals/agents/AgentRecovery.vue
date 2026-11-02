<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-dialog
    ref="dialogRef"
    aria-labelledby="agent-recovery-title"
    @hide="onDialogHide"
  >
    <q-card class="q-dialog-plugin rmm-dialog--md">
      <DialogHeader
        title-id="agent-recovery-title"
        :title="`Recover ${deviceName(agent)}`"
        subtitle="Repairs one of the two agents on this device by using the other one"
      />
      <q-form @submit="recover">
        <q-card-section class="q-gutter-y-sm">
          <div id="agent-recovery-mode" class="rmm-label">What to recover</div>
          <div
            class="q-gutter-sm"
            role="radiogroup"
            aria-labelledby="agent-recovery-mode"
          >
            <q-radio
              v-for="m in modes"
              :key="m.value"
              v-model="form.mode"
              :val="m.value"
              :label="m.label"
              :disable="offline && m.value === 'mesh'"
              dense
            />
          </div>
          <div class="text-body2 rmm-muted">
            {{ modes.find((m) => m.value === form.mode).help }}
          </div>
        </q-card-section>
        <FormButtons label="Recover" :loading="loading" />
      </q-form>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { ref } from "vue";
import { useDialogPluginComponent } from "quasar";
import { sendAgentRecovery } from "@/api/agents";
import { notifySuccess } from "@/utils/notify";
import { deviceName } from "@/utils/deviceName";
import DialogHeader from "@/components/ui/DialogHeader.vue";
import FormButtons from "@/components/agents/FormButtons.vue";

defineOptions({ name: "AgentRecovery" });
defineEmits([...useDialogPluginComponent.emits]);

const props = defineProps({
  agent: { type: Object, required: true },
});

const { dialogRef, onDialogHide, onDialogOK } = useDialogPluginComponent();

const modes = [
  {
    value: "mesh",
    label: "Mesh Agent",
    help: "Fix issues with the Mesh Agent which handles take control and file browser. The RMM agent restarts it (and reinstalls it on Windows), so the RMM agent must be online.",
  },
  {
    value: "agent",
    label: "UniversalLocal RMM Agent",
    help: "Fix issues with the UniversalLocal RMM Agent service. The request goes through MeshCentral, so the Mesh Agent must be online. Windows reinstalls the current agent; Linux, macOS and FreeBSD restart the service.",
  },
];

// an offline RMM agent can only be recovered through MeshCentral
const offline = props.agent.status !== "online";
const form = ref({ mode: offline ? "agent" : "mesh" });
const loading = ref(false);

async function recover() {
  loading.value = true;
  try {
    notifySuccess(await sendAgentRecovery(props.agent.agent_id, form.value));
    onDialogOK();
  } catch (e) {
    console.error(e);
  }
  loading.value = false;
}
</script>
