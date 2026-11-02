// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

import { endpoint } from "@/api/http";

const automation = endpoint("/automation");

export function fetchPolicyChecks(id) {
  return automation.get(`/policies/${id}/checks/`);
}

export function sendPatchPolicyReset(payload) {
  return automation.post("/patchpolicy/reset/", payload);
}
