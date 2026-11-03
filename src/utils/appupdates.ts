// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

// third-party app updates (GET /appupdates/<agent_id>/): row states and the
// effective policy

export interface AppUpdate {
  source: string;
  app_id: string;
  name: string;
  installed: string;
  available: string;
  seen_at: string | null;
  state: string;
  last_error: string;
  excluded_globally: boolean;
}

export type AppPolicy = "inherit" | "on" | "off";

export interface AppUpdatesView {
  rows: AppUpdate[];
  policy: AppPolicy;
  // true/false after resolving agent > site > global, null when unknown
  effective: boolean | null;
  effectiveFrom: "agent" | "site" | "global" | null;
  supported: boolean;
  // server count of rows still open and not excluded globally
  pending: number | null;
  // last collect error of the agent, "" when none
  error: string;
  lastCollected: string | null;
}

export const POLICY_OPTIONS: { value: AppPolicy; label: string }[] = [
  { value: "inherit", label: "Inherit (site, then global)" },
  { value: "on", label: "On" },
  { value: "off", label: "Off" },
];

const STATE_META: Record<string, { label: string; tone: string }> = {
  available: { label: "Available", tone: "info" },
  excluded: { label: "Excluded", tone: "neutral" },
  updating: { label: "Updating", tone: "warning" },
  failed: { label: "Failed", tone: "negative" },
  done: { label: "Updated", tone: "positive" },
};

export function stateMeta(state: unknown) {
  return typeof state === "string" &&
    Object.prototype.hasOwnProperty.call(STATE_META, state)
    ? STATE_META[state]
    : { label: String(state || "Unknown"), tone: "neutral" };
}

const str = (v: unknown) =>
  typeof v === "string" ? v : v == null ? "" : String(v);

export function normalizeAppUpdates(data: unknown): AppUpdatesView {
  const d = (data ?? {}) as Record<string, unknown>;
  const list = Array.isArray(d.updates) ? d.updates : [];
  const rows: AppUpdate[] = (list as Record<string, unknown>[])
    .filter((r) => r && typeof r === "object")
    .map((r) => ({
      source: str(r.source),
      app_id: str(r.app_id),
      name: str(r.name) || str(r.app_id),
      installed: str(r.installed),
      available: str(r.available),
      seen_at: r.seen_at ? str(r.seen_at) : null,
      state: str(r.state) || "available",
      last_error: str(r.last_error),
      excluded_globally: r.excluded_globally === true,
    }));
  const from = d.effective_from;
  return {
    rows,
    policy: d.policy === "on" || d.policy === "off" ? d.policy : "inherit",
    effective: typeof d.effective === "boolean" ? d.effective : null,
    effectiveFrom:
      from === "agent" || from === "site" || from === "global" ? from : null,
    supported: d.supported !== false,
    pending: Number.isInteger(d.pending) ? (d.pending as number) : null,
    error: str(d.error),
    lastCollected: d.collected_at ? str(d.collected_at) : null,
  };
}

// rows that still wait for an update (not excluded, not running, not done)
export function pendingRows(rows: AppUpdate[]): AppUpdate[] {
  return rows.filter(
    (r) =>
      (r.state === "available" || r.state === "failed") &&
      !!r.available &&
      !r.excluded_globally,
  );
}
