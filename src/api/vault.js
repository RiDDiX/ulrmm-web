// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

import axios from "axios";

const baseUrl = "/vault";
const SCOPE_PATH = { client: "clients", site: "sites", agent: "agents" };

// scope client | site | agent, key = pk or agent_id. {documents, credentials};
// items of a parent scope carry inherited: "client" | "site"
export async function fetchVault(scope, key) {
  const { data } = await axios.get(`${baseUrl}/${SCOPE_PATH[scope]}/${key}/`);
  return data;
}

export async function saveDocument(id, payload) {
  const { data } = id
    ? await axios.put(`${baseUrl}/documents/${id}/`, payload)
    : await axios.post(`${baseUrl}/documents/`, payload);
  return data;
}

export async function removeDocument(id) {
  const { data } = await axios.delete(`${baseUrl}/documents/${id}/`);
  return data;
}

// secret is write-only, empty keeps the stored one
export async function saveCredential(id, payload, config) {
  const { data } = id
    ? await axios.put(`${baseUrl}/credentials/${id}/`, payload, config)
    : await axios.post(`${baseUrl}/credentials/`, payload, config);
  return data;
}

export async function removeCredential(id) {
  const { data } = await axios.delete(`${baseUrl}/credentials/${id}/`);
  return data;
}

// needs the console step-up, 403 {"stepup": true} otherwise. audited
export async function revealCredential(id, config) {
  const { data } = await axios.post(
    `${baseUrl}/credentials/${id}/reveal/`,
    null,
    config,
  );
  return data.secret;
}
