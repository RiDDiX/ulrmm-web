<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-dialog
    ref="dialogRef"
    aria-labelledby="client-form-title"
    @hide="onDialogHide"
  >
    <q-card class="q-dialog-plugin rmm-dialog--md">
      <DialogHeader
        title-id="client-form-title"
        :title="client ? `Edit ${client.name}` : 'New client'"
        :subtitle="
          client ? '' : 'Creates the client together with its first site'
        "
      />
      <q-form @submit="save">
        <q-card-section class="q-pb-none">
          <q-input
            v-model="clientData.name"
            label="Name"
            :rules="[(val) => (val && val.length > 0) || '*Required']"
            outlined
            dense
          />
        </q-card-section>
        <q-card-section v-if="!client" class="q-pb-none">
          <q-input
            v-model="firstSite.name"
            label="Default first site"
            hint="Every client needs at least one site; agents are installed into a site"
            :rules="[(val) => !!val || '*Required']"
            outlined
            dense
          />
        </q-card-section>

        <CustomFieldsBlock
          :fields="cf.definitions.value"
          :values="cf.values.value"
          :failed="cf.loadFailed.value"
        />
        <FormActions class="q-mt-md" dense :loading="busy" />
      </q-form>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { onMounted, ref } from "vue";
import { useDialogPluginComponent } from "quasar";
import { fetchClient, saveClient, editClient } from "@/api/clients";
import { useCustomFieldForm } from "@/core/customFields";
import { notifySuccess } from "@/utils/notify";
import DialogHeader from "@/components/ui/DialogHeader.vue";
import CustomFieldsBlock from "@/core/ui/CustomFieldsBlock.vue";
import FormActions from "@/core/ui/FormActions.vue";

const props = defineProps({ client: Object });
defineEmits([...useDialogPluginComponent.emits]);

const { dialogRef, onDialogHide, onDialogOK } = useDialogPluginComponent();

const clientData = ref({ name: "", ...props.client });
const firstSite = ref({ name: "" });
const busy = ref(false);
const cf = useCustomFieldForm("client");

async function save() {
  busy.value = true;
  const body = {
    client: clientData.value,
    site: firstSite.value,
    custom_fields: cf.payload(),
  };
  try {
    // the edit answer is the fixed text "{client} was updated"
    if (props.client) {
      await editClient(props.client.id, body);
      notifySuccess(`${clientData.value.name} was updated`);
    } else notifySuccess(await saveClient(body));
    onDialogOK();
  } catch (e) {
    console.error(e);
  }
  busy.value = false;
}

onMounted(async () => {
  await cf.loadDefinitions();
  if (props.client) {
    busy.value = true;
    await cf.loadValues(() => fetchClient(props.client.id));
    busy.value = false;
  }
});
</script>
