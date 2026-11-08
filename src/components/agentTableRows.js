// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

// Row level logic of the agent table: the search box filter, cell texts
// and the CSV columns. No component state, so it can be tested alone.

import { date } from "quasar";
import { deviceName } from "@/utils/deviceName";
import {
  PATCHES_FAILED_LABEL,
  PATCHES_PENDING_LABEL,
  agentStatusLabel,
  agentStatusMeta,
  checksMeta,
  needsAttention,
  powerEventMeta,
  relativeTime,
} from "@/utils/format";

// is:<flag> search terms, each a test every shown row has to pass
const FLAG_TESTS = new Map(
  Object.entries({
    patchespending: (row) => !!row.has_patches_pending,
    patchesfailed: (row) => !!row.has_patches_failed,
    needsattention: (row) => !!needsAttention(row),
    actionspending: (row) => row.pending_actions_count !== 0,
    // as on the fleet overview tile: failing results of any severity, not
    // only the error count in checks.failing
    checksfailing: ({ checks }) =>
      checks.failing > 0 || checks.warning > 0 || checks.info > 0,
    rebootneeded: (row) => !!row.needs_reboot,
  }),
);
const STATUS_TERMS = new Set(["online", "offline", "expired", "overdue"]);

// searched too, although no column shows them
const EXTRA_SEARCH_COLUMNS = [
  ..."hostname version operating_system serial_number custom_fields".split(" "),
  ..."cpu_model graphics make_model physical_disks".split(" "),
  ..."public_ip local_ips".split(" "),
  (row) => (row.tags || []).map((tag) => tag.name).join(" "),
].map((field) => ({ field }));

function parseSearch(terms) {
  const parsed = { tests: [], status: null, words: [] };
  const lowered = terms ? terms.toLowerCase() : "";
  for (const token of lowered.trim().split(" ")) {
    if (!token.startsWith("is:")) {
      if (token) parsed.words.push(token);
      continue;
    }
    const flag = token.split(":")[1];
    if (FLAG_TESTS.has(flag)) parsed.tests.push(FLAG_TESTS.get(flag));
    else if (STATUS_TERMS.has(flag)) parsed.status = flag;
  }
  return parsed;
}

function statusMatches(row, status) {
  if (status === null) return true;
  if (status !== "expired") return row.status === status;
  if (!row.last_seen) return false;
  const idle = date.getDateDiff(new Date(), new Date(row.last_seen), "days");
  return idle >= 30;
}

function searchableText(value) {
  const flat = Array.isArray(value)
    ? value.map((part) => (part.value ? part.value : part))
    : value;
  const text = flat + "";
  return text === "undefined" || text === "null" ? "" : text.toLowerCase();
}

// q-table filter-method. Quasar only searches the visible columns, the
// extra fields are added here. Each typed word has to match somewhere in
// the row, so "Branch Office" does not shrink to "office".
export function filterAgentRows(rows, terms, cols, cellValue) {
  const { tests, status, words } = parseSearch(terms);
  const searched = [...cols, ...EXTRA_SEARCH_COLUMNS];
  const hasWord = (row, word) =>
    searched.some((col) => searchableText(cellValue(col, row)).includes(word));
  return rows.filter(
    (row) =>
      tests.every((test) => test(row)) &&
      statusMatches(row, status) &&
      words.every((word) => hasWord(row, word)),
  );
}

export function statusTooltip(row) {
  const power = powerEventMeta(row);
  if (power) return `${power.label} — ${power.tip}`;
  const { label } = agentStatusMeta(row.status);
  return row.last_seen
    ? `${label} — last seen ${relativeTime(row.last_seen)}`
    : `${label} — never checked in`;
}

// warning and info are counted on their own, not folded into failing
export function checksTooltip(row) {
  if (row.maintenance_mode)
    return "Maintenance mode enabled — alerts are suppressed";
  const { total, failing, warning, info, pending = 0 } = row.checks ?? {};
  if (!total) return "No checks configured for this device";
  const counts = [
    [failing, "error"],
    [warning, "warning"],
    [info, "info"],
  ]
    .filter(([n]) => n > 0)
    .map(([n, severity]) => `${n} ${severity}`);
  if (counts.length)
    return `Failing checks: ${counts.join(", ")} — details in the Checks tab`;
  return pending > 0
    ? `${pending} of ${total} checks have not run yet`
    : "All checks passing";
}

export function pendingTooltip(count) {
  const noun = count === 1 ? "action" : "actions";
  return `${count} pending ${noun} — click to review`;
}

// the Patches cell; only a pending state links to the tab
export function patchState(row) {
  if (row.has_patches_failed)
    return {
      tone: "agent-status--negative",
      icon: "sync_problem",
      text: "Failed",
      tip: `${PATCHES_FAILED_LABEL} — details in the Patches tab`,
    };
  if (row.has_patches_pending)
    return {
      tone: "agent-status--link rmm-link",
      icon: "schedule",
      text: "Pending",
      tip: `${PATCHES_PENDING_LABEL} — open the Patches tab`,
      to: {
        name: "Agent",
        params: { agent_id: row.agent_id },
        query: { tab: "patches" },
      },
    };
  return {
    tone: "agent-status--positive",
    icon: "check_circle",
    text: "Up to date",
    tip: "No approved update is waiting or failed",
  };
}

// "1–25" for the footer, "0" for an empty result
export function pageSpan({ page, rowsPerPage }, total) {
  if (!total) return "0";
  const from = (page - 1) * rowsPerPage + 1;
  return `${from}–${Math.min(page * rowsPerPage, total)}`;
}

// CSV export. Status, checks, reboot, patches and pending actions are
// icons or counts in the table, here they become text.
export function csvColumns(formatDate) {
  const yesNo = (key) => (row) => (row[key] ? "Yes" : "No");
  return [
    ["status", "Status", agentStatusLabel],
    ["name", "Name", deviceName],
    ["hostname", "Hostname", "hostname"],
    ["client_name", "Client", "client_name"],
    ["site_name", "Site", "site_name"],
    ["tags", "Tags", (row) => (row.tags || []).map((t) => t.name).join(", ")],
    ["checks", "Checks", (row) => checksMeta(row).label],
    ["needs_reboot", "Reboot needed", yesNo("needs_reboot")],
    ["patchespending", "Patches pending", yesNo("has_patches_pending")],
    ["patchesfailed", "Patch install failed", yesNo("has_patches_failed")],
    ["pendingactions", "Pending actions", "pending_actions_count"],
    ["user", "User", "logged_username"],
    ["description", "Description", "description"],
    ["last_seen", "Last seen", (row) => formatDate(row.last_seen)],
    ["version", "Agent version", "version"],
    ["operating_system", "Operating system", "operating_system"],
    ["public_ip", "Public IP", "public_ip"],
    ["serial_number", "Serial number", "serial_number"],
    ["make_model", "Make / model", "make_model"],
  ].map(([name, label, field]) => ({ name, label, field }));
}
