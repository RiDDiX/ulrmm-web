<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-dialog
    ref="dialogRef"
    aria-labelledby="route-dialog-title"
    @hide="onDialogHide"
  >
    <q-card class="q-dialog-plugin rmm-dialog--md">
      <DialogHeader
        title-id="route-dialog-title"
        :title="route ? 'Edit route' : 'Add route'"
        subtitle="Which events go to which channels, and who is told when nobody reacts"
      />
      <q-form @submit="submit">
        <q-card-section class="scroll q-gutter-y-sm" style="max-height: 72vh">
          <q-input
            v-model="form.name"
            label="Name"
            outlined
            dense
            :rules="[(v) => !!v || '*Required']"
          />
          <q-select
            v-model="form.severities"
            :options="SEVERITIES"
            label="Severities"
            multiple
            use-chips
            outlined
            dense
            options-dense
            hint="Empty matches every severity"
          />
          <q-select
            v-model="form.sources"
            :options="SOURCES"
            label="Sources"
            multiple
            use-chips
            emit-value
            map-options
            outlined
            dense
            options-dense
            hint="Empty matches every source"
          />
          <q-select
            v-model="form.channels"
            :options="channelOptions"
            label="Send to"
            multiple
            use-chips
            emit-value
            map-options
            outlined
            dense
            options-dense
            :rules="[(v) => (v && v.length > 0) || 'Pick at least one channel']"
          />
          <q-input
            v-model.number="form.escalate_after_minutes"
            type="number"
            min="0"
            max="10080"
            label="Escalate after (minutes)"
            outlined
            dense
            hint="0 = off. An alert still unresolved after this time is sent to the escalation channels once"
            :rules="[
              (v) =>
                v === '' ||
                (Number.isInteger(v) && v >= 0 && v <= 10080) ||
                '0 to 10080 minutes (one week)',
            ]"
          />
          <q-select
            v-if="form.escalate_after_minutes > 0"
            v-model="form.escalate_to"
            :options="channelOptions"
            label="Escalate to"
            multiple
            use-chips
            emit-value
            map-options
            outlined
            dense
            options-dense
            :rules="[(v) => (v && v.length > 0) || 'Pick at least one channel']"
          />
          <q-toggle
            v-model="form.mute_in_maintenance"
            label="Mute while the device is in maintenance"
          />
        </q-card-section>
        <DialogActions :loading="saving" @cancel="onDialogCancel" />
      </q-form>
    </q-card>
  </q-dialog>
</template>

<script setup>
import DialogActions from "@/components/ui/DialogActions.vue";
import { computed, ref } from "vue";
import { useDialogPluginComponent } from "quasar";
import DialogHeader from "@/components/ui/DialogHeader.vue";
import { saveRoute } from "@/api/notify";
import { SEVERITIES, SOURCES, kindLabel } from "@/utils/notifyChannels";
import { notifySuccess } from "@/utils/notify";

// channels: rows of GET /notify/channels/
const props = defineProps({
  route: { type: Object, default: null },
  channels: { type: Array, default: () => [] },
});
defineEmits([...useDialogPluginComponent.emits]);
const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } =
  useDialogPluginComponent();

function initialForm() {
  const r = props.route;
  return {
    name: r?.name || "",
    severities: [...(r?.severities || [])],
    sources: [...(r?.sources || [])],
    channels: [...(r?.channels || [])],
    escalate_after_minutes: r?.escalate_after_minutes || 0,
    escalate_to: [...(r?.escalate_to || [])],
    mute_in_maintenance: r ? r.mute_in_maintenance !== false : true,
  };
}
const form = ref(initialForm());
const saving = ref(false);
const channelOptions = computed(() =>
  props.channels.map((c) => ({
    value: c.id,
    label: `${c.name} (${kindLabel(c.kind)})`,
  })),
);

async function submit() {
  saving.value = true;
  try {
    const payload = {
      ...form.value,
      escalate_after_minutes: form.value.escalate_after_minutes || 0,
    };
    if (!payload.escalate_after_minutes) payload.escalate_to = [];
    const saved = await saveRoute(props.route?.id, payload);
    notifySuccess(props.route ? "Route saved" : "Route added");
    onDialogOK(saved);
  } catch {
    // the error toast comes from the axios boot
  }
  saving.value = false;
}
</script>
