// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

import { describe, expect, it } from "vitest";
import {
  capitalize,
  durationText,
  elapsedText,
  fmtBytes,
  uptimeText,
  NO_VALUE,
} from "@/utils/format";

describe("elapsedText", () => {
  it.each([
    [1000, "1 second ago"],
    [59600, "1 minute ago"],
    [-3000, "0 seconds ago"],
  ])("%d ms", (ms, expected) => {
    expect(elapsedText(ms)).toBe(expected);
  });
});

describe("capitalize", () => {
  it.each([
    ["", ""],
    ["agent", "Agent"],
  ])("%j", (text, expected) => {
    expect(capitalize(text)).toBe(expected);
  });
});

describe("fmtBytes", () => {
  it.each([
    [1536, "1.5 KB"],
    [512, "512 B"],
    [0, "0 B"],
    [null, NO_VALUE],
    [-1, NO_VALUE],
  ])("%j", (bytes, expected) => {
    expect(fmtBytes(bytes)).toBe(expected);
  });
});

describe("durationText", () => {
  it.each([
    [90061, "1d 1h 1m"],
    [30, "<1m"],
    [null, NO_VALUE],
  ])("%j s", (seconds, expected) => {
    expect(durationText(seconds)).toBe(expected);
  });
});

describe("uptimeText", () => {
  it("is a dash without a boot time", () => {
    expect(uptimeText(null)).toBe(NO_VALUE);
  });
});
