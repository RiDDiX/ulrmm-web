// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

// a long running command can stream without end: only the newest lines stay,
// the older ones are counted
export const MAX_OUTPUT_LINES = 5000;

export type OutputTail = { text: string; lines: number; dropped: number };

export const emptyTail = (): OutputTail => ({ text: "", lines: 0, dropped: 0 });

// every chunk starts a new line
export function appendChunk(
  tail: OutputTail,
  chunk: string,
  max = MAX_OUTPUT_LINES,
) {
  tail.text = tail.lines ? `${tail.text}\n${chunk}` : chunk;
  tail.lines += chunk.split("\n").length;
  const extra = tail.lines - max;
  if (extra <= 0) return;
  let cut = -1;
  for (let i = 0; i < extra; i++) cut = tail.text.indexOf("\n", cut + 1);
  tail.text = tail.text.slice(cut + 1);
  tail.lines = max;
  tail.dropped += extra;
}

export const tailText = ({ text, dropped }: OutputTail) =>
  dropped ? `[${dropped} lines left out]\n${text}` : text;
