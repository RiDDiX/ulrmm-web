// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

import axios from "axios";
import { SILENT_REQUEST_CONFIG } from "@/constants/constants";

const baseUrl = "/importers/sources";

// [{id, kind, name, url, verify_tls, options, secrets_set, secret_names,
// push_plats, parts, removes_agent, last_fetch, last_import, last_error}];
// superusers only
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

// reads the source in the background; poll fetchSource for last_fetch;
// 409 while a read or an import runs for it
export async function readSource(id) {
  const { data } = await axios.post(`${baseUrl}/${id}/fetch/`);
  return data;
}

// {part: {total, new_count, new: [names], existing_count, skipped_count,
// skipped: [{name, reason}]}}; devices also without_site and with_device_data,
// roles unknown_permissions, users note, policies to_complete (names) and
// to_complete_count
export async function fetchPlan(id) {
  const { data } = await axios.get(`${baseUrl}/${id}/plan/`);
  return data;
}

// {part: number created, sites, linked, completed: {policies: n},
// skipped: {part: [{name, reason}]}, skipped_total: {part: n}}; skipped holds
// at most 200 per part
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

// {queued: n, remove_requested: n}; the installer goes out in the background,
// with removeOld the old agent is taken off once the device is online here,
// which needs a current code; 409 while a read or an import runs for it
export async function migrateDevices(
  id,
  devices,
  removeOld = false,
  totp_code,
) {
  const { data } = await axios.post(`${baseUrl}/${id}/migrate/`, {
    devices,
    remove_old: removeOld,
    ...(removeOld && { totp_code }),
  });
  return data;
}

// {remove_requested: n}; the removal of the old agent without an installer,
// for devices whose agent here was installed another way
export async function removeOldAgent(id, devices, totp_code) {
  const { data } = await axios.post(`${baseUrl}/${id}/remove/`, {
    devices,
    totp_code,
  });
  return data;
}

// {withdrawn: n, in_flight: n}; only where the removal was not sent yet,
// in_flight counts those already being sent
export async function withdrawRemoval(id, devices) {
  const { data } = await axios.post(`${baseUrl}/${id}/withdraw/`, { devices });
  return data;
}
