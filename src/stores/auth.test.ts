// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

import { beforeEach, describe, expect, it, vi } from "vitest";
import { nextTick } from "vue";
import { createPinia, setActivePinia } from "pinia";
import axios from "axios";
import { useAuthStore } from "@/stores/auth";

vi.mock("axios", () => ({ default: { post: vi.fn() } }));
vi.mock("@/sso/api", () => ({ exchangeSSOToken: vi.fn() }));
vi.mock("@/websocket/websocket", () => ({ closeAllShared: vi.fn() }));

const post = vi.mocked(axios.post);
const stored = new Map<string, string>();
vi.stubGlobal("sessionStorage", {
  getItem: (key: string) => stored.get(key) ?? null,
  setItem: (key: string, value: string) => stored.set(key, value),
  removeItem: (key: string) => stored.delete(key),
});

describe("checkCredentials without a TOTP key", () => {
  beforeEach(() => {
    stored.clear();
    post.mockReset();
    setActivePinia(createPinia());
  });

  it("keeps the enrol token in memory and sends it to the key setup", async () => {
    const auth = useAuthStore();
    post.mockResolvedValueOnce({
      data: { token: "enrol", expiry: null, totp: false },
    });
    await auth.checkCredentials({ username: "u", password: "p" });
    await nextTick();
    expect(auth.loggedIn).toBe(false);
    expect(stored.has("access_token")).toBe(false);

    post.mockResolvedValueOnce({ data: { qr_url: "q", totp_key: "k" } });
    await auth.setupTotp();
    expect(post).toHaveBeenLastCalledWith("/accounts/users/setup_totp/", null, {
      headers: { Authorization: "Token enrol" },
    });
  });
});
