// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

import { endpoint } from "@/api/http";

const clients = endpoint("/clients");

// clients and sites share one shape: /clients/ and /clients/sites/
function crud(prefix) {
  return {
    list: (config) => clients.get(`${prefix}/`, config),
    one: (id) => clients.get(`${prefix}/${id}/`),
    create: (payload) => clients.post(`${prefix}/`, payload),
    update: (id, payload) => clients.put(`${prefix}/${id}/`, payload),
    remove: (id, params, totp_code) =>
      clients.delete(`${prefix}/${id}/`, { params, data: { totp_code } }),
  };
}

const client = crud("");
const site = crud("/sites");

export function fetchClients(config) {
  return client.list(config);
}

export function fetchClient(id) {
  return client.one(id);
}

export function saveClient(payload) {
  return client.create(payload);
}

export function editClient(id, payload) {
  return client.update(id, payload);
}

export function removeClient(id, params = {}, totp_code) {
  return client.remove(id, params, totp_code);
}

export function fetchSites() {
  return site.list();
}

export function fetchSite(id) {
  return site.one(id);
}

export function saveSite(payload) {
  return site.create(payload);
}

export function editSite(id, payload) {
  return site.update(id, payload);
}

export function removeSite(id, params = {}, totp_code) {
  return site.remove(id, params, totp_code);
}

// deployments (installer links)

export function fetchDeployments() {
  return clients.get("/deployments/");
}

export function saveDeployment(payload) {
  return clients.post("/deployments/", payload);
}

export function removeDeployment(id, params = {}) {
  return clients.delete(`/deployments/${id}/`, { params });
}
