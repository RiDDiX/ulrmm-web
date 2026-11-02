<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-dialog
    ref="dialogRef"
    maximized
    @show="createEditor"
    @before-hide="disposeEditor"
    @hide="onDialogHide"
  >
    <q-card class="column no-wrap">
      <DialogHeader :title="title" />
      <q-card-section class="row items-center q-gutter-sm q-pb-sm">
        <q-input
          v-model="name"
          dense
          outlined
          label="HTML Template Name"
          maxlength="200"
          style="min-width: 320px"
        />
        <q-space />
        <span v-pre class="editor-form__hint"
          >{{ css }} inserts the report's CSS; each {% block name %} is a slot
          the report template fills.</span
        >
      </q-card-section>
      <div ref="editorEl" class="col html-editor" />
      <q-card-actions align="right">
        <q-btn flat no-caps label="Cancel" @click="onDialogCancel" />
        <q-btn
          label="Save"
          @click="submit"
          v-bind="primaryBtn"
          :loading="isLoading"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { ref } from "vue";
import DialogHeader from "@/components/ui/DialogHeader.vue";
import { useDialogPluginComponent, useQuasar } from "quasar";
import { useReportHTMLTemplatesShared } from "@/reporting/stores";
import * as monaco from "monaco-editor";

import type { ReportHTMLTemplate } from "@/reporting/types";

const primaryBtn = { unelevated: true, "no-caps": true, color: "primary" };

const props = defineProps<{
  template?: ReportHTMLTemplate;
  cloneTemplate?: ReportHTMLTemplate;
}>();

defineEmits([...useDialogPluginComponent.emits]);

const DEFAULT_HTML = `<html>
    <head>
        <style>
            {{ css }}
        </style>
    </head>
    <body>
        {% block content %}{% endblock %}
    </body>
</html>
`;

const $q = useQuasar();
const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } =
  useDialogPluginComponent();
const { isLoading, addReportHTMLTemplate, editReportHTMLTemplate } =
  useReportHTMLTemplatesShared;

const title = props.template
  ? "Edit Base Template"
  : props.cloneTemplate
    ? "Clone Base Template"
    : "New Base Template";

const name = ref(
  props.template
    ? props.template.name
    : props.cloneTemplate
      ? `Copy of ${props.cloneTemplate.name}`
      : "",
);
let html = props.template?.html ?? props.cloneTemplate?.html ?? DEFAULT_HTML;

const editorEl = ref<HTMLElement | null>(null);
let editor: monaco.editor.IStandaloneCodeEditor | null = null;

function createEditor() {
  if (!editorEl.value) return;
  editor = monaco.editor.create(editorEl.value, {
    value: html,
    language: "html",
    theme: $q.dark.isActive ? "vs-dark" : "vs-light",
    automaticLayout: true,
    minimap: { enabled: false },
  });
  editor.onDidChangeModelContent(() => (html = editor!.getValue()));
}

function disposeEditor() {
  editor?.getModel()?.dispose();
  editor?.dispose();
  editor = null;
}

async function submit() {
  const body = { name: name.value, html };
  const ok = props.template
    ? await editReportHTMLTemplate(props.template.id, {
        id: props.template.id,
        ...body,
      })
    : await addReportHTMLTemplate(body);
  if (ok) onDialogOK();
}
</script>

<style scoped>
.editor-form__hint {
  color: var(--rmm-text-muted);
  font-size: var(--rmm-fs-xs);
}

.html-editor {
  min-height: 0;
  border-top: 1px solid var(--rmm-border);
  border-bottom: 1px solid var(--rmm-border);
}
</style>
