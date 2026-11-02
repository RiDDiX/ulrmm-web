// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

import axios from "axios";

// superuser only and behind the console step-up (403 {"stepup": true})
export async function revealUninstallCode(agentId, config) {
  const { data } = await axios.post(
    `/agents/${agentId}/uninstall_code/`,
    null,
    config,
  );
  return data.uninstall_code;
}
