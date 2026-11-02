// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

import axios from "axios";

const baseUrl = "/laps";

// {global: Policy, sites: [Policy]}; Policy {id, site (null = global),
// account, create_if_missing, rotate_days, length,
// rotate_after_reveal_hours, enabled}
export async function fetchLapsPolicies() {
  const { data } = await axios.get(`${baseUrl}/policies/`);
  return data;
}

// creates or updates one policy (policy.site null = global); step-up
export async function saveLapsPolicy(policy, config) {
  const { data } = await axios.put(`${baseUrl}/policies/`, policy, config);
  return data;
}

// the site follows the global policy again; step-up
export async function removeLapsPolicy(siteId, config) {
  const { data } = await axios.delete(`${baseUrl}/policies/${siteId}/`, config);
  return data;
}

// {supported, policy: Policy + {scope} | null, can_rotate,
// state: {account, next_rotation, last_rotation, last_error, credential} | null}
export async function fetchLapsState(agentId, config) {
  const { data } = await axios.get(`${baseUrl}/${agentId}/`, config);
  return data;
}

// answers with a message at once, the rotation runs in the background
export async function rotateLaps(agentId, config) {
  const { data } = await axios.post(
    `${baseUrl}/${agentId}/rotate/`,
    null,
    config,
  );
  return data;
}
