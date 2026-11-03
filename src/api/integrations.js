// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

import axios from "axios";
import { SILENT_REQUEST_CONFIG } from "@/constants/constants";

const baseUrl = "/integrations";

// {unifi: {...}, opnsense: {...}}; secrets come back as *_set flags only
export async function fetchIntegrationSettings() {
  const { data } = await axios.get(`${baseUrl}/settings/`);
  return data;
}

// secret fields are write-only: empty keeps the stored one, null removes it
export async function saveIntegrationSettings(payload, config) {
  const { data } = await axios.put(`${baseUrl}/settings/`, payload, config);
  return data;
}

// syncs every enabled target, which doubles as the connection test.
// {results: {unifi?: {ok, clients, vlans} | {ok: false, error}, opnsense?},
// unifi, opnsense}; 400 when nothing is enabled
export async function syncIntegrations() {
  const { data } = await axios.post(`${baseUrl}/sync/`);
  return data;
}

// [{vlan_id, name, subnet ("" when unknown), source}]; optional for the scan form, so silent
export async function fetchVlans() {
  const { data } = await axios.get(`${baseUrl}/vlans/`, SILENT_REQUEST_CONFIG);
  return data;
}
