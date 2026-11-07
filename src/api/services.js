// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

import { endpoint } from "@/api/http";

const services = endpoint("/services");
const service = (agent_id, svcname) => `/${agent_id}/${svcname}/`;

export function getAgentServices(agent_id, params = {}) {
  return services.get(`/${agent_id}/`, { params });
}

export function editAgentServiceStartType(agent_id, svcname, payload) {
  return services.put(service(agent_id, svcname), payload);
}

export function sendAgentServiceAction(agent_id, svcname, payload) {
  return services.post(service(agent_id, svcname), payload);
}
