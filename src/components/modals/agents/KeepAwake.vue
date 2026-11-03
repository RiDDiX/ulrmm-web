<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-dialog
    ref="dialogRef"
    aria-labelledby="keep-awake-title"
    :persistent="powerSaving"
    @hide="onHide"
  >
    <q-card class="q-dialog-plugin rmm-dialog--sm">
      <DialogHeader
        title-id="keep-awake-title"
        :close-disable="powerSaving"
        :title="`Keep ${deviceName(agent)} awake`"
        subtitle="No sleep from idle time or a closed lid while the hold lasts; the screen can still lock"
      />
      <q-card-section class="q-gutter-y-sm">
        <div v-if="activeUntil" class="rmm-muted">
          Awake until {{ activeUntil }}. A new hold replaces it.
        </div>
        <q-option-group
          v-model="minutes"
          :options="OPTIONS"
          type="radio"
          dense
        />
        <div class="rmm-muted keep-awake__hint">
          The hold ends by itself, at the latest after six hours. A laptop on
          battery keeps running and drains it.
        </div>
        <template v-if="agent.plat === 'darwin'">
          <q-separator />
          <q-toggle
            v-model="onPower"
            label="Stay awake on power"
            :disable="loading || powerSaving"
            @update:model-value="saveOnPower"
          />
          <div class="rmm-muted keep-awake__hint">
            Also with the lid closed. On battery it sleeps as usual.
          </div>
        </template>
      </q-card-section>
      <q-card-actions>
        <q-btn
          v-if="activeUntil"
          flat
          no-caps
          label="Turn off"
          :disable="loading || powerSaving"
          @click="save(0)"
        >
          <q-tooltip>End the hold now; the device may sleep again</q-tooltip>
        </q-btn>
        <q-space />
        <q-btn v-close-popup flat label="Cancel" :disable="powerSaving" />
        <q-btn
          unelevated
          color="primary"
          label="Keep awake"
          :loading="loading"
          :disable="powerSaving"
          @click="save(minutes)"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { ref, computed } from "vue";
import { useStore } from "vuex";
import { useDialogPluginComponent } from "quasar";
import { keepAgentAwake, keepAgentAwakeOnPower } from "@/api/agents";
import { deviceName } from "@/utils/deviceName";
import { notifySuccess } from "@/utils/notify";
import DialogHeader from "@/components/ui/DialogHeader.vue";

const OPTIONS = [
  { label: "1 hour", value: 60 },
  { label: "2 hours", value: 120 },
  { label: "4 hours", value: 240 },
  { label: "6 hours", value: 360 },
];

const props = defineProps({
  agent: { type: Object, required: true },
});
const emit = defineEmits([...useDialogPluginComponent.emits]);

const { dialogRef, onDialogHide, onDialogOK } = useDialogPluginComponent();
const store = useStore();

const minutes = ref(60);
const loading = ref(false);
const onPower = ref(!!props.agent.keep_awake_ac);
const powerSaving = ref(false);
const powerChanged = ref(false);

const activeUntil = computed(() => {
  const until = props.agent.keep_awake_until;
  return until && new Date(until) > Date.now()
    ? store.getters.formatDate(until)
    : "";
});

async function save(value) {
  loading.value = true;
  try {
    const { keep_awake_until } = await keepAgentAwake(
      props.agent.agent_id,
      value,
    );
    notifySuccess(
      value
        ? `${deviceName(props.agent)} stays awake until ${store.getters.formatDate(keep_awake_until)}`
        : `${deviceName(props.agent)} may sleep again`,
    );
    powerChanged.value = false;
    onDialogOK();
  } catch (err) {
    console.error("keep awake change failed", err);
  }
  loading.value = false;
}

// the toggle saves at once; closing the dialog then counts as OK, so the
// caller reloads the agent. It stays open until the answer is in.
async function saveOnPower(ac) {
  powerSaving.value = true;
  try {
    await keepAgentAwakeOnPower(props.agent.agent_id, ac);
    powerChanged.value = true;
    notifySuccess(
      ac
        ? `${deviceName(props.agent)} stays awake on power`
        : `${deviceName(props.agent)} sleeps on power as usual`,
    );
  } catch (err) {
    onPower.value = !ac;
    console.error("stay awake on power change failed", err);
  }
  powerSaving.value = false;
}

function onHide(evt) {
  if (powerChanged.value) emit("ok");
  onDialogHide(evt);
}
</script>

<style scoped>
.keep-awake__hint {
  font-size: var(--rmm-fs-xs);
}
</style>
