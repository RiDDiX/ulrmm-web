// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

// software vulnerabilities (GET /vulns/...): severity order, labels and
// colours, status labels, the status filters sent to the server

export type Severity = "critical" | "high" | "medium" | "low" | "unknown";
export type FindingStatus = "open" | "ignored" | "fixed";

export interface Finding {
  id: number;
  agent_id: string;
  hostname: string;
  display_name?: string | null;
  package: string;
  version: string;
  ecosystem: string;
  vuln_id: string;
  status: string;
  first_seen: string;
  last_seen: string;
  summary: string;
  // the source's own rating (Ubuntu priority, Debian urgency, ...)
  severity: string;
  // highest CVSS 3 base score
  score: number | null;
  level: string;
  fixed_in: string[];
  // the advisory lists a fixed version for this package and release
  fix_available?: boolean;
  // the version to update to, null without a fix
  fixed_version?: string | null;
  // "osv" | "msrc" | "nvd" | "vuxml"; missing on rows of an older server
  source?: string | null;
  // "linux" | "windows" | "darwin" | "freebsd"
  plat?: string | null;
}

export const SEVERITIES: Severity[] = [
  "critical",
  "high",
  "medium",
  "low",
  "unknown",
];

// the status param of /vulns/ and /vulns/<agent_id>/; "" = all
export type StatusFilter = "needs_update" | "no_fix" | "ignored" | "fixed" | "";

export const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "needs_update", label: "Needs update" },
  { value: "no_fix", label: "No fix yet" },
  { value: "ignored", label: "Ignored" },
  { value: "fixed", label: "Fixed" },
  { value: "", label: "All" },
];

export interface SeverityMeta {
  label: string;
  // dot, border and tint
  color: string;
  // text on the tint, >= 4.5:1 in both themes
  text: string;
  // filled pill: white on the badge red, 4.8:1 in both themes
  solid?: boolean;
}

const SEVERITY_META: Record<Severity, SeverityMeta> = {
  critical: {
    label: "Critical",
    color: "var(--rmm-nav-badge-bg)",
    text: "var(--rmm-nav-badge-text)",
    solid: true,
  },
  high: {
    label: "High",
    color: "var(--q-negative)",
    text: "var(--rmm-status-negative)",
  },
  medium: {
    label: "Medium",
    color: "var(--q-warning)",
    text: "var(--rmm-status-warning)",
  },
  low: {
    label: "Low",
    color: "var(--q-info)",
    text: "var(--rmm-status-info)",
  },
  unknown: {
    label: "Unknown",
    color: "var(--rmm-text-muted)",
    text: "var(--rmm-text-muted)",
  },
};

const STATUS_META: Record<FindingStatus, { label: string; tone: string }> = {
  open: { label: "Open", tone: "warning" },
  ignored: { label: "Ignored", tone: "neutral" },
  fixed: { label: "Fixed", tone: "positive" },
};

const own = (obj: object, key: unknown): key is string =>
  typeof key === "string" && Object.prototype.hasOwnProperty.call(obj, key);

export function severityOf(level: unknown): Severity {
  return own(SEVERITY_META, level) ? (level as Severity) : "unknown";
}

export function severityMeta(level: unknown): SeverityMeta {
  return SEVERITY_META[severityOf(level)];
}

// 0 = critical ... 4 = unknown, for sorting worst first
export function severityRank(level: unknown): number {
  return SEVERITIES.indexOf(severityOf(level));
}

export function statusMeta(status: unknown) {
  return own(STATUS_META, status)
    ? STATUS_META[status as FindingStatus]
    : { label: String(status || "Unknown"), tone: "neutral" };
}

export function osvUrl(id: string): string {
  return `https://osv.dev/vulnerability/${encodeURIComponent(id)}`;
}

const SOURCE_LABEL: Record<string, string> = {
  osv: "OSV.dev",
  msrc: "Microsoft MSRC",
  nvd: "NVD",
  vuxml: "FreeBSD VuXML",
};

const PLATFORM_LABEL: Record<string, string> = {
  linux: "Linux",
  windows: "Windows",
  darwin: "macOS",
  freebsd: "FreeBSD",
};

export function sourceLabel(source: unknown): string {
  return typeof source === "string" && source
    ? SOURCE_LABEL[source] || source
    : SOURCE_LABEL.osv;
}

export function platformLabel(platform: unknown): string {
  return typeof platform === "string" && platform
    ? PLATFORM_LABEL[platform] || platform
    : "";
}

// the advisory page of the source that reported the finding
export function advisoryUrl(id: string, source?: string | null): string {
  const q = encodeURIComponent(id);
  if (source === "nvd") return `https://nvd.nist.gov/vuln/detail/${q}`;
  if (source === "msrc")
    return `https://msrc.microsoft.com/update-guide/vulnerability/${q}`;
  if (source === "vuxml") return `https://vuxml.FreeBSD.org/freebsd/${q}.html`;
  return osvUrl(id);
}

// apps in the inventory that have no CPE mapping (not checked); sent by
// the device list, the fleet summary does not carry it
export function unmappedApps(data: unknown): number | null {
  const v = (data as Record<string, unknown> | null)?.unmapped;
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export function scoreText(score: unknown): string {
  return typeof score === "number" && Number.isFinite(score)
    ? score.toFixed(1)
    : "";
}

export function fixedText(fixed: unknown): string {
  return Array.isArray(fixed)
    ? fixed.filter((v) => typeof v === "string" && v).join(", ")
    : "";
}

// the "Fixed in" cell: the version to update to; "" when there is no fix
export function fixedVersion(row: Finding): string {
  if (row.fix_available === undefined) return fixedText(row.fixed_in);
  return row.fix_available ? row.fixed_version || fixedText(row.fixed_in) : "";
}

// attribution the NVD terms of use ask for wherever its data is shown
export const NVD_NOTICE =
  "This product uses data from the NVD API but is not endorsed or certified by the NVD.";
