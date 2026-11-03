// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

// Single source of truth for a patch/package update row's lifecycle state.
// From the winupdate row: action, installed, result, installing.
// Status column, filter chips, default sort and install confirm all use it.

export type PatchDecision = "approve" | "ignore" | "inherit" | "nothing";

export type PatchLifecycleState =
  | "needs_decision"
  | "approved"
  | "installing"
  | "installed"
  | "failed"
  | "ignored";

export interface PatchRow {
  installed: boolean;
  installing?: boolean;
  action: string;
  result?: string;
  title?: string;
  kb?: string;
  severity?: string | null;
}

const STATE_LABELS: Record<PatchLifecycleState, string> = {
  needs_decision: "Needs decision",
  approved: "Approved - waiting to install",
  installing: "Installing",
  installed: "Installed",
  failed: "Install failed on last attempt",
  ignored: "Ignored",
};

// Short word for the status pill, matching the filter chip it sorts under;
// the sentence in STATE_LABELS above stays available for a tooltip and
// sr-only text next to the pill.
const STATE_PILL_LABELS: Record<PatchLifecycleState, string> = {
  needs_decision: "Needs decision",
  approved: "Approved",
  installing: "Installing",
  installed: "Installed",
  failed: "Failed",
  ignored: "Ignored",
};

// Lower sorts first: a failed install needs attention before anything else,
// then undecided rows, then everything already handled.
const STATE_RANK: Record<PatchLifecycleState, number> = {
  failed: 0,
  needs_decision: 1,
  approved: 2,
  installing: 3,
  ignored: 4,
  installed: 5,
};

// tooltip on the status pill and its filter chip
export const PATCH_STATE_HELP: Record<PatchLifecycleState, string> = {
  needs_decision:
    "Not approved yet; it installs only once approved by hand or by the patch policy",
  approved: "Installs with the next install run",
  installing: "Install running on the device - this updates automatically",
  installed: "The last scan reported it as installed",
  failed: "The last install attempt failed; the next install retries it",
  ignored: "Never installed; the patch policy cannot approve it either",
};

const STATE_PILL_COLOR: Record<PatchLifecycleState, string> = {
  failed: "negative",
  needs_decision: "warning",
  approved: "info",
  installing: "info",
  ignored: "neutral",
  installed: "positive",
};

// Severity fields of an effective patch policy, as returned in
// effective_patch_policy (agents/models.py get_patch_policy()).
export interface SeverityPolicy {
  critical: string;
  important: string;
  moderate: string;
  low: string;
  other: string;
}

const SEVERITY_POLICY_FIELD: Record<string, keyof SeverityPolicy> = {
  Critical: "critical",
  Important: "important",
  Moderate: "moderate",
  Low: "low",
  // the server files only an empty severity under "other"; a null or an
  // unknown word is matched by no policy field
  "": "other",
};

// True when the effective policy auto-approves this row's severity: the
// next sweep (agents/models.py approve_updates(), run every 8h and again
// right before an install) sets the row to Approve unless it is ignored.
function severityAutoApproves(
  row: PatchRow,
  policy?: SeverityPolicy | null,
): boolean {
  if (!policy || typeof row.severity !== "string") return false;
  const field = SEVERITY_POLICY_FIELD[row.severity];
  return !!field && policy[field] === "approve";
}

// A row an install will act on: approved by hand, or about to be approved
// by the policy sweep the install endpoint runs first. An ignored row is
// never touched by that sweep.
export function willInstall(
  row: PatchRow,
  policy?: SeverityPolicy | null,
): boolean {
  if (row.installed || row.action === "ignore") return false;
  return row.action === "approve" || severityAutoApproves(row, policy);
}

// isInstalling is the caller's flag, set when Install is sent and cleared
// on the next successful load. row.installing comes from the server.
export function getPatchState(
  row: PatchRow,
  isInstalling = false,
  policy?: SeverityPolicy | null,
): PatchLifecycleState {
  if (row.installed) return "installed";
  // the server never resets `result`, so an operator's Ignore has to win
  // over an old failure or the row could never leave "failed"
  if (row.action === "ignore") return "ignored";
  // a retried failed row shows "installing" while it runs, not the old failure
  if (row.installing || isInstalling) return "installing";
  // ...and switching a failed row to Approve/Do Nothing/Inherit has to win
  // too, or "failed" stays stuck under its old decision forever
  if (row.action === "approve" && row.result === "failed") return "failed";
  if (willInstall(row, policy)) return "approved";
  return "needs_decision"; // covers "nothing" and an unresolved "inherit"
}

// An Inherit row that the policy leaves alone isn't waiting on an admin,
// and an "approved" row nobody approved by hand got there through the
// policy - both say so instead of borrowing the manual wording.
function policyLabel(
  state: PatchLifecycleState,
  row?: PatchRow,
): string | null {
  if (!row) return null;
  if (state === "needs_decision" && row.action === "inherit")
    return "Follows policy";
  if (state === "approved" && row.action !== "approve")
    return "Approved by policy";
  return null;
}

// Long, descriptive label - for a tooltip or sr-only text next to a pill.
export function patchStateLabel(
  state: PatchLifecycleState,
  row?: PatchRow,
): string {
  const label = policyLabel(state, row);
  if (label === "Approved by policy")
    return "Approved by policy - waiting to install";
  return label ?? STATE_LABELS[state];
}

// Short label for the status pill itself; same wording as the filter chips.
export function patchStatePillLabel(
  state: PatchLifecycleState,
  row?: PatchRow,
): string {
  return policyLabel(state, row) ?? STATE_PILL_LABELS[state];
}

export function patchStateRank(state: PatchLifecycleState): number {
  return STATE_RANK[state];
}

export function patchStatePillColor(state: PatchLifecycleState): string {
  return STATE_PILL_COLOR[state];
}

export const PATCH_STATE_FILTERS: {
  label: string;
  value: PatchLifecycleState;
}[] = [
  { label: "Needs decision", value: "needs_decision" },
  { label: "Approved", value: "approved" },
  { label: "Failed", value: "failed" },
  { label: "Installed", value: "installed" },
  { label: "Ignored", value: "ignored" },
];

const DECISION_LABELS: Record<PatchDecision, string> = {
  approve: "Approve",
  ignore: "Ignore",
  inherit: "Inherit",
  // matches the "Do Nothing" wording already used on the button and the
  // context menu, so the column and the toast don't use a second word for
  // the same decision
  nothing: "Do Nothing",
};

// tooltip or caption next to the decision
export const DECISION_HELP: Record<PatchDecision, string> = {
  approve: "Install it with the next install run",
  ignore: "Never install it; the patch policy cannot approve it",
  inherit: "Let the patch policy decide by severity",
  nothing:
    "Leave it pending; the patch policy can still approve it by severity",
};

export function decisionLabel(action: string): string {
  return DECISION_LABELS[action as PatchDecision] ?? DECISION_LABELS.nothing;
}

const SEVERITY_RANK: Record<string, number> = {
  Critical: 0,
  Important: 1,
  Moderate: 2,
  Low: 3,
};

// Unknown/empty severity renders as "Other" and sorts after the named ranks.
export function severityRank(severity?: string | null): number {
  if (!severity) return 4;
  return severity in SEVERITY_RANK ? SEVERITY_RANK[severity] : 4;
}

// How many rows a click on "Install approved updates" will actually act on -
// used to label and disable the install button and to size its confirmation.
// Shares willInstall with the "Approved" filter chip and the status pill so
// the counts can't drift apart.
export function countWillInstall(
  rows: PatchRow[],
  policy?: SeverityPolicy | null,
): number {
  return rows.filter((row) => willInstall(row, policy)).length;
}

export function installBusyWarning(
  rows: PatchRow[],
  policy: SeverityPolicy | null | undefined,
  platform: string,
): string {
  const total = countWillInstall(rows, policy);
  const busy = rows.filter(
    (row) => row.installing && willInstall(row, policy),
  ).length;
  if (busy === 0) return "";

  const prefix = `${busy} of these updates ${busy === 1 ? "is" : "are"} already installing. The server will send all ${total} approved update${total === 1 ? "" : "s"}. `;
  const outcome =
    platform === "windows"
      ? "If an install is still running, Windows ignores the entire new request."
      : "The request waits for the current package script, then runs, or is skipped if the device stays busy for about 30 minutes.";
  return `<strong>${prefix}${outcome}</strong><br><br>`;
}

export const escapeHtml = (text: string) =>
  text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

// The updates an install will act on, as an escaped list for a confirmation
// dialog with `html: true`. A row that failed last time is still
// in this list - the install click retries it - so it's labelled as such
// instead of looking identical to a fresh approval.
export function willInstallListHtml(
  rows: PatchRow[],
  policy?: SeverityPolicy | null,
  cap = 10,
): string {
  const titles = rows
    .filter((row) => willInstall(row, policy))
    .map((row) => {
      const name = escapeHtml(row.title || row.kb || "Unnamed update");
      if (row.action !== "approve") return `${name} (approved by policy)`;
      return row.result === "failed"
        ? `${name} (failed last time, will be retried)`
        : name;
    });
  const items = titles.slice(0, cap);
  if (titles.length > cap) items.push(`+${titles.length - cap} more`);
  return `<ul class="q-pl-md q-my-sm">${items
    .map((item) => `<li>${item}</li>`)
    .join("")}</ul>`;
}

export function rebootConsequence(rebootAfterInstall?: string | null): string {
  switch (rebootAfterInstall) {
    case "always":
      return "the device reboots immediately, every time";
    case "required":
      return "the device reboots immediately if it reports one is needed";
    default:
      return "the device is not rebooted automatically";
  }
}
