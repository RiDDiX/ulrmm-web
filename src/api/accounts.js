// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

import { endpoint } from "@/api/http";

const accounts = endpoint("/accounts");
const withCode = (body, totp_code) => ({ ...body, totp_code });
const codeBody = (totp_code) => ({ data: { totp_code } });

// users

export function fetchUsers(params = {}) {
  return accounts.get("/users/", { params });
}

// silent. form shows the 400, no toast
export function resetPass(pass, code) {
  return accounts.put("/resetpw/", { password: pass, code }, { silent: true });
}

export function resetTwoFactor(code) {
  return accounts.put("/reset2fa/", { code });
}

// step-up status. server keeps terminal/file access for 60 min.
export function fetchConsoleStepUp() {
  return accounts.get("/users/console_stepup/");
}

export function sendConsoleStepUp(code) {
  return accounts.post("/users/console_stepup/", { code });
}

// sessions

export function fetchUserSessions(id) {
  return accounts.get(`/users/${id}/sessions/`);
}

export function deleteAllUserSessions(id) {
  return accounts.delete(`/users/${id}/sessions/`);
}

export function deleteUserSession(id) {
  return accounts.delete(`/sessions/${id}/`);
}

// roles and api keys: every write carries the TOTP code

export function fetchRoles(params = {}) {
  return accounts.get("/roles/", { params });
}

export function saveRole(role, totp_code) {
  return accounts.post("/roles/", withCode(role, totp_code));
}

export function editRole(id, role, totp_code) {
  return accounts.put(`/roles/${id}/`, withCode(role, totp_code));
}

export function removeRole(id, totp_code) {
  return accounts.delete(`/roles/${id}/`, codeBody(totp_code));
}

export function fetchAPIKeys(params = {}) {
  return accounts.get("/apikeys/", { params });
}

export function saveAPIKey(apiKey, totp_code) {
  return accounts.post("/apikeys/", withCode(apiKey, totp_code));
}

export function editAPIKey(id, apiKey, totp_code) {
  return accounts.put(`/apikeys/${id}/`, withCode(apiKey, totp_code));
}

export function removeAPIKey(id, totp_code) {
  return accounts.delete(`/apikeys/${id}/`, codeBody(totp_code));
}
