// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

import type { ITheme } from "@xterm/xterm";

// ansi order: black red green yellow blue magenta cyan white, then bright set
const ANSI_KEYS = [
  "black",
  "red",
  "green",
  "yellow",
  "blue",
  "magenta",
  "cyan",
  "white",
  "brightBlack",
  "brightRed",
  "brightGreen",
  "brightYellow",
  "brightBlue",
  "brightMagenta",
  "brightCyan",
  "brightWhite",
] as const;

function makeTheme(
  base: [bg: string, fg: string, cursor: string, selection: string],
  ansi: string,
): ITheme {
  const [background, foreground, cursor, selectionBackground] = base;
  const theme: Record<string, string> = {
    background,
    foreground,
    cursor,
    cursorAccent: background,
    selectionBackground,
  };
  ansi.split(" ").forEach((hex, i) => {
    theme[ANSI_KEYS[i]] = `#${hex}`;
  });
  return theme as ITheme;
}

export const cmdTheme = makeTheme(
  ["#0c0c0c", "#f2f2f2", "#ffffff", "rgba(255,255,255,0.22)"],
  "0c0c0c c50f1f 13a10e c19c00 0037da 881798 3a96dd cccccc " +
    "767676 e74856 16c60c f9f1a5 3b78ff b4009e 61d6d6 f2f2f2",
);

export const powershellTheme = makeTheme(
  ["#012456", "#ffffff", "#ffffff", "rgba(255,255,255,0.25)"],
  "000000 800000 008000 eeedf0 000080 012456 008080 c0c0c0 " +
    "808080 ff0000 00ff00 ffff00 0000ff ff00ff 00ffff ffffff",
);

export const pwsh7Theme = makeTheme(
  ["#282c34", "#dcdfe4", "#a3b3cc", "rgba(116,151,196,0.35)"],
  "282c34 e06c75 98c379 e5c07b 61afef c678dd 56b6c2 dcdfe4 " +
    "5d677a e06c75 98c379 e5c07b 61afef c678dd 56b6c2 dcdfe4",
);

export const unixTheme = makeTheme(
  ["#1d1f21", "#c5c8c6", "#c5c8c6", "rgba(255,255,255,0.18)"],
  "1d1f21 cc6666 b5bd68 f0c674 81a2be b294bb 8abeb7 c5c8c6 " +
    "666666 d54e53 b9ca4a e7c547 7aa6da c397d8 70c0b1 eaeaea",
);
