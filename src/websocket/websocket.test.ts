// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

import { describe, expect, it, vi } from "vitest";
import { reconnectDelay } from "@/websocket/websocket";

vi.mock("@/boot/axios", () => ({ getBaseUrl: () => "https://rmm.test" }));
vi.mock("@/stores/auth", () => ({ useAuthStore: vi.fn() }));

describe("reconnectDelay", () => {
  it("doubles from 1-2 s and stops at 15-30 s", () => {
    expect([0, 1, 2].map((n) => reconnectDelay(n, 0))).toEqual([
      1000, 2000, 4000,
    ]);
    expect(reconnectDelay(0, 1)).toBe(2000);
    expect(reconnectDelay(10, 0)).toBe(15_000);
    expect(reconnectDelay(10, 1)).toBe(30_000);
  });
});
