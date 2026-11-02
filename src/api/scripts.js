// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

import axios from "axios";
import { endpoint } from "@/api/http";

const scripts = endpoint("/scripts");

export function fetchScripts(params = {}) {
  return scripts.get("/", { params });
}

export function saveScript(payload) {
  return scripts.post("/", payload);
}

export function editScript(payload) {
  return scripts.put(`/${payload.id}/`, payload);
}

export function removeScript(id) {
  return scripts.delete(`/${id}/`);
}

export function downloadScript(id, params = {}) {
  return scripts.get(`/${id}/download/`, { params });
}

export function testScript(agent_id, payload) {
  return scripts.post(`/${agent_id}/test/`, payload);
}

export async function testScriptOnServer(payload, config = {}) {
  const { data } = await axios.post("core/serverscript/test/", payload, config);
  return data;
}

// sync community scripts from the library repo
export function syncCommunityScripts() {
  return scripts.post("/community/sync/");
}

// snippets

export function fetchScriptSnippets(params = {}) {
  return scripts.get("/snippets/", { params });
}

export function fetchScriptSnippet(id, params = {}) {
  return scripts.get(`/snippets/${id}/`, { params });
}

export function saveScriptSnippet(payload) {
  return scripts.post("/snippets/", payload);
}

export function editScriptSnippet(payload) {
  return scripts.put(`/snippets/${payload.id}/`, payload);
}

export function removeScriptSnippet(id) {
  return scripts.delete(`/snippets/${id}/`);
}
