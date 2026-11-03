// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

import { endpoint } from "@/api/http";
import { SILENT_REQUEST_CONFIG } from "@/constants/constants";

const logs = endpoint("/logs");

// both log views send their filters as a PATCH body
export function fetchDebugLog(payload) {
  return logs.patch("/debug/", payload);
}

export function fetchAuditLog(payload) {
  return logs.patch("/audit/", payload);
}

export function fetchPendingActions(params = {}) {
  return logs.get("/pendingactions/", { params });
}

// {pending}; 403 without the pending actions permission
export function fetchPendingActionsCount() {
  return logs.get("/pendingactions/count/", SILENT_REQUEST_CONFIG);
}

export function deletePendingAction(id) {
  return logs.delete(`/pendingactions/${id}/`);
}

export function fetchAgentPendingActions(agent_id, config) {
  return endpoint("/agents").get(`/${agent_id}/pendingactions/`, config);
}
