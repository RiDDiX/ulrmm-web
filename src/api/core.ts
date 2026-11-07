// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

import axios, { type AxiosRequestConfig } from "axios";
import { openURL } from "quasar";
import { endpoint } from "@/api/http";
import { router } from "@/router";
import type { CoreSetting } from "@/types/core/settings";
import type * as urlActions from "@/types/core/urlactions";
import { getCenteredWindowOptions, isWebUrl } from "@/utils/helpers";
import { notifyError } from "@/utils/notify";

type URLAction = urlActions.URLAction;

const core = endpoint("/core");

type RequestConfig = AxiosRequestConfig & { silent?: boolean };

export function fetchCoreSettings(params = {}): Promise<CoreSetting> {
  return core.get("/settings/", { params });
}

export function fetchAbout() {
  return core.get("/about/");
}

export function fetchDashboardInfo(params = {}) {
  return core.get("/dashinfo/", { params });
}

export interface FleetStats {
  agents: {
    total: number;
    online: number;
    offline: number;
    overdue: number;
    servers: number;
    workstations: number;
    needs_reboot: number;
    maintenance_mode: number;
  };
  by_plat: Array<{ plat: string; count: number }>;
  by_version: Array<{ version: string; count: number }>;
  last_seen_buckets: {
    under_1d: number;
    "1d_7d": number;
    over_7d: number;
    never: number;
  };
  checks: { failing: number; passing: number };
  failing_checks_by_type: Array<{ check_type: string; count: number }>;
  patches_pending_agents: number;
  patches_failed_agents: number;
  alerts: Array<{ severity: string; count: number }>;
}

export function fetchFleetStats(
  params = {},
  config: RequestConfig = {},
): Promise<FleetStats> {
  return core.get<FleetStats>("/stats/", { ...config, params });
}

export function fetchBrandingEdit() {
  return core.get("/branding/edit/");
}

export function editBranding(
  payload: Record<string, unknown>,
  config: RequestConfig = {},
) {
  return core.put("/branding/edit/", payload, config);
}

// failures are logged and resolve to undefined
export async function fetchCustomFields(params = {}, config = {}) {
  try {
    return await core.get("/customfields/", { ...config, params });
  } catch (e) {
    console.error(e);
  }
}

// url actions

export function fetchURLActions(params = {}): Promise<URLAction[]> {
  return core.get("/urlaction/", { params });
}

export function saveURLAction(action: URLAction) {
  return core.post("/urlaction/", action);
}

export function editURLAction(id: number, action: URLAction) {
  return core.put(`/urlaction/${id}/`, action);
}

export function removeURLAction(id: number) {
  return core.delete(`/urlaction/${id}/`);
}

type RunTarget = { agent_id?: string; client?: number; site?: number };
type RunURLActionRequest = RunTarget & { action: number };

// the server answers with the url to open; only web links leave the dashboard
export async function runURLAction(payload: RunURLActionRequest) {
  const url = await core.patch<string>("/urlaction/run/", payload);
  if (isWebUrl(url)) openURL(url);
  else notifyError("URL action returned no web link");
}

export function runTestURLAction(
  payload: urlActions.TestRunURLActionRequest,
): Promise<urlActions.TestRunURLActionResponse> {
  return core.post("/urlaction/run/test/", payload);
}

// web terminal

export async function checkWebTermPerms(): Promise<{
  message: string;
  status: number;
}> {
  const { data, status } = await axios.post("/core/webtermperms/");
  return { message: data, status };
}

export function openWebTerminal(): void {
  const { href } = router.resolve("/webterm");
  openURL(href, undefined, getCenteredWindowOptions(1280, 720));
}

// AI script drafts: the server sends the prompt on and answers with the code
export function draftScript(payload: { prompt: string }): Promise<string> {
  return core.post("/ai/generate/", payload);
}
