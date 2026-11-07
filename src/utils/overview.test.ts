// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

import { describe, expect, it } from "vitest";
import {
  cleanSettings,
  moveWidget,
  type MoveTarget,
  type Widget,
} from "@/utils/overview";

const ID = "be765a48-3e3a-4b24-afd3-dffc5f030fd4";

describe("cleanSettings", () => {
  it.each([
    ["fleet", undefined, {}],
    ["top_cpu", undefined, { range: "24h", limit: 10 }],
    ["top_cpu", { limit: "5" }, { range: "24h", limit: 5 }],
  ])("%s %j", (type, data, expected) => {
    expect(cleanSettings(type, data)).toEqual(expected);
  });

  it.each([
    [
      "top_cpu",
      { limit: 0 },
      "limit: Ensure this value is greater than or equal to 1.",
    ],
    ["fleet", { range: "1h" }, "unknown settings: range"],
    ["fleet", [], "settings must be an object"],
  ])("%s %j throws", (type, data, message) => {
    expect(() => cleanSettings(type, data)).toThrow(message);
  });
});

describe("moveWidget", () => {
  const only: Widget[] = [
    { id: ID, type: "fleet", size: "m", settings: cleanSettings("fleet") },
  ];

  it.each(["first", "left", "right", "last"] as MoveTarget[])(
    "%s keeps the only widget",
    (where) => {
      expect(moveWidget(only, ID, where)).toEqual(only);
    },
  );

  it("leaves the list alone for an unknown id", () => {
    expect(moveWidget(only, "missing", "last")).toBe(only);
  });
});
