// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

import { describe, expect, it } from "vitest";
import { appendChunk, emptyTail, tailText } from "@/utils/outputTail";

describe("appendChunk", () => {
  it("joins chunks with a newline like the full output", () => {
    const tail = emptyTail();
    for (const chunk of ["", "a", "b\nc"]) appendChunk(tail, chunk);
    expect(tailText(tail)).toBe(["", "a", "b\nc"].join("\n"));
    expect(tail.lines).toBe(4);
  });

  it("keeps the last lines and one marker for the rest", () => {
    const tail = emptyTail();
    appendChunk(tail, "1\n2\n3", 4);
    appendChunk(tail, "4\n5", 4);
    appendChunk(tail, "6", 4);
    expect(tail.text).toBe("3\n4\n5\n6");
    expect(tail.lines).toBe(4);
    expect(tailText(tail)).toBe("[2 lines left out]\n3\n4\n5\n6");
  });

  it("drops most of a chunk larger than the cap", () => {
    const tail = emptyTail();
    appendChunk(tail, "a", 2);
    appendChunk(tail, "b\nc\nd", 2);
    expect(tailText(tail)).toBe("[2 lines left out]\nc\nd");
  });
});
