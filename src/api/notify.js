// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

import axios from "axios";

const baseUrl = "/notify";

export async function fetchChannels() {
  const { data } = await axios.get(`${baseUrl}/channels/`);
  return data;
}

// secret is write-only, empty keeps the stored one. PUT would need name and
// kind again, so edits are PATCHed
export async function saveChannel(id, payload, config) {
  const { data } = id
    ? await axios.patch(`${baseUrl}/channels/${id}/`, payload, config)
    : await axios.post(`${baseUrl}/channels/`, payload, config);
  return data;
}

export async function removeChannel(id) {
  const { data } = await axios.delete(`${baseUrl}/channels/${id}/`);
  return data;
}

// 200 {ok, error}; a failed send is ok: false, not an HTTP error
export async function testChannel(id) {
  const { data } = await axios.post(`${baseUrl}/channels/${id}/test/`);
  return data;
}

export async function fetchRoutes() {
  const { data } = await axios.get(`${baseUrl}/routes/`);
  return data;
}

export async function saveRoute(id, payload) {
  const { data } = id
    ? await axios.put(`${baseUrl}/routes/${id}/`, payload)
    : await axios.post(`${baseUrl}/routes/`, payload);
  return data;
}

export async function removeRoute(id) {
  const { data } = await axios.delete(`${baseUrl}/routes/${id}/`);
  return data;
}

// last 200, newest first
export async function fetchNotifications(params = {}) {
  const { data } = await axios.get(`${baseUrl}/notifications/`, { params });
  return data;
}
