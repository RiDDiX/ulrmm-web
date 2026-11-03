// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

import axios from "axios";

// newest first; params: before (iso, the previous page's next_before),
// limit, types (comma list)
export async function fetchAgentTimeline(agent_id, params = {}) {
  const { data } = await axios.get(`/timeline/${agent_id}/`, { params });
  return data;
}
