// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

// Wording and next-run estimate for a WinUpdatePolicy schedule. Shares the
// backend's own weekday convention (0 = Monday ... 6 = Sunday, see the
// comment in winupdate/models.py and the check in winupdate/tasks.py) so the
// patch policy form, the automation table and the device patch tab never
// describe a schedule differently than the scheduler itself.
import { scheduledTimes } from "@/mixins/data";

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function weekdaysToLabel(days: number[] | null | undefined): string {
  if (!days || days.length === 0) return "no days selected";
  return [...days]
    .filter((d) => d >= 0 && d <= 6)
    .sort((a, b) => a - b)
    .map((d) => WEEKDAY_LABELS[d])
    .join(", ");
}

export function hourLabel(hour: number): string {
  return scheduledTimes.find((t) => t.value === hour)?.label ?? `${hour}:00`;
}

export interface EffectivePatchPolicy {
  run_time_frequency: string; // "daily" | "monthly" | "inherit"
  run_time_days: number[];
  run_time_day: number;
  run_time_hour: number;
}

// A plain-language sentence for what the scheduler will actually do.
export function scheduleSummary(
  policy: EffectivePatchPolicy | null | undefined,
): string {
  if (!policy || policy.run_time_frequency === "inherit") {
    return "Not configured";
  }
  const hour = hourLabel(policy.run_time_hour);
  if (policy.run_time_frequency === "daily") {
    if (!policy.run_time_days || policy.run_time_days.length === 0) {
      return "Never (no days selected)";
    }
    return `Installs ${weekdaysToLabel(policy.run_time_days)} at ${hour}, device time zone (as set in the RMM)`;
  }
  if (policy.run_time_frequency === "monthly") {
    return `Installs on day ${policy.run_time_day} of every month at ${hour}, device time zone (as set in the RMM)`;
  }
  return "Not configured";
}

function zonedParts(instant: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).formatToParts(instant);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return {
    weekday: get("weekday"),
    day: parseInt(get("day"), 10),
    month: get("month"),
    year: parseInt(get("year"), 10),
  };
}

function zonedHour(instant: Date, timeZone: string): number {
  return parseInt(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "numeric",
      hourCycle: "h23",
    }).format(instant),
    10,
  );
}

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

// The day the scheduler really uses: winupdate/tasks.py runs a day the month
// does not have on that month's last day.
function serverRunDay(day: number, year: number, month: string): number {
  const daysInMonth = new Date(
    Date.UTC(year, MONTH_LABELS.indexOf(month) + 1, 0),
  ).getUTCDate();
  return Math.min(day, daysInMonth);
}

// Walks calendar days in the agent's zone instead of doing full
// zoned-arithmetic (DST-correct instants); good enough for an informational
// "next scheduled install" label, not for firing the install itself.
// The label leaves the zone out; the caller states it next to the label.
export function nextScheduledInstallLabel(
  policy: EffectivePatchPolicy | null | undefined,
  timeZone: string,
): string | null {
  if (!policy || policy.run_time_frequency === "inherit") return null;
  if (
    policy.run_time_frequency === "daily" &&
    (!policy.run_time_days || policy.run_time_days.length === 0)
  ) {
    return null;
  }
  if (
    policy.run_time_frequency !== "daily" &&
    policy.run_time_frequency !== "monthly"
  ) {
    return null;
  }

  const now = new Date();
  // Intl throws a RangeError for a zone the browser does not know (or a
  // missing one); an informational label must not take its panel down
  try {
    const today = zonedParts(now, timeZone);
    const month = MONTH_LABELS.indexOf(today.month);
    for (let i = 0; i <= 35; i++) {
      // step calendar days of the agent's zone: 24 h steps skip a day on a
      // DST night; read back in UTC so a zone beyond +-12 h cannot shift it
      const candidate = new Date(
        Date.UTC(today.year, month, today.day + i, 12),
      );
      const parts = zonedParts(candidate, "UTC");
      const matches =
        policy.run_time_frequency === "daily"
          ? policy.run_time_days.includes(WEEKDAY_LABELS.indexOf(parts.weekday))
          : parts.day ===
            serverRunDay(policy.run_time_day, parts.year, parts.month);
      if (!matches) continue;
      if (i === 0 && zonedHour(now, timeZone) >= policy.run_time_hour) continue;
      return `${parts.weekday} ${parts.month} ${parts.day}, ${hourLabel(policy.run_time_hour)}`;
    }
  } catch (e) {
    console.error(e);
  }
  return null;
}

export interface WinUpdatePolicyLike extends EffectivePatchPolicy {
  critical: string;
  important: string;
  moderate: string;
  low: string;
  other: string;
  reboot_after_install: string;
}

const SEVERITY_KEYS: [keyof WinUpdatePolicyLike, string][] = [
  ["critical", "Crit"],
  ["important", "Imp"],
  ["moderate", "Mod"],
  ["low", "Low"],
  ["other", "Other"],
];

export function autoApproveSummary(policy: WinUpdatePolicyLike): string {
  const approved = SEVERITY_KEYS.filter(
    ([key]) => policy[key] === "approve",
  ).map(([, label]) => label);
  return approved.length
    ? `${approved.join("/")} auto-approve`
    : "No auto-approval";
}

export function rebootSummary(rebootAfterInstall: string): string {
  if (rebootAfterInstall === "always") return "reboot always";
  if (rebootAfterInstall === "required") return "reboot when required";
  if (rebootAfterInstall === "never") return "no auto-reboot";
  return "";
}

// Full "what this policy does" sentence - long enough that the Automation
// Manager table now uses it only as a tooltip, see policySummaryCompact.
export function policySummary(
  policy: WinUpdatePolicyLike | null | undefined,
): string {
  if (!policy) return "None";
  const parts = [autoApproveSummary(policy), scheduleSummary(policy)];
  const reboot = rebootSummary(policy.reboot_after_install);
  if (reboot) parts.push(reboot);
  return parts.join(" - ");
}

// Short "Daily 3 AM · auto: Crit/Imp" label for a table cell that has no
// room for the full sentence above; that sentence is this label's tooltip
// instead.
export function policySummaryCompact(
  policy: WinUpdatePolicyLike | null | undefined,
): string {
  if (!policy) return "Create patch policy";
  const approved = SEVERITY_KEYS.filter(
    ([key]) => policy[key] === "approve",
  ).map(([, label]) => label);
  const auto =
    approved.length === SEVERITY_KEYS.length
      ? "auto: all"
      : approved.length
        ? `auto: ${approved.join("/")}`
        : "no auto-approval";
  if (
    policy.run_time_frequency !== "daily" &&
    policy.run_time_frequency !== "monthly"
  ) {
    return `Not scheduled · ${auto}`;
  }
  const frequency = policy.run_time_frequency === "daily" ? "Daily" : "Monthly";
  return `${frequency} ${hourLabel(policy.run_time_hour)} · ${auto}`;
}
