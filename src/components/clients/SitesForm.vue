<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-dialog
    ref="dialogRef"
    aria-labelledby="site-form-title"
    @hide="onDialogHide"
  >
    <q-card class="q-dialog-plugin rmm-dialog--md">
      <DialogHeader
        title-id="site-form-title"
        :title="site ? `Edit ${site.name}` : 'New site'"
        :subtitle="site ? '' : 'Agents are installed into a site'"
      />
      <q-form @submit="save">
        <q-card-section class="q-pb-none">
          <rmm-select
            v-model="siteData.client"
            label="Client"
            :options="clientOptions"
            :hint="clientHint"
            :rules="[(val) => !!val || 'Client is required']"
            outlined
            mapOptions
            filterable
          />
        </q-card-section>
        <q-card-section class="q-pb-none">
          <q-input
            v-model="siteData.name"
            label="Name"
            :rules="[(val) => !!val || 'Name is required']"
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
import { computed, onMounted, ref } from "vue";
import { useDialogPluginComponent, useQuasar } from "quasar";
import { useClientDropdown } from "@/composables/clients";
import { fetchSite, saveSite, editSite } from "@/api/clients";
import { useCustomFieldForm } from "@/core/customFields";
import { notifySuccess } from "@/utils/notify";
import DialogHeader from "@/components/ui/DialogHeader.vue";
import RmmSelect from "@/components/ui/RmmSelect.vue";
import CustomFieldsBlock from "@/core/ui/CustomFieldsBlock.vue";
import FormActions from "@/core/ui/FormActions.vue";

const props = defineProps({
  site: Object,
  client: Number,
  lastSite: { type: Boolean, default: false },
});
defineEmits([...useDialogPluginComponent.emits]);

const $q = useQuasar();
const { dialogRef, onDialogHide, onDialogOK } = useDialogPluginComponent();
const { clientOptions } = useClientDropdown(true);

const siteData = ref(
  props.site ? { ...props.site } : { client: props.client, name: "" },
);
const busy = ref(false);
const cf = useCustomFieldForm("site");

const clientHint = computed(() => {
  if (props.lastSite) {
    return "Only site shown for this client. The server refuses to move the last site of a client.";
  }
  return props.site
    ? "Changing the client moves this site and its agents to that client"
    : undefined;
});

async function save() {
  busy.value = true;
  const body = { site: siteData.value, custom_fields: cf.payload() };
  try {
    const message = props.site
      ? await editSite(props.site.id, body)
      : await saveSite(body);
    notifySuccess(message);
    onDialogOK();
  } catch (e) {
    console.error(e);
  }
  busy.value = false;
}

onMounted(async () => {
  $q.loading.show();
  try {
    await cf.loadDefinitions();
    if (props.site) {
      busy.value = true;
      cf.loadValues(() => fetchSite(props.site.id)).finally(() => {
        busy.value = false;
      });
    }
  } catch (e) {
    console.error(e);
  }
  $q.loading.hide();
});
</script>
