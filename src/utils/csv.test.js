// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

import { describe, expect, it } from "vitest";
import { csvField } from "@/utils/csv";

describe("csvField", () => {
  it.each([
    ["=1+1", '"\'=1+1"'],
    ["+49 123", '"\'+49 123"'],
    [-5, '"-5"'],
    ["-", '"-"'],
    ["-2+cmd", '"\'-2+cmd"'],
    ["@SUM(A1)", '"\'@SUM(A1)"'],
    ['say "hi", then\nleave', '"say ""hi"", then\nleave"'],
    [null, '""'],
  ])("%j", (value, expected) => {
    expect(csvField(value)).toBe(expected);
  });
});
