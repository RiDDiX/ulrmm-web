// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

import { describe, expect, it, vi } from "vitest";
import { useAgentTab } from "@/components/agents/useAgentTab";

vi.mock("vuex", () => ({
  useStore: () => ({ state: { selectedRow: "ag1" }, getters: {} }),
}));

function tab(fetch) {
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  return useAgentTab({
    fetch,
    accept: () => {},
    clear: () => {},
    forbidden: "no",
    failed: "failed",
  });
}

describe("useAgentTab", () => {
  it("a quiet reload that fails keeps the shown state", async () => {
    const t = tab(() => Promise.reject(new Error("offline")));
    await t.load({ quiet: true });
    expect(t.error.value).toBeNull();
    expect(t.loading.value).toBe(false);
  });
  it("a normal load, also from a click event, shows the failure", async () => {
    const t = tab(() => Promise.reject(new Error("offline")));
    await t.load({ type: "click" });
    expect(t.errorMessage.value).toBe("failed");
  });
});
