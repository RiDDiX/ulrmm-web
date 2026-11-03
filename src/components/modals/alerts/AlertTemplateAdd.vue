<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide">
    <q-card class="q-dialog-plugin" style="width: 60vw">
      <DialogHeader
        :title="`Edit Alert Template assigned to ${type}`"
        :subtitle="SUBTITLES[type]"
      />
      <q-form @submit.prevent="save">
        <SchemaForm v-if="options.length > 0" v-model="form" :fields="fields" />
        <q-card-section v-else>
          <EmptyState
            icon="notifications"
            title="No alert templates yet"
            text="Create one under Settings > Alerts Manager, then assign it here."
          />
        </q-card-section>
        <FormActions label="Submit" :no-submit="options.length === 0" />
      </q-form>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { computed, onMounted, ref } from "vue";
import axios from "axios";
import { useDialogPluginComponent, useQuasar } from "quasar";
import { capitalize } from "@/utils/format";
import { notifySuccess } from "@/utils/notify";
import DialogHeader from "@/components/ui/DialogHeader.vue";
import EmptyState from "@/components/ui/EmptyState.vue";
import SchemaForm from "@/components/ui/SchemaForm.vue";
import FormActions from "@/core/ui/FormActions.vue";

const props = defineProps({
  object: Object,
  type: {
    type: String,
    required: true,
    validator: (value) => ["site", "client", "policy"].includes(value),
  },
});
defineEmits([...useDialogPluginComponent.emits]);

const $q = useQuasar();
const { dialogRef, onDialogHide, onDialogOK } = useDialogPluginComponent();

const SUBTITLES = {
  policy:
    "Agents this policy applies to use it unless a closer level has its own template",
  site: "Agents in this site use it unless an agent or site policy has its own template",
  client:
    "Agents in this client use it unless a policy or their site has its own template",
};

const options = ref([]);
const form = ref({ template: props.object.alert_template });

const fields = computed(() => [
  {
    key: "template",
    type: "select",
    label: `${capitalize(props.type)} Alert Template`,
    hint: "Clear it to fall back to the template of the next level up",
    options: options.value,
    props: { clearable: true },
  },
]);

// where each kind of owner is saved, and how the body wraps the change
const TARGETS = {
  client: (id, change) => [`/clients/${id}/`, { client: change }],
  site: (id, change) => [`/clients/sites/${id}/`, { site: change }],
  policy: (id, change) => [`/automation/policies/${id}/`, change],
};

async function save() {
  const chosen = form.value.template;
  // nothing was edited
  if (props.object.alert_template === chosen) {
    dialogRef.value.hide();
    return;
  }

  $q.loading.show();
  const { id } = props.object;
  const [url, body] = TARGETS[props.type](id, { id, alert_template: chosen });
  try {
    await axios.put(url, body);
    $q.loading.hide();
    onDialogOK();
    notifySuccess(`Alert template ${chosen ? "assigned" : "removed"}`);
  } catch {
    $q.loading.hide();
  }
}

onMounted(async () => {
  $q.loading.show();
  try {
    const { data } = await axios.get("/alerts/templates/");
    options.value = data.map((t) => ({ label: t.name, value: t.id }));
  } catch {
    // the request layer already reported it
  }
  $q.loading.hide();
});
</script>
