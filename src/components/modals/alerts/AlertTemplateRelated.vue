<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<script setup>
import { ref, onMounted } from "vue";
import { useQuasar, useDialogPluginComponent } from "quasar";
import axios from "axios";
import DialogHeader from "@/components/ui/DialogHeader.vue";
import EmptyState from "@/components/ui/EmptyState.vue";

const props = defineProps({ template: Object });
defineEmits([...useDialogPluginComponent.emits]);

const $q = useQuasar();
const { dialogRef, onDialogHide } = useDialogPluginComponent();

const KINDS = [
  {
    name: "policies",
    label: "Policies",
    icon: "policy",
    hint: "Assign it from the Automation Manager with Assign Alert Template.",
  },
  {
    name: "clients",
    label: "Clients",
    icon: "business",
    hint: "Assign it with Assign Alert Template on a client in the tree.",
  },
  {
    name: "sites",
    label: "Sites",
    icon: "apartment",
    hint: "Assign it with Assign Alert Template on a site in the tree.",
  },
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

const tab = ref("policies");
const related = ref({});

const listOf = (kind) => related.value[kind] || [];

onMounted(async () => {
  $q.loading.show();
  try {
    const { data } = await axios.get(
      `/alerts/templates/${props.template.id}/related/`,
    );
    related.value = data;
  } catch {
    // the request layer already reported it
  }
  $q.loading.hide();
});
</script>

<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide">
    <q-card style="width: 60vw">
      <DialogHeader
        :title="`Assigned to ${template.name}`"
        subtitle="Policies, clients and sites that use this template directly"
      />
      <q-card-section>
        <q-tabs v-model="tab" v-bind="tabAttrs">
          <q-tab
            v-for="kind in KINDS"
            :key="kind.name"
            :name="kind.name"
            :label="`${kind.label} (${listOf(kind.name).length})`"
          />
        </q-tabs>

        <q-separator />
        <q-scroll-area :thumb-style="thumbStyle" style="height: 50vh">
          <q-tab-panels v-model="tab" :animated="false">
            <q-tab-panel
              v-for="kind in KINDS"
              :key="kind.name"
              :name="kind.name"
            >
              <q-list v-if="listOf(kind.name).length" separator padding>
                <q-item v-for="row in listOf(kind.name)" :key="row.id">
                  <q-item-section>
                    <q-item-label>{{ row.name }}</q-item-label>
                  </q-item-section>
                </q-item>
              </q-list>
              <EmptyState
                v-else
                :icon="kind.icon"
                :title="`Not assigned to any ${kind.name}`"
                :text="kind.hint"
              />
            </q-tab-panel>
          </q-tab-panels>
        </q-scroll-area>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>
