// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

import { endpoint } from "@/api/http";
import type { AxiosRequestConfig } from "axios";
import type { Baseline } from "@/utils/baselines";

type Config = AxiosRequestConfig & { silent?: boolean };

const software = endpoint("/software");

export type BaselineInput = Omit<Baseline, "id">;

export function fetchBaselines() {
  return software.get<Baseline[]>("/baselines/");
}

// field errors come back per field, items as a list of per-item errors
export function createBaseline(payload: BaselineInput, config?: Config) {
  return software.post<Baseline>("/baselines/", payload, config);
}

export function updateBaseline(
  id: number,
  payload: BaselineInput,
  config?: Config,
) {
  return software.put<Baseline>(`/baselines/${id}/`, payload, config);
}

export function removeBaseline(id: number) {
  return software.delete(`/baselines/${id}/`);
}

// one row per agent and item, plus pending rows for agents without a state
export function fetchBaselineStatus(id: number) {
  return software.get(`/baselines/${id}/status/`);
}

// the baseline items of one agent with their state
export function fetchAgentBaseline(agentId: string) {
  return software.get(`/${agentId}/baseline/`);
}

// failed items of the agent go back to pending
export function retryAgentBaseline(agentId: string) {
  return software.post(`/${agentId}/baseline/retry/`);
}

export function fetchDeploymentBaselines(deploymentId: number) {
  return software.get<{ baselines: number[] }>(
    `/deployments/${deploymentId}/baselines/`,
  );
}

export function saveDeploymentBaselines(
  deploymentId: number,
  baselines: number[],
  config?: Config,
) {
  return software.put<{ baselines: number[] }>(
    `/deployments/${deploymentId}/baselines/`,
    { baselines },
    config,
  );
}
