// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

import { defineStore } from "pinia";
import { ref, watch } from "vue";
import { useDashWSConnection } from "@/websocket/websocket";

// payload of the dashboard.agentcount websocket event
export type WSAgentCount = Record<
  | "total_server_count"
  | "total_server_offline_count"
  | "total_workstation_count"
  | "total_workstation_offline_count"
  | "days_until_cert_expires",
  number
>;

export const useDashboardStore = defineStore("dashboard", () => {
  const counts = {
    total_server_count: ref(0),
    total_server_offline_count: ref(0),
    total_workstation_count: ref(0),
    total_workstation_offline_count: ref(0),
    days_until_cert_expires: ref(180),
  };
  const agentCountReady = ref(false);

  // set by the axios interceptor when the backend can't be reached, cleared
  // on the next successful response
  const isOffline = ref(false);
  const setOffline = (value: boolean) => {
    isOffline.value = value;
  };

  const { data, status: wsStatus } = useDashWSConnection();

  watch(data, (message) => {
    if (message.action !== "dashboard.agentcount") return;
    const payload = message.data as WSAgentCount;
    agentCountReady.value = true;
    for (const [field, target] of Object.entries(counts)) {
      target.value = payload[field as keyof WSAgentCount];
    }
  });

  return {
    serverCount: counts.total_server_count,
    serverOfflineCount: counts.total_server_offline_count,
    workstationCount: counts.total_workstation_count,
    workstationOfflineCount: counts.total_workstation_offline_count,
    daysUntilCertExpires: counts.days_until_cert_expires,
    isOffline,
    setOffline,
    wsStatus,
    agentCountReady,
  };
});
