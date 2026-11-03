// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

import axios, { type AxiosRequestConfig } from "axios";

import type { AlertTemplate } from "@/types/alerts";

type RequestConfig = AxiosRequestConfig & { silent?: boolean };

// a template with a server action needs the console step-up, 403 {"stepup": true}
export async function saveAlertTemplate(
  id: number,
  payload: Partial<AlertTemplate>,
  config: RequestConfig = {},
) {
  const { data } = await axios.put(`alerts/templates/${id}/`, payload, config);
  return data;
}

export async function addAlertTemplate(
  payload: AlertTemplate,
  config: RequestConfig = {},
) {
  const { data } = await axios.post("alerts/templates/", payload, config);
  return data;
}
