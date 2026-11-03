// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

import axios from "axios";

const baseUrl = "/lifecycle";

export async function fetchAssetsSummary() {
  const { data } = await axios.get(`${baseUrl}/summary/`);
  return data;
}

export async function fetchLicenses() {
  const { data } = await axios.get(`${baseUrl}/licenses/`);
  return data;
}

// key is write-only, empty keeps the stored one
export async function saveLicense(id, payload, config) {
  const { data } = id
    ? await axios.put(`${baseUrl}/licenses/${id}/`, payload, config)
    : await axios.post(`${baseUrl}/licenses/`, payload, config);
  return data;
}

export async function removeLicense(id) {
  const { data } = await axios.delete(`${baseUrl}/licenses/${id}/`);
  return data;
}

// needs the console step-up, 403 {"stepup": true} otherwise. audited
export async function revealLicenseKey(id, config) {
  const { data } = await axios.post(
    `${baseUrl}/licenses/${id}/reveal/`,
    null,
    config,
  );
  return data.key;
}

// asks the vendor for the warranty of the device
export async function checkAgentWarranty(agent_id) {
  const { data } = await axios.post(`/agents/${agent_id}/warranty/`);
  return data;
}
