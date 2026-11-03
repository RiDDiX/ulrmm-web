<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-dialog
    ref="dialogRef"
    aria-labelledby="rename-agent-title"
    @hide="onDialogHide"
  >
    <q-card class="q-dialog-plugin rmm-dialog--sm">
      <DialogHeader
        title-id="rename-agent-title"
        :title="`Rename ${deviceName(agent)}`"
        subtitle="The name is shown in the dashboard and in MeshCentral; the computer's own hostname stays"
      />
      <q-form @submit="save(name)">
        <q-card-section class="q-gutter-y-sm">
          <q-input
            v-model="name"
            autofocus
            outlined
            dense
            label="Display name"
            :placeholder="agent.hostname"
            hint="Leave empty to show the hostname"
            :rules="[(val) => displayNameError(val) || true]"
          />
          <div class="rename-agent__hostname rmm-muted">
            Hostname <span class="rmm-mono">{{ agent.hostname }}</span> ·
            reported by the device, not changed
          </div>
        </q-card-section>
        <q-card-actions>
          <q-btn
            v-if="agent.display_name"
            flat
            no-caps
            label="Use hostname"
            :disable="saving"
            @click="save('')"
          >
            <q-tooltip>Remove the display name and show the hostname</q-tooltip>
          </q-btn>
          <q-space />
          <q-btn v-close-popup flat label="Cancel" />
          <q-btn
            type="submit"
            label="Save"
            :loading="saving"
            color="primary"
            unelevated
          />
        </q-card-actions>
      </q-form>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { ref } from "vue";
import DialogHeader from "@/components/ui/DialogHeader.vue";
import { useDialogPluginComponent } from "quasar";
import { useStore } from "vuex";
import { editAgent } from "@/api/agents";
import { deviceName, displayNameError } from "@/utils/deviceName";
import { notifySuccess } from "@/utils/notify";

const props = defineProps({
  agent: { type: Object, required: true },
});
defineEmits([...useDialogPluginComponent.emits]);

const { dialogRef, onDialogHide, onDialogOK } = useDialogPluginComponent();
const store = useStore();

const name = ref(props.agent.display_name || "");
const saving = ref(false);

async function save(value) {
  const display_name = (value || "").trim();
  if (displayNameError(display_name)) return;
  saving.value = true;
  try {
    await editAgent(props.agent.agent_id, { display_name });
    // updates the table row, quick panel and breadcrumb.
    // caller reloads the rest
    store.commit("setAgentDisplayName", {
      agent_id: props.agent.agent_id,
      display_name,
    });
    notifySuccess(
      display_name
        ? `Renamed to ${display_name}`
        : `${props.agent.hostname} shows its hostname again`,
    );
    // no payload. onOk is refreshDashboard; that argument is clearTreeSelected
    onDialogOK();
  } catch (err) {
    console.error("rename failed", err);
  }
  saving.value = false;
}
</script>

<style scoped>
.rename-agent__hostname {
  overflow-wrap: anywhere;
  font-size: var(--rmm-fs-xs);
}
</style>
