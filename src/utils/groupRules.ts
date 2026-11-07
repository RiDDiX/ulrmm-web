// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

// device group rules and tag names. Same checks as groups/rules.py,
// so the form can name a problem before save. The server still decides.

export type Match = "all" | "any";
export type Op = "eq" | "neq" | "contains" | "starts" | "lt" | "gte" | "in";
type Scalar = string | number | boolean;

export interface Condition {
  field: string;
  op: string;
  value: Scalar | Scalar[] | null;
  // agent custom field id, custom_field conditions only
  custom_field?: number | null;
}

export interface Rules {
  match: Match;
  conditions: Condition[];
}

// how the value is entered
export type ValueKind =
  | "choice"
  | "client"
  | "site"
  | "tag"
  | "text"
  | "bool"
  | "custom_field";

interface FieldDef {
  label: string;
  ops: Op[];
  kind: ValueKind;
  hint?: string;
  opLabels?: Partial<Record<Op, string>>;
}

export const MAX_CONDITIONS = 20;
const MAX_IN_VALUES = 100;
export const MAX_TEXT = 255;
export const GROUP_NAME_MAX = 80;
export const GROUP_DESCRIPTION_MAX = 500;
export const TAG_NAME_MAX = 40;

const PICK_OPS: Op[] = ["eq", "neq", "in"];

export const FIELDS: Record<string, FieldDef> = {
  plat: { label: "Operating system", ops: PICK_OPS, kind: "choice" },
  client: { label: "Client", ops: PICK_OPS, kind: "client" },
  site: { label: "Site", ops: PICK_OPS, kind: "site" },
  tag: {
    label: "Tag",
    ops: PICK_OPS,
    kind: "tag",
    opLabels: { eq: "has", neq: "does not have", in: "has any of" },
  },
  hostname: { label: "Hostname", ops: ["contains", "starts"], kind: "text" },
  os: {
    label: "OS name",
    ops: ["contains"],
    kind: "text",
    hint: "For example Ubuntu 24.04 or Server 2022",
  },
  status: { label: "Status", ops: PICK_OPS, kind: "choice" },
  monitoring_type: { label: "Type", ops: ["eq", "neq"], kind: "choice" },
  agent_version: {
    label: "Agent version",
    ops: ["lt", "gte"],
    kind: "text",
    hint: "For example 1.31.10.2026",
    opLabels: { lt: "older than", gte: "at least" },
  },
  software: {
    label: "Installed software",
    ops: ["contains"],
    kind: "text",
    hint: "Part of the name in the software inventory",
    opLabels: { contains: "name contains" },
  },
  custom_field: {
    label: "Custom field",
    ops: ["eq", "contains"],
    kind: "custom_field",
  },
  needs_reboot: { label: "Reboot needed", ops: ["eq"], kind: "bool" },
  patches_failed: { label: "Patch install failed", ops: ["eq"], kind: "bool" },
};

export const FIELD_OPTIONS = Object.entries(FIELDS).map(([value, f]) => ({
  value,
  label: f.label,
}));

const OP_LABELS: Record<Op, string> = {
  eq: "is",
  neq: "is not",
  contains: "contains",
  starts: "starts with",
  lt: "lower than",
  gte: "at least",
  in: "is any of",
};

export const CHOICES: Record<string, { value: string; label: string }[]> = {
  plat: [
    { value: "windows", label: "Windows" },
    { value: "linux", label: "Linux" },
    { value: "darwin", label: "macOS" },
    { value: "freebsd", label: "FreeBSD" },
  ],
  status: [
    { value: "online", label: "Online" },
    { value: "offline", label: "Offline" },
    { value: "overdue", label: "Overdue" },
  ],
  monitoring_type: [
    { value: "server", label: "Server" },
    { value: "workstation", label: "Workstation" },
  ],
};

export function opLabel(field: string, op: string) {
  return FIELDS[field]?.opLabels?.[op as Op] || OP_LABELS[op as Op] || op;
}

export function newCondition(field = "plat"): Condition {
  const def = FIELDS[field];
  const condition: Condition = {
    field,
    op: def.ops[0],
    value: def.kind === "bool" ? true : null,
  };
  if (def.kind === "custom_field") condition.custom_field = null;
  return condition;
}

// one value and a list convert into each other when the op switches
export function withOp(condition: Condition, op: string): Condition {
  let value = condition.value;
  if (op === "in" && !Array.isArray(value))
    value = value === null || value === "" ? [] : [value];
  else if (op !== "in" && Array.isArray(value)) value = value[0] ?? null;
  return { ...condition, op, value };
}

function textError(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return "Enter a value";
  if (value.length > MAX_TEXT) return `At most ${MAX_TEXT} characters`;
  return "";
}

function valueError(field: string, value: unknown) {
  const kind = FIELDS[field].kind;
  if (kind === "choice")
    return CHOICES[field].some((c) => c.value === value) ? "" : "Pick a value";
  if (kind === "client" || kind === "site" || kind === "tag")
    return Number.isInteger(value) && (value as number) >= 1
      ? ""
      : "Pick a value";
  if (kind === "bool")
    return typeof value === "boolean" ? "" : "Pick yes or no";
  return textError(value);
}

// "" when the server would take it. cfTypes: agent custom field id -> type
export function conditionError(
  c: Condition,
  cfTypes: Record<number, string> = {},
): string {
  const def = FIELDS[c.field];
  if (!def) return "Pick a field";
  if (!def.ops.includes(c.op as Op)) return "Pick a comparison";
  if (def.kind === "custom_field") {
    const type = c.custom_field ? cfTypes[c.custom_field] : undefined;
    if (!type) return "Pick an agent custom field";
    if (type === "checkbox")
      return c.op === "eq" && typeof c.value === "boolean"
        ? ""
        : "A checkbox field takes is yes or no";
    return textError(c.value);
  }
  if (c.op === "in") {
    if (!Array.isArray(c.value) || !c.value.length)
      return "Pick at least one value";
    if (c.value.length > MAX_IN_VALUES)
      return `At most ${MAX_IN_VALUES} values`;
    for (const v of c.value) {
      const error = valueError(c.field, v);
      if (error) return error;
    }
    return "";
  }
  return valueError(c.field, c.value);
}

export function rulesError(rules: Rules): string {
  if (rules.match !== "all" && rules.match !== "any") return "Match all or any";
  if (!rules.conditions.length) return "Add at least one condition";
  if (rules.conditions.length > MAX_CONDITIONS)
    return `At most ${MAX_CONDITIONS} conditions`;
  return "";
}

export function rulesValid(rules: Rules, cfTypes: Record<number, string>) {
  return (
    !rulesError(rules) &&
    rules.conditions.every((c) => !conditionError(c, cfTypes))
  );
}

// the payload: only the keys the server accepts, text trimmed
export function cleanRules(rules: Rules): Rules {
  return {
    match: rules.match,
    conditions: rules.conditions.map((c) => {
      const out: Condition = {
        field: c.field,
        op: c.op,
        value: typeof c.value === "string" ? c.value.trim() : c.value,
      };
      if (c.field === "custom_field") out.custom_field = c.custom_field;
      return out;
    }),
  };
}

// id -> name per field, for the readable summary
export type RuleNames = Partial<
  Record<"client" | "site" | "tag" | "custom_field", Record<number, string>>
>;

function valueLabel(field: string, value: unknown, names: RuleNames) {
  const kind = FIELDS[field]?.kind;
  if (kind === "choice")
    return CHOICES[field].find((c) => c.value === value)?.label ?? `${value}`;
  if (kind === "client" || kind === "site" || kind === "tag")
    return names[kind]?.[value as number] ?? `#${value}`;
  if (typeof value === "boolean") return value ? "yes" : "no";
  return `"${value}"`;
}

function conditionLabel(c: Condition, names: RuleNames = {}) {
  const def = FIELDS[c.field];
  if (!def) return c.field;
  const values = (Array.isArray(c.value) ? c.value : [c.value])
    .map((v) => valueLabel(c.field, v, names))
    .join(", ");
  const subject =
    def.kind === "custom_field"
      ? (names.custom_field?.[c.custom_field as number] ?? def.label)
      : def.label;
  return `${subject} ${opLabel(c.field, c.op)} ${values}`;
}

export function rulesSummary(
  rules: Rules | null | undefined,
  names: RuleNames = {},
) {
  const conditions = rules?.conditions || [];
  if (!conditions.length) return "No conditions";
  const join = rules?.match === "any" ? " or " : " and ";
  return conditions.map((c) => conditionLabel(c, names)).join(join);
}

export const TAG_COLORS = [
  "#2563eb",
  "#16a34a",
  "#d97706",
  "#dc2626",
  "#7c3aed",
  "#0891b2",
  "#db2777",
  "#607d8b",
];

// tag colors come from the server; only a plain hex reaches a style
export function tagColor(color: unknown) {
  return typeof color === "string" && /^#[0-9a-f]{6}$/i.test(color)
    ? color
    : "#607d8b";
}

export function tagNameError(
  name: string,
  tags: { id: number; name: string }[] = [],
  id: number | null = null,
) {
  const trimmed = (name || "").trim();
  if (!trimmed) return "Enter a name";
  if (trimmed.length > TAG_NAME_MAX)
    return `At most ${TAG_NAME_MAX} characters`;
  const lower = trimmed.toLowerCase();
  if (tags.some((t) => t.name.toLowerCase() === lower && t.id !== id))
    return "A tag with this name exists";
  return "";
}
