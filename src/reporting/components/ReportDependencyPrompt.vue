<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide">
    <q-card class="q-dialog-plugin rmm-dialog--sm">
      <DialogHeader
        title="Report Dependencies"
        subtitle="The report needs these values before it can run"
      />
      <q-form @submit="submit">
        <q-card-section class="q-gutter-y-sm">
          <template v-for="name in dependsOn" :key="name">
            <RmmSelect
              v-if="name === 'client'"
              v-model="form[name]"
              :options="clientOptions"
              :label="label(name)"
              map-options
              filterable
              :rules="[required]"
            />
            <RmmSelect
              v-else-if="name === 'site'"
              v-model="form[name]"
              :options="siteOptions"
              :label="label(name)"
              map-options
              filterable
              :rules="[required]"
            />
            <RmmSelect
              v-else-if="name === 'agent'"
              v-model="form[name]"
              :options="agentOptions"
              :label="label(name)"
              map-options
              filterable
              :rules="[required]"
            />
            <q-input
              v-else
              v-model="form[name]"
              :label="label(name)"
              :hint="`Available as {{ ${name} }} in the template`"
              :rules="[required]"
              outlined
              dense
            />
          </template>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat no-caps label="Cancel" @click="onDialogCancel" />
          <q-btn v-bind="primaryBtn" label="Submit" type="submit" />
        </q-card-actions>
      </q-form>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { onMounted, reactive } from "vue";
import { useDialogPluginComponent } from "quasar";
import DialogHeader from "@/components/ui/DialogHeader.vue";
import RmmSelect from "@/components/ui/RmmSelect.vue";
import { useAgentDropdown } from "@/composables/agents";
import { useClientDropdown, useSiteDropdown } from "@/composables/clients";
import { capitalize } from "@/utils/format";
import { notifyError } from "@/utils/notify";
import { missingDependencies } from "@/reporting/utils";

import type { ReportDependencies } from "@/reporting/types";

const primaryBtn = { unelevated: true, "no-caps": true, color: "primary" };

const props = withDefaults(
  defineProps<{
    dependsOn: string[];
    values?: ReportDependencies;
  }>(),
  { values: () => ({}) },
);

const { agentOptions, getAgentOptions } = useAgentDropdown();
const { siteOptions, getSiteOptions } = useSiteDropdown();
const { clientOptions, getClientOptions } = useClientDropdown();

// a copy: the caller's values change only on submit
const form = reactive<Record<string, string | number | null>>(
  Object.fromEntries(
    props.dependsOn.map((name) => [
      name,
      Object.prototype.hasOwnProperty.call(props.values, name)
        ? props.values[name]
        : null,
    ]),
  ),
);

const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } =
  useDialogPluginComponent();
defineEmits([...useDialogPluginComponent.emits]);

const required = (value: unknown) =>
  (value !== null && value !== undefined && String(value).trim() !== "") ||
  "*Required";

function label(name: string) {
  return name ? capitalize(name) : name;
}

const needs = (name: string) => props.dependsOn.includes(name);

onMounted(async () => {
  if (needs("client")) getClientOptions();
  if (needs("site")) getSiteOptions();
  if (needs("agent")) {
    await getAgentOptions().catch((err: unknown) => console.error(err));
  }
});

function submit() {
  const filled = Object.entries(form).filter(
    (entry): entry is [string, string | number] => entry[1] !== null,
  );
  const entered: ReportDependencies = Object.fromEntries(filled);
  if (missingDependencies(props.dependsOn, entered).length > 0) {
    notifyError("All fields must have a value");
    return;
  }
  onDialogOK({ ...props.values, ...entered });
}
</script>
