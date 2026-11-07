// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

import axios from "axios";
import { endpoint } from "@/api/http";

const baseUrl = "/packages";
const packages = endpoint(baseUrl);

export async function fetchPackages() {
  const { data } = await axios.get(`${baseUrl}/`);
  return data;
}

export async function updatePackage(id, payload, config) {
  const { data } = await axios.put(`${baseUrl}/${id}/`, payload, config);
  return data;
}

export async function removePackage(id) {
  const { data } = await axios.delete(`${baseUrl}/${id}/`);
  return data;
}

// {batch, queued, skipped, refused}
export async function installPackage(id, payload) {
  const { data } = await axios.post(`${baseUrl}/${id}/install/`, payload);
  return data;
}

// params: batch, agent, package
export async function fetchPackageInstalls(params = {}) {
  const { data } = await axios.get(`${baseUrl}/installs/`, { params });
  return data;
}

// chunked upload: {filename, size} -> {id, chunk_size, received}. creating
// and finishing need the console step-up, config comes from the caller
export function startUpload(payload, config) {
  return packages.post("/uploads/", payload, config);
}

export function fetchUpload(id) {
  return packages.get(`/uploads/${id}/`, { silent: true });
}

// raw body; 409 {received} when start is not where the server stands
export function putUploadChunk(id, chunk, start, size, onProgress) {
  return packages.put(`/uploads/${id}/`, chunk, {
    silent: true,
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Range": `bytes ${start}-${start + chunk.size - 1}/${size}`,
    },
    onUploadProgress: (e) => onProgress?.(e.loaded ?? 0),
  });
}

export function removeUpload(id) {
  return packages.delete(`/uploads/${id}/`, { silent: true });
}

// {name, kind?, plat?, default_args, timeout, allow_unsigned, command?,
// success_codes?, reboot_codes?, detection?, vendor?, version?} -> package
export function finishUpload(id, payload, config) {
  return packages.post(`/uploads/${id}/finish/`, payload, config);
}

// {state, exit_code, detail, output}; the server waits up to 150 s for pnputil
export async function removeDriver(agent_id, inf) {
  const { data } = await axios.post(
    `${baseUrl}/drivers/remove/`,
    { agent_id, inf },
    { timeout: 180000 },
  );
  return data;
}
