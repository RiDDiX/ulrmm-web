// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2
import { ref, watch, type Ref } from "vue";
import { useQuasar } from "quasar";
import * as monaco from "monaco-editor";

const themeFor = (dark: boolean) => (dark ? "vs-dark" : "vs-light");

// the Monaco instance of the script builder, created on dialog show and
// thrown away before it hides
export function useScriptEditor(
  language: Ref<string>,
  onEdit: (code: string) => void,
) {
  const $q = useQuasar();
  const host = ref<HTMLElement | null>(null);
  let view: monaco.editor.IStandaloneCodeEditor | undefined;
  // set once the user clicks into the code; until then inserts append
  let hasCursor = false;

  function mount(code: string, readOnly: boolean): boolean {
    if (view || !host.value) return false;
    view = monaco.editor.create(host.value, {
      model: monaco.editor.createModel(code, language.value),
      theme: themeFor($q.dark.isActive),
      automaticLayout: true,
      readOnly,
    });
    view.onDidChangeModelContent(() => view && onEdit(view.getValue()));
    hasCursor = false;
    view.onDidFocusEditorText(() => (hasCursor = true));
    return true;
  }

  function unmount() {
    view?.getModel()?.dispose();
    view?.dispose();
    view = undefined;
  }

  const show = (code: string) => view?.setValue(code);
  const unlock = () => view?.updateOptions({ readOnly: false });

  function insert(text: string) {
    const model = view?.getModel();
    const selection = view?.getSelection();
    if (!view || !model || !selection) return;
    const end = model.getFullModelRange().getEndPosition();
    // appending must not land above the shebang, and starts its own line
    const lead = !hasCursor && end.column > 1 ? "\n" : "";
    view.executeEdits("insert-menu", [
      {
        range: hasCursor ? selection : monaco.Range.fromPositions(end),
        text: lead + text,
        forceMoveMarkers: true,
      },
    ]);
    if (!hasCursor)
      view.setPosition(model.getFullModelRange().getEndPosition());
    view.pushUndoStop();
    view.focus();
  }

  watch(language, (id) => {
    const model = view?.getModel();
    if (model) monaco.editor.setModelLanguage(model, id);
  });
  watch(
    () => $q.dark.isActive,
    (dark) => monaco.editor.setTheme(themeFor(dark)),
  );

  return { host, mount, unmount, show, unlock, insert };
}
