<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-dialog
    ref="dialogRef"
    aria-labelledby="reboot-later-title"
    @hide="onDialogHide"
  >
    <q-card class="q-dialog-plugin rmm-dialog--sm">
      <DialogHeader
        title-id="reboot-later-title"
        :title="`Schedule reboot on ${deviceName(agent)}`"
        subtitle="Reboots the device once at the chosen time; unsaved work is lost"
      />
      <SchemaForm v-model="form" :fields="fields" />
      <FormButtons
        label="Schedule reboot"
        :loading="loading"
        :submit="false"
        @go="schedule"
      />
    </q-card>
  </q-dialog>
</template>

<script setup>
import { ref } from "vue";
import { useQuasar, useDialogPluginComponent, date } from "quasar";
import { scheduleAgentReboot } from "@/api/agents";
import { formatDateInputField } from "@/utils/format";
import { deviceName } from "@/utils/deviceName";
import DialogHeader from "@/components/ui/DialogHeader.vue";
import SchemaForm from "@/components/ui/SchemaForm.vue";
import FormButtons from "@/components/agents/FormButtons.vue";

defineOptions({ name: "RebootLater" });
defineEmits([...useDialogPluginComponent.emits]);

const props = defineProps({
  agent: { type: Object, required: true },
});

const { dialogRef, onDialogHide, onDialogOK } = useDialogPluginComponent();
const $q = useQuasar();

const fields = [
  {
    key: "datetime",
    type: "datetime",
    label: "Reboot time",
    hint: "Agent's local time zone. If the device is off at that time, the reboot is skipped",
    props: { hideBottomSpace: true },
  },
];

const form = ref({
  datetime: formatDateInputField(date.addToDate(Date.now(), { hours: 1 })),
});
const loading = ref(false);

async function schedule() {
  loading.value = true;
  try {
    const { time } = await scheduleAgentReboot(
      props.agent.agent_id,
      form.value,
    );
    $q.dialog({
      title: "Reboot pending",
      style: "width: 40vw",
      message: `A reboot has been scheduled for ${time} on ${deviceName(props.agent)}. It can be cancelled from the Pending Actions menu until the scheduled time.`,
    }).onDismiss(onDialogOK);
  } catch (e) {
    console.error(e);
  }
  loading.value = false;
}
</script>
