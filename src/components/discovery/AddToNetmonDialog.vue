<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-dialog
    ref="dialogRef"
    aria-labelledby="discovery-netmon-title"
    @hide="onDialogHide"
  >
    <q-card class="q-dialog-plugin rmm-dialog--sm">
      <DialogHeader
        title-id="discovery-netmon-title"
        :title="`Monitor ${device.ip}`"
        subtitle="Adds it to the network devices the server checks"
      />
      <q-form @submit="submit">
        <q-card-section class="q-gutter-y-sm">
          <rmm-select
            v-model="site"
            :options="siteOptions"
            label="Site"
            hint="Alerts and access follow this site"
            map-options
            filterable
            :rules="[(v) => !!v || 'Required']"
          />
          <q-input
            v-model="name"
            label="Name"
            maxlength="255"
            dense
            outlined
            :rules="[(v) => !!v?.trim() || 'Required']"
          />
          <div class="rmm-muted text-caption">
            Checks: ping{{
              device.open_ports?.length
                ? `, TCP ${device.open_ports.slice(0, 8).join(", ")}`
                : ""
            }}. SNMP, monitors and alerts can be set afterwards under Network
            devices.
          </div>
        </q-card-section>
        <DialogActions
          submit-label="Add"
          :loading="saving"
          @cancel="onDialogCancel"
        />
      </q-form>
    </q-card>
  </q-dialog>
</template>

<script setup>
import DialogActions from "@/components/ui/DialogActions.vue";
import { ref } from "vue";
import { useDialogPluginComponent } from "quasar";
import DialogHeader from "@/components/ui/DialogHeader.vue";
import RmmSelect from "@/components/ui/RmmSelect.vue";
import { addDeviceToNetmon } from "@/api/discovery";
import { useSiteDropdown } from "@/composables/clients";
import { notifySuccess } from "@/utils/notify";

const props = defineProps({ device: { type: Object, required: true } });
defineEmits(Array.from(useDialogPluginComponent.emits));
const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } =
  useDialogPluginComponent();

const { site, siteOptions, getSiteOptions } = useSiteDropdown();
getSiteOptions();

const name = ref(
  props.device.snmp?.sysName || props.device.hostname || props.device.ip,
);
const saving = ref(false);

async function submit() {
  saving.value = true;
  try {
    const added = await addDeviceToNetmon(props.device.id, {
      site: site.value,
      name: name.value.trim(),
    });
    notifySuccess(`${added.name} is now checked from the server`);
    onDialogOK(added);
  } catch {
    // the error toast comes from the axios boot
  }
  saving.value = false;
}
</script>
