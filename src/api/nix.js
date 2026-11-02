// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

import axios from "axios";
import { SILENT_REQUEST_CONFIG } from "@/constants/constants";

const baseUrl = "/nix";

// the server's answer when the agent does not know the call yet
export const AGENT_UPDATE_REQUIRED = "Agent update required";

// reads show their errors in the tab, so they are not toasted
export async function fetchNixServices(agent_id) {
  const { data } = await axios.get(
    `${baseUrl}/${agent_id}/services/`,
    SILENT_REQUEST_CONFIG,
  );
  return data;
}

export async function sendNixServiceAction(agent_id, name, action) {
  const { data } = await axios.post(
    `${baseUrl}/${agent_id}/services/${encodeURIComponent(name)}/`,
    { action },
  );
  return data;
}

export async function fetchNixLogs(agent_id, params) {
  const { data } = await axios.get(`${baseUrl}/${agent_id}/logs/`, {
    params,
    ...SILENT_REQUEST_CONFIG,
  });
  return data;
}

// readable text for a failed nix request, and whether the agent is too old
export function nixError(e, forbidden) {
  const status = e?.response?.status;
  const data = e?.response?.data;
  if (status === 403) return { text: forbidden, updateRequired: false };
  if (status === 400 && data === AGENT_UPDATE_REQUIRED)
    return { text: data, updateRequired: true };
  const text =
    status < 500 &&
    typeof data === "string" &&
    !data.trimStart().startsWith("<")
      ? data
      : data?.detail ||
        (status
          ? `The server returned an error (${status}).`
          : "The server did not answer.");
  return { text, updateRequired: false };
}
