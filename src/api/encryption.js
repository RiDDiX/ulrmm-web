// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

import axios from "axios";

const baseUrl = "/encryption";

// {volumes: [{volume, kind, protection, percent, has_key, collected_at}],
//  keys: [{id, kind, volume, protector_id, collected_at, status}], error}
export async function fetchEncryption(agent_id) {
  const { data } = await axios.get(`${baseUrl}/${agent_id}/`);
  return data;
}

// reads the volumes from the agent now, same answer as fetchEncryption
export async function collectEncryption(agent_id) {
  const { data } = await axios.post(`${baseUrl}/${agent_id}/collect/`);
  return data;
}

// macOS only. {username, password}. The password is only in this body.
// step-up like revealRecoveryKey
export async function rotateFileVaultKey(agent_id, payload, config) {
  const { data } = await axios.post(
    `${baseUrl}/${agent_id}/rotate/`,
    payload,
    config,
  );
  return data;
}

// needs the console step-up, 403 {"stepup": true} otherwise. audited
export async function revealRecoveryKey(id, config) {
  const { data } = await axios.post(
    `${baseUrl}/keys/${id}/reveal/`,
    null,
    config,
  );
  return data.key;
}
