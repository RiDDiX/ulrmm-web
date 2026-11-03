// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

// variables <-> env_vars ("NAME=value"). no Vue.
import type {
  ScriptShellType,
  ScriptVariable,
  ScriptVariableType,
} from "@/types/scripts";

export const VARIABLE_TYPES: { value: ScriptVariableType; label: string }[] = [
  { value: "string", label: "Text (one line)" },
  { value: "text", label: "Text (multi-line)" },
  { value: "integer", label: "Whole number" },
  { value: "decimal", label: "Decimal number" },
  { value: "checkbox", label: "Checkbox" },
  { value: "select", label: "Drop-down" },
  { value: "ip", label: "IP address" },
  { value: "date", label: "Date" },
  { value: "datetime", label: "Date and time" },
  { value: "password", label: "Password" },
];

export const MAX_VARIABLE_NAME = 40;
export const MAX_LABEL = 60;
export const MAX_HELP = 200;
// user scripts; library scripts use ^[A-Z][A-Z0-9_]{1,39}$
export const USER_NAME_RE = /^[A-Za-z_][A-Za-z0-9_]{0,39}$/;

const PLACEHOLDER_RE = /\{\{\s*[^{}]+\s*\}\}/;
const IPV4_RE =
  /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;

// values can contain server placeholders, filled in before the run
export function hasPlaceholder(value: string): boolean {
  return PLACEHOLDER_RE.test(value);
}

// first "=" splits name and value
export function splitEnv(entry: string): [string, string] {
  const i = entry.indexOf("=");
  return i < 0 ? [entry, ""] : [entry.slice(0, i), entry.slice(i + 1)];
}

const sameName = (a: string, b: string) => a.toUpperCase() === b.toUpperCase();

// names match regardless of case. duplicates: last one wins,
// same as the agent
export function getEnvValue(
  envVars: string[] | undefined,
  name: string,
): string | undefined {
  let found: string | undefined;
  for (const entry of envVars || []) {
    const [key, value] = splitEnv(entry);
    if (sameName(key, name)) found = value;
  }
  return found;
}

// replace the first NAME entry, drop duplicates. empty or
// undefined removes it. other entries keep their order.
export function setEnvValue(
  envVars: string[] | undefined,
  name: string,
  value: string | undefined,
): string[] {
  const out: string[] = [];
  let placed = false;
  for (const entry of envVars || []) {
    if (!sameName(splitEnv(entry)[0], name)) {
      out.push(entry);
    } else if (!placed && value !== undefined && value !== "") {
      out.push(`${name}=${value}`);
      placed = true;
    }
  }
  if (!placed && value !== undefined && value !== "")
    out.push(`${name}=${value}`);
  return out;
}

// script env_vars, plus the default of any variable not set yet
export function applyVariableDefaults(
  envVars: string[] | undefined,
  variables: ScriptVariable[] | undefined,
): string[] {
  let out = [...(envVars || [])];
  for (const v of variables || []) {
    if (
      v.default &&
      v.type !== "password" &&
      getEnvValue(out, v.name) === undefined
    )
      out = setEnvValue(out, v.name, v.default);
  }
  return normalizeEnv(out, variables);
}

// one entry per declared variable, under its declared name,
// with the value the agent would use. required checkbox, no value: false
export function normalizeEnv(
  envVars: string[] | undefined,
  variables: ScriptVariable[] | undefined,
): string[] {
  let out = [...(envVars || [])];
  for (const v of variables || []) {
    const value = getEnvValue(out, v.name);
    out = setEnvValue(
      out,
      v.name,
      value ?? (v.type === "checkbox" && v.required ? "false" : undefined),
    );
  }
  return out;
}

function isValidDate(y: number, m: number, d: number): boolean {
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

export function isIPv4(value: string): boolean {
  return IPV4_RE.test(value);
}

export function isIPv6(value: string): boolean {
  let v = value;
  // ipv4 on the end of an ipv6 address
  const tail = v.match(/^(.*:)(\d+\.\d+\.\d+\.\d+)$/);
  if (tail) {
    if (!isIPv4(tail[2])) return false;
    v = tail[1] + "0:0";
  }
  if (!/^[0-9A-Fa-f:]+$/.test(v) || v.includes(":::")) return false;
  const parts = v.split("::");
  if (parts.length > 2) return false;
  const groups = (s: string) => (s === "" ? [] : s.split(":"));
  const head = groups(parts[0]);
  const rest = parts.length === 2 ? groups(parts[1]) : [];
  if ([...head, ...rest].some((g) => g.length < 1 || g.length > 4))
    return false;
  const count = head.length + rest.length;
  return parts.length === 2 ? count <= 7 : count === 8;
}

// "" if the value is ok, else a short message.
// empty is checked only when the variable is required.
export function validateValue(v: ScriptVariable, value: string): string {
  if (value === "") return v.required ? "Required" : "";
  if (hasPlaceholder(value)) return "";
  switch (v.type) {
    case "string":
    case "password":
      return /[\r\n]/.test(value) ? "Must be a single line" : "";
    case "integer":
      return /^-?\d+$/.test(value) ? "" : "Enter a whole number";
    case "decimal":
      return /^-?\d+(\.\d+)?$/.test(value) ? "" : "Enter a number like 12.5";
    case "checkbox":
      return value === "true" || value === "false" ? "" : "Use true or false";
    case "select":
      return (v.options || []).some((o) => o.trim() === value)
        ? ""
        : "Pick one of the listed options";
    case "ip":
      return isIPv4(value) || isIPv6(value)
        ? ""
        : "Enter an IPv4 or IPv6 address";
    case "date": {
      const m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      return m && isValidDate(+m[1], +m[2], +m[3]) ? "" : "Use YYYY-MM-DD";
    }
    case "datetime": {
      const m = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
      return m && isValidDate(+m[1], +m[2], +m[3]) && +m[4] < 24 && +m[5] < 60
        ? ""
        : "Use YYYY-MM-DDTHH:MM";
    }
    default:
      return "";
  }
}

// errors for a filled run form, keyed by variable name
export function formErrors(
  variables: ScriptVariable[] | undefined,
  envVars: string[] | undefined,
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const v of variables || []) {
    const msg = validateValue(v, getEnvValue(envVars, v.name) ?? "");
    if (msg) errors[v.name] = msg;
  }
  return errors;
}

// missingOk: empty required inputs are allowed when editing something saved
export function isFormValid(
  variables: ScriptVariable[] | undefined,
  envVars: string[] | undefined,
  missingOk = false,
): boolean {
  return Object.values(formErrors(variables, envVars)).every(
    (msg) => missingOk && msg === "Required",
  );
}

// names an agent process already has. an empty optional variable
// is not sent, so the script would see the inherited value
export const INHERITED_ENV_NAMES: readonly string[] = [
  "PATH",
  "HOME",
  "USER",
  "USERNAME",
  "LOGNAME",
  "SHELL",
  "HOSTNAME",
  "PWD",
  "OLDPWD",
  "LANG",
  "LANGUAGE",
  "TERM",
  "TEMP",
  "TMP",
  "TMPDIR",
  "OS",
  "COMPUTERNAME",
  "USERDOMAIN",
  "USERPROFILE",
  "APPDATA",
  "LOCALAPPDATA",
  "PROGRAMDATA",
  "PROGRAMFILES",
  "SYSTEMROOT",
  "SYSTEMDRIVE",
  "WINDIR",
  "COMSPEC",
  "PATHEXT",
  "PSMODULEPATH",
  "PUBLIC",
  "HOMEDRIVE",
  "HOMEPATH",
  "IFS",
  "MAIL",
  "EDITOR",
  "DISPLAY",
  "UID",
  "EUID",
  "PPID",
  "RANDOM",
  "SECONDS",
  "LINENO",
  "OPTIND",
  "OPTARG",
  "SHLVL",
  "DRIVERDATA",
  "PROCESSOR_ARCHITECTURE",
  "NUMBER_OF_PROCESSORS",
];
const INHERITED = new Set(INHERITED_ENV_NAMES);

export function isInheritedName(name: string): boolean {
  return INHERITED.has(name.trim().toUpperCase());
}

export const SECRET_MASK = "••••••";

// chip label for an env entry. password values become SECRET_MASK.
// no variable list (unknown script): mask every value.
// stored: a saved object may still hold a secret from a variable that
// was renamed or retyped, so only declared non-password values show.
export function envMasker(
  variables: Pick<ScriptVariable, "name" | "type">[] | null | undefined,
  stored = false,
): (entry: string) => string {
  const types = new Map(
    (variables || []).map((v) => [v.name.trim().toUpperCase(), v.type]),
  );
  return (entry) => {
    const [name, value] = splitEnv(String(entry));
    if (value === "" && !String(entry).includes("=")) return entry;
    const type = types.get(name.trim().toUpperCase());
    return !variables || type === "password" || (stored && !type)
      ? `${name}=${SECRET_MASK}`
      : entry;
  };
}

const UMLAUTS: Record<string, string> = {
  ä: "ae",
  Ä: "AE",
  ö: "oe",
  Ö: "OE",
  ü: "ue",
  Ü: "UE",
  ß: "ss",
};

// "Warn above (%)" -> "WARN_ABOVE", and not an inherited name
export function suggestVariableName(label: string): string {
  let name = label
    .normalize("NFC")
    .replace(/[äÄöÖüÜß]/g, (c) => UMLAUTS[c])
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\w\s-]/g, " ")
    .trim()
    .replace(/[\s-]+/g, "_")
    .replace(/[^A-Za-z0-9_]/g, "")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();
  if (/^\d/.test(name)) name = "V_" + name;
  if (INHERITED.has(name)) name = "TARGET_" + name;
  return name.slice(0, MAX_VARIABLE_NAME).replace(/_+$/, "");
}

export interface VariableIssue {
  index: number;
  field: "name" | "label" | "type" | "default" | "options" | "help";
  message: string;
}

const TYPE_VALUES = VARIABLE_TYPES.map((t) => t.value);

// definition errors in the builder. same checks the server uses for user scripts
export function validateDefinitions(
  variables: ScriptVariable[] | undefined,
): VariableIssue[] {
  const issues: VariableIssue[] = [];
  const seen = new Map<string, number>();
  (variables || []).forEach((v, index) => {
    const add = (field: VariableIssue["field"], message: string) =>
      issues.push({ index, field, message });
    const name = (v.name || "").trim();
    if (!name) add("name", "Name is required");
    else if (!USER_NAME_RE.test(name))
      add(
        "name",
        "Letters, digits and _ only, not starting with a digit, max 40",
      );
    else if (seen.has(name.toUpperCase()))
      add("name", `Same name as variable ${seen.get(name.toUpperCase())! + 1}`);
    else seen.set(name.toUpperCase(), index);

    const label = (v.label || "").trim();
    if (!label) add("label", "Label is required");
    else if (label.length > MAX_LABEL)
      add("label", `At most ${MAX_LABEL} characters`);
    if (!TYPE_VALUES.includes(v.type)) add("type", "Unknown type");
    if ((v.help || "").length > MAX_HELP)
      add("help", `At most ${MAX_HELP} characters`);
    if (v.type === "select") {
      const opts = (v.options || []).map((o) => o.trim()).filter(Boolean);
      if (opts.length === 0) add("options", "Add at least one option");
      else if (new Set(opts).size !== opts.length)
        add("options", "Options must be unique");
    }
    if (v.default && v.type === "password")
      add("default", "A password has no default; it is typed at run time");
    else if (v.default) {
      const msg = validateValue({ ...v, required: false }, v.default);
      if (msg) add("default", msg);
    }
  });
  return issues;
}

// before save: trim, and drop empty optional fields
export function cleanDefinitions(
  variables: ScriptVariable[],
): ScriptVariable[] {
  return variables.map((v) => {
    const out: ScriptVariable = {
      name: v.name.trim(),
      label: v.label.trim(),
      type: v.type,
      required: !!v.required,
    };
    if (v.default) out.default = v.default;
    if (v.help && v.help.trim()) out.help = v.help.trim();
    if (v.type === "select")
      out.options = (v.options || []).map((o) => o.trim()).filter(Boolean);
    return out;
  });
}

// how the script body reads an env var
export function envReference(shell: ScriptShellType, name: string): string {
  switch (shell) {
    case "powershell":
      return `$env:${name}`;
    case "cmd":
      return `%${name}%`;
    case "python":
      return `os.environ.get("${name}")`;
    case "nushell":
      return `$env.${name}?`;
    case "deno":
      return `Deno.env.get("${name}")`;
    default:
      return `"\${${name}:-}"`;
  }
}

const COMMON_ENV = new Set([...INHERITED_ENV_NAMES, "ERRORLEVEL"]);

function readPatterns(shell: ScriptShellType): RegExp[] {
  const id = "([A-Za-z_][A-Za-z0-9_]*)";
  switch (shell) {
    case "powershell":
      return [new RegExp(`\\$env:${id}`, "gi")];
    case "cmd":
      return [new RegExp(`%${id}%`, "g"), new RegExp(`!${id}!`, "g")];
    case "python":
      return [
        new RegExp(`os\\.environ\\.get\\(\\s*["']${id}["']`, "g"),
        new RegExp(`os\\.environ\\[\\s*["']${id}["']`, "g"),
        new RegExp(`os\\.getenv\\(\\s*["']${id}["']`, "g"),
      ];
    case "nushell":
      return [new RegExp(`\\$env\\.${id}`, "g")];
    case "deno":
      return [new RegExp(`Deno\\.env\\.get\\(\\s*["']${id}["']`, "g")];
    default:
      return [new RegExp(`\\$\\{?${id}`, "g")];
  }
}

// env names the body reads. POSIX: only UPPER_CASE names the script
// does not assign itself. skip inherited names (PATH, USERNAME, ...)
// unless they are in keep.
export function envReads(
  shell: ScriptShellType,
  body: string,
  keep: string[] = [],
): string[] {
  const kept = new Set(keep.map((n) => n.toUpperCase()));
  const found = new Map<string, string>();
  for (const re of readPatterns(shell)) {
    for (const m of body.matchAll(re)) {
      const key =
        shell === "powershell" || shell === "cmd" ? m[1].toUpperCase() : m[1];
      if (!found.has(key)) found.set(key, m[1]);
    }
  }
  let names = [...found.values()].filter(
    (n) => !COMMON_ENV.has(n.toUpperCase()) || kept.has(n.toUpperCase()),
  );
  if (shell === "shell") {
    // a name the script assigns is not an input, unless it is read
    // earlier or the assignment reads it (X="${X:-85}")
    names = names.filter((n) => {
      const set = body.match(
        new RegExp(
          `(^|[\\s;&|(])(export\\s+|readonly\\s+|local\\s+)?${n}=([^\\n]*)|\\b(read|for)\\b[^\\n]*\\b${n}\\b`,
          "m",
        ),
      );
      if (!set || set.index === undefined) return true;
      const ref = new RegExp(`\\$\\{?${n}\\b`);
      if (set[3] !== undefined && ref.test(set[3])) return true;
      const first = body.search(ref);
      return first >= 0 && first < set.index;
    });
  }
  return names;
}

// builder hints: declared but not read, or read but not declared
export function variableHints(
  shell: ScriptShellType,
  body: string,
  variables: ScriptVariable[] | undefined,
): { unused: string[]; undeclared: string[] } {
  const reads = envReads(
    shell,
    body,
    (variables || []).map((v) => v.name),
  );
  const ci = shell === "powershell" || shell === "cmd";
  const norm = (n: string) => (ci ? n.toUpperCase() : n);
  const readSet = new Set(reads.map(norm));
  const declared = (variables || []).map((v) => v.name).filter(Boolean);
  const declaredSet = new Set(declared.map(norm));
  return {
    unused: declared.filter((n) => !readSet.has(norm(n))),
    undeclared: reads.filter(
      (n) =>
        !declaredSet.has(norm(n)) &&
        (shell !== "shell" || /^[A-Z][A-Z0-9_]*$/.test(n)),
    ),
  };
}
