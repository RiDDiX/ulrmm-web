// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

import axios from "axios";

const baseUrl = "/vulns";

// params: agent, severity, source, search, status (needs_update, no_fix,
// open, ignored, fixed; none = all)
export async function fetchVulnFindings(params = {}) {
  const { data } = await axios.get(`${baseUrl}/`, { params });
  return data;
}

export async function fetchVulnSummary() {
  const { data } = await axios.get(`${baseUrl}/summary/`);
  return data;
}

// params: status, severity, source, search
export async function fetchAgentVulns(agent_id, params = {}) {
  const { data } = await axios.get(`${baseUrl}/${agent_id}/`, { params });
  return data;
}

export async function scanFleetVulns() {
  const { data } = await axios.post(`${baseUrl}/scan/`);
  return data;
}

export async function scanAgentVulns(agent_id) {
  const { data } = await axios.post(`${baseUrl}/${agent_id}/scan/`);
  return data;
}

// open <-> ignored; returns {id, status}
export async function toggleVulnIgnore(id) {
  const { data } = await axios.post(`${baseUrl}/findings/${id}/ignore/`);
  return data;
}
