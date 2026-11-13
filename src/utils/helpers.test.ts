// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

import { describe, expect, it } from "vitest";
import { rustDeskLink } from "@/utils/helpers";

describe("rustDeskLink", () => {
  it.each([
    ["rustdesk://123?password=x", true],
    ["https://example.com", true],
    ["javascript:alert(1)", false],
    ["http://example.com", false],
    ["", false],
    ["not a url", false],
  ])("%s -> %s", (uri, ok) => {
    expect(rustDeskLink(uri)).toBe(ok);
  });
});
