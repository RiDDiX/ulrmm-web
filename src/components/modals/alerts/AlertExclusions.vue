<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide">
    <q-card style="width: 50vw; max-width: 50vw">
      <DialogHeader
        :title="`Alert exclusions for ${template.name}`"
        subtitle="Excluded agents skip this template and use the next one that applies, if any"
      />
      <q-form @submit.prevent="save">
        <q-card-section class="q-gutter-y-md">
          <rmm-select
            v-for="p in pickers"
            :key="p.field"
            v-model="excluded[p.field]"
            :label="p.label"
            :hint="p.hint"
            :options="p.options"
            outlined
            multiple
            use-chips
            mapOptions
            filterable
          />
        </q-card-section>

        <q-card-section class="q-pt-none">
          <div class="rmm-label q-pb-xs">By agent type</div>
          <q-checkbox
            v-for="t in typeFlags"
            :key="t.field"
            v-model="excluded[t.field]"
            :label="t.label"
          >
            <q-tooltip>{{ t.tip }}</q-tooltip>
          </q-checkbox>
        </q-card-section>

        <FormActions />
      </q-form>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import axios from "axios";
import { useDialogPluginComponent, useQuasar } from "quasar";
import { formatAgentOptions } from "@/utils/format";
import { notifySuccess } from "@/utils/notify";
import { withStepUp } from "@/components/vault/stepUp";
import DialogHeader from "@/components/ui/DialogHeader.vue";
import RmmSelect from "@/components/ui/RmmSelect.vue";
import FormActions from "@/core/ui/FormActions.vue";

const props = defineProps({ template: Object });
defineEmits([...useDialogPluginComponent.emits]);

const $q = useQuasar();
const { dialogRef, onDialogHide, onDialogOK } = useDialogPluginComponent();

const excluded = reactive({
  id: props.template.id,
  excluded_clients: props.template.excluded_clients,
  excluded_sites: props.template.excluded_sites,
  excluded_agents: props.template.excluded_agents,
  exclude_servers: props.template.exclude_servers,
  exclude_workstations: props.template.exclude_workstations,
});

const clientOptions = ref([]);
const siteOptions = ref([]);
const agentOptions = ref([]);

const pickers = computed(() => [
  {
    field: "excluded_clients",
    label: "Excluded Clients",
    hint: "Every agent in these clients skips the template",
    options: clientOptions.value,
  },
  {
    field: "excluded_sites",
    label: "Excluded Sites",
    hint: "Every agent in these sites skips the template",
    options: siteOptions.value,
  },
  {
    field: "excluded_agents",
    label: "Excluded Agents",
    hint: "Only these agents skip the template",
    options: agentOptions.value,
  },
]);

const typeFlags = [
  {
    field: "exclude_workstations",
    label: "Exclude Workstations",
    tip: "No workstation uses this template",
  },
  {
    field: "exclude_servers",
    label: "Exclude Servers",
    tip: "No server uses this template",
  },
];

async function save() {
  // no loading overlay: a template with a server action may first ask for
  // the two-factor code in a dialog
  const saved = await withStepUp($q, (config) =>
    axios.put(`alerts/templates/${props.template.id}/`, excluded, config),
  );
  if (saved === null) return;
  onDialogOK();
  notifySuccess("Alert template exclusions saved");
}

async function loadClientsAndSites() {
  $q.loading.show();
  try {
    const { data } = await axios.get("/clients/");
    clientOptions.value = data.map((c) => ({ label: c.name, value: c.id }));
    siteOptions.value = data.flatMap((client) => [
      { category: client.name },
      ...client.sites.map((s) => ({ label: s.name, value: s.id })),
    ]);
  } catch {
    // the request layer already reported it
  }
  $q.loading.hide();
}

onMounted(async () => {
  const { data } = await axios.get("/agents/?detail=false");
  agentOptions.value = Object.freeze(formatAgentOptions(data, false, "id"));
  loadClientsAndSites();
});
</script>
