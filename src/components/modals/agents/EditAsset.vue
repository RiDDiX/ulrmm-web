<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-dialog
    ref="dialogRef"
    persistent
    aria-labelledby="asset-title"
    @hide="onDialogHide"
  >
    <q-card class="q-dialog-plugin rmm-dialog--md">
      <DialogHeader
        title-id="asset-title"
        :title="`Asset details of ${deviceName(agent)}`"
        subtitle="Purchase and warranty record; the warranty lookup fills the end date"
      />
      <q-form autocomplete="off" @submit="save">
        <q-card-section class="row q-col-gutter-md">
          <div class="col-12 col-sm-6">
            <q-input
              v-model="form.asset_tag"
              label="Asset tag"
              maxlength="64"
              dense
              outlined
              autofocus
            />
          </div>
          <div class="col-12 col-sm-6">
            <q-input
              v-model="form.vendor"
              label="Vendor"
              hint="Where it was bought"
              maxlength="120"
              dense
              outlined
            />
          </div>
          <div class="col-12 col-sm-6">
            <q-input
              v-model="form.purchase_date"
              label="Purchase date"
              type="date"
              dense
              outlined
              stack-label
              clearable
            />
          </div>
          <div class="col-12 col-sm-6">
            <q-input
              v-model="form.purchase_price"
              label="Purchase price"
              type="number"
              min="0"
              step="0.01"
              dense
              outlined
              clearable
            />
          </div>
          <div class="col-12 col-sm-6">
            <q-input
              v-model="form.warranty_end"
              label="Warranty ends"
              type="date"
              dense
              outlined
              stack-label
              clearable
              hint="A warranty lookup overwrites it"
            />
          </div>
          <div class="col-12">
            <q-input
              v-model="form.lifecycle_notes"
              type="textarea"
              label="Notes"
              maxlength="2000"
              counter
              autogrow
              dense
              outlined
            />
          </div>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn
            flat
            label="Cancel"
            :disable="saving"
            @click="onDialogCancel"
          />
          <q-btn
            unelevated
            color="primary"
            label="Save"
            type="submit"
            :loading="saving"
          />
        </q-card-actions>
      </q-form>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { reactive, ref } from "vue";
import { useDialogPluginComponent } from "quasar";
import { editAgent } from "@/api/agents";
import { deviceName } from "@/utils/deviceName";
import { notifySuccess } from "@/utils/notify";
import DialogHeader from "@/components/ui/DialogHeader.vue";

const props = defineProps({
  agent: { type: Object, required: true },
});
defineEmits([...useDialogPluginComponent.emits]);

const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } =
  useDialogPluginComponent();

const form = reactive({
  asset_tag: props.agent.asset_tag ?? "",
  vendor: props.agent.vendor ?? "",
  purchase_date: props.agent.purchase_date ?? "",
  purchase_price: props.agent.purchase_price ?? "",
  warranty_end: props.agent.warranty_end ?? "",
  lifecycle_notes: props.agent.lifecycle_notes ?? "",
});
const saving = ref(false);

async function save() {
  saving.value = true;
  const price = String(form.purchase_price ?? "").trim();
  try {
    await editAgent(props.agent.agent_id, {
      asset_tag: form.asset_tag.trim(),
      vendor: form.vendor.trim(),
      // empty dates and price are null on the server
      purchase_date: form.purchase_date || null,
      purchase_price: price === "" ? null : price,
      warranty_end: form.warranty_end || null,
      lifecycle_notes: form.lifecycle_notes ?? "",
    });
    notifySuccess("Asset details saved");
    onDialogOK();
  } catch (e) {
    console.error(e);
  } finally {
    saving.value = false;
  }
}
</script>
