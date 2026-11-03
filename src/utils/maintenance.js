// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

// labels for maint/sleep/wake. weekdays 0=Mon (server).

export const KIND_OPTIONS = [
  { value: "maintenance", label: "Maintenance window" },
  { value: "sleep", label: "Sleep" },
  { value: "wake", label: "Wake" },
];

export const KIND_LABELS = Object.fromEntries(
  KIND_OPTIONS.map((o) => [o.value, o.label]),
);

export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export const MONTH_WEEKS = [
  { value: 1, label: "First" },
  { value: 2, label: "Second" },
  { value: 3, label: "Third" },
  { value: 4, label: "Fourth" },
  { value: -1, label: "Last" },
];

const RUN_STATES = {
  new: ["Starting", "info"],
  waking: ["Waking", "info"],
  scanning: ["Scanning", "info"],
  scanned: ["Scanned", "info"],
  installing: ["Installing", "info"],
  installed: ["Installed", "info"],
  rebooting: ["Rebooting", "info"],
  idle_wait: ["Waiting for idle", "info"],
  done: ["Done", "positive"],
  slept: ["Put to sleep", "positive"],
  left_awake: ["Left awake", "warning"],
  timeout: ["Window ended", "warning"],
  failed: ["Failed", "negative"],
  skipped: ["Skipped", "neutral"],
  refused: ["Refused", "negative"],
};

export function runStateMeta(state) {
  const [label, tone] = RUN_STATES[state] || [String(state || "—"), "neutral"];
  return { label, cls: `rmm-pill--${tone}` };
}

// e.g. "Tue, 20 Oct 2026, 03:00 CEST" in the zone
export function formatRun(iso, timeZone) {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone,
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
      timeZoneName: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function scheduleSummary(s) {
  const at = String(s.run_time || "").slice(0, 5);
  let when;
  if (s.frequency === "once") {
    const n = (s.dates || []).length;
    when = n === 1 ? `once on ${s.dates[0]}` : `once on ${n} dates`;
  } else if (s.frequency === "daily") {
    when = "daily";
  } else if (s.frequency === "weekly") {
    when = `every ${[...(s.weekdays || [])]
      .sort((a, b) => a - b)
      .map((d) => WEEKDAYS[d])
      .join(", ")}`;
  } else if (s.month_day) {
    when = `monthly on day ${s.month_day}`;
  } else {
    const week = MONTH_WEEKS.find((w) => w.value === s.month_week);
    when = `monthly on the ${(week?.label || "").toLowerCase()} ${
      WEEKDAYS[s.month_weekday] || ""
    }`;
  }
  return `${when} at ${at}, ${s.duration} min`;
}

export function targetSummary(s) {
  const parts = [];
  const add = (n, one) => n && parts.push(`${n} ${one}${n === 1 ? "" : "s"}`);
  add((s.clients || []).length, "client");
  add((s.sites || []).length, "site");
  add((s.agents || []).length, "agent");
  return parts.join(", ") || "none";
}
