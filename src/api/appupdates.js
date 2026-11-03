// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

import axios from "axios";

const baseUrl = "/appupdates";

// rows + effective policy of one agent
export async function fetchAppUpdates(agent_id, config = {}) {
  const { data } = await axios.get(`${baseUrl}/${agent_id}/`, config);
  return data;
}

// asks the agent for its list; needs the agent online
export async function collectAppUpdates(agent_id) {
  const { data } = await axios.post(`${baseUrl}/${agent_id}/collect/`);
  return data;
}

export async function applyAppUpdates(agent_id, ids) {
  const { data } = await axios.post(`${baseUrl}/${agent_id}/apply/`, { ids });
  return data;
}

export async function excludeAppUpdate(agent_id, app_id, excluded) {
  const { data } = await axios.put(`${baseUrl}/${agent_id}/exclude/`, {
    app_id,
    excluded,
  });
  return data;
}

// app_updates: "inherit" | "on" | "off"
export async function setAppUpdatePolicy(agent_id, app_updates) {
  const { data } = await axios.patch(`${baseUrl}/${agent_id}/policy/`, {
    app_updates,
  });
  return data;
}

// site override, same values as the device policy
export async function setSiteAppUpdatePolicy(site_pk, app_updates) {
  const { data } = await axios.patch(`${baseUrl}/sites/${site_pk}/policy/`, {
    app_updates,
  });
  return data;
}

export async function fetchAppUpdateSettings() {
  const { data } = await axios.get(`${baseUrl}/settings/`);
  return data;
}

export async function saveAppUpdateSettings(payload) {
  const { data } = await axios.put(`${baseUrl}/settings/`, payload);
  return data;
}
