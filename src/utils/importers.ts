// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

// Wording for the Import page: the parts of an import, what came of it, and
// where the removal of a device's old agent stands.
import { NO_VALUE } from "@/utils/format";
import { humanizeFieldKey } from "@/utils/notify";

// "1 device", "2 devices"; many for nouns that do not just take an s
export function count(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

export interface Skipped {
  name: string;
  reason: string;
}

// in the server's import order; part "" is shown but imported with clients
export const IMPORT_PARTS = [
  {
    key: "clients",
    part: "clients",
    label: "Clients",
    one: "client",
    noun: "clients",
  },
  {
    key: "sites",
    part: "",
    label: "Sites (with their clients)",
    one: "site",
    noun: "sites",
  },
  {
    key: "custom_fields",
    part: "custom_fields",
    label: "Custom fields",
    one: "custom field",
    noun: "custom fields",
  },
  {
    key: "scripts",
    part: "scripts",
    label: "Scripts",
    one: "script",
    noun: "scripts",
  },
  {
    key: "snippets",
    part: "snippets",
    label: "Script snippets",
    one: "snippet",
    noun: "snippets",
  },
  {
    key: "keystore",
    part: "keystore",
    label: "Key store",
    one: "key store entry",
    noun: "key store entries",
  },
  {
    key: "url_actions",
    part: "url_actions",
    label: "URL actions",
    one: "URL action",
    noun: "URL actions",
  },
  {
    key: "alert_templates",
    part: "alert_templates",
    label: "Alert templates",
    one: "alert template",
    noun: "alert templates",
  },
  {
    key: "policies",
    part: "policies",
    label: "Policies with their checks and tasks",
    one: "policy",
    noun: "policies",
  },
  { key: "roles", part: "roles", label: "Roles", one: "role", noun: "roles" },
  { key: "users", part: "users", label: "Users", one: "user", noun: "users" },
  {
    key: "reports",
    part: "reports",
    label: "Reports, HTML templates and data queries",
    one: "report entry",
    noun: "report entries",
  },
  {
    key: "devices",
    part: "devices",
    label: "Devices",
    one: "device",
    noun: "devices",
  },
];

export type ImportPart = (typeof IMPORT_PARTS)[number];

// the parts a source offers; sites come along with clients
export function partsOffered(offered: string[]): ImportPart[] {
  return IMPORT_PARTS.filter((p) => offered.includes(p.part || "clients"));
}

// short lines under a part of the plan, only when there is something to say
export function partNotes(
  key: string,
  part: {
    note?: string;
    unknown_permissions?: number;
    with_device_data?: number;
    to_complete?: string[];
    to_complete_count?: number;
  },
): string[] {
  const notes: string[] = [];
  const perms = part.unknown_permissions || 0;
  const own = part.with_device_data || 0;
  const fill = part.to_complete_count || 0;
  if (key === "roles" && perms)
    notes.push(
      `${count(perms, "permission")} this installation does not have ${perms === 1 ? "is" : "are"} left out.`,
    );
  if (key === "devices" && own)
    notes.push(
      `${count(own, "device")} ${own === 1 ? "brings its" : "bring their"} own policy, patch policy, settings, checks or tasks; linking applies them where the agent here has nothing set.`,
    );
  if (key === "policies" && fill) {
    const names = part.to_complete || [];
    const more = fill > names.length ? ", ..." : "";
    notes.push(
      `${count(fill, "policy", "policies")} imported earlier ${fill === 1 ? "is" : "are"} completed with the checks, tasks or alert template ${fill === 1 ? "it still lacks" : "they still lack"}: ${names.join(", ")}${more}`,
    );
  }
  if (part.note) notes.push(part.note);
  return notes;
}

// "Added 2 clients, 1 site ...; 1 policy completed; 3 devices linked to
// enrolled agents."
export function importSummary(
  result: Record<string, unknown>,
  parts: string[],
): string {
  const added = IMPORT_PARTS.filter((p) =>
    parts.includes(p.part || "clients"),
  ).map((p) => count(Number(result[p.key]) || 0, p.one, p.noun));
  let text = `Added ${added.join(", ")}`;
  const completed = (result.completed as Record<string, number> | undefined)
    ?.policies;
  if (completed)
    text += `; ${count(completed, "policy", "policies")} completed`;
  if (parts.includes("devices"))
    text += `; ${count(Number(result.linked) || 0, "device")} linked to enrolled agents`;
  return `${text}.`;
}

export function withoutSiteText(n: number): string {
  return `${count(n, "device")} ${n === 1 ? "has" : "have"} no site in the source and cannot be placed.`;
}

// [{label, items, total}] per part that left something out, in import order;
// the server sends at most 200 items per part and the full count in totals
export function skippedByPart(
  skipped?: Record<string, Skipped[]> | null,
  totals?: Record<string, number> | null,
): { label: string; items: Skipped[]; total: number }[] {
  return IMPORT_PARTS.filter((p) => skipped?.[p.key]?.length).map((p) => ({
    label: p.label,
    items: skipped![p.key],
    total: Math.max(totals?.[p.key] || 0, skipped![p.key].length),
  }));
}

export interface SourceState {
  last_fetch?: string | null;
  last_error?: string;
}

// a read clears last_error when it starts, so any error is this read's
export function readOutcome(
  beforeFetch: string | null | undefined,
  now: SourceState | null,
): "running" | "failed" | "done" {
  if (!now) return "running";
  if (now.last_error) return "failed";
  return now.last_fetch !== beforeFetch ? "done" : "running";
}

export const IMPORT_FILE_MAX = 64 * 1024 * 1024;

// checked before sending, the server refuses larger files anyway
export function importFileError(file?: { size: number } | null): string {
  if (!file) return "Choose the export file.";
  return file.size > IMPORT_FILE_MAX ? "The file is larger than 64 MB." : "";
}

function firstText(value: unknown): string {
  if (Array.isArray(value)) return firstText(value[0]);
  if (value && typeof value === "object")
    return firstText(Object.values(value)[0]);
  return value == null ? "" : String(value);
}

// a rejected save: errors of the given form fields go inline, the rest into
// one message; "" when the server gave no readable text (an HTML page)
export function saveErrors(
  data: unknown,
  fields: string[],
): { fields: Record<string, string>; message: string } {
  const inline: Record<string, string> = {};
  if (typeof data === "string")
    return {
      fields: inline,
      message: data.trimStart().startsWith("<") ? "" : data.trim(),
    };
  if (Array.isArray(data)) data = { non_field_errors: data };
  const rest: string[] = [];
  if (data && typeof data === "object")
    for (const [k, v] of Object.entries(data)) {
      const text = firstText(v);
      if (!text) continue;
      if (fields.includes(k)) inline[k] = text;
      else if (k === "detail" || k === "non_field_errors") rest.push(text);
      else rest.push(`${humanizeFieldKey(k)}: ${text}`);
    }
  return { fields: inline, message: rest.join(" ") };
}

export interface RemovalRow {
  remove_state?: string;
  remove_at?: string | null;
  remove_reason?: string;
  recovery?: string;
}

export interface RemovalView {
  label: string;
  color: string;
  details: string[];
}

const REMOVAL_STATES: Record<string, [string, string]> = {
  waiting_here: ["waiting for the device here", "grey-6"],
  waiting_there: ["waiting for it on the other server", "info"],
  sending: ["being sent", "warning"],
  removed: ["removed", "positive"],
  not_removed: ["not removed", "negative"],
};

// the repair of remote control after a removal: pending, ok,
// "failed: <reason>" (tried again), "given up: <reason>" or a final reason
export function recoveryText(recovery?: string): string {
  if (!recovery) return "";
  if (recovery === "pending")
    return "Repair of remote control is scheduled for 5 minutes after the removal.";
  if (recovery === "ok") return "Remote control repaired.";
  if (recovery.startsWith("failed:"))
    return `Repair of remote control failed and is tried again hourly: ${recovery.replace(/^failed: */, "")}`;
  return `Remote control not repaired (${recovery.replace(/^given up: */, "")}); reinstall it by hand.`;
}

// where the removal of the old agent stands; fmt formats the time
export function removalView(
  row: RemovalRow,
  fmt: (value: string) => string,
): RemovalView {
  const state = REMOVAL_STATES[row.remove_state || ""];
  if (!state)
    return {
      label: NO_VALUE,
      color: "",
      details: row.remove_reason ? [row.remove_reason] : [],
    };
  const details: string[] = [];
  if (row.remove_state === "removed") {
    if (row.remove_at) details.push(fmt(row.remove_at));
  } else if (row.remove_reason) details.push(row.remove_reason);
  const repair = recoveryText(row.recovery);
  if (repair) details.push(repair);
  return { label: state[0], color: state[1], details };
}

export function removalWaiting(row: RemovalRow): boolean {
  return (
    row.remove_state === "waiting_here" || row.remove_state === "waiting_there"
  );
}

// the send dialog without removal: an earlier request still holds
export function keptAgentText(rows: RemovalRow[]): string {
  const waiting = rows.filter(removalWaiting).length;
  if (!waiting) {
    return "The old agent stays installed; remove it once the device shows up here.";
  }
  return `The removal of the old agent asked for earlier still waits for ${count(waiting, "device")} and is sent once ${waiting === 1 ? "it is" : "they are"} online here; use Withdraw removal to keep the old agent.`;
}

// no removal waiting, being sent or done: one can be asked for
export function removalAskable(row: RemovalRow): boolean {
  return (
    !removalWaiting(row) &&
    row.remove_state !== "sending" &&
    row.remove_state !== "removed"
  );
}
