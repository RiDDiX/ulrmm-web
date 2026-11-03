// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

import axios from "axios";

const baseUrl = "/patches/schedules";

export async function fetchSchedules() {
  const { data } = await axios.get(`${baseUrl}/`);
  return data;
}

export async function saveSchedule(id, payload) {
  const { data } = id
    ? await axios.put(`${baseUrl}/${id}/`, payload)
    : await axios.post(`${baseUrl}/`, payload);
  return data;
}

export async function removeSchedule(id) {
  const { data } = await axios.delete(`${baseUrl}/${id}/`);
  return data;
}

// next runs for unsaved schedule (server computes)
export async function previewSchedule(payload) {
  const { data } = await axios.post(`${baseUrl}/preview/`, payload);
  return data;
}

export async function fetchAgentSchedules(agent_id) {
  const { data } = await axios.get(`${baseUrl}/agent/${agent_id}/`);
  return data;
}
