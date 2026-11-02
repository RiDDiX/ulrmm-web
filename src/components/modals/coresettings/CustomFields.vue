<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <div>
    <SettingsPanelHeader
      title="Custom Fields"
      :count="customFields.length"
      text="Extra fields on clients, sites and agents; scripts read them as {{client.Name}}, {{site.Name}} or {{agent.Name}}."
    >
      <q-btn
        unelevated
        no-caps
        color="primary"
        icon="add"
        label="Add custom field"
        @click="add"
      >
        <q-tooltip>Creates a new {{ tab }} field</q-tooltip>
      </q-btn>
    </SettingsPanelHeader>
    <q-linear-progress v-if="loading" indeterminate color="primary" />
    <q-banner v-if="error" dense class="bg-negative text-white">
      {{ error }}
      <template #action>
        <q-btn outline dense label="Retry" @click="load" />
      </template>
    </q-banner>
    <div>
      <q-tabs v-model="tab" v-bind="tabAttrs">
        <q-tab
          v-for="m in MODELS"
          :key="m.name"
          :name="m.name"
          :label="`${m.label} (${fieldsOf(m.name).length})`"
        />
      </q-tabs>

      <q-separator />
      <q-scroll-area :thumb-style="thumbStyle" style="height: 50vh">
        <q-tab-panels v-model="tab" :animated="false">
          <q-tab-panel v-for="m in MODELS" :key="m.name" :name="m.name">
            <CustomFieldsTable :data="fieldsOf(m.name)" @refresh="load" />
          </q-tab-panel>
        </q-tab-panels>
      </q-scroll-area>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { useQuasar } from "quasar";
import axios from "axios";
import SettingsPanelHeader from "@/components/modals/coresettings/SettingsPanelHeader.vue";
import CustomFieldsTable from "@/components/modals/coresettings/CustomFieldsTable.vue";
import CustomFieldsForm from "@/components/modals/coresettings/CustomFieldsForm.vue";

const $q = useQuasar();

const MODELS = [
  { name: "client", label: "Clients" },
  { name: "site", label: "Sites" },
  { name: "agent", label: "Agents" },
];
const tabAttrs = {
  dense: true,
  "inline-label": true,
  "no-caps": true,
  "narrow-indicator": true,
  "active-color": "primary",
  "indicator-color": "primary",
  align: "left",
};
const thumbStyle = {
  right: "2px",
  borderRadius: "5px",
  backgroundColor: "var(--rmm-accent)",
  width: "5px",
  opacity: 0.75,
};

const tab = ref("client");
const customFields = ref([]);
const loading = ref(false);
const error = ref("");

const fieldsOf = (model) => customFields.value.filter((f) => f.model === model);

async function load() {
  loading.value = true;
  error.value = "";
  try {
    customFields.value = (await axios.get("/core/customfields/")).data;
  } catch (err) {
    error.value =
      err?.response?.status === 403
        ? "Your role cannot view custom fields."
        : "Custom fields could not be loaded.";
  }
  loading.value = false;
}

// the new field starts on the model of the open tab
function add() {
  $q.dialog({
    component: CustomFieldsForm,
    componentProps: { model: tab.value },
  }).onOk(load);
}

onMounted(load);
</script>
