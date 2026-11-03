<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide">
    <q-card class="rmm-dialog--md">
      <DialogHeader
        :title="service.display_name"
        subtitle="Windows service on this agent"
      />

      <q-card-section>
        <div class="rmm-kv">
          <div>Service name</div>
          <div class="rmm-mono">{{ service.name }}</div>
          <div>Display name</div>
          <div>{{ service.display_name }}</div>
          <div>Description</div>
          <div class="service-detail__well">
            {{ service.description || "No description" }}
          </div>
          <div>Path</div>
          <div class="service-detail__well rmm-mono">{{ service.binpath }}</div>
        </div>
      </q-card-section>
      <q-separator />
      <q-card-section>
        <div class="rmm-label q-mb-sm">Startup type</div>
        <q-select
          dense
          options-dense
          outlined
          v-model="startupType"
          :options="startupOptions"
          map-options
          emit-value
          aria-label="Startup type"
          class="service-detail__startup"
          hint="How Windows starts the service; Save applies it without starting or stopping it now"
        />
      </q-card-section>
      <q-separator />
      <q-card-section>
        <div class="row items-center q-gutter-sm">
          <span class="rmm-label">Status</span>
          <span class="rmm-pill" :class="statusPill.cls">{{
            statusPill.label
          }}</span>
          <q-space />
          <q-btn
            v-for="act in svcActions"
            :key="act.verb"
            outline
            dense
            no-caps
            :color="act.color"
            :icon="act.icon"
            :label="act.label"
            @click="runAction(act.verb)"
          >
            <q-tooltip>{{ act.tip }}</q-tooltip>
          </q-btn>
        </div>
      </q-card-section>
      <q-card-actions align="right">
        <q-btn flat no-caps label="Cancel" v-close-popup />
        <q-btn
          :loading="loading"
          :disable="!startupTypeEdited"
          unelevated
          no-caps
          label="Save"
          color="primary"
          @click="saveStartup"
        >
          <q-tooltip v-if="!startupTypeEdited"
            >Change the startup type to enable Save</q-tooltip
          >
        </q-btn>
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { computed, ref } from "vue";
import { useDialogPluginComponent } from "quasar";
import { notifySuccess } from "@/utils/notify";
import DialogHeader from "@/components/ui/DialogHeader.vue";
import { serviceStatusMeta } from "@/components/agents/remotebg/serviceStates";
import {
  sendAgentServiceAction,
  editAgentServiceStartType,
} from "@/api/services";

defineOptions({ name: "ServiceDetail" });
defineEmits([...useDialogPluginComponent.emits]);
const props = defineProps({
  service: { type: Object, default: undefined },
  agent_id: { type: String, default: undefined },
});

const { dialogRef, onDialogHide, onDialogOK } = useDialogPluginComponent();

const startupOptions = [
  { label: "Automatic (Delayed Start)", value: "autodelay" },
  { label: "Automatic", value: "automatic" },
  { label: "Manual", value: "manual" },
  { label: "Disabled", value: "disabled" },
];

const svcActions = [
  {
    verb: "start",
    label: "Start",
    icon: "play_arrow",
    color: "primary",
    tip: "Start the service now",
  },
  {
    verb: "stop",
    label: "Stop",
    icon: "stop",
    color: "negative",
    tip: "Stop the service now",
  },
  {
    verb: "restart",
    label: "Restart",
    icon: "restart_alt",
    color: "primary",
    tip: "Stop the service and start it again",
  },
];

function currentStartup() {
  const type = props.service.start_type.toLowerCase();
  return type === "automatic" && props.service.autodelay ? "autodelay" : type;
}

const startupType = ref(currentStartup());
const loading = ref(false);
const startupTypeEdited = computed(
  () => startupType.value !== currentStartup(),
);
const statusPill = computed(() =>
  serviceStatusMeta(props.service.status || "unknown"),
);

async function submit(call) {
  loading.value = true;
  try {
    notifySuccess(await call());
    onDialogOK();
  } catch (e) {
    console.error(e);
  }
  loading.value = false;
}

const runAction = (verb) =>
  submit(() =>
    sendAgentServiceAction(props.agent_id, props.service.name, {
      sv_action: verb,
    }),
  );

const saveStartup = () =>
  submit(() =>
    editAgentServiceStartType(props.agent_id, props.service.name, {
      startType: startupType.value === "automatic" ? "auto" : startupType.value,
    }),
  );
</script>

<style scoped>
.service-detail__well {
  padding: 6px 8px;
  border: 1px solid var(--rmm-border);
  border-radius: var(--rmm-radius-sm);
  background: var(--rmm-surface-2);
  overflow-wrap: anywhere;
}

.service-detail__startup {
  max-width: 320px;
}
</style>
