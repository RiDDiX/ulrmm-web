// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

import { endpoint } from "@/api/http";

const tasks = endpoint("/tasks");

export function saveTask(payload) {
  return tasks.post("/", payload);
}

export function updateTask(id, payload) {
  return tasks.put(`/${id}/`, payload);
}

export function removeTask(id) {
  return tasks.delete(`/${id}/`);
}

export function runTask(id, payload) {
  return tasks.post(`/${id}/run/`, payload);
}
