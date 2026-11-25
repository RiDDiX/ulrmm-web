// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

// Labels and payloads of the backup settings: origins, sync state, field
// values and the save bodies. No component state, so it can be tested alone.

import { nextTick } from "vue";
import {
  sameVolumes,
  volumesPayload,
} from "@/components/agents/imagingVolumes";
import { fmtBytes, NO_VALUE } from "@/utils/format";

const FIELD_LABELS = {
  target: "Backup target",
  network_mode: "Transfer network",
  compression: "Compression",
  compression_level: "Gzip level",
  schedule: "Schedule",
  schedule_events: "Event triggers",
  min_spacing_minutes: "Minimum spacing",
  catch_up: "Missed backups",
  catch_up_delay_minutes: "Catch-up delay",
  windows_allowed: "Backup windows",
  windows_blackout: "Blackout windows",
  stop_at_window_end: "Stop at window end",
  timezone: "Time zone",
  keep_last: "Keep last",
  gfs: "Retention tiers",
  quota_bytes: "Device quota",
  volumes: "Extra volumes",
  auto_setup: "Automatic setup",
  hooks: "Hooks",
  throttle: "Bandwidth limits",
  on_battery: "On battery",
  pause_on_battery: "Pause on battery",
  pause_max_minutes: "Pause limit",
  keep_awake: "Keep awake",
  priority: "Priority",
  smart: "SMART check",
  rpo_hours: "Recovery point objective",
  alert_failures: "Failures before an alert",
};

// keys without a label, such as the policy body's own, read as words
export const fieldLabel = (key) =>
  FIELD_LABELS[key] ??
  `${key.charAt(0).toUpperCase()}${key.slice(1).replaceAll("_", " ")}`;

// the fields of the editor, by section, in display order
export const GROUPS = [
  {
    label: "Target and transfer",
    keys: [
      "target",
      "network_mode",
      "compression",
      "compression_level",
      "volumes",
      "auto_setup",
    ],
  },
  {
    label: "Schedule",
    keys: [
      "schedule",
      "schedule_events",
      "timezone",
      "min_spacing_minutes",
      "catch_up",
      "catch_up_delay_minutes",
      "windows_allowed",
      "windows_blackout",
      "stop_at_window_end",
    ],
  },
  { label: "Retention and quota", keys: ["keep_last", "gfs", "quota_bytes"] },
  { label: "Hooks", keys: ["hooks"] },
  {
    label: "While a backup runs",
    keys: [
      "throttle",
      "priority",
      "on_battery",
      "pause_on_battery",
      "pause_max_minutes",
      "keep_awake",
      "smart",
    ],
  },
  { label: "Alerts", keys: ["rpo_hours", "alert_failures"] },
];
export const EDITED = GROUPS.flatMap((group) => group.keys);
export const ENFORCEABLE = ["target", "hooks", "auto_setup"];
// builtin values a policy starts from when it sets a field; target comes
// from the default target row
export const DEFAULTS = {
  network_mode: "internet",
  compression: "gzip",
  compression_level: 6,
  schedule: { kind: "none" },
  schedule_events: [],
  min_spacing_minutes: 60,
  catch_up: "run_asap",
  catch_up_delay_minutes: 10,
  windows_allowed: [],
  windows_blackout: [],
  stop_at_window_end: false,
  timezone: "",
  keep_last: 0,
  gfs: { hourly: 0, daily: 0, weekly: 0, monthly: 0, yearly: 0 },
  quota_bytes: 0,
  volumes: [],
  auto_setup: "safe",
  hooks: [],
  throttle: { default_kbps: 0, rules: [] },
  on_battery: "defer",
  pause_on_battery: true,
  pause_max_minutes: 30,
  keep_awake: true,
  priority: "background",
  smart: "warn",
  rpo_hours: 0,
  alert_failures: 3,
};

// plain inputs: numbers with their bounds, choices with their labels
export const NUMBERS = {
  compression_level: [0, 9, ""],
  min_spacing_minutes: [0, 10080, "min"],
  catch_up_delay_minutes: [0, 1440, "min"],
  keep_last: [0, 365, "points"],
  pause_max_minutes: [0, 240, "min"],
  rpo_hours: [0, 8760, "h"],
  alert_failures: [1, 100, "runs"],
};
export const CHOICES = {
  compression: [
    { value: "gzip", label: "Gzip" },
    { value: "none", label: "None" },
  ],
  auto_setup: [
    { value: "safe", label: "Apply safe fixes" },
    { value: "all", label: "Apply all fixes" },
    { value: "off", label: "Only report what is missing" },
  ],
  catch_up: [
    { value: "run_asap", label: "Run once when the device is back" },
    { value: "skip", label: "Skip missed runs" },
  ],
  on_battery: [
    { value: "defer", label: "Wait for AC power" },
    { value: "run", label: "Run on battery too" },
  ],
  priority: [
    { value: "background", label: "Background" },
    { value: "normal", label: "Normal" },
  ],
  smart: [
    { value: "warn", label: "Warn and go on" },
    { value: "abort", label: "Abort the backup" },
    { value: "off", label: "Do not check" },
  ],
};
export const SWITCHES = [
  "stop_at_window_end",
  "pause_on_battery",
  "keep_awake",
];
export const HINTS = {
  auto_setup: "What the agent may set up on its own before a backup",
  min_spacing_minutes: "Least time between two points of this device",
  catch_up_delay_minutes: "Wait after the device is back before a missed run",
  keep_last: "Newest verified points to keep, 0 = rely on the tiers",
  pause_max_minutes:
    "How long a run may pause for network or battery, 0 = no pause",
  rpo_hours: "Alert when no point is newer, 0 = derived from the schedule",
  stop_at_window_end: "End a run when its backup window closes",
  pause_on_battery: "Pause a running backup on battery power",
  keep_awake: "Keep the device awake while a backup runs",
  smart: "Disk health check before each backup",
};

export const SCOPES = {
  global: "Global",
  client: "Client",
  site: "Site",
  group: "Device group",
  tag: "Tag",
  assigned: "Assigned devices",
};
const SCOPE_KEYS = ["client", "site", "group", "tag"];

export function originLabel(origin) {
  if (!origin) return NO_VALUE;
  if (origin.level === "device") return "This device";
  if (origin.level === "default" || origin.level === "global")
    return origin.name;
  return `${SCOPES[origin.level] ?? origin.level} policy ${origin.name}`;
}

const SYNC_STATE = {
  synced: { label: "Synced", cls: "rmm-pill--positive" },
  pending: { label: "Pending", cls: "rmm-pill--info" },
  error: { label: "Refused", cls: "rmm-pill--negative" },
  legacy: { label: "Older agent", cls: "rmm-pill--neutral" },
};

export const syncState = (state) =>
  SYNC_STATE[state] ?? { label: state || NO_VALUE, cls: "rmm-pill--neutral" };

export function syncLabel(sync, formatDate) {
  if (!sync) return "";
  const version = `Settings version ${sync.config_version}`;
  switch (sync.state) {
    case "legacy":
      return "Older agent: settings apply on the server only. Update the agent.";
    case "synced":
      return `${version} is applied on the device${sync.acked_at ? ` since ${formatDate(sync.acked_at)}` : ""}.`;
    case "error":
      return `The device refused ${version.toLowerCase()} and keeps its previous settings.`;
    default:
      return `${version} waits for the device${sync.pending_since ? ` since ${formatDate(sync.pending_since)}` : ""}: ${sync.offline ? "device offline" : "not yet polled"}.`;
  }
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const ORDINAL = {
  1: "first",
  2: "second",
  3: "third",
  4: "fourth",
  "-1": "last",
};

// weekdays count from Monday = 0, as in the server's calendar rule
function calendarSummary(s) {
  const at = ` at ${s.run_time}`;
  switch (s.frequency) {
    case "once":
      return `Once on ${(s.dates ?? []).join(", ")}${at}`;
    case "weekly":
      return `Weekly on ${(s.weekdays ?? []).map((d) => WEEKDAYS[d]).join(", ")}${at}`;
    case "monthly":
      return s.month_day
        ? `Monthly on day ${s.month_day}${at}`
        : `Monthly on the ${ORDINAL[s.month_week]} ${WEEKDAYS[s.month_weekday]}${at}`;
    default:
      return `Daily${at}`;
  }
}

export function scheduleSummary(schedule) {
  switch (schedule?.kind) {
    case "daily":
      return `Daily at ${schedule.time}`;
    case "interval":
      return schedule.hours === 1
        ? "Every hour"
        : `Every ${schedule.hours} hours`;
    case "calendar":
      return calendarSummary(schedule);
    case "cron":
      return `Cron ${schedule.expr}`;
    default:
      return "Manual only";
  }
}

// one line for a field value, as the hold review and the policy list show it
export function valueText(key, value, targets = []) {
  if (key === "schedule") return scheduleSummary(value);
  if (key === "target")
    return targets.find((t) => t.id === value)?.name ?? `Target ${value}`;
  if (key === "hooks")
    return value?.length
      ? value
          .map(
            (hook) =>
              `${PHASES.find((p) => p.value === hook.phase)?.label ?? hook.phase}: ${hookName(hook)}`,
          )
          .join("\n")
      : NO_VALUE;
  if (key === "gfs") {
    const kept = Object.entries(value ?? {}).filter(([, n]) => n > 0);
    return kept.length
      ? kept.map(([tier, n]) => `${tier} ${n}`).join(", ")
      : "No tiers";
  }
  if (key === "throttle")
    return `${value?.default_kbps ? `${value.default_kbps} kbps` : "Unlimited"}, ${value?.rules?.length ?? 0} rules`;
  if (typeof value === "boolean") return value ? "On" : "Off";
  if (Array.isArray(value)) {
    if (!value.length) return NO_VALUE;
    return value.every((item) => typeof item === "string")
      ? value.join(", ")
      : `${value.length} ${value.length === 1 ? "entry" : "entries"}`;
  }
  if (value === null || value === undefined || value === "") return NO_VALUE;
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}

// lists of strings compare as sets, the volume table ticks in any order
function sameValue(a, b) {
  if (
    Array.isArray(a) &&
    Array.isArray(b) &&
    a.every((x) => typeof x === "string")
  )
    return sameVolumes(a, b);
  return JSON.stringify(a) === JSON.stringify(b);
}

// setting values are JSON; structuredClone refuses Vue's reactive proxies
export const copy = (value) => JSON.parse(JSON.stringify(value));

export const formFromEffective = (fields = {}) =>
  Object.fromEntries(
    EDITED.filter((key) => key in fields).map((key) => [
      key,
      copy(fields[key].value),
    ]),
  );

// a reload under unsaved edits: the new effective values with the pending
// edits on top, so neither the reload nor the edits get lost; an edit of a
// field the reload locked is dropped, the save would omit it anyway
export const reloadForm = (fields = {}, pending) => ({
  ...formFromEffective(fields),
  ...copy(
    Object.fromEntries(
      Object.entries(pending ?? {}).filter(([key]) => !fields[key]?.locked),
    ),
  ),
});

// the form and resets after a reload: kept under unsaved edits, else the new
// values; without earlier fields (first load, other device) nothing is kept
export function reloadState(oldFields, form, resets, fields) {
  const { set, reset } = oldFields
    ? devicePayload(form, oldFields, resets)
    : { set: {}, reset: [] };
  const dirty = Object.keys(set).length > 0 || reset.length > 0;
  return dirty
    ? { form: reloadForm(fields, set), resets }
    : { form: reloadForm(fields, null), resets: [] };
}

// PUT /imaging/agents/<id>/ {set, reset}: a field edited after its reset is
// set, not reset; enforced fields are never sent
export function devicePayload(form, fields = {}, resets = []) {
  const set = {};
  for (const [key, value] of Object.entries(form))
    if (!fields[key]?.locked && !sameValue(value, fields[key]?.value))
      set[key] = value;
  return { set, reset: resets.filter((key) => !(key in set)) };
}

// the device save body: volume selectors as the server takes them, hooks
// with kept environment values; hook changes need the step-up
export function deviceSaveBody({ set, reset }, volumes) {
  const out = { ...set };
  if ("volumes" in out) out.volumes = volumesPayload(volumes, out.volumes);
  if ("hooks" in out) out.hooks = hooksForSave(out.hooks);
  return {
    body: { set: out, reset },
    stepUp: "hooks" in out || reset.includes("hooks"),
  };
}

// answers never carry an environment value: {name, value: "", has_value};
// a save keeps a stored value with {name} and sends only values typed here
function envForSave(entry) {
  if (typeof entry === "string") return entry;
  return entry.has_value ? { name: entry.name } : `${entry.name}=`;
}
// a typed NAME=value replaces an earlier entry of that name, kept or typed
export function lastEnvPerName(entries = []) {
  const name = (entry) =>
    typeof entry === "string" ? entry.split("=")[0] : entry.name;
  const names = entries.map(name);
  return entries.filter((entry, i) => names.lastIndexOf(name(entry)) === i);
}
export const envText = (entry) =>
  typeof entry === "string"
    ? entry
    : entry.has_value
      ? `${entry.name} (value kept)`
      : `${entry.name}=`;

// the hooks of a save: key kept for existing hooks, args_count dropped
export const hooksForSave = (hooks = []) =>
  hooks.map((hook) => {
    const out = { ...hook, env_vars: (hook.env_vars ?? []).map(envForSave) };
    delete out.args_count;
    return out;
  });

// POST and PUT /imaging/policies/: only the key of the scope, enforced only
// for fields the policy sets, agents only for assigned policies; a PUT that
// leaves the hooks alone keeps the stored ones with their approval
export function policyBody(draft, stored = null) {
  const config = { ...draft.config };
  if ("hooks" in config) config.hooks = hooksForSave(config.hooks);
  const body = {
    name: draft.name.trim(),
    scope: draft.scope,
    priority: Number(draft.priority) || 0,
    config,
    enforced: draft.enforced.filter(
      (key) => ENFORCEABLE.includes(key) && key in draft.config,
    ),
  };
  for (const key of SCOPE_KEYS)
    body[key] = draft.scope === key ? draft[key] : null;
  if (draft.scope === "assigned") body.agents = draft.agents;
  if (
    stored &&
    JSON.stringify(stored.config?.hooks) === JSON.stringify(draft.config.hooks)
  )
    body.keep_hooks = true;
  return body;
}

const NESTED_LABELS = {
  script_id: "Script",
  env_vars: "Environment",
  args: "Arguments",
  on_fail: "On failure",
  phase: "When",
  timeout: "Timeout",
  rules: "Rules",
  days: "Days",
  start: "From",
  end: "To",
};
const indexed = (path, i) =>
  path.length
    ? [...path.slice(0, -1), `${path.at(-1)} ${i + 1}`]
    : [`Entry ${i + 1}`];
// DRF nests errors in dicts, lists of dicts (many=True) and dicts keyed by
// list index (ListField); the path reads "Hooks 2, Script"
function walkErrors(value, path, lines) {
  if (typeof value === "string") {
    lines.push(path.length ? `${path.join(", ")}: ${value}` : value);
  } else if (Array.isArray(value)) {
    value.forEach((item, i) =>
      walkErrors(
        item,
        typeof item === "string" ? path : indexed(path, i),
        lines,
      ),
    );
  } else if (value && typeof value === "object") {
    for (const [key, inner] of Object.entries(value)) {
      if (!path.length && (key === "config" || key === "set"))
        walkErrors(inner, path, lines);
      else if (/^\d+$/.test(key))
        walkErrors(inner, indexed(path, Number(key)), lines);
      else
        walkErrors(
          inner,
          [
            ...path,
            path.length
              ? (NESTED_LABELS[key] ?? fieldLabel(key))
              : fieldLabel(key),
          ],
          lines,
        );
    }
  }
}

// serverErrors() of a 400, one line per error
export function fieldErrors({ fields, message }) {
  const lines = [];
  walkErrors(fields, [], lines);
  return lines.length ? lines : [message];
}

export const HOLD_CAUSE = {
  group_rule: "a device group rule changed",
  group_member: "a dynamic device group changed its members",
  tag: "a tag changed",
  site_move: "the device moved to another site",
  unknown: "the device's memberships changed",
};

export const CHECK_STATE = {
  ok: { label: "Passed", icon: "check_circle", color: "positive" },
  fixed: { label: "Fixed", icon: "build_circle", color: "positive" },
  missing: { label: "Missing", icon: "cancel", color: "negative" },
  failed: { label: "Failed", icon: "error", color: "negative" },
  manual: { label: "Manual step", icon: "pan_tool", color: "warning" },
};

const ISO_DAYS = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// {days: [1-7], start, end} as "Mon-Fri 22:00 to 06:00 next day"; an end
// before the start runs past midnight, an equal end is the whole day
export function rangeText({ days = [], start, end }) {
  const sorted = [...new Set(days)].sort((a, b) => a - b);
  const runs = [];
  for (const day of sorted) {
    const last = runs.at(-1);
    if (last && day === last[1] + 1) last[1] = day;
    else runs.push([day, day]);
  }
  const when =
    sorted.length === 7
      ? "Every day"
      : runs
          .map(([a, b]) =>
            a === b
              ? ISO_DAYS[a]
              : b === a + 1
                ? `${ISO_DAYS[a]}, ${ISO_DAYS[b]}`
                : `${ISO_DAYS[a]}-${ISO_DAYS[b]}`,
          )
          .join(", ");
  if (start === end) return `${when}, whole day`;
  return `${when} ${start} to ${end}${end < start ? " next day" : ""}`;
}

export function scheduleDefaults(kind) {
  switch (kind) {
    case "daily":
      return { kind, time: "02:00" };
    case "interval":
      return { kind, hours: 24 };
    case "calendar":
      return {
        kind,
        frequency: "weekly",
        run_time: "02:00",
        weekdays: [0],
        month_day: null,
        month_week: null,
        month_weekday: null,
        dates: [],
        excluded_dates: [],
        start_date: null,
        end_date: null,
      };
    case "cron":
      return { kind, expr: "0 2 * * *" };
    default:
      return { kind: "none" };
  }
}

export const TRIGGERS = {
  schedule: "Scheduled",
  manual: "Manual",
  event: "Event",
};
const METHODS = {
  "windows-wbadmin-tar-v1": "Windows system image",
  "linux-offline-disk-v1": "Offline Linux disk",
  "linux-files-v1": "Linux live backup",
  "macos-timemachine-disk-v1": "macOS Time Machine disk",
};

// trigger, method and, once verified, the new and reused stored bytes; every
// native point is a full part list, reused bytes are the stored rest
export function pointLabel(image) {
  const method = image.native?.method;
  const parts = [
    TRIGGERS[image.trigger] ?? TRIGGERS.manual,
    method ? (METHODS[method] ?? method) : "Offline disk image",
  ];
  if (method && image.verified_at) {
    const reused = Math.max((image.size ?? 0) - (image.new_bytes ?? 0), 0);
    parts.push(
      `full part list, ${fmtBytes(image.new_bytes)} new, ${fmtBytes(reused)} reused`,
    );
  }
  return parts.join(" · ");
}

const RUN_STATUS = {
  deferred: { label: "Waiting", cls: "rmm-pill--info" },
  running: { label: "Running", cls: "rmm-pill--info" },
  paused: { label: "Paused", cls: "rmm-pill--warning" },
  succeeded: { label: "Succeeded", cls: "rmm-pill--positive" },
  failed: { label: "Failed", cls: "rmm-pill--negative" },
  cancelled: { label: "Cancelled", cls: "rmm-pill--neutral" },
  interrupted: { label: "Interrupted", cls: "rmm-pill--warning" },
};
export const runStatus = (status) =>
  RUN_STATUS[status] ?? { label: status || NO_VALUE, cls: "rmm-pill--neutral" };
export const runActive = (run) => ["running", "paused"].includes(run?.status);

// share of the expected bytes read, null while the total is unknown
export function runProgress(counters = {}) {
  const { bytes_read: read = 0, expected_bytes: total } = counters;
  return total > 0 ? Math.min(read / total, 1) : null;
}

// the detail answers the lines from max(log_from, log_start) on; lines
// before next are known already, a start after next means dropped lines
export function mergeLog({ lines, next }, reply, from = next, cap = 200) {
  const log = reply.log ?? [];
  const first = Math.max(from, reply.log_start ?? 0);
  const fresh = log.slice(Math.max(next - first, 0));
  if (!fresh.length) return { lines, next };
  const gap = first > next ? [`(${first - next} earlier lines dropped)`] : [];
  return {
    lines: [...lines, ...gap, ...fresh].slice(-cap),
    next: Math.max(next, first) + fresh.length,
  };
}

// after a poll of a run: "again" while it runs, "ended" once it stopped
// under the panel or is gone (403, 404), "stop" for a run that had ended
export function pollDecision(wasActive, reply, status = 0) {
  if (status === 403 || status === 404) return "ended";
  if (status) return wasActive ? "again" : "stop";
  if (runActive(reply)) return "again";
  return wasActive ? "ended" : "stop";
}

export const PHASES = [
  { value: "pre-backup", label: "Before the backup" },
  { value: "pre-snapshot", label: "Before the snapshot" },
  { value: "post-snapshot", label: "After the snapshot" },
  { value: "post-backup", label: "After the backup, always" },
];

// a suspended hook is confirmed where its pin lives: the device or a policy
export const hookConfirmPath = (entry, agentId) =>
  !entry.origin || entry.origin.level === "device"
    ? `/agents/${agentId}/hooks/confirm/`
    : `/policies/${entry.origin.id}/hooks/confirm/`;

// a hook whose script changed waits for a confirm; a deleted one can only go
export function hookState(hook, suspended = []) {
  const entry = suspended.find((item) => item.script_id === hook.script_id);
  if (!entry) return "";
  return entry.name ? "changed" : "deleted";
}

export const ALERT_KINDS = {
  run_failed: "Run failed",
  failures_in_row: "Failures in a row",
  interruptions_in_row: "Interruptions in a row",
  stale: "No recent point",
  verify_failed: "Verification failed",
  config_error: "Settings refused",
  readiness_lost: "Readiness lost",
  quota_exceeded: "Quota exceeded",
  quota_high: "Quota above 90 %",
  smart_warning: "SMART warning",
  target_unreachable: "Target unreachable",
  hook_suspended: "Hook suspended",
};

// the per-device review of an assigned policy: an error or a device that
// cannot back up is not ready, the reason says why
export function reviewState(reply) {
  if (!reply) return { ready: false, reason: "" };
  if (reply.error) return { ready: false, reason: reply.error };
  const capability = reply.capability ?? {};
  const capable = !!(capability.supported && capability.native?.method);
  // the server refuses a device without a native source; say so up front
  if (!capable)
    return {
      ready: false,
      noSource: true,
      reason: `No native backup source${capability.reason ? `: ${capability.reason}` : "."}`,
    };
  const ready = reply.ready !== false && !!reply.storage?.configured;
  const reason = ready
    ? ""
    : reply.not_ready_reason ||
      (reply.storage?.configured === false
        ? reply.storage.problem ||
          "System images are not set up on this server yet."
        : capability.reason);
  return { ready, reason };
}

// a value set on the device beats an assigned policy unless that policy
// enforces it or a policy of another level locks it; the lock of the
// assigned policy the device is in now ends with this save
export function deviceWins(draft, reply) {
  const fields = reply?.effective?.fields ?? {};
  const own = reply?.overrides ?? {};
  return Object.keys(draft.config).filter(
    (key) =>
      key in own &&
      !draft.enforced.includes(key) &&
      !(fields[key]?.locked && fields[key].origin?.level !== "assigned"),
  );
}

// hooks with hidden arguments can be neither edited nor saved by this role
function fromDevice(config) {
  const out = copy(config);
  if (out.hooks?.some((hook) => hook.args_count !== undefined))
    delete out.hooks;
  else if (out.hooks) out.hooks = withoutKeptEnv(out.hooks).hooks;
  return out;
}

// the editor state of a policy row, or of a new one; opened from a device,
// that device joins the assignment and a new policy starts from its settings
export function policyDraft(policy, { agentId = "", config = {} } = {}) {
  return {
    name: policy?.name ?? "",
    scope: policy?.scope ?? (agentId ? "assigned" : "client"),
    client: policy?.client ?? null,
    site: policy?.site ?? null,
    group: policy?.group ?? null,
    tag: policy?.tag ?? null,
    priority: policy?.priority ?? 0,
    config: policy ? copy(policy.config) : fromDevice(config),
    enforced: [...(policy?.enforced ?? [])],
    agents: [
      ...new Set([...(policy?.agents ?? []), ...(agentId ? [agentId] : [])]),
    ],
  };
}

// the device tab reloads on its own while settings wait for the device and
// while a point waits for its run, which the agent's claim creates
export function needsReload(info) {
  if (!info) return false;
  if (info.sync?.state === "pending") return true;
  return (
    !info.active_run &&
    (info.images ?? []).some((image) =>
      ["waiting", "uploading"].includes(image.status),
    )
  );
}

// a new policy has no stored values to keep: copied hooks lose the
// environment entries whose value the answer did not carry
export function withoutKeptEnv(hooks = []) {
  const names = [];
  const out = hooks.map((hook) => ({
    ...hook,
    env_vars: (hook.env_vars ?? []).filter((entry) => {
      if (typeof entry === "string" || !entry.has_value) return true;
      names.push(entry.name);
      return false;
    }),
  }));
  return { hooks: out, names };
}

const WARNING_CODES = {
  smart: "SMART warning",
  hook: "A hook reported a problem",
  window: "The backup window ends soon",
  other: "Warning",
};
export const warningText = (warning) =>
  warning.detail || WARNING_CODES[warning.code] || WARNING_CODES.other;

// an assigned policy is deleted once no device follows it any more
export function deleteMessage(policy) {
  const n = policy.scope === "assigned" ? policy.agents.length : 0;
  if (n)
    return {
      canDelete: false,
      message: `${n} ${n === 1 ? "device is" : "devices are"} still assigned. Open the policy, remove them and save, then delete it.`,
    };
  return {
    canDelete: true,
    message: `${policy.reach} ${policy.reach === 1 ? "device follows" : "devices follow"} the level below again.`,
  };
}

// the closing line of a save's warning list, which the server caps at 100
export const moreDevicesText = (n) =>
  n > 0 ? `and ${n} more ${n === 1 ? "device" : "devices"}` : "";

// answers name a policy's client, site, group or tag in scope_name; without
// it the kind and id stand in
export function scopeText(policy) {
  const id = policy[policy.scope];
  const name =
    policy.scope_name || (id != null ? `${SCOPES[policy.scope]} ${id}` : "");
  switch (policy.scope) {
    case "client":
    case "site":
      return name;
    case "group":
    case "tag":
      return `${name} · priority ${policy.priority}`;
    case "assigned":
      return `${policy.agents.length} assigned`;
    default:
      return "Every device";
  }
}

// hook entries and results carry script_name; empty when the script is gone
export const hookName = (hook, scripts = []) =>
  hook.script_name ||
  scripts.find((s) => s.id === hook.script_id)?.name ||
  (hook.script_id ? `Script ${hook.script_id}` : "");

// a device field edited or reset since the last save
export function fieldMark(key, pending) {
  if (pending?.reset?.includes(key)) return "reset";
  return pending?.set && key in pending.set ? "changed" : "";
}

// a lock binds the levels applied after the policy's own, and the device
const ENFORCED_BY = {
  global: "by client, site, group, tag or assigned policies or on a device",
  client: "by site, group, tag or assigned policies or on a device",
  site: "by group, tag or assigned policies or on a device",
  group:
    "by group or tag policies of higher priority, assigned policies or on a device",
  tag: "by group or tag policies of higher priority, assigned policies or on a device",
  assigned: "on a device",
};
export const enforcedText = (scope) =>
  `Enforced settings cannot be changed ${ENFORCED_BY[scope] ?? "on a device"}.`;

// the time a point stands for, the same the retention preview shows as at
export const pointTime = (image) => image.snapshot_at || image.created_at;

// formatDate is the tab's computed formatter, a ref in script code
export const deletePointPrompt = (image, formatDate) => ({
  title: "Delete system image?",
  message: `${formatDate.value(pointTime(image))} · ${image.status} · ${image.id}`,
});

// a dialog that v-if unmounts cannot hand the focus back; call this when it
// opens and the returned function when it closes
export function returnFocus() {
  const opener = document.activeElement;
  return () => nextTick(() => opener?.focus?.());
}
