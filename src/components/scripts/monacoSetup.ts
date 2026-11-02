// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

import JsonWorker from "monaco-editor/esm/vs/language/json/json.worker?worker";
import CssWorker from "monaco-editor/esm/vs/language/css/css.worker?worker";
import HtmlWorker from "monaco-editor/esm/vs/language/html/html.worker?worker";
import TsWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker";
import BaseWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";

const WORKERS: Record<string, new () => Worker> = {
  json: JsonWorker,
  css: CssWorker,
  scss: CssWorker,
  less: CssWorker,
  html: HtmlWorker,
  handlebars: HtmlWorker,
  razor: HtmlWorker,
  typescript: TsWorker,
  javascript: TsWorker,
};

self.MonacoEnvironment = {
  getWorker: (_id: string, label: string) =>
    new (WORKERS[label] || BaseWorker)(),
};

const LANGUAGES: Record<string, string> = {
  cmd: "bat",
  powershell: "powershell",
  python: "python",
  shell: "shell",
  nushell: "shell",
  deno: "typescript",
};

export const editorLanguage = (shell?: string): string =>
  (shell && LANGUAGES[shell]) || "";
