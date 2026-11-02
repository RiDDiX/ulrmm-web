<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-splitter v-if="debug" v-model="frameHeight" horizontal class="full-height">
    <template #before>
      <ReportFrame :output="output" :format="format" title="Report preview" />
    </template>
    <template #after>
      <q-splitter v-model="sourceWidth" class="full-height">
        <template #before>
          <div class="column no-wrap full-height">
            <div class="preview-label rmm-label">
              {{ format === "plaintext" ? "Text" : "HTML" }}
            </div>
            <div ref="sourceEl" class="col" />
          </div>
        </template>
        <template #after>
          <div class="column no-wrap full-height">
            <div class="preview-label rmm-label">Variables</div>
            <div ref="variablesEl" class="col" />
          </div>
        </template>
      </q-splitter>
    </template>
  </q-splitter>
  <ReportFrame
    v-else
    :output="output"
    :format="format"
    title="Report preview"
  />
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useQuasar } from "quasar";
import * as monaco from "monaco-editor";
import ReportFrame from "@/reporting/components/ReportFrame.vue";

import type { ReportFormat, ReportOutput } from "@/reporting/types";

const props = defineProps<{
  output: ReportOutput | null;
  format: ReportFormat;
  // debug shows the rendered source and the resolved variables below
  debug: boolean;
  debugVariables: Record<string, unknown> | null;
}>();

const $q = useQuasar();

const frameHeight = ref(50);
const sourceWidth = ref(50);
const sourceEl = ref<HTMLElement | null>(null);
const variablesEl = ref<HTMLElement | null>(null);
const editors: monaco.editor.IStandaloneCodeEditor[] = [];

function readOnly(el: HTMLElement, value: string, language: string) {
  const editor = monaco.editor.create(el, {
    value,
    language,
    readOnly: true,
    theme: $q.dark.isActive ? "vs-dark" : "vs-light",
    automaticLayout: true,
    minimap: { enabled: false },
  });
  editors.push(editor);
  return editor;
}

const sourceText = () => (typeof props.output === "string" ? props.output : "");
const variablesText = () => JSON.stringify(props.debugVariables ?? {}, null, 4);

onMounted(() => {
  if (!sourceEl.value || !variablesEl.value) return;
  const source = readOnly(sourceEl.value, sourceText(), "html");
  const variables = readOnly(variablesEl.value, variablesText(), "json");
  watch(
    () => [props.output, props.debugVariables],
    () => {
      source.setValue(sourceText());
      variables.setValue(variablesText());
    },
  );
});

onBeforeUnmount(() => {
  for (const editor of editors) {
    editor.getModel()?.dispose();
    editor.dispose();
  }
});
</script>

<style scoped>
.preview-label {
  padding: 4px 8px;
  border-bottom: 1px solid var(--rmm-border);
  background: var(--rmm-surface-2);
}
</style>
