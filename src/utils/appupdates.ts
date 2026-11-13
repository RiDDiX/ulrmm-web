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

export const UPDATE_POLL_MS = 15_000;
// the server gives one upgrade call 30 min before it marks it timed out
export const UPDATE_POLL_LIMIT_MS = 35 * 60_000;

// start time of the reload loop while a row is updating, null to stop it
export function updatePollStart(
  rows: { state: string; last_error?: string }[],
  startedAt: number | null,
  now: number,
): number | null {
  // the server sets last_error on an updating row only when the run timed out
  if (!rows.some((r) => r.state === "updating" && !r.last_error)) return null;
  const start = startedAt ?? now;
  return now - start < UPDATE_POLL_LIMIT_MS ? start : null;
}

export interface HistoryOutcome {
  label: string;
  icon: string;
  color: string | null;
}

// appupdates/tasks.py writes one "<app> <from> -> <to>: <outcome>" line per
// app, failed and timed out followed by the installer's tail lines
const OUTCOME_LINE = / -> .*: (ok|failed|timed out|not started)$/gm;

export function historyOutcome(results: unknown): HistoryOutcome {
  const text = typeof results === "string" ? results : "";
  const seen = new Set([...text.matchAll(OUTCOME_LINE)].map((m) => m[1]));
  if (seen.has("failed"))
    return { label: "Failed", icon: "error", color: "negative" };
  if (seen.has("timed out"))
    return { label: "Timed out", icon: "timer_off", color: "warning" };
  if (seen.has("not started"))
    return { label: "Not started", icon: "do_not_disturb_on", color: null };
  if (seen.has("ok"))
    return { label: "Success", icon: "check_circle", color: "positive" };
  return { label: "Unknown", icon: "help_outline", color: null };
}

const HISTORY_ICONS: Record<string, string> = {
  cmd_run: "terminal",
  script_run: "code",
  task_run: "task_alt",
  app_update: "system_update_alt",
};

export interface HistoryRow {
  id: number;
  time: string;
  type: string;
  command?: string | null;
  script_name?: string | null;
  username?: string | null;
  results?: string | null;
  script_results?: { retcode?: number | null } | null;
}

// one agent history row as a line of the device quick panel's Activity list
export function historyActivityRow(h: HistoryRow) {
  const retcode = h.script_results?.retcode;
  const by = `by ${h.username || "system"}`;
  if (h.type === "app_update") {
    const outcome = historyOutcome(h.results);
    return {
      key: `history-${h.id}`,
      time: h.time,
      icon: HISTORY_ICONS.app_update,
      state:
        outcome.color === "negative" || outcome.color === "warning"
          ? outcome.color
          : "neutral",
      title: h.command,
      caption: `App update ${by} · ${outcome.label.toLowerCase()}`,
    };
  }
  const result =
    h.type === "cmd_run"
      ? h.results
        ? "output received"
        : "no output"
      : retcode === 0
        ? "success"
        : retcode == null
          ? "unknown result"
          : `failed (exit ${retcode})`;
  return {
    key: `history-${h.id}`,
    time: h.time,
    icon: HISTORY_ICONS[h.type] || "history",
    state: retcode != null && retcode > 0 ? "negative" : "neutral",
    title: h.type === "cmd_run" ? h.command : h.script_name,
    caption: `${h.type === "cmd_run" ? "Command" : h.type === "task_run" ? "Task" : "Script"} ${by} · ${result}`,
  };
}
