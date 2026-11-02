// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

import axios from "axios";
import { SILENT_REQUEST_CONFIG } from "@/constants/constants";

const baseUrl = "/discovery";

// networks the server may scan, its defaults and limits
export async function fetchDiscoveryNetworks() {
  const { data } = await axios.get(`${baseUrl}/networks/`);
  return data;
}

export async function fetchScans() {
  const { data } = await axios.get(`${baseUrl}/scans/`);
  return data;
}

// polled while a scan runs, so failures are not toasted
export async function fetchScan(id) {
  const { data } = await axios.get(
    `${baseUrl}/scans/${id}/`,
    SILENT_REQUEST_CONFIG,
  );
  return data;
}

export async function startScan(payload) {
  const { data } = await axios.post(`${baseUrl}/scans/`, payload);
  return data;
}

export async function fetchDiscoveredDevices(params = {}) {
  const { data } = await axios.get(`${baseUrl}/devices/`, { params });
  return data;
}

// toggles ignored, returns the device
export async function toggleIgnoreDevice(id) {
  const { data } = await axios.post(`${baseUrl}/devices/${id}/ignore/`);
  return data;
}

export async function addDeviceToNetmon(id, payload) {
  const { data } = await axios.post(
    `${baseUrl}/devices/${id}/netmon/`,
    payload,
  );
  return data;
}
