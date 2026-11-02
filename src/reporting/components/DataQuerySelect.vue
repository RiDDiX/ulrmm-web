<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide">
    <q-card class="q-dialog-plugin rmm-dialog--sm">
      <DialogHeader
        :title="dataSources ? 'Edit Data Query' : 'Insert Data Query'"
        :subtitle="
          dataSources
            ? 'Pick a query from this template\'s data_sources to edit'
            : 'Copies a saved query into this template\'s data_sources'
        "
      />
      <q-card-section>
        <RmmSelect
          label="Data Queries"
          :loading="isLoading"
          v-model="picked"
          :options="options"
          filterable
        />
      </q-card-section>
      <q-card-actions align="right">
        <q-btn flat no-caps label="Cancel" @click="onDialogCancel" />
        <q-btn
          label="Select"
          color="primary"
          unelevated
          no-caps
          @click="submit()"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref } from "vue";
import { useDialogPluginComponent } from "quasar";
import DialogHeader from "@/components/ui/DialogHeader.vue";
import RmmSelect from "@/components/ui/RmmSelect.vue";
import { notifyError } from "@/utils/notify";
import { useReportDataQueriesShared } from "@/reporting/stores";

import type { ReportDataQuery } from "@/reporting/types";

const props = defineProps<{
  // the template's data_sources map; without it the saved queries are listed
  dataSources?: Record<string, Record<string, unknown>>;
}>();

defineEmits([...useDialogPluginComponent.emits]);

const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } =
  useDialogPluginComponent();
const { dataQueries, isLoading, getReportDataQueries } =
  useReportDataQueriesShared;

const picked = ref<string | null>(null);

const options = computed(() =>
  props.dataSources
    ? Object.keys(props.dataSources)
    : dataQueries.value.map((query) => query.name),
);

function submit() {
  if (!picked.value) {
    notifyError("Select a query from the dropdown");
    return;
  }
  let query: ReportDataQuery | undefined;
  if (props.dataSources)
    query = {
      id: 0,
      name: picked.value,
      json_query: props.dataSources[picked.value],
    };
  else query = dataQueries.value.find((entry) => entry.name === picked.value);
  if (query) onDialogOK(query);
}

onMounted(() => {
  if (!props.dataSources) getReportDataQueries();
});
</script>
