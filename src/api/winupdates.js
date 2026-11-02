// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

import { endpoint } from "@/api/http";

const winupdate = endpoint("/winupdate");

export function fetchAgentUpdates(agent_id, params = {}, config = {}) {
  return winupdate.get(`/${agent_id}/`, { ...config, params });
}

export function runAgentUpdateScan(agent_id) {
  return winupdate.post(`/${agent_id}/scan/`);
}

export function runAgentUpdateInstall(agent_id) {
  return winupdate.post(`/${agent_id}/install/`);
}

// id of the update row, not the agent
export function editAgentUpdate(id, payload) {
  return winupdate.put(`/${id}/`, payload);
}
