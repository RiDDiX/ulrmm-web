// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

import { useStorage } from "@vueuse/core";
import axios from "axios";
import { defineStore } from "pinia";
import { exchangeSSOToken } from "@/sso/api";

type Credentials = { username: string; password: string };
type LoginRequest = Credentials & { twofactor: string };
// a token, its expiry and whether the account already has a TOTP key
type CheckCredentialsResponse = {
  token: string;
  expiry: string | null;
  totp?: boolean;
};
type TOTPSetupResponse = { qr_url: string; totp_key: string };
type SignedIn = { token: string; username: string; name: string };

// per tab: each value sits in sessionStorage under its own key
const tabStored = (key: string) =>
  useStorage<string | null>(key, null, sessionStorage);

// an in-app path only: one leading slash, not "//" or "/\" (both read as
// another host), and nothing that resolves to a different origin
function isSafeNext(path: unknown): path is string {
  if (typeof path !== "string" || !/^\/(?![/\\])/.test(path)) return false;
  try {
    return (
      new URL(path, window.location.origin).origin === window.location.origin
    );
  } catch {
    return false;
  }
}

export const useAuthStore = defineStore("auth", {
  state: () => ({
    username: tabStored("user_name"),
    name: tabStored("name"),
    token: tabStored("access_token"),
    ssoLoginProvider: tabStored("sso_provider"),
    provider_id: tabStored("provider_id"),
    next: tabStored("next"),
  }),
  getters: {
    loggedIn: (state) => state.token !== null,
    displayName: (state) => state.name || state.username,
  },
  actions: {
    remember(data: SignedIn, provider: string | null) {
      this.username = data.username;
      this.name = data.name;
      this.token = data.token;
      this.ssoLoginProvider = provider;
    },
    // first step of the password login. Without a TOTP key the token only
    // allows enrolling one; the account details come with the login itself
    async checkCredentials(
      credentials: Credentials,
    ): Promise<CheckCredentialsResponse> {
      const { data } = await axios.post<CheckCredentialsResponse>(
        "/v2/checkcreds/",
        credentials,
      );
      if (!data.totp) this.token = data.token;
      return data;
    },
    async login(credentials: LoginRequest) {
      // silent: the code prompt words every failure itself
      const quiet = { silent: true };
      const { data } = await axios.post("/v2/login/", credentials, quiet);
      this.remember(data, null);
      return data;
    },
    // second half of the provider sign-in: the provider round trip left a
    // server session, which is exchanged once for a dashboard token
    async ssoLogin() {
      const data = await exchangeSSOToken();
      this.remember(data, data.provider);
      return data;
    },
    // where to go after sign-in; clears the stored path either way
    takeNext(): string | null {
      const next = this.next;
      this.next = null;
      return isSafeNext(next) ? next : null;
    },
    async logout() {
      // the local sign-out happens even when the server is unreachable
      if (this.token !== null) await axios.post("/logout/").catch(() => {});
      this.$patch({
        token: null,
        username: null,
        name: null,
        ssoLoginProvider: null,
        provider_id: null,
      });
    },
    // false when the account already has a key
    setupTotp(): Promise<TOTPSetupResponse | false> {
      return axios
        .post("/accounts/users/setup_totp/")
        .then((response) => response.data);
    },
  },
});
