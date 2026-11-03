<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-dialog ref="dialogRef" :aria-labelledby="titleId" @hide="onDialogHide">
    <q-card class="q-dialog-plugin rmm-dialog--md">
      <DialogHeader
        :title="`Uninstall ${softwareName}`"
        :title-id="titleId"
        subtitle="Runs the uninstall command on the device"
      />

      <q-card-section class="q-gutter-y-sm">
        <q-input
          v-model="form.uninstallString"
          label="Uninstall command"
          hint="Confirm or edit it; MSI commands already have /qn /norestart added"
          input-class="rmm-mono"
          dense
          outlined
        />
        <q-input
          v-model.number="form.timeout"
          type="number"
          label="Timeout (seconds)"
          hint="The agent stops waiting after this"
          :rules="[
            (val) =>
              (Number.isInteger(val) && val >= 1 && val <= 86400) ||
              '1 to 86400 seconds',
          ]"
          style="max-width: 200px"
          dense
          outlined
        />
        <div class="row items-center no-wrap">
          <q-checkbox v-model="form.run_as_user" label="Run as user" />
          <HelpTip
            text="Runs in the logged-in user's session instead of as SYSTEM; someone has to be logged in"
            class="q-ml-xs"
          />
        </div>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn label="Cancel" flat no-caps @click="onDialogCancel" />
        <q-btn
          label="Uninstall"
          color="negative"
          unelevated
          no-caps
          :disable="
            !form.uninstallString?.trim() ||
            !(
              Number.isInteger(form.timeout) &&
              form.timeout >= 1 &&
              form.timeout <= 86400
            )
          "
          @click="onDialogOK({ ...form })"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { getCurrentInstance, reactive } from "vue";
import { useDialogPluginComponent } from "quasar";
import DialogHeader from "@/components/ui/DialogHeader.vue";
import HelpTip from "@/components/ui/HelpTip.vue";

const props = defineProps({
  softwareName: String,
  initialUninstallString: String,
});

defineEmits([...useDialogPluginComponent.emits]);

const titleId = `software-uninstall-cmd-title-${getCurrentInstance()?.uid}`;
const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } =
  useDialogPluginComponent();

const form = reactive({
  uninstallString: props.initialUninstallString,
  run_as_user: false,
  timeout: 1800,
});
</script>
