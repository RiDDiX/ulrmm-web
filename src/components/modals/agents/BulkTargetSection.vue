<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-card-section class="q-pb-sm">
    <div class="bulk-section-title">Target</div>
    <div class="row items-center q-gutter-x-xs">
      <div class="rmm-label">Choose target</div>
      <HelpTip
        text="Client or Site: all matching agents in it. Group: its members when you run it. All: every agent you can see"
      />
    </div>
    <q-option-group
      v-model="state.target"
      :options="targetChoices"
      aria-label="Target"
      color="primary"
      class="q-pl-sm"
      dense
      inline
    />
  </q-card-section>

  <q-card-section class="q-py-none">
    <rmm-select
      v-if="picker"
      :key="state.target"
      v-model="state[picker.key]"
      :options="picker.options"
      :label="picker.label"
      :multiple="picker.multiple"
      :rules="[(v) => (picker.multiple ? v?.length > 0 : !!v) || 'Required']"
      outlined
      mapOptions
      filterable
    />
  </q-card-section>

  <q-card-section class="q-py-sm">
    <div class="rmm-label">Agent OS</div>
    <div v-if="mode === 'package'" class="q-pl-sm">
      {{
        selectedPackage
          ? `${osTypeLabel}, from the package`
          : "Follows the package"
      }}
    </div>
    <q-option-group
      v-else
      v-model="state.osType"
      :options="osChoices"
      aria-label="Agent OS"
      color="primary"
      class="q-pl-sm"
      dense
      inline
    />
    <div
      v-if="state.target === 'agents'"
      class="text-caption rmm-muted q-pl-sm q-mt-xs"
    >
      Selected agents that do not match are skipped.
    </div>
  </q-card-section>

  <q-card-section v-show="state.target !== 'agents'" class="q-py-sm">
    <BulkChoice
      v-model="state.monType"
      :options="monTypeChoices"
      title="Agent type"
    />
  </q-card-section>
</template>

<script setup>
import { computed, toRef } from "vue";
import RmmSelect from "@/components/ui/RmmSelect.vue";
import HelpTip from "@/components/ui/HelpTip.vue";
import BulkChoice from "@/components/modals/agents/BulkChoice.vue";

const props = defineProps({
  draft: { type: Object, required: true },
  mode: String,
  selectedPackage: Object,
  osTypeLabel: String,
  osChoices: { type: Array, required: true },
  clientOptions: Array,
  siteOptions: Array,
  groupOptions: Array,
  agentOptions: Array,
});
const state = toRef(props, "draft");

const targetChoices = [
  { label: "Client", value: "client" },
  { label: "Site", value: "site" },
  { label: "Group", value: "group" },
  { label: "Selected agents", value: "agents" },
  { label: "All", value: "all" },
];
const monTypeChoices = [
  { label: "All", value: "all" },
  { label: "Servers", value: "servers" },
  { label: "Workstations", value: "workstations" },
];

const picker = computed(() => {
  const by = {
    client: {
      key: "client",
      label: "Select client",
      options: props.clientOptions,
    },
    site: { key: "site", label: "Select site", options: props.siteOptions },
    group: { key: "group", label: "Select group", options: props.groupOptions },
    agents: {
      key: "agents",
      label: "Select agents",
      options: props.agentOptions,
      multiple: true,
    },
  };
  return by[state.value.target];
});
</script>
