// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

import type {
  Deployment,
  FieldChoice,
  FieldValue,
  Matrix,
  MonType,
  RenderedFile,
  Target,
} from "@/api/deploy";

// scope

export interface ScopeState {
  mode: "new" | "existing";
  existing: number | null;
  client: number | null;
  site: number | null;
  name: string;
  agenttype: MonType;
  policy: number | null;
  // enrollment limit as typed; "" = no limit
  maxEnrollments: string;
  // hours; 0 = the custom date
  ttl: number;
  custom: string;
  rdp: boolean;
  ping: boolean;
  power: boolean;
  baselines: number[];
}

const HOUR = 3_600_000;
const MAX_TTL_HOURS = 24 * 365;
// the server measures the 365 days on its own clock
const CLOCK_MARGIN = 10 * 60_000;
const MAX_TTL = MAX_TTL_HOURS * HOUR - CLOCK_MARGIN;

export const TTL_CHOICES = [
  { label: "1 hour", value: 1 },
  { label: "24 hours", value: 24 },
  { label: "7 days", value: 24 * 7 },
  { label: "30 days", value: 24 * 30 },
  { label: "90 days", value: 24 * 90 },
  { label: "180 days", value: 24 * 180 },
  { label: "365 days", value: MAX_TTL_HOURS },
  { label: "Custom date", value: 0 },
];

export function expiryFromHours(hours: number, now = Date.now()): Date {
  return new Date(now + Math.min(hours * HOUR, MAX_TTL));
}

// "%Y-%m-%dT%H:%M:%S%z" in UTC, the format POST /clients/deployments/ parses
export function expiryParam(date: Date): string {
  return date.toISOString().replace(/\.\d+Z$/, "+0000");
}

// a datetime-local value (local time); "" when it can be the expiry
export function customExpiryError(value: string, now = Date.now()): string {
  if (!value) return "Pick a date and time";
  const at = new Date(value).getTime();
  if (Number.isNaN(at)) return "Not a valid date";
  if (at <= now) return "The date must lie in the future";
  if (at - now > MAX_TTL)
    return "A deployment link can be valid for 365 days at most";
  return "";
}

// "YYYY-MM-DDTHH:mm" in local time, for datetime-local min and max
export function localInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  return `${day}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// what Python's str.isprintable() accepts: no control, format or separator
// characters except the plain space
const PRINTABLE = /^(?:[^\p{C}\p{Z}]| )*$/u;

export function nameError(name: string): string {
  if (name.length > 100) return "100 characters at most";
  if (!PRINTABLE.test(name)) return "Only printable characters";
  return "";
}

const MAX_ENROLLMENTS = 100_000;

// "" when the field can be sent; empty means no limit
export function maxEnrollmentsError(value: string | number | null): string {
  const text = String(value ?? "").trim();
  if (!text) return "";
  if (!/^\d+$/.test(text)) return "A whole number";
  const n = Number(text);
  if (n < 1 || n > MAX_ENROLLMENTS)
    return `Between 1 and ${MAX_ENROLLMENTS.toLocaleString("en-US")}`;
  return "";
}

export function maxEnrollmentsParam(value: string | number | null) {
  const text = String(value ?? "").trim();
  return text ? Number(text) : null;
}

// "3 / 10", "3 / no limit"; "" from servers that do not count
export function enrollmentsText(
  deployment: Pick<Deployment, "enrollments" | "max_enrollments">,
): string {
  if (deployment.enrollments == null) return "";
  const limit = deployment.max_enrollments ?? "no limit";
  return `${deployment.enrollments} / ${limit}`;
}

export function enrollmentLimitReached(
  deployment: Pick<Deployment, "enrollments" | "max_enrollments">,
): boolean {
  return (
    deployment.max_enrollments != null &&
    (deployment.enrollments ?? 0) >= deployment.max_enrollments
  );
}

export function isExpired(
  deployment: Pick<Deployment, "expiry">,
  now = Date.now(),
): boolean {
  return !!deployment.expiry && new Date(deployment.expiry).getTime() <= now;
}

export function deploymentLabel(deployment: Deployment): string {
  const where = `${deployment.client_name} / ${deployment.site_name}`;
  return deployment.name ? `${deployment.name} (${where})` : where;
}

// target

export interface TargetState {
  // "inst:<fmt>", "os:<group>" or "" before the first pick
  choice: string;
  // installer architecture; "" lets the shell script pick by uname -m
  arch: string;
  // OS image target id
  target: string;
}

export interface TargetGroup {
  group: string;
  family: string;
  targets: Target[];
}

// in matrix order
export function groupTargets(targets: Target[]): TargetGroup[] {
  const groups = new Map<string, TargetGroup>();
  for (const target of targets) {
    const entry = groups.get(target.group);
    if (entry) entry.targets.push(target);
    else
      groups.set(target.group, {
        group: target.group,
        family: target.family,
        targets: [target],
      });
  }
  return [...groups.values()];
}

const GROUP_LABELS: Record<string, string> = {
  win10: "Windows 10",
  win11: "Windows 11",
  server2019: "Windows Server 2019",
  server2022: "Windows Server 2022",
  server2025: "Windows Server 2025",
  ubuntu: "Ubuntu",
  debian: "Debian",
  rhel: "RHEL",
  rocky: "Rocky Linux",
  alma: "AlmaLinux",
  fedora: "Fedora",
  sles: "SUSE Linux Enterprise",
  leap: "openSUSE Leap",
  arch: "Arch Linux",
  cachyos: "CachyOS",
  endeavouros: "EndeavourOS",
  batocera: "Batocera",
};

export const groupLabel = (group: string) =>
  GROUP_LABELS[group] ?? humanize(group);

// "Windows 11 Pro" in group win11 -> "Pro"
export function editionLabel(target: Target): string {
  const prefix = `${groupLabel(target.group)} `;
  return target.label.startsWith(prefix) && target.label.length > prefix.length
    ? target.label.slice(prefix.length)
    : target.label;
}

export interface ReleaseBadge {
  text: string;
  tone: "neutral" | "warning" | "negative";
}

// one badge per edition chip; LTS only when the label does not say it already
export function releaseBadge(target: Target): ReleaseBadge | null {
  const release = target.release;
  if (!release) return null;
  if (release.status === "eol")
    return {
      text: release.eol ? `EOL ${release.eol.slice(0, 7)}` : "EOL",
      tone: "negative",
    };
  if (release.status === "prerelease")
    return { text: "prerelease", tone: "warning" };
  if (release.status === "interim") return { text: "interim", tone: "neutral" };
  if (release.lts && !/\bLTS\b/.test(target.label))
    return { text: "LTS", tone: "neutral" };
  return null;
}

const ACRONYMS = new Set(
  "rdp nla ssh luks lvm uwf tpm gpt uefi ou ip dns id url ntp os iso".split(
    " ",
  ),
);

function humanize(key: string): string {
  const words = key
    .split(/[._\s-]+/)
    .filter(Boolean)
    .map((w) => (ACRONYMS.has(w.toLowerCase()) ? w.toUpperCase() : w));
  const text = words.join(" ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const CAPABILITY_LABELS: Record<string, string> = {
  domain_join: "Domain join",
  bitlocker: "BitLocker",
  consumer_policy: "Consumer features policy",
  telemetry_off: "Diagnostic data off",
  uwf: "Unified Write Filter",
  desktop: "Desktop",
  appx_debloat: "Store app removal",
  assistant_recall: "Assistant app and Recall",
  client_apps: "Client apps",
  iso_image: "ISO image",
};

export const capabilityLabel = (capability: string) =>
  CAPABILITY_LABELS[capability] ?? humanize(capability);

// why an edition lacks a capability (the limits the matrix encodes)
const CAPABILITY_REASONS: Record<string, string> = {
  domain_join: "Home editions cannot join a domain.",
  bitlocker: "Home editions have no BitLocker management.",
  consumer_policy:
    "Windows honours the consumer features policy only on Enterprise, Education and IoT Enterprise.",
  telemetry_off:
    "Diagnostic data can be switched off only on Enterprise, Education and Server; other editions keep the minimum level.",
  uwf: "The Unified Write Filter exists only on Enterprise and IoT Enterprise.",
  desktop: "Server Core has no desktop.",
  appx_debloat: "Store app removal is offered for Home and Pro editions only.",
  assistant_recall:
    "The assistant app and Recall exist only on Windows client editions.",
  client_apps:
    "Server editions have no widgets, Cortana, Find My Device or OneDrive client.",
  iso_image:
    "No installer image exists; the files go onto the SHARE partition.",
};

// what the target demands, not a feature it can lack
const REQUIREMENTS = new Set(["device_required"]);
export const isRequirement = (capability: string) =>
  REQUIREMENTS.has(capability);

function capabilityReason(capability: string, target: Target): string {
  return (
    CAPABILITY_REASONS[capability] ??
    `${target.label} does not support ${capabilityLabel(capability)}.`
  );
}

// policy fields, read from the target's defaults

const POLICY_GROUPS = [
  { id: "general", label: "General", icon: "tune" },
  { id: "software", label: "Software", icon: "apps" },
  { id: "disk", label: "Disk & encryption", icon: "storage" },
  { id: "network", label: "Network & firewall", icon: "security" },
  { id: "desktop", label: "Desktop", icon: "desktop_windows" },
  { id: "remote", label: "Remote access", icon: "settings_remote" },
  { id: "ssh", label: "SSH", icon: "terminal" },
  { id: "accounts", label: "Accounts & LAPS", icon: "manage_accounts" },
  { id: "debloat", label: "Debloat", icon: "cleaning_services" },
  { id: "domain", label: "Domain", icon: "domain" },
  { id: "uwf", label: "Write filter", icon: "shield" },
  // last: the tallest card, so the two columns balance
  { id: "privacy", label: "Privacy", icon: "privacy_tip" },
];

// cards that span both columns
export const WIDE_GROUPS = new Set(["general", "software"]);

// first match wins; unmatched paths are general
const GROUP_RULES: [string, RegExp][] = [
  ["uwf", /uwf|write_?filter/],
  ["domain", /domain|join|(^|[._])ou([._]|$)/],
  ["privacy", /telemetry|diagnostic|privacy/],
  ["debloat", /debloat|appx|consumer/],
  ["ssh", /(^|[._])ssh([._]|$)|authorized/],
  ["desktop", /(^|[._])desktop([._]|$)/],
  [
    "disk",
    /disk|device|partition|layout|lvm|luks|bitlocker|tpm|encrypt|wipe|swap|recovery/,
  ],
  ["remote", /rdp|nla|ssh|authorized|remote/],
  ["network", /firewall|allow|network|netcfg|mirror|proxy|dns/],
  ["accounts", /admin|user|account|password|root|laps|sudo|wheel/],
];

const CAPABILITY_RULES: [string, RegExp][] = [
  ["domain_join", /domain|join/],
  ["bitlocker", /bitlocker|tpm|recovery/],
  ["consumer_policy", /consumer/],
  ["telemetry_off", /telemetry|diagnostic/],
  ["uwf", /uwf|write_?filter/],
  ["appx_debloat", /appx|debloat/],
  ["desktop", /desktop/],
];

const SECRET =
  /pass(word|phrase)|secret|token|reg(istration)?_?code|product_?key/;
// the admin account password the builder generates when it is left empty
const GENERATED = /(^|[._])(admin|user|account)[._]password$|^password$/;

export type FieldKind =
  | "bool"
  | "number"
  | "list"
  | "secret"
  | "select"
  | "multiline"
  | "checkgroup"
  | "text";

export interface PolicyField {
  path: string;
  label: string;
  group: string;
  kind: FieldKind;
  // set for every select and checkgroup
  choices?: FieldChoice[];
  help?: string;
  showIf?: Record<string, FieldValue | FieldValue[]>;
  // gating capability of the target, when it names one
  capability?: string;
  generate: boolean;
  // a list of numbers (ports) stays one
  numeric: boolean;
  // place inside the group
  order: number;
  // a select that applies Target.presets
  preset?: boolean;
}

// the preset select's own choice for edited values; never sent
const CUSTOM = "custom";

const isObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

function leaves(
  obj: Record<string, unknown>,
  prefix = "",
): [string, unknown][] {
  return Object.entries(obj).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return isObject(value)
      ? leaves(value, path)
      : [[path, value] as [string, unknown]];
  });
}

function kindOf(path: string, value: unknown): FieldKind {
  if (typeof value === "boolean") return "bool";
  if (typeof value === "number") return "number";
  if (Array.isArray(value)) return "list";
  if (SECRET.test(path)) return "secret";
  if (/(^|[._])(layout|timezone|time_zone)$/.test(path)) return "select";
  return "text";
}

// the Linux disk layout and time zones, for targets without field metadata
const LAYOUT_OPTIONS = ["lvm", "direct"];

function zones(): string[] {
  try {
    const list = Intl.supportedValuesOf("timeZone");
    return list.includes("UTC") ? list : ["UTC", ...list];
  } catch {
    return ["UTC"];
  }
}
const TIMEZONES = zones();

const asChoices = (values: string[]) =>
  values.map((value) => ({ value, label: value }));

const fallbackChoices = (path: string) =>
  asChoices(/(^|[._])layout$/.test(path) ? LAYOUT_OPTIONS : TIMEZONES);

function capabilityOf(
  path: string,
  capabilities: Record<string, unknown>,
): string | undefined {
  const rule = CAPABILITY_RULES.find(
    ([cap, re]) => cap in capabilities && re.test(path),
  );
  if (rule) return rule[0];
  return path.split(/[._]/).find((segment) => segment in capabilities);
}

// the last two path segments: "firewall.enabled" -> "Firewall enabled"
function fieldLabel(path: string): string {
  const words = path.split(".").slice(-2);
  return words.length === 1
    ? capabilityLabel(words[0])
    : humanize(words.join(" "));
}

// server metadata decides kind, label and choices; paths without it fall
// back to the name and the default value
function metaKind(path: string, value: unknown, target: Target) {
  const meta = target.fields?.[path];
  if (!meta) {
    const kind = kindOf(path.toLowerCase(), value);
    return {
      kind,
      label: fieldLabel(path),
      choices: kind === "select" ? fallbackChoices(path.toLowerCase()) : [],
    };
  }
  let kind: FieldKind;
  if (meta.kind === "checkgroup")
    kind = meta.choices?.length ? "checkgroup" : "list";
  else if (meta.choices?.length) kind = "select";
  else if (Array.isArray(value)) kind = "list";
  else if (meta.kind && meta.kind !== "select") kind = meta.kind;
  else kind = kindOf(path.toLowerCase(), value);
  // a select hint without choices stays a text field
  if (kind === "select" && !meta.choices?.length) kind = "text";
  return {
    kind,
    label: meta.label || fieldLabel(path),
    choices: meta.choices ?? [],
    help: meta.help,
    showIf: meta.show_if,
  };
}

const ORDER_DEFAULT = 1000;

// a field may name a shared list in choice_sets instead of carrying it;
// inline choices win, an unknown name leaves the field without choices
export function resolveChoiceRefs(matrix: Matrix): Matrix {
  for (const target of matrix.targets)
    for (const meta of Object.values(target.fields ?? {}))
      if (!meta.choices && meta.choices_ref)
        meta.choices = matrix.choice_sets?.[meta.choices_ref];
  return matrix;
}

// explicit server metadata (group, capability, order) wins over the path
// rules; fields keep the defaults' order inside the same order value
export function policyFields(target: Target): PolicyField[] {
  const capabilities = target.capabilities || {};
  const fields = leaves(target.defaults || {}).map(([path, value]) => {
    const lower = path.toLowerCase();
    const meta = target.fields?.[path];
    const { kind, label, choices, help, showIf } = metaKind(
      path,
      value,
      target,
    );
    const preset =
      kind === "select" && !!meta?.preset && !!target.presets?.[path];
    const listed =
      preset && !choices.some((c) => c.value === CUSTOM)
        ? [...choices, { value: CUSTOM, label: "Custom" }]
        : choices;
    return {
      path,
      label,
      group:
        meta?.group ??
        GROUP_RULES.find(([, re]) => re.test(lower))?.[0] ??
        "general",
      kind,
      ...(kind === "select" || kind === "checkgroup"
        ? { choices: listed }
        : {}),
      ...(help ? { help } : {}),
      ...(showIf ? { showIf } : {}),
      ...(preset ? { preset } : {}),
      capability: meta?.capability ?? capabilityOf(lower, capabilities),
      generate: kind === "secret" && GENERATED.test(lower),
      numeric:
        Array.isArray(value) &&
        value.length > 0 &&
        value.every((item) => typeof item === "number"),
      order: meta?.order ?? ORDER_DEFAULT,
    };
  });
  // Array.prototype.sort is stable
  return fields.sort((a, b) => a.order - b.order);
}

const same = (a: unknown, b: unknown) =>
  JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

// the value a preset select shows: its own while every field it sets still
// holds the preset's value, else Custom
export function presetShown(
  target: Target,
  path: string,
  profile: Record<string, unknown>,
): unknown {
  const value = getPath(profile, path);
  const preset = target.presets?.[path]?.[String(value)];
  if (!preset) return value;
  return Object.entries(preset).every(([p, v]) => same(getPath(profile, p), v))
    ? value
    : CUSTOM;
}

// writes the preset select's choice and the values it stands for; Custom
// changes nothing
export function applyPreset(
  target: Target,
  path: string,
  value: unknown,
  profile: Record<string, unknown>,
): void {
  if (value === CUSTOM) return;
  setPath(profile, path, value);
  for (const [p, v] of Object.entries(
    target.presets?.[path]?.[String(value)] ?? {},
  ))
    setPath(profile, p, Array.isArray(v) ? [...v] : v);
}

export interface ChoiceSection {
  name: string;
  choices: FieldChoice[];
}

// checkgroup choices by section, in server order, filtered by label
export function choiceSections(
  choices: FieldChoice[],
  needle = "",
): ChoiceSection[] {
  const want = needle.trim().toLowerCase();
  const out = new Map<string, FieldChoice[]>();
  for (const choice of choices) {
    if (want && !`${choice.label} ${choice.value}`.toLowerCase().includes(want))
      continue;
    const name = choice.section ?? "";
    out.set(name, [...(out.get(name) ?? []), choice]);
  }
  return [...out].map(([name, list]) => ({ name, choices: list }));
}

// false while a show_if condition does not hold for the profile
function fieldShown(
  field: PolicyField,
  profile: Record<string, unknown>,
): boolean {
  return Object.entries(field.showIf ?? {}).every(([path, want]) => {
    const have = getPath(profile, path);
    return Array.isArray(want)
      ? want.includes(have as FieldValue)
      : have === want;
  });
}

// the empty password the builder generates on Next; one show_if hides stays
// empty
export const passwordToGenerate = (
  target: Target,
  profile: Record<string, unknown>,
) =>
  policyFields(target).find(
    (f) => f.generate && fieldShown(f, profile) && !getPath(profile, f.path),
  );

// the edition reason when the target does not allow the field, else "";
// a select or number stays, the server narrows its range per edition
function fieldBlock(field: PolicyField, target: Target): string {
  if (!field.capability || field.kind === "select" || field.kind === "number")
    return "";
  if (target.capabilities?.[field.capability] !== false) return "";
  return capabilityReason(field.capability, target);
}

export interface MissingFeature {
  capability: string;
  label: string;
  group: string;
  reason: string;
}

// capabilities the target lacks that no field stands for, so the step can
// still say why the feature is missing
function missingFeatures(
  target: Target,
  fields: PolicyField[],
): MissingFeature[] {
  const named = new Set(fields.map((field) => field.capability));
  return Object.entries(target.capabilities || {})
    .filter(
      ([cap, value]) =>
        value === false && !named.has(cap) && !isRequirement(cap),
    )
    .map(([cap]) => ({
      capability: cap,
      label: capabilityLabel(cap),
      group: GROUP_RULES.find(([, re]) => re.test(cap))?.[0] ?? "general",
      reason: capabilityReason(cap, target),
    }));
}

export interface PolicyGroup {
  id: string;
  label: string;
  icon: string;
  // shown and allowed on the edition
  fields: PolicyField[];
  // one entry per capability the edition lacks, fields and features alike
  missing: MissingFeature[];
}

// the cards of the policy step: blocked fields leave the card and join the
// features the edition lacks; a card left without fields hands that line to
// General
export function policyGroups(
  target: Target,
  profile: Record<string, unknown>,
): PolicyGroup[] {
  const all = policyFields(target);
  const missing = new Map<string, MissingFeature>();
  for (const field of all) {
    const reason = fieldBlock(field, target);
    if (reason && field.capability && !missing.has(field.capability))
      missing.set(field.capability, {
        capability: field.capability,
        label: capabilityLabel(field.capability),
        group: field.group,
        reason,
      });
  }
  for (const m of missingFeatures(target, all))
    if (!missing.has(m.capability)) missing.set(m.capability, m);
  const shown = all.filter(
    (f) => fieldShown(f, profile) && !fieldBlock(f, target),
  );
  const owner = (group: string) =>
    shown.some((f) => f.group === group) ? group : "general";
  const lacks = [...missing.values()];
  const known = new Set(POLICY_GROUPS.map((g) => g.id));
  const extra = [...new Set(all.map((f) => f.group))]
    .filter((id) => !known.has(id))
    .map((id) => ({ id, label: humanize(id), icon: "tune" }));
  return [...POLICY_GROUPS, ...extra]
    .map((g) => ({
      ...g,
      fields: shown.filter((f) => f.group === g.id),
      missing: lacks.filter((m) => owner(m.group) === g.id),
    }))
    .filter((g) => g.fields.length || g.missing.length);
}

// the defaults are server JSON, so a JSON copy is exact (and drops proxies)
export const copyDefaults = (target: Target): Record<string, unknown> =>
  JSON.parse(JSON.stringify(target.defaults || {}));

export function getPath(obj: Record<string, unknown>, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>(
      (node, key) => (isObject(node) ? node[key] : undefined),
      obj,
    );
}

export function setPath(
  obj: Record<string, unknown>,
  path: string,
  value: unknown,
): void {
  const keys = path.split(".");
  const last = keys.pop() as string;
  let node = obj;
  for (const key of keys) {
    if (!isObject(node[key])) node[key] = {};
    node = node[key] as Record<string, unknown>;
  }
  node[last] = value;
}

// one entry per line
export function listFromText(text: string, numeric: boolean): unknown[] {
  const items = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  return numeric ? items.map(Number).filter((n) => Number.isFinite(n)) : items;
}

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
// bytes at or above this would favour the first letters
const UNBIASED = 256 - (256 % ALPHABET.length);

export function generatePassword(
  length = 20,
  random = (n: number) => crypto.getRandomValues(new Uint8Array(n)),
): string {
  for (;;) {
    let out = "";
    while (out.length < length) {
      for (const byte of random(length)) {
        if (byte < UNBIASED && out.length < length)
          out += ALPHABET[byte % ALPHABET.length];
      }
    }
    // Windows complexity: three of upper, lower, digit, symbol
    if (/[A-Z]/.test(out) && /[a-z]/.test(out) && /\d/.test(out)) return out;
  }
}

export interface ServerErrors {
  fields: Record<string, string>;
  other: string[];
}

// a DRF error body -> messages for known field paths, the rest as lines
export function serverErrors(data: unknown, known: string[]): ServerErrors {
  const out: ServerErrors = { fields: {}, other: [] };
  const paths = new Set(known);
  const add = (path: string, message: string) => {
    // list items report under their index: "firewall.allow.0"
    const field = path.replace(/^profile\./, "");
    const owner = [field, field.replace(/(\.\d+)+$/, "")].find((p) =>
      paths.has(p),
    );
    if (owner) out.fields[owner] ??= message;
    else if (path) out.other.push(`${humanize(field)}: ${message}`);
    else out.other.push(message);
  };
  const walk = (value: unknown, path: string) => {
    if (typeof value === "string") add(path, value);
    else if (Array.isArray(value)) {
      if (value.every((item) => typeof item === "string")) {
        if (value.length) add(path, value[0]);
      } else
        value.forEach((item, i) => walk(item, path ? `${path}.${i}` : `${i}`));
    } else if (isObject(value)) {
      for (const [key, item] of Object.entries(value)) {
        const own = key === "non_field_errors" || key === "detail";
        walk(item, own ? path : path ? `${path}.${key}` : key);
      }
    }
  };
  walk(data, "");
  return out;
}

export interface FailedResponse {
  status: number;
  data: unknown;
}

// status and body of a failed request; blob and text bodies are read as
// JSON where they are JSON, an HTML error page counts as no body
export async function failedResponse(
  e: unknown,
): Promise<FailedResponse | null> {
  const response = (e as { response?: FailedResponse } | null)?.response;
  if (!response) return null;
  let data = response.data;
  if (data instanceof Blob) data = await data.text();
  if (typeof data === "string") {
    if (data.trimStart().startsWith("<")) data = "";
    else {
      try {
        data = JSON.parse(data);
      } catch {
        // plain text
      }
    }
  }
  return { status: response.status, data };
}

// one line for a failed request without fields to attach messages to
export async function failureText(e: unknown): Promise<string> {
  const failed = await failedResponse(e);
  if (!failed) return "The server could not be reached.";
  return (
    serverErrors(failed.data, []).other.join(" ") ||
    `The server returned an error (${failed.status}).`
  );
}

// runs the request again once after the console step-up when the server
// asks for it with 403 {"stepup": true}
export async function retryAfterStepUp<T>(
  run: () => Promise<T>,
  stepUp: () => Promise<boolean>,
): Promise<T> {
  try {
    return await run();
  } catch (e) {
    const failed = await failedResponse(e);
    const asks =
      failed?.status === 403 &&
      isObject(failed.data) &&
      failed.data.stepup === true;
    if (asks && (await stepUp())) return run();
    throw e;
  }
}

// preview, export and links

const MONACO_LANGUAGES: Record<string, string> = { text: "plaintext" };

export const monacoLanguage = (language: string) =>
  MONACO_LANGUAGES[language] ?? language;

const slug = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

// the API's Content-Disposition is not readable cross-origin, so the name
// comes from the preview
export function exportName(
  parts: string[],
  files: RenderedFile[],
  blobType: string,
  bundle: boolean,
): string {
  const stem = parts.map(slug).filter(Boolean).join("-") || "deployment";
  if (bundle || /zip/.test(blobType)) return `${stem}.zip`;
  return files[0]?.name || `${stem}.txt`;
}

export function installerUrl(base: string, fmt: string, arch?: string): string {
  const query = new URLSearchParams({ fmt });
  if (arch) query.set("arch", arch);
  return `${base}?${query}`;
}

const shQuote = (text: string) => `'${text.replace(/'/g, "'\\''")}'`;
const psQuote = (text: string) => `'${text.replace(/'/g, "''")}'`;

// adds TLS 1.2 (3072) for Windows PowerShell on older .NET defaults
export function windowsCommand(url: string): string {
  const tls =
    "[Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor 3072";
  return `powershell -NoProfile -ExecutionPolicy Bypass -Command "${tls}; iex (irm ${psQuote(url)})"`;
}

export const curlCommand = (url: string) =>
  `curl -fsSL ${shQuote(url)} | sudo bash`;

// runs the script only when OpenSSL verifies its detached Ed25519 signature
// against the enrollment key; the subshell keeps the exit status and removes
// the temp dir on every path
export function verifiedCommand(
  url: string,
  sigUrl: string,
  pem: string,
): string {
  const key = pem
    .trim()
    .split(/\r?\n/)
    .map((line) => shQuote(line.trim()))
    .join(" ");
  const steps = [
    'd="$(mktemp -d)"',
    "trap 'rm -rf \"$d\"' EXIT",
    `printf '%s\\n' ${key} > "$d/key.pem"`,
    `curl -fsSL ${shQuote(url)} -o "$d/install.sh"`,
    `curl -fsSL ${shQuote(sigUrl)} | base64 -d > "$d/install.sig"`,
    'openssl pkeyutl -verify -pubin -inkey "$d/key.pem" -rawin -in "$d/install.sh" -sigfile "$d/install.sig"',
    'sudo bash "$d/install.sh"',
  ];
  return `(${steps.join(" && ")})`;
}
