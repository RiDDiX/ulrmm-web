// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

import axios from "axios";

export async function fetchRustDeskSettings() {
  const { data } = await axios.get("/core/rustdesk/");
  return data;
}

export async function saveRustDeskSettings(payload) {
  const { data } = await axios.put("/core/rustdesk/", payload);
  return data;
}

export async function fetchAgentRustDesk(agent_id, config = {}) {
  const { data } = await axios.get(`/agents/${agent_id}/rustdesk/`, config);
  return data;
}

// installing the client on the endpoint can take a few minutes; the server
// gives up after about 250 s, so the request has to outlast that
export async function deployAgentRustDesk(agent_id) {
  const { data } = await axios.post(
    `/agents/${agent_id}/rustdesk/deploy/`,
    undefined,
    { timeout: 270000 },
  );
  return data;
}

// same limits as deploy; password neither sent nor touched
export async function updateAgentRustDesk(agent_id) {
  const { data } = await axios.post(
    `/agents/${agent_id}/rustdesk/update/`,
    undefined,
    { timeout: 270000 },
  );
  return data;
}

// the password is only ever handed to the caller; nothing here keeps it
export async function revealAgentRustDeskPassword(agent_id, config = {}) {
  const { data } = await axios.post(
    `/agents/${agent_id}/rustdesk/password/`,
    undefined,
    config,
  );
  return data;
}

export async function fetchRustDeskReleases(config = {}) {
  const { data } = await axios.get("/core/rustdesk/releases/", config);
  return data;
}

// GitHub is checked in the request and takes a few seconds
export async function checkRustDeskReleases(config = {}) {
  const { data } = await axios.post(
    "/core/rustdesk/releases/check/",
    undefined,
    { timeout: 60000, ...config },
  );
  return data;
}

// download and install on the RMM host; server gives up before 300 s
export async function updateRustDeskServer(version, config = {}) {
  const { data } = await axios.post(
    "/core/rustdesk/server/update/",
    { version },
    { timeout: 320000, ...config },
  );
  return data;
}

// mirrors the five client files first; about 90 s
export async function pinRustDeskClient(version, config = {}) {
  const { data } = await axios.post(
    "/core/rustdesk/client/pin/",
    { version },
    { timeout: 320000, ...config },
  );
  return data;
}

export async function updateRustDeskClients(config = {}) {
  const { data } = await axios.post(
    "/core/rustdesk/clients/update/",
    undefined,
    config,
  );
  return data;
}
