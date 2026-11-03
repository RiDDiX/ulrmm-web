// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

// software baselines and the detection rules of catalog packages; shapes as
// the server sends them

export type Plat = "windows" | "linux" | "darwin";
export type BaselineSource = "winget" | "choco" | "package" | "linux_pkg";
export type ItemStatus =
  | "pending"
  | "installing"
  | "installed"
  | "failed"
  | "unsupported";

export type Detection =
  | { type: "inventory"; name: string; version_min?: string }
  | { type: "file"; path: string; version_min?: string }
  | { type: "registry"; key: string; value?: string; version_min?: string }
  | { type: "none" };
export type DetectionType = Detection["type"];

export interface BaselineItem {
  id?: number;
  order?: number;
  source: BaselineSource;
  ref: string;
  name: string;
  // null: the default rule of the source
  detection: Detection | null;
  required?: boolean;
  timeout?: number;
}

export interface Baseline {
  id: number;
  name: string;
  description: string;
  plat: Plat;
  enabled: boolean;
  policies: number[];
  deployments: number[];
  items: BaselineItem[];
}

export interface ItemState {
  status: ItemStatus;
  attempts?: number;
  started_at?: string | null;
  verified_at?: string | null;
  detected_version?: string;
  detail?: string;
  updated?: string | null;
}

export type AgentBaselineRow = BaselineItem & {
  baseline_name?: string;
  state: ItemState | null;
};

export const PLAT_OPTIONS: { value: Plat; label: string }[] = [
  { value: "windows", label: "Windows" },
  { value: "linux", label: "Linux" },
  { value: "darwin", label: "macOS" },
];

export const SOURCE_META: Record<
  BaselineSource,
  { label: string; plats: Plat[]; defaultRule: string }
> = {
  winget: {
    label: "winget",
    plats: ["windows"],
    defaultRule: "installed software list, matched by the catalog name",
  },
  choco: {
    label: "Chocolatey",
    plats: ["windows"],
    defaultRule: "installed software list, matched by the package name",
  },
  package: {
    label: "Hosted package",
    plats: ["windows", "linux", "darwin"],
    defaultRule: "the rule of the package, or the exit code when it has none",
  },
  linux_pkg: {
    label: "Linux package",
    plats: ["linux"],
    defaultRule: "installed package list, matched by the exact name",
  },
};

export function sourcesFor(plat: Plat): BaselineSource[] {
  return (Object.keys(SOURCE_META) as BaselineSource[]).filter((s) =>
    SOURCE_META[s].plats.includes(plat),
  );
}

export const STATUS_META: Record<
  ItemStatus,
  { label: string; cls: string; tip: string }
> = {
  pending: {
    label: "Pending",
    cls: "rmm-pill--neutral",
    tip: "Waiting for the agent to be online and its turn",
  },
  installing: {
    label: "Installing",
    cls: "rmm-pill--info",
    tip: "The install runs; detection checks it afterwards",
  },
  installed: {
    label: "Installed",
    cls: "rmm-pill--positive",
    tip: "Detection found it on the device",
  },
  failed: {
    label: "Failed",
    cls: "rmm-pill--negative",
    tip: "The install or the detection failed; see the detail",
  },
  unsupported: {
    label: "Unsupported",
    cls: "rmm-pill--neutral",
    tip: "This item cannot run on this device",
  },
};

export function statusMeta(status: string) {
  return (
    STATUS_META[status as ItemStatus] ?? { label: status, cls: "", tip: "" }
  );
}

export const DETECTION_LABELS: Record<DetectionType, string> = {
  inventory: "Installed software list",
  file: "File",
  registry: "Registry value",
  none: "Exit code only",
};

// debian, rpm and arch package names
export const LINUX_PKG_RE = /^[a-zA-Z0-9][a-zA-Z0-9.+_@:-]*$/;

const trimmed = (v: unknown) => (typeof v === "string" ? v.trim() : "");

// trims the fields, drops empty optional ones and anything of another type
export function cleanDetection(d: Detection | null): Detection | null {
  if (!d) return null;
  const version = trimmed((d as { version_min?: string }).version_min);
  const opt = version ? { version_min: version } : {};
  switch (d.type) {
    case "inventory":
      return { type: "inventory", name: trimmed(d.name), ...opt };
    case "file":
      return { type: "file", path: trimmed(d.path), ...opt };
    case "registry": {
      const value = trimmed(d.value);
      return {
        type: "registry",
        key: trimmed(d.key),
        ...(value ? { value } : {}),
        ...opt,
      };
    }
    default:
      return { type: "none" };
  }
}

export function detectionSummary(d: Detection | null): string {
  if (!d) return "Default";
  const min = "version_min" in d && d.version_min ? ` ≥ ${d.version_min}` : "";
  switch (d.type) {
    case "inventory":
      return `Software list: ${d.name}${min}`;
    case "file":
      return `File: ${d.path}${min}`;
    case "registry":
      return `Registry: ${d.key}${d.value ? ` › ${d.value}` : ""}${min}`;
    default:
      return DETECTION_LABELS.none;
  }
}

// list order is the install order; local keys stay out
export function itemsPayload(items: BaselineItem[]): BaselineItem[] {
  return items.map((item, order) => {
    const out: BaselineItem = {
      source: item.source,
      ref: item.ref.trim(),
      name: item.name.trim() || item.ref.trim(),
      detection: cleanDetection(item.detection),
      order,
    };
    if (item.id !== undefined) out.id = item.id;
    if (item.required !== undefined) out.required = item.required;
    if (item.timeout !== undefined) out.timeout = item.timeout;
    return out;
  });
}

// the device view: items with their state inline, or a states list keyed
// by item id
export function agentBaselineRows(reply: unknown): AgentBaselineRow[] {
  const body = (reply ?? {}) as {
    items?: (BaselineItem & {
      state?: ItemState | null;
      status?: ItemStatus;
    })[];
    states?: (ItemState & { item: number })[];
  };
  const states = new Map((body.states ?? []).map((s) => [s.item, s]));
  return (body.items ?? []).map((item) => ({
    ...item,
    state:
      item.state ??
      (item.id !== undefined ? states.get(item.id) : undefined) ??
      (item.status ? (item as ItemState) : null),
  }));
}

export function countByStatus(statuses: (string | undefined)[]) {
  const counts: Record<string, number> = {};
  for (const s of statuses) {
    const key = s ?? "pending";
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}
