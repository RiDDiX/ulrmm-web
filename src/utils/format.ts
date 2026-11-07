// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

import { date } from "quasar";
import builtinIcon from "@/assets/builtin_256.png";
import { validateTimePeriod } from "@/utils/validation";
import type { Agent } from "@/types/agents";
import type { CustomField, CustomFieldValue } from "@/types/core/customfields";
import type { User } from "@/types/accounts";
import type { Check } from "@/types/checks";
import { deviceName } from "@/utils/deviceName";
import type { URLAction } from "@/types/core/urlactions";
import type { Client, ClientWithSites } from "@/types/clients";
import type { Script } from "@/types/scripts";

/* eslint-disable @typescript-eslint/no-explicit-any */

// { category } rows render as group headers
export type SelectOptionCategory = { category: string };
export type OptionWithoutCategory = { label: string; value: any } & Row;
export type Option = SelectOptionCategory | OptionWithoutCategory | string;

type Row = Record<string, any>;

const byLabel = (a: { label: string }, b: { label: string }) =>
  a.label.localeCompare(b.label);

const isCategory = (opt: Option | undefined) =>
  typeof opt === "object" && "category" in opt;

// drops headers with nothing under them
export function removeExtraOptionCategories(array: Option[]) {
  return array.filter(
    (opt, i) =>
      !isCategory(opt) || (i < array.length - 1 && !isCategory(array[i + 1])),
  );
}

interface OptionShape {
  label: string;
  value?: string;
  flat?: boolean;
  unique?: boolean;
  extra?: Row;
  copy?: string[];
}

// rows -> options; flat gives only the labels
function toOptions(
  rows: Row[],
  {
    label,
    value = "id",
    flat = false,
    unique = false,
    extra = {},
    copy = [],
  }: OptionShape,
): Option[] | string[] {
  if (flat) {
    const labels: string[] = rows.map((row) => row[label]);
    return unique ? Array.from(new Set(labels)) : labels;
  }
  return rows.map((row) => {
    const opt: Row = { label: row[label], value: row[value], ...extra };
    for (const key of copy) if (Object.hasOwn(row, key)) opt[key] = row[key];
    return opt as Option;
  });
}

function grouped<T extends OptionWithoutCategory>(
  pairs: (readonly [string, T])[],
): Option[] {
  const groups = new Map<string, T[]>();
  for (const [key, entry] of pairs) {
    groups.set(key, [...(groups.get(key) ?? []), entry]);
  }
  return Array.from(groups.keys())
    .sort()
    .flatMap((key) => [{ category: key }, ...groups.get(key)!.sort(byLabel)]);
}

export function formatScriptOptions(data: Script[]): Option[] {
  return grouped(
    data.map(
      (s) =>
        [
          s.category || "Unassigned",
          {
            img_right: s.script_type === "builtin" ? builtinIcon : undefined,
            label: s.name,
            value: s.id,
            default_timeout: s.default_timeout,
            args: s.args,
            env_vars: s.env_vars,
            filename: s.filename,
            syntax: s.syntax,
            script_type: s.script_type,
            shell: s.shell,
            supported_platforms: s.supported_platforms,
            variables: s.variables || [],
          },
        ] as const,
    ),
  );
}

// grouped by "client > site"; flat gives the distinct hostnames
export function formatAgentOptions(
  agents: Agent[],
  flat = false,
  valueKey: keyof Agent = "agent_id",
): Option[] | string[] {
  if (flat) {
    return toOptions(agents, {
      label: "hostname",
      value: valueKey as string,
      flat: true,
      unique: true,
    });
  }
  return grouped(
    agents.map((agent) => {
      const cat = `${agent.client} > ${agent.site}`;
      const value = agent[valueKey] as string;
      return [cat, { label: deviceName(agent), value, cat }] as const;
    }),
  );
}

const CUSTOM_FIELD_MODELS = ["Client", "Site", "Agent"];

export function formatCustomFieldOptions(
  data: CustomField[],
  flat = false,
): Option[] {
  if (flat) return toOptions(data, { label: "name", flat: true });
  return CUSTOM_FIELD_MODELS.flatMap((cat) => [
    { category: cat, label: cat, value: cat },
    ...data
      .filter((field) => field.model === cat.toLowerCase())
      .map((field) => ({ label: field.name, value: field.id, cat }))
      .sort(byLabel),
  ]);
}

export function formatClientOptions(data: Client[], flat = false) {
  return toOptions(data, { label: "name", flat });
}

export function formatSiteOptions(data: ClientWithSites[], flat = false) {
  return data.flatMap((client) => [
    { category: client.name },
    ...toOptions(client.sites, {
      label: "name",
      flat,
      extra: { cat: client.name },
    }),
  ]) as Option[];
}

export function formatUserOptions(data: User[], flat = false) {
  return toOptions(data, { label: "username", flat });
}

export function formatCheckOptions(data: Check[], flat = false) {
  return toOptions(data, { label: "readable_desc", flat });
}

export function formatURLActionOptions(data: URLAction[], flat = false) {
  return toOptions(data, { label: "name", flat, copy: ["action_type"] });
}

const CUSTOM_FIELD_VALUE_KEY: Record<string, string> = {
  multiple: "multiple_value",
  checkbox: "bool_value",
};

export function formatCustomFields(
  fields: CustomField[],
  values: CustomFieldValue,
) {
  return fields.map((field) => ({
    [CUSTOM_FIELD_VALUE_KEY[field.type] ?? "string_value"]: values[field.name],
    field: field.id,
  }));
}

// agent status: one shape + colour + text map shared by every surface that
// renders online/offline/overdue so they cannot drift out of sync
export interface AgentStatusMeta {
  state: "positive" | "warning" | "negative" | "info" | "neutral";
  icon: string;
  label: string;
}

const AGENT_STATUS: Record<string, AgentStatusMeta> = {
  online: { state: "positive", icon: "fiber_manual_record", label: "Online" },
  // often just switched off, so no warning colour
  offline: {
    state: "neutral",
    icon: "radio_button_unchecked",
    label: "Offline",
  },
  overdue: { state: "negative", icon: "warning", label: "Overdue" },
  // a status the SPA does not recognize; neutral, and never treated as
  // reachable (a menu gating on "online" already excludes it)
  unknown: { state: "info", icon: "help_outline", label: "Unknown" },
};

export function agentStatusMeta(status?: string | null): AgentStatusMeta {
  return AGENT_STATUS[status ?? ""] ?? AGENT_STATUS.unknown;
}

// a shutdown, restart or sleep the agent announced before it went silent.
// The status stays offline (never overdue) until the agent checks in again
export interface PowerEventMeta {
  icon: string;
  // "Offline · Restarting"
  label: string;
  // "Announced 5 minutes ago by rmm: alice"
  tip: string;
}

const POWER_EVENTS: Record<string, { icon: string; label: string }> = {
  shutdown: { icon: "power_settings_new", label: "Shut down" },
  restart: { icon: "restart_alt", label: "Restarting" },
  shutdown_or_restart: {
    icon: "power_settings_new",
    label: "Shut down or restarting",
  },
  sleep: { icon: "bedtime", label: "Asleep" },
};

interface PowerRowLike {
  status?: string | null;
  planned_offline?: boolean;
  power_event?: string | null;
  power_event_at?: string | null;
  power_event_by?: string | null;
}

export function powerEventMeta(
  row?: PowerRowLike | null,
): PowerEventMeta | null {
  if (!row?.planned_offline || row.status !== "offline") return null;
  const event = POWER_EVENTS[row.power_event ?? ""];
  if (!event) return null;
  const tip = [
    "Announced",
    row.power_event_at && relativeTime(row.power_event_at),
    row.power_event_by && `by ${row.power_event_by}`,
  ]
    .filter(Boolean)
    .join(" ");
  return { icon: event.icon, label: `Offline · ${event.label}`, tip };
}

// status text for one agent row: the plain status, or the announced reason
export function agentStatusLabel(row?: PowerRowLike | null) {
  return powerEventMeta(row)?.label ?? agentStatusMeta(row?.status).label;
}

interface AgentRowLike {
  status?: string | null;
  checks?: {
    total?: number;
    failing?: number;
    warning?: number;
    info?: number;
    // checks without any result yet; older servers do not send it
    pending?: number;
  };
  has_patches_failed?: boolean;
  needs_reboot?: boolean;
  maintenance_mode?: boolean;
}

// tile, Needs attention tab, and is:needsattention. Skip maintenance
// mode; alerts for those devices are already suppressed
export function needsAttention(row: AgentRowLike): boolean {
  if (row.maintenance_mode) return false;
  return Boolean(
    (row.checks?.failing ?? 0) > 0 ||
      (row.checks?.warning ?? 0) > 0 ||
      row.has_patches_failed ||
      row.needs_reboot ||
      row.status === "overdue",
  );
}

export interface ChecksMeta {
  state: "positive" | "warning" | "negative" | "info" | "neutral";
  icon: string;
  label: string;
}

// the checks column: worst result first, N/A when nothing is configured.
// Green only once every check has a passing result
export function checksMeta(row: AgentRowLike): ChecksMeta {
  const {
    total = 0,
    failing = 0,
    warning = 0,
    info = 0,
    pending = 0,
  } = row.checks ?? {};
  if (row.maintenance_mode)
    return { state: "neutral", icon: "construction", label: "Maintenance" };
  if (failing > 0)
    return { state: "negative", icon: "cancel", label: `${failing} failing` };
  if (warning > 0)
    return {
      state: "warning",
      icon: "warning_amber",
      label: `${warning} warning`,
    };
  if (info > 0) return { state: "info", icon: "info", label: `${info} info` };
  if (total === 0) return { state: "neutral", icon: "remove", label: "N/A" };
  if (pending > 0)
    return {
      state: "neutral",
      icon: "hourglass_empty",
      label: `${pending} pending`,
    };
  return { state: "positive", icon: "check_circle", label: "Passing" };
}

export interface PlatformMeta {
  icon: string;
  label: string;
}

const PLATFORMS: Record<string, PlatformMeta> = {
  windows: { icon: "mdi-microsoft-windows", label: "Microsoft Windows" },
  linux: { icon: "mdi-linux", label: "Linux" },
  darwin: { icon: "mdi-apple", label: "macOS" },
  freebsd: { icon: "mdi-freebsd", label: "FreeBSD" },
};

export function platformMeta(plat?: string | null): PlatformMeta {
  return PLATFORMS[plat ?? ""] ?? { icon: "devices_other", label: plat || "" };
}

export interface Appliance {
  name: string;
  version: string;
}

// wmi_detail.appliance, set by the agent on TrueNAS SCALE; the appliance
// updates its own system packages
export function applianceOf(wmiDetail: unknown): Appliance | null {
  const a = (wmiDetail as { appliance?: Record<string, unknown> } | null)
    ?.appliance;
  if (!a || typeof a.name !== "string" || !a.name) return null;
  return {
    name: a.name,
    version: typeof a.version === "string" ? a.version : "",
  };
}

// CPU, memory and disk bars, chips and meters share these thresholds
export function usageLevel(
  percent?: number | null,
): "warning" | "negative" | null {
  if (percent == null || !Number.isFinite(percent)) return null;
  if (percent >= 95) return "negative";
  if (percent >= 80) return "warning";
  return null;
}

// the action menu's mesh-routed items (Take Control, VNC) reach the device
// through MeshCentral, not the RMM agent's NATS channel, so they stay usable
// while the agent itself is offline or overdue
export const MESH_OFFLINE_WARNING =
  "The RMM agent is offline. This works only while the Mesh agent is still connected.";

// an approved update that is not installed yet is either waiting for its
// install or failed on the last attempt; the server flags the two apart
export const PATCHES_PENDING_LABEL = "Approved updates waiting to install";
export const PATCHES_FAILED_LABEL =
  "An approved update failed to install on the last attempt";

// marker for an alert checkbox that is not actually editable here: forced by
// an alert template, or managed by a policy, so the reason shows in the cell
// instead of a plain disabled checkbox with no explanation
export interface AlertOverrideMeta {
  icon: string;
  tooltip: string;
}

export function alertOverrideMeta(
  templateOverride: boolean | null | undefined,
  templateName: string | null | undefined,
  policyManaged: boolean,
): AlertOverrideMeta | null {
  if (templateOverride !== null && templateOverride !== undefined) {
    return {
      icon: "bookmark",
      tooltip: `Forced by alert template: ${templateName}`,
    };
  }
  if (policyManaged) {
    return { icon: "policy", tooltip: "Managed by policy" };
  }
  return null;
}

// relative time ("3 hours ago") for status/last-seen captions; the locale is
// fixed so it never mixes non-English wording into these English sentences
// when the browser locale is not English
const relativeFormatter = new Intl.RelativeTimeFormat("en", {
  numeric: "auto",
});

export function relativeTime(value?: string | number | Date | null) {
  if (!value) return "—";
  const seconds = (new Date(value).getTime() - Date.now()) / 1000;
  if (!Number.isFinite(seconds)) return "—";
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31_536_000],
    ["month", 2_592_000],
    ["day", 86_400],
    ["hour", 3_600],
    ["minute", 60],
    ["second", 1],
  ];
  const [, unit, divisor] = units
    .map(
      ([unitName, unitSeconds]) =>
        [Math.abs(seconds) >= unitSeconds, unitName, unitSeconds] as const,
    )
    .find(([matches]) => matches) || [true, "second", 1];
  return relativeFormatter.format(Math.round(seconds / divisor), unit);
}

// [divisor in ms, unit, used while elapsed is below this many ms]
const LAPSE_STEPS: [number, string, number][] = [
  [1_000, "seconds", 60_000],
  [60_000, "minutes", 3_600_000],
  [3_600_000, "hours", 86_400_000],
  [86_400_000, "days", 2_592_000_000],
  [2_592_000_000, "months", 31_536_000_000],
  [31_536_000_000, "years", Infinity],
];

// "5 minutes ago" for an elapsed time in ms
export function elapsedText(elapsed: number) {
  const ms = Math.max(0, elapsed);
  // rounded first, so 59.6 s reads "1 minute ago" and not "60 seconds ago"
  const [divisor, unit] =
    LAPSE_STEPS.find(([d, , below]) => Math.round(ms / d) * d < below) ??
    LAPSE_STEPS[LAPSE_STEPS.length - 1];
  const n = Math.round(ms / divisor);
  return `${n} ${n === 1 ? unit.slice(0, -1) : unit} ago`;
}

// placeholder for an unknown value
export const NO_VALUE = "—";

// "3d 4h 12m" for a span in seconds, NO_VALUE when unknown
export function durationText(seconds?: number | null) {
  if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds <= 0)
    return NO_VALUE;
  if (seconds < 60) return "<1m";
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  return [days && `${days}d`, hours && `${hours}h`, `${minutes}m`]
    .filter(Boolean)
    .join(" ");
}

// uptime from a boot time in epoch seconds
export function uptimeText(bootTime?: number | null) {
  return bootTime && bootTime > 0
    ? durationText(Date.now() / 1000 - bootTime)
    : NO_VALUE;
}

export function getTimeLapse(unixtime: number) {
  const seconds =
    date.inferDateFormat(unixtime) === "string"
      ? parseInt(date.formatDate(unixtime, "X"))
      : unixtime;
  return elapsedText(Date.now() - seconds * 1000);
}

export function formatDate(
  dateString: string | number | Date,
  format = "MMM-DD-YYYY HH:mm",
) {
  return dateString ? date.formatDate(dateString, format) : "";
}

// agents check for updates at minute 35 of every hour. Returns a Date so
// callers apply the user's date format (store.getters.formatDate)
export function getNextAgentUpdateTime(): Date {
  const next = new Date();
  if (next.getMinutes() > 35) next.setHours(next.getHours() + 1);
  next.setMinutes(35);
  return next;
}

// value for <input type="datetime-local">: local "YYYY-MM-DDTHH:mm".
// noTimezone reads a UTC string as local wall time
export function formatDateInputField(
  isoDateString: string | number,
  noTimezone = false,
) {
  const value =
    noTimezone && typeof isoDateString === "string"
      ? isoDateString.replace("Z", "")
      : isoDateString;
  return date.formatDate(value, "YYYY-MM-DDTHH:mm");
}

export function formatDateStringwithTimezone(localDateString: string) {
  return date.formatDate(localDateString, "YYYY-MM-DDTHH:mm:ssZ");
}

export function capitalize(string: string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

export function formatTableColumnText(text: string) {
  return text.split("_").map(capitalize).join(" ").trim();
}

export function truncateText(txt: string, chars: number) {
  if (!txt) return;
  return txt.length < chars ? txt : `${txt.substring(0, chars)}...`;
}

const BYTE_UNITS = ["B", "KB", "MB", "GB", "TB", "PB"];

// "1.5 KB", NO_VALUE when the size is unknown
export function fmtBytes(bytes?: number | null) {
  if (typeof bytes !== "number" || !Number.isFinite(bytes) || bytes < 0)
    return NO_VALUE;
  if (bytes === 0) return "0 B";
  const exp = Math.min(
    Math.max(Math.floor(Math.log(bytes) / Math.log(1024)), 0),
    BYTE_UNITS.length - 1,
  );
  const value = bytes / 1024 ** exp;
  return `${exp ? value.toFixed(1) : Math.round(value)} ${BYTE_UNITS[exp]}`;
}

const PERIOD_UNITS: [string, number][] = [
  ["S", 1],
  ["M", 60],
  ["H", 3600],
  ["D", 86400],
];

// "3h" -> 10800, for comparing time periods
export function convertPeriodToSeconds(period: string) {
  if (!validateTimePeriod(period)) {
    console.error("Time Period is invalid");
    return 0;
  }
  const upper = period.toUpperCase();
  const unit = PERIOD_UNITS.find(([letter]) => upper.includes(letter));
  return unit ? parseInt(period.slice(0, -1)) * unit[1] : 0;
}

// 13 -> [8, 4, 1]; the task form's weekday/month selects work on these
export function convertToBitArray(number: number) {
  const digits = number.toString(2);
  const bits: number[] = [];
  digits.split("").forEach((digit, pos) => {
    if (digit !== "0") bits.push(2 ** (digits.length - 1 - pos));
  });
  return bits;
}

export function convertFromBitArray(array: number[]) {
  return array.reduce((sum, bit) => sum + bit, 0);
}

export function convertCamelCase(str: string) {
  const spaced = str.replace(/[^a-zA-Z0-9]+/g, " ");
  const cased = spaced.replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) =>
    index === 0 ? word.toLowerCase() : word.toUpperCase(),
  );
  return cased.replace(/\s+/g, "");
}
