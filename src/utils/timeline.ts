// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

// per-device timeline (GET /timeline/<agent_id>/): type labels and icons,
// where an item's source is shown, grouping by local day

export interface TimelineRef {
  kind: string;
  id: number | string | null;
}

export interface TimelineItem {
  ts: string;
  type: string;
  title: string;
  detail: string;
  user: string;
  severity: string;
  ref?: TimelineRef | null;
}

export interface TypeMeta {
  label: string;
  icon: string;
}

export const TIMELINE_TYPES: Record<string, TypeMeta> = {
  script: { label: "Script", icon: "description" },
  command: { label: "Command", icon: "terminal" },
  task: { label: "Task", icon: "task" },
  alert: { label: "Alert", icon: "notifications" },
  patch: { label: "Patch", icon: "system_update" },
  schedule: { label: "Schedule", icon: "event_repeat" },
  app_update: { label: "App update", icon: "system_update_alt" },
  package: { label: "Package", icon: "install_desktop" },
  pending: { label: "Pending action", icon: "pending_actions" },
  audit: { label: "Audit", icon: "travel_explore" },
  debug: { label: "Debug", icon: "bug_report" },
};

const own = (obj: object, key: string) =>
  Object.prototype.hasOwnProperty.call(obj, key);

export function typeMeta(type: string): TypeMeta {
  return own(TIMELINE_TYPES, type)
    ? TIMELINE_TYPES[type]
    : { label: type || "Other", icon: "radio_button_unchecked" };
}

// alerts and the merged sources use info | warning | error
export function severityState(severity: string): "negative" | "warning" | null {
  if (severity === "error") return "negative";
  if (severity === "warning") return "warning";
  return null;
}

// the device page tab or dialog that shows an item's source; kinds without
// one (or unknown kinds) get no link
export type RefTarget =
  | { tab: string }
  | { dialog: "alerts" | "pending" | "packages" };

const REF_TARGETS: Record<string, RefTarget> = {
  history: { tab: "history" },
  audit: { tab: "audit" },
  debuglog: { tab: "debug" },
  patch: { tab: "patches" },
  schedulerun: { tab: "overview" },
  alert: { dialog: "alerts" },
  pendingaction: { dialog: "pending" },
  packageinstall: { dialog: "packages" },
};

export function refTarget(ref?: TimelineRef | null): RefTarget | null {
  const kind = ref?.kind;
  return typeof kind === "string" && own(REF_TARGETS, kind)
    ? REF_TARGETS[kind]
    : null;
}

function countByType(items: TimelineItem[]): Record<string, number> {
  const counts: Record<string, number> = Object.create(null);
  for (const item of items) counts[item.type] = (counts[item.type] || 0) + 1;
  return counts;
}

// known types in display order, then any type the server added since
export function typeOptions(items: TimelineItem[], selected: string[] = []) {
  const counts = countByType(items);
  const types = [
    ...Object.keys(TIMELINE_TYPES),
    ...Object.keys(counts).filter((t) => !own(TIMELINE_TYPES, t)),
  ];
  return types
    .filter((type) => counts[type] || selected.includes(type))
    .map((type) => ({ type, count: counts[type] || 0, ...typeMeta(type) }));
}

function dayKey(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function dayLabel(d: Date, now = new Date()): string {
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const key = dayKey(d);
  if (key === dayKey(now)) return "Today";
  if (key === dayKey(yesterday)) return "Yesterday";
  try {
    return d.toLocaleDateString(undefined, {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return key;
  }
}

export interface DayGroup {
  key: string;
  label: string;
  items: TimelineItem[];
}

// items come newest first, the groups keep that order (local days)
export function groupByDay(
  items: TimelineItem[],
  now = new Date(),
): DayGroup[] {
  const groups = new Map<string, DayGroup>();
  for (const item of items) {
    const d = new Date(item.ts);
    const valid = !Number.isNaN(d.getTime());
    const key = valid ? dayKey(d) : "unknown";
    let group = groups.get(key);
    if (!group) {
      group = {
        key,
        label: valid ? dayLabel(d, now) : "Unknown date",
        items: [],
      };
      groups.set(key, group);
    }
    group.items.push(item);
  }
  return [...groups.values()];
}
