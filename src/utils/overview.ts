// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

// overview page (GET/PUT /dashboard/layout/, GET /dashboard/widgets/<type>/):
// widget types, settings rules, layout checks, and the edits the page makes

import { TIMELINE_TYPES } from "@/utils/timeline";

export type WidgetSize = "s" | "m" | "l";

export interface Widget {
  id: string;
  type: string;
  size: WidgetSize;
  settings: Record<string, unknown>;
}

export const MAX_WIDGETS = 24;
export const SIZES: WidgetSize[] = ["s", "m", "l"];
export const SIZE_LABELS: Record<WidgetSize, string> = {
  s: "Small",
  m: "Medium",
  l: "Large",
};

const METRIC_RANGES = ["1h", "6h", "24h", "7d", "30d"];
export const RANGE_LABELS: Record<string, string> = {
  "1h": "Last hour",
  "6h": "Last 6 hours",
  "24h": "Last 24 hours",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
};
// sorted like the server's choices
const ACTIVITY_TYPES = Object.keys(TIMELINE_TYPES).sort();
const MAX_GROUPS = 20;
const MAX_CLIENTS = 200;
const NOTE_MAX = 2000;

export type SettingField =
  | {
      key: string;
      label: string;
      kind: "int";
      min: number;
      max: number;
      default: number;
    }
  | {
      key: string;
      label: string;
      kind: "choice";
      choices: string[];
      default: string;
    }
  // list of choices, empty = all
  | { key: string; label: string; kind: "choices"; choices: string[] }
  // list of positive ids, duplicates dropped; source = where the names are
  | {
      key: string;
      label: string;
      kind: "ids";
      max: number;
      source: "groups" | "clients";
    }
  | { key: string; label: string; kind: "text"; max: number };

export interface WidgetMeta {
  label: string;
  description: string;
  icon: string;
  size: WidgetSize;
  settings: SettingField[];
}

const TOP_SETTINGS: SettingField[] = [
  {
    key: "range",
    label: "Time range",
    kind: "choice",
    choices: METRIC_RANGES,
    default: "24h",
  },
  {
    key: "limit",
    label: "Devices shown",
    kind: "int",
    min: 1,
    max: 50,
    default: 10,
  },
];

export const CATALOGUE: Record<string, WidgetMeta> = {
  fleet: {
    label: "Fleet",
    description: "Devices by status, type and platform.",
    icon: "devices",
    size: "m",
    settings: [],
  },
  alerts: {
    label: "Alerts",
    description: "Open alerts by severity and the ten latest.",
    icon: "notifications_none",
    size: "m",
    settings: [],
  },
  offline: {
    label: "Offline devices",
    description: "Devices that are offline or overdue, last seen first.",
    icon: "portable_wifi_off",
    size: "m",
    settings: [],
  },
  patches: {
    label: "Patches",
    description: "Approved updates waiting to install, and failed ones.",
    icon: "system_update",
    size: "s",
    settings: [],
  },
  checks: {
    label: "Failing checks",
    description: "Checks failing right now, with their devices.",
    icon: "rule",
    size: "m",
    settings: [],
  },
  activity: {
    label: "Activity",
    description: "Script runs, alerts, patches and more across the fleet.",
    icon: "history",
    size: "l",
    settings: [
      {
        key: "limit",
        label: "Entries shown",
        kind: "int",
        min: 1,
        max: 50,
        default: 20,
      },
      {
        key: "types",
        label: "Types",
        kind: "choices",
        choices: ACTIVITY_TYPES,
      },
    ],
  },
  vulns: {
    label: "Vulnerabilities",
    description:
      "Vulnerabilities with an available update by severity, and how many have no fix yet.",
    icon: "gpp_maybe",
    size: "s",
    settings: [],
  },
  netmon: {
    label: "Network devices",
    description: "Network device states and the devices with problems.",
    icon: "lan",
    size: "m",
    settings: [],
  },
  top_cpu: {
    label: "Top CPU",
    description: "Devices with the highest average CPU load.",
    icon: "speed",
    size: "m",
    settings: TOP_SETTINGS,
  },
  top_mem: {
    label: "Top memory",
    description: "Devices with the highest average memory use.",
    icon: "memory",
    size: "m",
    settings: TOP_SETTINGS,
  },
  discovery: {
    label: "Network discovery",
    description: "Devices found by network scans, and the last scan.",
    icon: "travel_explore",
    size: "s",
    settings: [],
  },
  groups: {
    label: "Device groups",
    description: "Members and offline devices per device group.",
    icon: "workspaces",
    size: "m",
    settings: [
      {
        key: "group_ids",
        label: "Groups",
        kind: "ids",
        max: MAX_GROUPS,
        source: "groups",
      },
    ],
  },
  encryption: {
    label: "Disk encryption",
    description: "Encrypted devices and escrowed recovery keys.",
    icon: "lock",
    size: "s",
    settings: [],
  },
  actions: {
    label: "Actions",
    description: "Pending actions and the ones completed in the last 24 hours.",
    icon: "pending_actions",
    size: "m",
    settings: [
      {
        key: "client_ids",
        label: "Clients",
        kind: "ids",
        max: MAX_CLIENTS,
        source: "clients",
      },
      {
        key: "limit",
        label: "Rows per list",
        kind: "int",
        min: 1,
        max: 50,
        default: 10,
      },
    ],
  },
  notes: {
    label: "Notes",
    description: "Your own text, kept with this layout.",
    icon: "sticky_note_2",
    size: "s",
    settings: [{ key: "text", label: "Text", kind: "text", max: NOTE_MAX }],
  },
};

export const WIDGET_TYPES = Object.keys(CATALOGUE);

// the server's default, the same ids
const DEFAULT: [string, string, WidgetSize][] = [
  ["be765a48-3e3a-4b24-afd3-dffc5f030fd4", "fleet", "m"],
  ["c12ffc27-6cc1-4c74-8f3e-d12f85c2c67b", "alerts", "m"],
  ["eb25ec6b-57a5-4660-b5ea-fe0eddc1afb2", "offline", "m"],
  ["a28b2adb-909c-497e-b084-47ab89c4f2cc", "patches", "s"],
  ["d6a7fec9-6c59-4817-ba8e-ad62b901286e", "activity", "l"],
];

const own = (obj: object, key: unknown): key is string =>
  typeof key === "string" && Object.prototype.hasOwnProperty.call(obj, key);

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

export function widgetMeta(type: string): WidgetMeta | null {
  return own(CATALOGUE, type) ? CATALOGUE[type] : null;
}

export function hasSettings(type: string): boolean {
  return Boolean(widgetMeta(type)?.settings.length);
}

// getRandomValues works on plain http too, randomUUID does not
function newId(): string {
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

function toInt(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value === "string" && /^\s*-?\d+\s*$/.test(value))
    return Number(value);
  return null;
}

function intError(value: unknown, min: number, max?: number): string | null {
  const n = toInt(value);
  if (n === null) return "A valid integer is required.";
  if (n < min) return `Ensure this value is greater than or equal to ${min}.`;
  if (max !== undefined && n > max)
    return `Ensure this value is less than or equal to ${max}.`;
  return null;
}

function cleanField(field: SettingField, value: unknown): unknown {
  switch (field.kind) {
    case "int": {
      const error = intError(value, field.min, field.max);
      if (error) throw new Error(error);
      return toInt(value);
    }
    case "choice":
      if (typeof value !== "string" || !field.choices.includes(value))
        throw new Error(`"${String(value)}" is not a valid choice.`);
      return value;
    case "choices":
    case "ids": {
      if (!Array.isArray(value))
        throw new Error(
          `Expected a list of items but got type "${typeof value}".`,
        );
      const max = field.kind === "ids" ? field.max : field.choices.length;
      if (value.length > max)
        throw new Error(`Ensure this field has no more than ${max} elements.`);
      value.forEach((item, i) => {
        const error =
          field.kind === "ids"
            ? intError(item, 1)
            : typeof item === "string" && field.choices.includes(item)
              ? null
              : `"${String(item)}" is not a valid choice.`;
        if (error) throw new Error(`${i}: ${error}`);
      });
      return field.kind === "ids"
        ? [...new Set(value.map((item) => toInt(item) as number))]
        : [...value];
    }
    case "text":
      if (typeof value !== "string") throw new Error("Not a valid string.");
      // code points, as the server counts
      if (Array.from(value).length > field.max)
        throw new Error(
          `Ensure this field has no more than ${field.max} characters.`,
        );
      return value;
  }
}

function fieldDefault(field: SettingField): unknown {
  if (field.kind === "int" || field.kind === "choice") return field.default;
  if (field.kind === "text") return "";
  return [];
}

// the stored settings of a widget with defaults filled in; throws the
// server's wording ("limit: Ensure this value ...")
export function cleanSettings(
  type: string,
  data: unknown = {},
): Record<string, unknown> {
  const fields = widgetMeta(type)?.settings ?? [];
  if (!isObject(data)) throw new Error("settings must be an object");
  const unknown = Object.keys(data)
    .filter((key) => !fields.some((f) => f.key === key))
    .sort();
  if (unknown.length)
    throw new Error(`unknown settings: ${unknown.join(", ")}`);
  const out: Record<string, unknown> = {};
  const errors: string[] = [];
  for (const field of fields) {
    try {
      out[field.key] = own(data, field.key)
        ? cleanField(field, data[field.key])
        : fieldDefault(field);
    } catch (e) {
      errors.push(`${field.key}: ${(e as Error).message}`);
    }
  }
  if (errors.length) throw new Error(errors.join("; "));
  return out;
}

export function settingsError(type: string, data: unknown): string | null {
  try {
    cleanSettings(type, data);
    return null;
  } catch (e) {
    return (e as Error).message;
  }
}

export function defaultLayout(): Widget[] {
  return DEFAULT.map(([id, type, size]) => ({
    id,
    type,
    size,
    settings: cleanSettings(type),
  }));
}

export function addWidget(
  widgets: Widget[],
  type: string,
  id = newId(),
): Widget[] {
  const meta = widgetMeta(type);
  if (!meta || widgets.length >= MAX_WIDGETS) return widgets;
  return [
    ...widgets,
    { id, type, size: meta.size, settings: cleanSettings(type) },
  ];
}

export function removeWidget(widgets: Widget[], id: string): Widget[] {
  return widgets.filter((w) => w.id !== id);
}

export type MoveTarget = "first" | "left" | "right" | "last";

export function moveWidget(
  widgets: Widget[],
  id: string,
  where: MoveTarget,
): Widget[] {
  const from = widgets.findIndex((w) => w.id === id);
  if (from < 0) return widgets;
  const last = widgets.length - 1;
  const to = {
    first: 0,
    left: Math.max(0, from - 1),
    right: Math.min(last, from + 1),
    last,
  }[where];
  if (to === from) return widgets;
  const next = [...widgets];
  next.splice(to, 0, ...next.splice(from, 1));
  return next;
}

export function resizeWidget(
  widgets: Widget[],
  id: string,
  size: WidgetSize,
): Widget[] {
  return widgets.map((w) => (w.id === id ? { ...w, size } : w));
}

export function setSettings(
  widgets: Widget[],
  id: string,
  settings: Record<string, unknown>,
): Widget[] {
  return widgets.map((w) => (w.id === id ? { ...w, settings } : w));
}

// GET /dashboard/widgets/<type>/ query: lists comma separated, empty
// lists left out (the server's default)
export function widgetParams(
  settings: Record<string, unknown>,
): Record<string, string> {
  const params: Record<string, string> = {};
  for (const [key, value] of Object.entries(settings || {})) {
    if (Array.isArray(value)) {
      if (value.length) params[key] = value.join(",");
    } else if (value !== null && value !== undefined) {
      params[key] = String(value);
    }
  }
  return params;
}

// the message of a rejected request: the server answers validation errors
// with a plain string, DRF errors with {detail}
export function errorMessage(error: unknown): string {
  const response = (error as { response?: { data?: unknown } })?.response;
  if (!response) return "The server could not be reached.";
  const data = response.data;
  if (typeof data === "string" && data) return data;
  if (isObject(data)) {
    const first = own(data, "detail") ? data.detail : Object.values(data)[0];
    if (Array.isArray(first)) return String(first[0]);
    if (first !== undefined) return String(first);
  }
  return "The request failed.";
}

const counter = new Intl.NumberFormat("en");
const compact = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 1,
});

export function formatCount(value: unknown): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return Math.abs(value) >= 100_000
    ? compact.format(value)
    : counter.format(value);
}

// dot colours of stat tiles and list rows; text keeps the text tokens
export const STATE_DOT: Record<string, string> = {
  positive: "var(--rmm-status-positive)",
  warning: "var(--rmm-dot-warning)",
  negative: "var(--rmm-status-negative)",
  info: "var(--rmm-status-info)",
  neutral: "var(--rmm-text-subtle)",
};

// alerts and checks use error | warning | info
export function alertState(severity: unknown): string {
  if (severity === "error") return "negative";
  if (severity === "warning") return "warning";
  return "info";
}

export function alertLabel(severity: unknown): string {
  if (severity === "error") return "Error";
  if (severity === "warning") return "Warning";
  if (severity === "info") return "Info";
  return String(severity || "Unknown");
}
