// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

import type { User } from "@/types/accounts";

// list item of GET accounts/ssoproviders/; the client secret never leaves
// the server, secret_set says whether one is stored
// what the admin enters for every provider
type ProviderSettings = {
  client_id: string;
  server_url: string;
  role: number | null;
};

export interface SSOProvider extends ProviderSettings {
  id: number;
  name: string;
  provider: string;
  provider_id: string;
  secret_set: boolean;
  callback_url: string;
  javascript_origin_url: string;
  // set when the issuer URL fails the server's URL rule; such a provider
  // cannot sign in and is not offered on the login page
  blocked_reason: string | null;
}

export interface SSOProviderCreate extends ProviderSettings {
  name: string;
  secret: string;
}

// name and provider_id are fixed after creation. An empty secret keeps the
// stored one, secret_clear removes it
export interface SSOProviderUpdate extends ProviderSettings {
  secret: string;
  secret_clear?: boolean;
}

export interface SocialAccount {
  uid: string;
  provider: string;
  display: string;
  last_login: string;
  date_joined?: string;
}

export interface SSOUser extends User {
  social_accounts: SocialAccount[];
}

export interface SSOSettings {
  sso_enabled: boolean;
  block_local_user_logon: boolean;
}

// provider entry of the login page config
export interface SSOLoginProvider {
  id: string;
  name: string;
  icon: string;
}

export interface SSOTokenResponse {
  token: string;
  expiry: string;
  username: string;
  provider: string;
  name: string | null;
}
