// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

import axios from "axios";

// sampled performance history, range = 1h | 6h | 24h | 7d | 30d
export async function fetchAgentMetrics(agent_id, range, config = {}) {
  const { data } = await axios.get(`/metrics/${agent_id}/`, {
    ...config,
    params: { range },
  });
  return data;
}

// last state document the agent pushed; 404 while it has sent none
export async function fetchAgentState(agent_id, config = {}) {
  const { data } = await axios.get(`/metrics/${agent_id}/state/`, config);
  return data;
}

// without a name: the series catalog of the newest sample
export async function fetchMetricSeries(agent_id, query = {}, config = {}) {
  const params = { ...query };
  if (params.labels) params.labels = JSON.stringify(params.labels);
  const { data } = await axios.get(`/metrics/${agent_id}/series/`, {
    ...config,
    params,
  });
  return data;
}

// the server stores only these series; labels are the selector keys
export const METRICS = {
  "cpu.pct": { label: "CPU use", unit: "%", labels: [] },
  "mem.pct": { label: "Memory use", unit: "%", labels: [] },
  "swap.pct": { label: "Swap use", unit: "%", labels: [] },
  "load.1": { label: "Load average, 1 min", unit: "", labels: [] },
  "load.5": { label: "Load average, 5 min", unit: "", labels: [] },
  "load.15": { label: "Load average, 15 min", unit: "", labels: [] },
  "disk.used_pct": { label: "Disk space used", unit: "%", labels: ["mount"] },
  "disk.inode_pct": { label: "Inodes used", unit: "%", labels: ["mount"] },
  "net.rx_bps": { label: "Received", unit: "B/s", labels: ["if"] },
  "net.tx_bps": { label: "Sent", unit: "B/s", labels: ["if"] },
  "net.err_ps": { label: "Interface errors", unit: "/s", labels: ["if"] },
  "net.drop_ps": { label: "Interface drops", unit: "/s", labels: ["if"] },
  "temp.c": { label: "Temperature", unit: "°C", labels: ["sensor"] },
  "time.offset_ms": { label: "Clock offset", unit: "ms", labels: [] },
  "ctr.cpu_pct": {
    label: "Container CPU use",
    unit: "%",
    labels: ["kind", "name"],
  },
  "ctr.mem_bytes": {
    label: "Container memory",
    unit: "B",
    labels: ["kind", "name"],
  },
  "vm.total": { label: "Instances (total)", unit: "", labels: ["kind"] },
  "vm.running": { label: "Instances (running)", unit: "", labels: ["kind"] },
};

export const METRIC_LABEL_NAMES = {
  mount: "Mount point",
  if: "Interface",
  sensor: "Sensor",
  kind: "Kind",
  name: "Container or guest name",
};

// metric checks of an agent, policy ones included, for threshold lines
export async function fetchAgentMetricChecks(agent_id, config = {}) {
  const { data } = await axios.get(`/agents/${agent_id}/checks/`, config);
  return Array.isArray(data)
    ? data.filter((c) => c.check_type === "metric")
    : [];
}
