// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

import { endpoint } from "@/api/http";

const checks = endpoint("/checks");

export function saveCheck(payload) {
  return checks.post("/", payload);
}

export function updateCheck(id, payload) {
  return checks.put(`/${id}/`, payload);
}

export function removeCheck(id) {
  return checks.delete(`/${id}/`);
}

export function resetCheck(id) {
  return checks.post(`/${id}/reset/`);
}

// per agent
export function resetAllChecksStatus(agent_id) {
  return checks.post(`/${agent_id}/resetall/`);
}

export function runAgentChecks(agent_id) {
  return checks.post(`/${agent_id}/run/`);
}
