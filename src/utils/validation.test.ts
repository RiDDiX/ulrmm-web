// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

import { describe, expect, it } from "vitest";
import { wholeNumberIn } from "@/utils/validation";

describe("wholeNumberIn", () => {
  const rule = wholeNumberIn(0, 9);
  it.each([0, 6, 9])("accepts %s", (val) => expect(rule(val)).toBe(true));
  it.each(["", undefined, null, -1, 10, 2.5, "6"])("refuses %s", (val) =>
    expect(rule(val)).toBe("Enter a whole number from 0 to 9"),
  );
});
