<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <!-- the browser pdf viewer does not run in a sandboxed frame; the blob is
       always retyped application/pdf before it gets here -->
  <iframe
    v-if="pdfUrl"
    id="report-iframe"
    :key="pdfUrl"
    class="report-frame"
    :title="title"
    :src="pdfUrl"
  />
  <!-- report html may carry script: opaque origin, no forms, popups or top
       navigation, and the API serves it with a policy that limits what it
       loads. allow-same-origin must never be added here -->
  <iframe
    v-else-if="frameUrl"
    id="report-iframe"
    :key="frameUrl"
    class="report-frame"
    :title="title"
    sandbox="allow-scripts"
    referrerpolicy="no-referrer"
    :src="frameUrl"
  />
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from "vue";
import { reportFrameUrl } from "@/reporting/api";
import { plaintextDocument } from "@/reporting/utils";

import type { ReportFormat, ReportOutput } from "@/reporting/types";

const props = defineProps<{
  output: ReportOutput | null;
  format: ReportFormat;
  title: string;
}>();

const pdfUrl = ref<string | null>(null);
const frameUrl = ref<string | null>(null);
// the answer for an output that was replaced meanwhile is dropped
let request = 0;

function revoke() {
  if (pdfUrl.value) URL.revokeObjectURL(pdfUrl.value);
  pdfUrl.value = null;
}

watch(
  () => [props.output, props.format] as const,
  ([output]) => {
    revoke();
    frameUrl.value = null;
    const current = ++request;
    if (output instanceof Blob && output.type === "application/pdf")
      pdfUrl.value = URL.createObjectURL(output);
    else if (typeof output === "string" && props.format !== "pdf") {
      const html =
        props.format === "plaintext" ? plaintextDocument(output) : output;
      reportFrameUrl(html)
        .then((url) => {
          if (current === request) frameUrl.value = url;
        })
        .catch(() => undefined);
    }
  },
  { immediate: true },
);

onBeforeUnmount(revoke);
</script>

<style scoped>
.report-frame {
  display: block;
  width: 100%;
  height: 100%;
  border: 0;
  background: #fff;
}
</style>
