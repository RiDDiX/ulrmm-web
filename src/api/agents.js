// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

import { openURL } from "quasar";
import { router } from "@/router";
import { endpoint, logAndRethrow } from "@/api/http";
import { getCenteredWindowOptions } from "@/utils/helpers";

const agents = endpoint("/agents");

function openCentered(path, width, height) {
  const { href } = router.resolve(path);
  openURL(href, null, getCenteredWindowOptions(width, height));
}

// pop-out windows

export function runTakeControl(agent_id) {
  openCentered(`/takecontrol/${agent_id}`, 1600, 900);
}

export function runWebVNC(agent_id, port) {
  openCentered(`/webvnc/${agent_id}/${port}`, 1600, 900);
}

export function openAgentWindow(agent_id) {
  openCentered(`/agents/${agent_id}`, 1600, 900);
}

export function runRemoteBackground(agent_id, agentPlatform) {
  openCentered(
    `/remotebackground/${agent_id}?agentPlatform=${agentPlatform}`,
    1280,
    900,
  );
}

// agent records

export function fetchAgents(params = {}) {
  return agents.get("/", { params });
}

export function fetchAgent(agent_id, params = {}, config = {}) {
  return agents.get(`/${agent_id}/`, { ...config, params });
}

export function fetchAgentPerf(agent_id, config = {}) {
  return agents.get(`/${agent_id}/perf/`, config);
}

export function editAgent(agent_id, payload) {
  return agents.put(`/${agent_id}/`, payload);
}

export function removeAgent(agent_id, totp_code) {
  return agents.delete(`/${agent_id}/`, { data: { totp_code } });
}

export function fetchAgentHistory(agent_id, params = {}, config = {}) {
  return agents.get(`/${agent_id}/history/`, { ...config, params });
}

export function fetchAgentChecks(agent_id, params = {}) {
  return agents.get(`/${agent_id}/checks/`, { params });
}

export function fetchAgentTasks(agent_id, params = {}) {
  return agents.get(`/${agent_id}/tasks/`, { params });
}

// commands and actions

export function sendAgentRecovery(agent_id, payload) {
  return agents.post(`/${agent_id}/recover/`, payload);
}

export function sendAgentCommand(agent_id, payload) {
  return agents.post(`/${agent_id}/cmd/`, payload);
}

export function refreshAgentWMI(agent_id) {
  return agents.post(`/${agent_id}/wmi/`);
}

export function runScript(agent_id, payload, config = {}) {
  return agents.post(`/${agent_id}/runscript/`, payload, config);
}

export function runBulkAction(payload) {
  return agents.post("/actions/bulk/", payload);
}

export function fetchAgentProcesses(agent_id, params = {}) {
  return agents.get(`/${agent_id}/processes/`, { params });
}

export function killAgentProcess(agent_id, pid, params = {}) {
  return agents.delete(`/${agent_id}/processes/${pid}/`, { params });
}

export function fetchAgentEventLog(agent_id, logType, days, params = {}) {
  return agents.get(`/${agent_id}/eventlog/${logType}/${days}/`, { params });
}

export function fetchAgentMeshCentralURLs(agent_id, params = {}) {
  return agents.get(`/${agent_id}/meshcentral/`, { params });
}

// mesh terminal and file urls. needs the console step-up.
export function fetchAgentMeshConsoleURLs(agent_id) {
  return agents.post(`/${agent_id}/meshcentral/console/`);
}

export function fetchAgentWebVNCUrl(agent_id, port) {
  return agents.get(`/${agent_id}/${port}/webvnc/`);
}

// why a mesh session did not open: the 4xx body is the server's reason,
// unless it's an html error page. 5xx uses the generic text
export function meshFailure(e) {
  const body = e?.response?.status < 500 ? e.response.data : null;
  const text =
    typeof body === "string" && !body.trimStart().startsWith("<")
      ? body
      : body?.detail;
  return (
    text ||
    "The server could not open a MeshCentral session. Check that MeshCentral is reachable, then retry."
  );
}

export function sendAgentRecoverMesh(agent_id, params = {}) {
  return agents.post(`/${agent_id}/meshcentral/recover/`, { params });
}

export function sendAgentPing(agent_id, params = {}) {
  return agents.get(`/${agent_id}/ping/`, { params });
}

// power

export function scheduleAgentReboot(agent_id, payload) {
  return agents.patch(`/${agent_id}/reboot/`, payload);
}

export function agentRebootNow(agent_id) {
  return agents.post(`/${agent_id}/reboot/`);
}

export function agentShutdown(agent_id) {
  return agents.post(`/${agent_id}/shutdown/`);
}

export function agentSuspend(agent_id) {
  return agents.post(`/${agent_id}/suspend/`);
}

export function keepAgentAwake(agent_id, minutes) {
  return agents.post(`/${agent_id}/keepawake/`, { minutes });
}

export function keepAgentAwakeOnPower(agent_id, ac) {
  return agents.post(`/${agent_id}/keepawake/`, { ac });
}

export function wakeUpWOL(agent_id) {
  return agents.post(`/${agent_id}/wol/`);
}

// notes

export function fetchAgentNotes(agent_id, params = {}, config = {}) {
  return agents.get(`/${agent_id}/notes/`, { ...config, params });
}

export function saveAgentNote(payload) {
  return agents.post("/notes/", payload);
}

export function editAgentNote(pk, payload) {
  return agents.put(`/notes/${pk}/`, payload);
}

export function removeAgentNote(pk) {
  return agents.delete(`/notes/${pk}/`);
}

// registry

// one page size for browsing and searching, so a page number means the same
// offset in both (agents answer at most 1000 subkeys per page)
const REGISTRY_PAGE_SIZE = 1000;
// a search stops after this many pages and leaves the rest to "Load More"
const REGISTRY_SEARCH_PAGES = 100;

// hiveSearch walks every page from the first one so a path lookup sees all
// subkeys; the reply's page is the last page fetched
export async function fetchAgentRegistry(
  agent_id,
  path,
  page = 1,
  hiveSearch = false,
) {
  const fetchPage = (p) =>
    agents.get(`/${agent_id}/registry/`, {
      params: { path: `${path}`, page: p, page_size: REGISTRY_PAGE_SIZE },
    });
  try {
    if (!hiveSearch) return await fetchPage(page);
    let current = 1;
    let data = await fetchPage(current);
    const subkeys = [...(data?.subkeys || [])];
    while (data?.has_more && current < REGISTRY_SEARCH_PAGES) {
      current += 1;
      data = await fetchPage(current);
      subkeys.push(...(data?.subkeys || []));
    }
    return { ...data, subkeys, page: current };
  } catch (e) {
    console.error(e);
    throw e;
  }
}

const registry = (agent_id, action) => `/${agent_id}/registry/${action}/`;

export function deleteRegistryKey(agent_id, path) {
  return agents
    .delete(registry(agent_id, "delete-key"), { params: { path: `${path}` } })
    .catch(logAndRethrow());
}

export function createRegistryKey(agent_id, path) {
  return agents
    .post(registry(agent_id, "create-key"), { path })
    .catch(logAndRethrow());
}

export function renameRegistryKey(agent_id, old_path, new_path) {
  return agents
    .post(registry(agent_id, "rename-key"), { old_path, new_path })
    .catch(logAndRethrow());
}

export function deleteRegistryValue(agent_id, path, name) {
  return agents
    .delete(registry(agent_id, "delete-value"), { params: { path, name } })
    .catch(logAndRethrow("Failed to delete value:"));
}

export function renameRegistryValue(agentId, path, oldName, newName) {
  const payload = { path, old_name: oldName, new_name: newName };
  return agents
    .post(registry(agentId, "rename-value"), payload)
    .catch(logAndRethrow("Failed to rename value:"));
}

export function modifyRegistryValue(agentId, path, name, type, dataValue) {
  const payload = { path, name, type, data: dataValue };
  return agents
    .post(registry(agentId, "modify-value"), payload)
    .catch(logAndRethrow("Failed to modify registry value:"));
}

export async function createRegistryValue(agentId, path, name, type, data) {
  const form = new FormData();
  Object.entries({ path, name, type, data }).forEach(([key, value]) =>
    form.append(key, value),
  );
  return agents
    .post(registry(agentId, "create-value"), form)
    .catch(logAndRethrow("Failed to create registry value:"));
}

export function fetchAgentTerminalDefaults(agent_id) {
  return agents.get(`/${agent_id}/terminal-defaults/`).catch(logAndRethrow());
}
