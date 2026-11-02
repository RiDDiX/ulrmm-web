// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

import axios from "axios";
import { SILENT_REQUEST_CONFIG } from "@/constants/constants";

const baseUrl = "/dashboard";

// the user's own overview layout, or the default for the role
export async function fetchLayout() {
  const { data } = await axios.get(`${baseUrl}/layout/`);
  return data;
}

// saved on every change; the page shows a rejection itself
export async function saveLayout(layout) {
  const { data } = await axios.put(
    `${baseUrl}/layout/`,
    layout,
    SILENT_REQUEST_CONFIG,
  );
  return data;
}

// back to the default of the user's role, which the response carries
export async function resetLayout() {
  const { data } = await axios.delete(
    `${baseUrl}/layout/`,
    SILENT_REQUEST_CONFIG,
  );
  return data;
}

// params: the widget's settings, lists comma separated. the card shows
// 403/404/400 itself, so nothing is toasted
export async function fetchWidget(type, params = {}) {
  const { data } = await axios.get(
    `${baseUrl}/widgets/${encodeURIComponent(type)}/`,
    {
      ...SILENT_REQUEST_CONFIG,
      params,
    },
  );
  return data;
}
