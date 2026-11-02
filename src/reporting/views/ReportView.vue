<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <div class="report-page">
    <EmptyState
      v-if="error"
      icon="link_off"
      title="This report cannot be opened"
      :text="`${error} Open the report again from the Reports Manager.`"
    />
    <EmptyState
      v-else-if="needsValues"
      icon="tune"
      title="Values required"
      :text="`This report needs a value for ${missing.join(', ')} before it can run.`"
    >
      <q-btn
        unelevated
        color="primary"
        label="Enter values"
        @click="askForValues"
      />
    </EmptyState>
    <EmptyState
      v-else-if="isError"
      icon="error_outline"
      title="The report could not be generated"
      text="See the error message for the reason."
    >
      <q-btn unelevated color="primary" label="Try again" @click="run" />
    </EmptyState>
    <ReportFrame v-else :output="output" :format="format" title="Report" />
    <q-inner-loading :showing="isLoading" label="Generating report..." />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import EmptyState from "@/components/ui/EmptyState.vue";
import ReportFrame from "@/reporting/components/ReportFrame.vue";
import { runReport } from "@/reporting/api";
import { promptDependencies } from "@/reporting/actions";
import { useRequestState } from "@/reporting/stores";
import { missingDependencies, reportLocation } from "@/reporting/utils";

import type {
  ReportDependencies,
  ReportFormat,
  ReportOutput,
} from "@/reporting/types";

// parsed and checked by reportRouteProps; error is set for a bad link
const props = defineProps<{
  id: number;
  format: ReportFormat;
  dependsOn: string[];
  dependencies: ReportDependencies;
  error: string | null;
}>();

const router = useRouter();
const { isLoading, isError, track } = useRequestState();

const output = ref<ReportOutput | null>(null);
const values = ref<ReportDependencies>({ ...props.dependencies });
const needsValues = ref(false);
const missing = computed(() =>
  missingDependencies(props.dependsOn, values.value),
);

function run() {
  output.value = null;
  return track(async () => {
    output.value = await runReport(props.id, {
      format: props.format,
      dependencies: values.value,
    });
  });
}

// A closed prompt sends nothing. The entered values go into the URL, so a
// reload does not ask again.
async function askForValues() {
  const result = await promptDependencies(missing.value, values.value);
  if (!result) {
    needsValues.value = true;
    return;
  }
  needsValues.value = false;
  values.value = result;
  router.replace(
    reportLocation(props.id, props.format, props.dependsOn, result),
  );
  run();
}

onMounted(() => {
  if (props.error) return;
  if (missing.value.length > 0) askForValues();
  else run();
});
</script>

<style scoped>
.report-page {
  position: relative;
  height: 100vh;
  overflow: hidden;
}
</style>
