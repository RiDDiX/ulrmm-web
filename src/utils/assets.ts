// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

// asset lifecycle fields of an agent and the license list; every field may
// be missing on an older server

export interface WarrantyStatus {
  provider: string;
  product: string;
  start: string;
  end: string;
  service_level: string;
  fetched_at: string;
  error: string;
}

const s = (v: unknown) => (v == null ? "" : String(v));

export function warrantyOf(agent: unknown): WarrantyStatus | null {
  const raw = (agent as { warranty_status?: unknown })?.warranty_status;
  if (!raw || typeof raw !== "object" || !Object.keys(raw).length) return null;
  const w = raw as Record<string, unknown>;
  return {
    provider: s(w.provider),
    product: s(w.product),
    start: s(w.start),
    end: s(w.end),
    service_level: s(w.service_level),
    fetched_at: s(w.fetched_at),
    error: s(w.error),
  };
}

// whole days from today to a YYYY-MM-DD date; null when unparsable
function daysUntil(value: unknown, now = Date.now()): number | null {
  const t = Date.parse(s(value).slice(0, 10));
  return Number.isNaN(t) ? null : Math.ceil((t - now) / 86400000);
}

export function expiryPill(value: unknown): { text: string; tone: string } {
  const d = daysUntil(value);
  if (d === null) return { text: "", tone: "neutral" };
  if (d < 0) return { text: `Expired ${-d} d ago`, tone: "negative" };
  if (d <= 30) return { text: `${d} d left`, tone: "warning" };
  return { text: `${d} d left`, tone: "neutral" };
}

export function priceText(value: unknown): string {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) ? n.toFixed(2) : "";
}

export interface KeyDevice {
  agent_id: string;
  name: string;
  product: string;
  channel: string;
  licensed: boolean;
  status: string;
  collected_at: string;
}

export interface KeyActivation {
  devices: KeyDevice[];
  activated: number;
  failing: KeyDevice[];
  // seats minus activated devices, null without a seat limit
  free: number | null;
}

// devices that report one of the license's Microsoft keys; null when the
// license holds no product key (or the server is older)
export function activationOf(license: unknown): KeyActivation | null {
  const l = license as { activation?: unknown; seats?: unknown };
  if (!Array.isArray(l?.activation)) return null;
  const devices = l.activation as KeyDevice[];
  const activated = new Set(
    devices.filter((d) => d.licensed).map((d) => d.agent_id),
  ).size;
  return {
    devices,
    activated,
    failing: devices.filter((d) => !d.licensed),
    free: typeof l.seats === "number" ? Math.max(l.seats - activated, 0) : null,
  };
}
