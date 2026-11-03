// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

import { endpoint } from "@/api/http";

const software = endpoint("/software");

// the installed list only, without the wrapper object
export async function fetchAgentSoftware(agent_id, params = {}) {
  const reply = await software.get(`/${agent_id}/`, { params });
  return reply.software;
}

export function refreshAgentSoftware(agent_id) {
  return software.put(`/${agent_id}/`);
}

export function installAgentSoftware(agent_id, payload) {
  return software.post(`/${agent_id}/`, payload);
}

export function uninstallAgentSoftware(agent_id, payload) {
  return software.post(`/${agent_id}/uninstall/`, payload);
}

// {received, stale, drivers, problems, errors}; 404 = no inventory yet, the
// tab shows that itself
export function fetchAgentDrivers(agent_id) {
  return software.get(`/${agent_id}/drivers/`, { silent: true });
}

export function refreshAgentDrivers(agent_id) {
  return software.post(`/${agent_id}/drivers/refresh/`);
}

// {rows: [{source, id, name, version}], total, truncated, winget: {count,
// updated, checked, error}}; params: source all|choco|winget, search
export function fetchSoftwareCatalog(params = {}) {
  return software.get("/catalog/", { params });
}

// {detail, keys, seconds}
export function checkDriverCatalog(agent_id) {
  return software.post(`/${agent_id}/drivers/catalog/check/`);
}

// {job}
export function installCatalogDriver(agent_id, payload) {
  return software.post(`/${agent_id}/drivers/catalog/install/`, payload);
}

// {progress: null | {done, total}} of a running catalog check
export function fetchCatalogCheck(agent_id) {
  return software.get(`/${agent_id}/drivers/catalog/check/`, { silent: true });
}

// {state: resolving|downloading|queued|failed, detail, batch, package}
export function fetchCatalogJob(agent_id, job) {
  return software.get(`/${agent_id}/drivers/catalog/jobs/${job}/`, {
    silent: true,
  });
}

// {index: {updated, torrent_time, error, files}, approvals: [...]}
export function fetchSdioApprovals() {
  return software.get("/sdio/approvals/");
}

// {hwid, version}; fleet-wide, needs the console step-up (403 {"stepup":
// true}), config comes from withStepUp
export function approveSdioDriver(payload, config) {
  return software.post("/sdio/approvals/", payload, config);
}

export function revokeSdioApproval(id, config) {
  return software.delete(`/sdio/approvals/${id}/`, config);
}

// queues the index download and scan; 409 while one runs
export function refreshSdioIndex() {
  return software.post("/sdio/refresh/");
}

// {offers: [{...entry, approved, pack_http, pack_verified, devices: [...]}]},
// most devices first
export function fetchSdioOffers() {
  return software.get("/sdio/offers/");
}

// {progress: null | {phase, done, total}} of a running index refresh
export function fetchSdioProgress() {
  return software.get("/sdio/progress/", { silent: true });
}
