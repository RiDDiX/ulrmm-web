// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

import { ref, shallowRef } from "vue";
import * as monaco from "monaco-editor";
import { quoteBraceValues } from "@/reporting/editing";
import type { ReportTemplateBody } from "@/reporting/types";

type Editor = monaco.editor.IStandaloneCodeEditor;
type Model = monaco.editor.ITextModel;
type Edit = monaco.editor.IIdentifiedSingleEditOperation;
type Texts = Pick<
  ReportTemplateBody,
  "template_md" | "template_css" | "template_variables" | "type"
>;

const LAYOUT = { automaticLayout: true, minimap: { enabled: false } };

// body and CSS share the main editor and swap models; the YAML variables
// have an editor of their own. Every edit is written back into texts
export function useTemplateEditors(texts: Texts, onEdit: () => void) {
  const mainEl = ref<HTMLElement | null>(null);
  const variablesEl = ref<HTMLElement | null>(null);
  const mainEditor = shallowRef<Editor | null>(null);
  const ready = ref(false);
  let yamlEditor: Editor | null = null;
  let models: { body: Model; css: Model; yaml: Model } | null = null;

  function mount(dark: boolean) {
    if (!mainEl.value || !variablesEl.value) return;
    const theme = dark ? "vs-dark" : "vs-light";
    const own = {
      body: monaco.editor.createModel(texts.template_md, texts.type),
      css: monaco.editor.createModel(texts.template_css ?? "", "css"),
      yaml: monaco.editor.createModel(texts.template_variables, "yaml"),
    };
    models = own;

    const main = monaco.editor.create(mainEl.value, {
      ...LAYOUT,
      theme,
      model: own.body,
      quickSuggestions: false,
    });
    main.onDidChangeModelContent(() => {
      if (main.getModel() === own.body) texts.template_md = main.getValue();
      else texts.template_css = main.getValue();
      onEdit();
    });
    mainEditor.value = main;

    const yaml = monaco.editor.create(variablesEl.value, {
      ...LAYOUT,
      theme,
      model: own.yaml,
    });
    yaml.onDidChangeModelContent(() => {
      texts.template_variables = yaml.getValue();
      onEdit();
    });
    yamlEditor = yaml;
    ready.value = true;
  }

  function unmount() {
    ready.value = false;
    mainEditor.value?.dispose();
    yamlEditor?.dispose();
    if (models) Object.values(models).forEach((model) => model.dispose());
    mainEditor.value = null;
    yamlEditor = null;
    models = null;
  }

  // false while there is no editor to switch
  function show(which: "body" | "css") {
    const main = mainEditor.value;
    if (!main || !models) return false;
    main.setModel(which === "css" ? models.css : models.body);
    main.updateOptions({ quickSuggestions: which === "css" });
    return true;
  }

  // one undo step for the whole change
  function undoable(editor: Editor, edits: Edit[]) {
    editor.pushUndoStop();
    editor.executeEdits("reporting", edits);
    editor.pushUndoStop();
  }

  function replaceVariables(text: string) {
    if (yamlEditor && models) {
      undoable(yamlEditor, [{ range: models.yaml.getFullModelRange(), text }]);
    }
    texts.template_variables = text;
  }

  // quotes {{ }} values in place; only changed lines are touched, so the
  // cursor stays where it was
  function quoteVariables() {
    if (!yamlEditor || !models) {
      texts.template_variables = quoteBraceValues(texts.template_variables);
      return;
    }
    const yaml = models.yaml;
    const edits: Edit[] = [];
    for (let row = 1; row <= yaml.getLineCount(); row++) {
      const before = yaml.getLineContent(row);
      const after = quoteBraceValues(before);
      if (after === before) continue;
      const range = new monaco.Range(row, 1, row, before.length + 1);
      edits.push({ range, text: after });
    }
    if (edits.length > 0) undoable(yamlEditor, edits);
  }

  return {
    mainEl,
    variablesEl,
    mainEditor,
    ready,
    mount,
    unmount,
    show,
    replaceVariables,
    quoteVariables,
  };
}
