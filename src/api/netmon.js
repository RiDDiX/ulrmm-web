// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

import axios from "axios";

const baseUrl = "/netmon/devices";

export async function fetchNetworkDevices() {
  const { data } = await axios.get(`${baseUrl}/`);
  return data;
}

export async function saveNetworkDevice(id, payload) {
  const { data } = id
    ? await axios.put(`${baseUrl}/${id}/`, payload)
    : await axios.post(`${baseUrl}/`, payload);
  return data;
}

export async function removeNetworkDevice(id) {
  const { data } = await axios.delete(`${baseUrl}/${id}/`);
  return data;
}

// current probes from server; result not stored
export async function testNetworkDevice(id) {
  const { data } = await axios.post(`${baseUrl}/${id}/test/`);
  return data;
}
