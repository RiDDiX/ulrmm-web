// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

import axios, { type AxiosRequestConfig } from "axios";
import { endpoint } from "@/api/http";
import { getBaseUrl } from "@/boot/axios";

import type {
  SSOLoginProvider,
  SSOProvider,
  SSOProviderCreate,
  SSOProviderUpdate,
  SSOSettings,
  SSOTokenResponse,
} from "@/sso/types";

const baseUrl = "/accounts/ssoproviders";

// silent: the interceptor shows no toast, the caller handles the error
type RequestConfig = AxiosRequestConfig & { silent?: boolean };

// the provider sends the browser back to this dashboard path, with ?error=
// when the sign-in failed
const CALLBACK_PATH = "/account/provider/callback";

// provider management
const providers = endpoint(baseUrl);

export function fetchSSOProviders(): Promise<SSOProvider[]> {
  return providers.get("/");
}

export function addSSOProvider(payload: SSOProviderCreate, totp_code: string) {
  return providers.post("/", { ...payload, totp_code });
}

export function editSSOProvider(
  id: number,
  payload: SSOProviderUpdate,
  totp_code: string,
) {
  return providers.put(`/${id}/`, { ...payload, totp_code });
}

export function removeSSOProvider(id: number, totp_code: string) {
  return providers.delete(`/${id}/`, { data: { totp_code } });
}

export async function fetchSSOSettings(): Promise<SSOSettings> {
  const { data } = await axios.get(`${baseUrl}/settings/`);
  return data;
}

export async function saveSSOSettings(settings: SSOSettings) {
  const { data } = await axios.post(`${baseUrl}/settings/`, settings);
  return data;
}

// account is the uid of the linked identity at the provider
export async function disconnectSocialAccount(provider: string, uid: string) {
  const { data } = await axios.delete(`${baseUrl}/account/`, {
    data: { provider, account: uid },
  });
  return data;
}

function getCookie(name: string): string | null {
  for (const part of document.cookie.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key !== name) continue;
    try {
      return decodeURIComponent(value.join("="));
    } catch {
      return null;
    }
  }
  return null;
}

// Trades the session cookie left by the provider round trip for an API token.
// Session auth on the server, so the CSRF header is required. Silent: the
// callback page shows its own error.
export async function exchangeSSOToken(): Promise<SSOTokenResponse> {
  const config: RequestConfig = {
    withCredentials: true,
    headers: { "X-CSRFToken": getCookie("csrftoken") ?? "" },
    silent: true,
  };
  const { data } = await axios.post(`${baseUrl}/token/`, {}, config);
  return data;
}

// icon names come from the server; only plain icon-font names pass, so a
// tampered response cannot use the img: form to load a URL
function safeIcon(icon: unknown): string {
  return typeof icon === "string" &&
    /^(mdi-[a-z0-9-]+|fa-brands fa-[a-z0-9-]+)$/.test(icon)
    ? icon
    : "mdi-key";
}

// empty when SSO is turned off on the server
export async function fetchSSOLoginProviders(): Promise<SSOLoginProvider[]> {
  const { data } = await axios.get("/_allauth/browser/v1/config/");
  const providers = data?.data?.socialaccount?.providers;
  if (!Array.isArray(providers)) return [];
  return providers.map((p: Record<string, unknown>) => ({
    id: String(p.id),
    name: String(p.name),
    icon: safeIcon(p.icon),
  }));
}

// The provider redirect is a chain of 302s, so it has to be a top-level form
// POST (carrying the CSRF token), not an XHR. This navigates the tab away.
export function startSSOLogin(providerId: string) {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = `${getBaseUrl()}/_allauth/browser/v1/auth/provider/redirect/`;

  const fields = {
    provider: providerId,
    process: "login",
    callback_url: `${window.location.origin}${CALLBACK_PATH}`,
    csrfmiddlewaretoken: getCookie("csrftoken") ?? "",
  };
  for (const [name, value] of Object.entries(fields)) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = value;
    form.appendChild(input);
  }

  document.body.appendChild(form);
  form.submit();
}
