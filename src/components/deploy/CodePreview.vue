<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <div ref="host" class="code-preview" />
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useQuasar } from "quasar";
import * as monaco from "monaco-editor";
import { monacoLanguage } from "@/utils/deploy";

const props = defineProps<{
  content: string;
  language: string;
  label: string;
}>();

const $q = useQuasar();
const host = ref<HTMLElement | null>(null);
let editor: monaco.editor.IStandaloneCodeEditor | null = null;

const theme = () => ($q.dark.isActive ? "vs-dark" : "vs-light");

onMounted(() => {
  if (!host.value) return;
  editor = monaco.editor.create(host.value, {
    model: monaco.editor.createModel(
      props.content,
      monacoLanguage(props.language),
    ),
    readOnly: true,
    automaticLayout: true,
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    wordWrap: "on",
    ariaLabel: props.label,
    theme: theme(),
  });
});

watch(
  () => [props.content, props.language],
  () => {
    const model = editor?.getModel();
    if (!model) return;
    model.setValue(props.content);
    monaco.editor.setModelLanguage(model, monacoLanguage(props.language));
  },
);

// monaco has one theme for all editors on the page
watch(
  () => $q.dark.isActive,
  () => monaco.editor.setTheme(theme()),
);

onBeforeUnmount(() => {
  editor?.getModel()?.dispose();
  editor?.dispose();
});
</script>

<style scoped>
.code-preview {
  height: min(60vh, 640px);
  min-height: 240px;
  border: 1px solid var(--rmm-border);
  border-radius: var(--rmm-radius-sm);
  overflow: hidden;
}
</style>
