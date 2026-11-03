// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import cssWorker from "monaco-editor/esm/vs/language/css/css.worker?worker";
import htmlWorker from "monaco-editor/esm/vs/language/html/html.worker?worker";
import jsonWorker from "monaco-editor/esm/vs/language/json/json.worker?worker";
import { boot } from "quasar/wrappers";

// editor language -> its worker; anything else uses the plain editor worker
const WORKERS: Record<string, new () => Worker> = {
  json: jsonWorker,
  css: cssWorker,
  scss: cssWorker,
  less: cssWorker,
  html: htmlWorker,
  handlebars: htmlWorker,
  razor: htmlWorker,
};

export default boot(() => {
  self.MonacoEnvironment = {
    getWorker: (_: unknown, label: string) =>
      new (WORKERS[label] ?? editorWorker)(),
  };
});
