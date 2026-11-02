<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide">
    <q-card style="width: 50vw; max-width: 50vw">
      <DialogHeader
        :title="`Policy Exclusions for ${policy.name}`"
        subtitle="Excluded agents skip this policy even where it is assigned above them"
      />
      <q-form @submit.prevent="save">
        <q-card-section class="q-gutter-y-md">
          <rmm-select
            v-for="f in fields"
            :key="f.model"
            v-model="excl[f.model]"
            :options="options[f.opts]"
            :label="f.label"
            :hint="f.hint"
            outlined
            multiple
            mapOptions
            filterable
          />
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Cancel" v-close-popup />
          <q-btn unelevated label="Save" color="primary" type="submit" />
        </q-card-actions>
      </q-form>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { reactive, onMounted } from "vue";
import { useDialogPluginComponent, Loading } from "quasar";
import axios from "axios";
import RmmSelect from "@/components/ui/RmmSelect.vue";
import DialogHeader from "@/components/ui/DialogHeader.vue";
import { formatAgentOptions } from "@/utils/format";
import { notifySuccess } from "@/utils/notify";

const props = defineProps({ policy: { type: Object, required: true } });
defineEmits(useDialogPluginComponent.emits);
const { dialogRef, onDialogHide, onDialogOK } = useDialogPluginComponent();

const fields = [
  {
    model: "excluded_clients",
    opts: "clients",
    label: "Excluded Clients",
    hint: "Every agent in these clients skips the policy",
  },
  {
    model: "excluded_sites",
    opts: "sites",
    label: "Excluded Sites",
    hint: "Every agent in these sites skips the policy",
  },
  {
    model: "excluded_agents",
    opts: "agents",
    label: "Excluded Agents",
    hint: "Only these agents skip the policy",
  },
];

const excl = reactive({
  id: props.policy.id,
  excluded_clients: props.policy.excluded_clients,
  excluded_sites: props.policy.excluded_sites,
  excluded_agents: props.policy.excluded_agents,
});
const options = reactive({ clients: [], sites: [], agents: [] });

async function save() {
  try {
    await axios.put(`automation/policies/${props.policy.id}/`, excl);
    Loading.hide();
    onDialogOK();
    notifySuccess("Policy exclusions added");
  } catch {
    Loading.hide();
  }
}

async function loadClientsAndSites() {
  Loading.show();
  try {
    const { data } = await axios.get("/clients/");
    options.clients = data.map((c) => ({ label: c.name, value: c.id }));
    for (const c of data) {
      options.sites.push({ category: c.name });
      for (const s of c.sites)
        options.sites.push({ label: s.name, value: s.id });
    }
  } catch {
    // the axios boot reports it
  }
  Loading.hide();
}

onMounted(() => {
  axios.get("/agents/?detail=false").then(({ data }) => {
    options.agents = Object.freeze(formatAgentOptions(data, false, "id"));
  });
  loadClientsAndSites();
});
</script>
