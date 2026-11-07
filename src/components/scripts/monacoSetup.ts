// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

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
