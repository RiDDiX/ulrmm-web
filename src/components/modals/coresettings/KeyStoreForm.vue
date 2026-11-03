<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide">
    <q-card class="q-dialog-plugin rmm-dialog--md">
      <DialogHeader
        :title="globalKey ? 'Edit Global Key' : 'Add Global Key'"
        subtitle="A named value that scripts, URL actions and web hooks read as {{global.Name}}"
      />
      <q-form @submit="save">
        <SchemaForm v-model="entry" :fields="fields" compact />
        <q-card-actions align="right">
          <q-btn flat label="Cancel" v-close-popup />
          <q-btn unelevated label="Save" color="primary" type="submit" />
        </q-card-actions>
      </q-form>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { ref } from "vue";
import axios from "axios";
import { useDialogPluginComponent, useQuasar } from "quasar";
import { notifySuccess } from "@/utils/notify";
import DialogHeader from "@/components/ui/DialogHeader.vue";
import SchemaForm from "@/components/ui/SchemaForm.vue";

const props = defineProps({ globalKey: Object });
defineEmits([...useDialogPluginComponent.emits]);

const $q = useQuasar();
const { dialogRef, onDialogHide, onDialogOK } = useDialogPluginComponent();

const required = [(val) => !!val || "*Required"];
const fields = [
  {
    key: "name",
    type: "text",
    label: "Name",
    hint: "Letters, numbers, spaces, - and _; e.g. SMB_Share becomes {{global.SMB_Share}}",
    rules: required,
  },
  {
    key: "value",
    type: "password",
    secret: "value",
    label: "Value",
    hint: "Every role that can view the key store can read this value",
    rules: required,
  },
];

const entry = ref({ name: "", value: "", ...props.globalKey });

async function save() {
  const body = { ...entry.value };
  $q.loading.show();
  try {
    if (props.globalKey) {
      await axios.put(`/core/keystore/${body.id}/`, body);
    } else {
      await axios.post("/core/keystore/", body);
    }
    $q.loading.hide();
    onDialogOK();
    notifySuccess(props.globalKey ? "Key was edited!" : "Key was added!");
  } catch {
    $q.loading.hide();
  }
}
</script>
