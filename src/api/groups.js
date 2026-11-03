// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

import axios from "axios";

const baseUrl = "/groups";

export async function fetchTags(config = {}) {
  const { data } = await axios.get(`${baseUrl}/tags/`, config);
  return data;
}

export async function saveTag(id, payload) {
  const { data } = id
    ? await axios.put(`${baseUrl}/tags/${id}/`, payload)
    : await axios.post(`${baseUrl}/tags/`, payload);
  return data;
}

export async function removeTag(id) {
  const { data } = await axios.delete(`${baseUrl}/tags/${id}/`);
  return data;
}

// replaces the agent's tags with these ids
export async function setAgentTags(agent_id, tags) {
  const { data } = await axios.put(`${baseUrl}/agents/${agent_id}/tags/`, {
    tags,
  });
  return data;
}

export async function fetchGroups(config = {}) {
  const { data } = await axios.get(`${baseUrl}/`, config);
  return data;
}

export async function saveGroup(id, payload) {
  const { data } = id
    ? await axios.put(`${baseUrl}/${id}/`, payload)
    : await axios.post(`${baseUrl}/`, payload);
  return data;
}

export async function removeGroup(id) {
  const { data } = await axios.delete(`${baseUrl}/${id}/`);
  return data;
}

// current members as agent table rows
export async function fetchGroupAgents(id, config = {}) {
  const { data } = await axios.get(`${baseUrl}/${id}/agents/`, config);
  return data;
}

// {count, agents: first hostnames} for unsaved rules
export async function previewGroup(rules, config = {}) {
  const { data } = await axios.post(`${baseUrl}/preview/`, rules, config);
  return data;
}
