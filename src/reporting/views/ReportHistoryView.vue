<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <div class="report-page">
    <EmptyState
      v-if="error"
      icon="link_off"
      title="This report cannot be opened"
      :text="`${error} Open the run again from Report History.`"
    />
    <EmptyState
      v-else-if="isError"
      icon="error_outline"
      title="The report could not be loaded"
      text="See the error message for the reason."
    >
      <q-btn unelevated color="primary" label="Try again" @click="load" />
    </EmptyState>
    <ReportFrame v-else :output="output" :format="format" title="Report" />
    <q-inner-loading :showing="isLoading" label="Loading report..." />
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import EmptyState from "@/components/ui/EmptyState.vue";
import ReportFrame from "@/reporting/components/ReportFrame.vue";
import { runReportHistory } from "@/reporting/api";
import { useRequestState } from "@/reporting/stores";

import type { ReportFormat, ReportOutput } from "@/reporting/types";

// parsed and checked by reportHistoryRouteProps; error is set for a bad link
const props = defineProps<{
  id: number;
  format: ReportFormat;
  error: string | null;
}>();

const { isLoading, isError, track } = useRequestState();
const output = ref<ReportOutput | null>(null);

function load() {
  output.value = null;
  return track(async () => {
    output.value = await runReportHistory(props.id, props.format);
  });
}

onMounted(() => {
  if (!props.error) load();
});
</script>

<style scoped>
.report-page {
  position: relative;
  height: 100vh;
  overflow: hidden;
}
</style>
