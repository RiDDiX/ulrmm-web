// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

import axios from "axios";
import { SILENT_REQUEST_CONFIG } from "@/constants/constants";

const baseUrl = "/importers/sources";

// [{id, kind, name, url, verify_tls, options, secrets_set, secret_names,
// push_plats, last_fetch, last_import, last_error}]; superusers only
export async function fetchSources() {
  const { data } = await axios.get(`${baseUrl}/`, SILENT_REQUEST_CONFIG);
  return data;
}

export async function fetchSource(id) {
  const { data } = await axios.get(`${baseUrl}/${id}/`, SILENT_REQUEST_CONFIG);
  return data;
}

// secrets: {name: value}; empty keeps the stored one, null removes it
export async function saveSource(id, payload, config) {
  const { data } = id
    ? await axios.put(`${baseUrl}/${id}/`, payload, config)
    : await axios.post(`${baseUrl}/`, payload, config);
  return data;
}

export async function deleteSource(id) {
  const { data } = await axios.delete(`${baseUrl}/${id}/`);
  return data;
}

// reads the source in the background; poll fetchSource for last_fetch
export async function readSource(id) {
  const { data } = await axios.post(`${baseUrl}/${id}/fetch/`);
  return data;
}

// {part: {total, new_count, new: [names]}}, devices also without_site
export async function fetchPlan(id) {
  const { data } = await axios.get(`${baseUrl}/${id}/plan/`);
  return data;
}

// {part: number created, sites, linked}
export async function runImport(id, parts) {
  const { data } = await axios.post(`${baseUrl}/${id}/import/`, { parts });
  return data;
}

export async function fetchImportedDevices(id) {
  const { data } = await axios.get(`${baseUrl}/${id}/devices/`);
  return data;
}

// {linked: n}
export async function linkDevices(id) {
  const { data } = await axios.post(`${baseUrl}/${id}/link/`);
  return data;
}

// {queued: n}; the installer goes out in the background
export async function migrateDevices(id, devices) {
  const { data } = await axios.post(`${baseUrl}/${id}/migrate/`, { devices });
  return data;
}
