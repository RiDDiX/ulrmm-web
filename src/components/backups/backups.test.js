// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

import { describe, expect, it } from "vitest";
import { computed, reactive } from "vue";
import {
  DEFAULTS,
  EDITED,
  deleteMessage,
  deletePointPrompt,
  deviceWins,
  enforcedText,
  lastEnvPerName,
  fieldMark,
  hookName,
  pointTime,
  scopeText,
  deviceSaveBody,
  reloadState,
  envText,
  moreDevicesText,
  needsReload,
  warningText,
  withoutKeptEnv,
  hookConfirmPath,
  hookState,
  hooksForSave,
  mergeLog,
  pollDecision,
  reloadForm,
  pointLabel,
  rangeText,
  reviewState,
  runProgress,
  scheduleDefaults,
  devicePayload,
  fieldErrors,
  fieldLabel,
  formFromEffective,
  originLabel,
  policyBody,
  policyDraft,
  scheduleSummary,
  syncLabel,
  syncState,
  valueText,
} from "@/components/backups/backups";
import { NO_VALUE } from "@/utils/format";

const at = (iso) => `at ${iso}`;

describe("originLabel", () => {
  it.each([
    [{ level: "default", id: null, name: "Global default" }, "Global default"],
    [{ level: "global", id: 1, name: "Global default" }, "Global default"],
    [{ level: "client", id: 3, name: "Nordwind" }, "Client policy Nordwind"],
    [{ level: "site", id: 4, name: "HQ" }, "Site policy HQ"],
    [{ level: "group", id: 5, name: "Laptops" }, "Device group policy Laptops"],
    [
      { level: "tag", id: 6, name: "backup-laptops" },
      "Tag policy backup-laptops",
    ],
    [{ level: "assigned", id: 7, name: "DB" }, "Assigned devices policy DB"],
    [{ level: "device", id: null, name: "" }, "This device"],
    [null, NO_VALUE],
  ])("%j", (origin, text) => expect(originLabel(origin)).toBe(text));
});

describe("syncLabel", () => {
  const base = {
    config_version: 7,
    acked_version: 6,
    acked_at: null,
    pending_since: "2026-11-24T09:00:00Z",
    offline: false,
    errors: [],
  };
  it("pending names why", () => {
    expect(syncLabel({ ...base, state: "pending" }, at)).toBe(
      "Settings version 7 waits for the device since at 2026-11-24T09:00:00Z: not yet polled.",
    );
    expect(
      syncLabel(
        { ...base, state: "pending", offline: true, pending_since: null },
        at,
      ),
    ).toBe("Settings version 7 waits for the device: device offline.");
  });
  it("synced, error and legacy", () => {
    expect(
      syncLabel(
        { ...base, state: "synced", acked_at: "2026-11-24T09:01:00Z" },
        at,
      ),
    ).toBe(
      "Settings version 7 is applied on the device since at 2026-11-24T09:01:00Z.",
    );
    expect(syncLabel({ ...base, state: "error" }, at)).toBe(
      "The device refused settings version 7 and keeps its previous settings.",
    );
    expect(syncLabel({ ...base, state: "legacy" }, at)).toMatch(/^Older agent/);
    expect(syncLabel(null, at)).toBe("");
  });
  it("state pills", () => {
    expect(syncState("error").label).toBe("Refused");
    expect(syncState("").label).toBe(NO_VALUE);
  });
});

describe("scheduleSummary", () => {
  it.each([
    [{ kind: "none" }, "Manual only"],
    [undefined, "Manual only"],
    [{ kind: "daily", time: "02:30" }, "Daily at 02:30"],
    [{ kind: "interval", hours: 1 }, "Every hour"],
    [{ kind: "interval", hours: 6 }, "Every 6 hours"],
    [{ kind: "cron", expr: "0 3 * * 1-5" }, "Cron 0 3 * * 1-5"],
    [
      { kind: "calendar", frequency: "daily", run_time: "01:00" },
      "Daily at 01:00",
    ],
    [
      {
        kind: "calendar",
        frequency: "weekly",
        run_time: "01:00",
        weekdays: [0, 4],
      },
      "Weekly on Mon, Fri at 01:00",
    ],
    [
      {
        kind: "calendar",
        frequency: "monthly",
        run_time: "01:00",
        month_day: 15,
      },
      "Monthly on day 15 at 01:00",
    ],
    [
      {
        kind: "calendar",
        frequency: "monthly",
        run_time: "01:00",
        month_day: null,
        month_week: -1,
        month_weekday: 6,
      },
      "Monthly on the last Sun at 01:00",
    ],
    [
      {
        kind: "calendar",
        frequency: "once",
        run_time: "01:00",
        dates: ["2026-12-24"],
      },
      "Once on 2026-12-24 at 01:00",
    ],
  ])("%j", (schedule, text) => expect(scheduleSummary(schedule)).toBe(text));
});

describe("fieldLabel and valueText", () => {
  it("labels known fields and passes unknown keys", () => {
    expect(fieldLabel("auto_setup")).toBe("Automatic setup");
    expect(fieldLabel("encryption")).toBe("Encryption");
    expect(fieldLabel("proposed_hash")).toBe("Proposed hash");
  });
  it.each([
    ["target", 2, "nordwind-nas"],
    ["target", 9, "Target 9"],
    ["keep_awake", false, "Off"],
    ["volumes", ["/data", "D:"], "/data, D:"],
    ["volumes", [], NO_VALUE],
    [
      "hooks",
      [
        { phase: "pre-backup", script_id: 1, script_name: "Dump DB" },
        { phase: "post-backup", script_id: 4, script_name: "" },
      ],
      "Before the backup: Dump DB\nAfter the backup, always: Script 4",
    ],
    ["timezone", "", NO_VALUE],
    ["keep_last", 0, "0"],
    ["gfs", { hourly: 0, daily: 7, weekly: 4 }, "daily 7, weekly 4"],
    ["gfs", { hourly: 0, daily: 0 }, "No tiers"],
    ["throttle", { default_kbps: 0, rules: [{}] }, "Unlimited, 1 rules"],
  ])("%s %j", (key, value, text) =>
    expect(
      valueText(key, value, [
        { id: 1, name: "images" },
        { id: 2, name: "nordwind-nas" },
      ]),
    ).toBe(text),
  );
});

describe("devicePayload", () => {
  const fields = {
    target: { value: 1, locked: true },
    compression_level: { value: 6, locked: false },
    schedule: { value: { kind: "none" }, locked: false },
    volumes: { value: ["/a", "/b"], locked: false },
  };
  it("sends only changed, unlocked fields", () => {
    const form = formFromEffective(fields);
    expect(devicePayload(form, fields)).toEqual({ set: {}, reset: [] });
    form.target = 2;
    form.volumes = ["/b", "/a"];
    form.schedule = { kind: "daily", time: "03:00" };
    expect(devicePayload(form, fields)).toEqual({
      set: { schedule: { kind: "daily", time: "03:00" } },
      reset: [],
    });
  });
  it("a reset stays unless the field was edited again", () => {
    const form = formFromEffective(fields);
    expect(devicePayload(form, fields, ["compression_level"])).toEqual({
      set: {},
      reset: ["compression_level"],
    });
    form.compression_level = 3;
    expect(devicePayload(form, fields, ["compression_level"])).toEqual({
      set: { compression_level: 3 },
      reset: [],
    });
  });
  it("the form is a copy of the effective values, also of reactive ones", () => {
    const form = formFromEffective(reactive(fields));
    form.volumes.push("/c");
    expect(fields.volumes.value).toEqual(["/a", "/b"]);
  });
});

describe("policyBody", () => {
  const draft = {
    name: " Laptops ",
    scope: "group",
    client: 3,
    site: 4,
    group: 5,
    tag: 6,
    priority: "10",
    config: { target: 2, keep_last: 7 },
    enforced: ["target", "auto_setup", "keep_last"],
    agents: ["abc"],
  };
  it("keeps only the key of its scope and enforced fields it sets", () => {
    expect(policyBody(draft)).toEqual({
      name: "Laptops",
      scope: "group",
      client: null,
      site: null,
      group: 5,
      tag: null,
      priority: 10,
      config: { target: 2, keep_last: 7 },
      enforced: ["target"],
    });
  });
  it("sends agents only for assigned policies", () => {
    const body = policyBody({ ...draft, scope: "assigned", priority: "" });
    expect(body.agents).toEqual(["abc"]);
    expect(body.priority).toBe(0);
    expect([body.client, body.site, body.group, body.tag]).toEqual([
      null,
      null,
      null,
      null,
    ]);
  });
});

describe("fieldErrors", () => {
  it("flattens config and set errors with field labels", () => {
    expect(
      fieldErrors({
        fields: {
          config: { target: ["Unknown setting."] },
          enforced: "Enforce only settings this policy sets.",
        },
        message: "x",
      }),
    ).toEqual([
      "Backup target: Unknown setting.",
      "Enforced: Enforce only settings this policy sets.",
    ]);
  });
  it("falls back to the message", () => {
    expect(fieldErrors({ fields: {}, message: "Not allowed." })).toEqual([
      "Not allowed.",
    ]);
  });
});

describe("rangeText", () => {
  it.each([
    [
      { days: [1, 2, 3, 4, 5], start: "22:00", end: "06:00" },
      "Mon-Fri 22:00 to 06:00 next day",
    ],
    [{ days: [6, 7], start: "08:00", end: "18:00" }, "Sat, Sun 08:00 to 18:00"],
    [{ days: [3, 1], start: "01:00", end: "01:00" }, "Mon, Wed, whole day"],
    [
      { days: [1, 2, 3, 5, 6, 7], start: "00:00", end: "05:30" },
      "Mon-Wed, Fri-Sun 00:00 to 05:30",
    ],
    [
      { days: [1, 2, 3, 4, 5, 6, 7], start: "23:30", end: "00:30" },
      "Every day 23:30 to 00:30 next day",
    ],
  ])("%j", (range, text) => expect(rangeText(range)).toBe(text));
});

describe("pointLabel", () => {
  const point = {
    trigger: "schedule",
    native: { method: "linux-files-v1" },
    verified_at: "2026-11-24T09:00:00Z",
    size: 3 * 1024 ** 3,
    new_bytes: 1024 ** 3,
  };
  it("names trigger, method and the stored bytes", () => {
    expect(pointLabel(point)).toBe(
      "Scheduled · Linux live backup · full part list, 1.0 GB new, 2.0 GB reused",
    );
  });
  it("leaves out the bytes before verification and names offline images", () => {
    expect(pointLabel({ ...point, trigger: "event", verified_at: null })).toBe(
      "Event · Linux live backup",
    );
    expect(pointLabel({ native: null, verified_at: "x" })).toBe(
      "Manual · Offline disk image",
    );
  });
});

describe("runs", () => {
  it("progress only with an expected total", () => {
    expect(runProgress({ bytes_read: 50, expected_bytes: 200 })).toBe(0.25);
    expect(runProgress({ bytes_read: 300, expected_bytes: 200 })).toBe(1);
    expect(runProgress({ bytes_read: 50, expected_bytes: null })).toBeNull();
    expect(runProgress()).toBeNull();
  });
  it("mergeLog appends from the next index and marks dropped lines", () => {
    let log = { lines: [], next: 0 };
    log = mergeLog(log, { log: ["a", "b"], log_start: 0 });
    expect(log).toEqual({ lines: ["a", "b"], next: 2 });
    log = mergeLog(log, { log: ["c"], log_start: 0 });
    expect(log).toEqual({ lines: ["a", "b", "c"], next: 3 });
    log = mergeLog(log, { log: ["x"], log_start: 10 });
    expect(log).toEqual({
      lines: ["a", "b", "c", "(7 earlier lines dropped)", "x"],
      next: 11,
    });
    expect(mergeLog(log, { log: [], log_start: 0 })).toEqual(log);
    expect(
      mergeLog(
        { lines: ["a", "b"], next: 2 },
        { log: ["c"], log_start: 0 },
        2,
        2,
      ).lines,
    ).toEqual(["b", "c"]);
  });
});

describe("schedules and hooks", () => {
  it.each(["none", "daily", "interval", "calendar", "cron"])(
    "a new %s schedule summarises",
    (kind) =>
      expect(scheduleSummary(scheduleDefaults(kind))).not.toMatch(/undefined/),
  );
  it("every edited field has a builtin default except target", () => {
    expect(EDITED.filter((key) => !(key in DEFAULTS))).toEqual(["target"]);
  });
  it("hookState tells a changed from a deleted script", () => {
    const suspended = [
      { script_id: 1, name: "Dump DB", sha256: "ab" },
      { script_id: 2, name: "", sha256: "" },
    ];
    expect(hookState({ script_id: 1 }, suspended)).toBe("changed");
    expect(hookState({ script_id: 2 }, suspended)).toBe("deleted");
    expect(hookState({ script_id: 3 }, suspended)).toBe("");
  });
});

describe("reviewState", () => {
  const device = {
    capability: {
      supported: true,
      native: { method: "linux-files-v1" },
      reason: "Ready.",
    },
    storage: { configured: true, problem: "" },
    ready: true,
    not_ready_reason: "",
  };
  it("a capable, ready device on configured storage passes", () => {
    expect(reviewState(device)).toEqual({ ready: true, reason: "" });
  });
  it("names the first reason it is not", () => {
    expect(
      reviewState({
        ...device,
        ready: false,
        not_ready_reason: "The agent has no active identity.",
      }),
    ).toEqual({ ready: false, reason: "The agent has no active identity." });
    expect(
      reviewState({
        ...device,
        capability: { supported: false, reason: "Not on FreeBSD." },
      }),
    ).toEqual({
      ready: false,
      noSource: true,
      reason: "No native backup source: Not on FreeBSD.",
    });
    expect(
      reviewState({ ...device, storage: { configured: false, problem: "" } })
        .reason,
    ).toBe("System images are not set up on this server yet.");
    expect(reviewState({ error: "Not allowed." })).toEqual({
      ready: false,
      reason: "Not allowed.",
    });
    expect(reviewState(undefined).ready).toBe(false);
  });
});

describe("policyDraft", () => {
  const row = {
    id: 4,
    name: "DB servers",
    scope: "assigned",
    client: null,
    site: null,
    group: null,
    tag: null,
    priority: 0,
    config: { keep_last: 7 },
    enforced: [],
    agents: ["a", "b"],
  };
  it("a new policy from a device starts assigned with its settings", () => {
    const draft = policyDraft(null, {
      agentId: "c",
      config: { compression: "none" },
    });
    expect(draft).toMatchObject({
      scope: "assigned",
      agents: ["c"],
      config: { compression: "none" },
    });
  });
  it("a device joins an existing assignment once", () => {
    expect(policyDraft(row, { agentId: "b" }).agents).toEqual(["a", "b"]);
    expect(policyDraft(row, { agentId: "c" }).agents).toEqual(["a", "b", "c"]);
  });
  it("a new policy without a device starts as a client policy, copies the row", () => {
    expect(policyDraft(null).scope).toBe("client");
    const draft = policyDraft(row);
    draft.config.keep_last = 1;
    expect(row.config.keep_last).toBe(7);
  });
});

describe("review fixes", () => {
  const masked = {
    key: "a1b2c3d4",
    script_id: 12,
    phase: "pre-backup",
    timeout: 300,
    on_fail: "abort",
    args_count: 2,
    env_vars: [
      { name: "PGPASS", value: "", has_value: true },
      { name: "EMPTY", value: "", has_value: false },
    ],
  };
  it("masked hooks go back with kept values, never with a guessed one", () => {
    expect(
      hooksForSave([
        { ...masked, env_vars: [...masked.env_vars, "NEW=1"] },
        { script_id: 3, phase: "post-backup", args: [], env_vars: ["A=b"] },
      ]),
    ).toEqual([
      {
        key: "a1b2c3d4",
        script_id: 12,
        phase: "pre-backup",
        timeout: 300,
        on_fail: "abort",
        env_vars: [{ name: "PGPASS" }, "EMPTY=", "NEW=1"],
      },
      { script_id: 3, phase: "post-backup", args: [], env_vars: ["A=b"] },
    ]);
    expect(masked.env_vars.map(envText)).toEqual([
      "PGPASS (value kept)",
      "EMPTY=",
    ]);
  });
  it("a policy PUT keeps untouched hooks and sends edited ones", () => {
    const stored = { config: { hooks: [masked] } };
    const draft = {
      name: "DB",
      scope: "global",
      priority: 0,
      config: { hooks: [masked] },
      enforced: ["hooks"],
      agents: [],
    };
    const kept = policyBody(draft, stored);
    expect(kept.keep_hooks).toBe(true);
    expect(kept.config.hooks[0].env_vars[0]).toEqual({ name: "PGPASS" });
    expect(kept.enforced).toEqual(["hooks"]);
    const edited = policyBody(
      { ...draft, config: { hooks: [{ ...masked, timeout: 60 }] } },
      stored,
    );
    expect(edited.keep_hooks).toBeUndefined();
    expect(policyBody(draft, null).keep_hooks).toBeUndefined();
  });
  it("list-shaped and index-keyed errors read as paths", () => {
    expect(
      fieldErrors({
        fields: {
          config: {
            hooks: [{}, { script_id: ["This script does not exist."] }],
            volumes: { 1: ["Not an absolute path."] },
          },
          name: "This field may not be blank.",
        },
        message: "x",
      }),
    ).toEqual([
      "Hooks 2, Script: This script does not exist.",
      "Extra volumes 2: Not an absolute path.",
      "Name: This field may not be blank.",
    ]);
    expect(
      fieldErrors({
        fields: { set: { target: ["Enforced by backup policy Nordwind."] } },
        message: "x",
      }),
    ).toEqual(["Backup target: Enforced by backup policy Nordwind."]);
  });
  it("an overlapping log reply adds only the new lines", () => {
    const log = { lines: ["a", "b", "c"], next: 3 };
    expect(mergeLog(log, { log: ["b", "c", "d"], log_start: 0 }, 1)).toEqual({
      lines: ["a", "b", "c", "d"],
      next: 4,
    });
    expect(mergeLog(log, { log: ["b", "c"], log_start: 0 }, 1)).toEqual(log);
  });
  it("the poll decision", () => {
    expect(pollDecision(true, { status: "running" })).toBe("again");
    expect(pollDecision(true, { status: "succeeded" })).toBe("ended");
    expect(pollDecision(false, { status: "failed" })).toBe("stop");
    expect(pollDecision(true, null, 404)).toBe("ended");
    expect(pollDecision(false, null, 403)).toBe("ended");
    expect(pollDecision(true, null, 502)).toBe("again");
    expect(pollDecision(false, null, 502)).toBe("stop");
  });
  it("a reload keeps unsaved edits on top of the new values", () => {
    const fields = {
      keep_last: { value: 3 },
      compression: { value: "gzip" },
    };
    expect(reloadForm(fields, { keep_last: 9 })).toEqual({
      keep_last: 9,
      compression: "gzip",
    });
    expect(reloadForm(fields, null)).toEqual({
      keep_last: 3,
      compression: "gzip",
    });
  });
  it("a suspended hook is confirmed where its pin lives", () => {
    expect(
      hookConfirmPath({ origin: { level: "device", id: null } }, "ag1"),
    ).toBe("/agents/ag1/hooks/confirm/");
    expect(hookConfirmPath({ origin: { level: "tag", id: 7 } }, "ag1")).toBe(
      "/policies/7/hooks/confirm/",
    );
    expect(hookConfirmPath({}, "ag1")).toBe("/agents/ag1/hooks/confirm/");
  });
});

describe("interop fixes", () => {
  it("the tab reloads while a point waits for its run", () => {
    const waiting = {
      sync: { state: "synced" },
      active_run: null,
      images: [{ status: "waiting" }],
    };
    expect(needsReload(waiting)).toBe(true);
    expect(needsReload({ ...waiting, active_run: { id: "r" } })).toBe(false);
    expect(needsReload({ ...waiting, images: [{ status: "verified" }] })).toBe(
      false,
    );
    expect(needsReload({ sync: { state: "pending" }, images: [] })).toBe(true);
    expect(needsReload(null)).toBe(false);
  });
  it("a new policy from a device drops env entries without a value", () => {
    const hooks = [
      {
        key: "k1",
        script_id: 1,
        env_vars: [
          { name: "PGPASS", value: "", has_value: true },
          { name: "E", value: "", has_value: false },
          "A=b",
        ],
      },
    ];
    expect(withoutKeptEnv(hooks)).toEqual({
      hooks: [
        {
          key: "k1",
          script_id: 1,
          env_vars: [{ name: "E", value: "", has_value: false }, "A=b"],
        },
      ],
      names: ["PGPASS"],
    });
    const draft = policyDraft(null, { agentId: "c", config: { hooks } });
    expect(draft.config.hooks[0].env_vars).toHaveLength(2);
    expect(
      policyDraft({ name: "DB", config: { hooks }, agents: [] }).config.hooks[0]
        .env_vars,
    ).toHaveLength(3);
  });
  it("a warning without detail names its code", () => {
    expect(warningText({ code: "smart", detail: "" })).toBe("SMART warning");
    expect(warningText({ code: "x", detail: "" })).toBe("Warning");
    expect(warningText({ code: "hook", detail: "Hook Dump failed." })).toBe(
      "Hook Dump failed.",
    );
  });
  it("an assigned policy with devices cannot be deleted yet", () => {
    expect(
      deleteMessage({ scope: "assigned", agents: ["a"], reach: 1 }).canDelete,
    ).toBe(false);
    expect(deleteMessage({ scope: "assigned", agents: [], reach: 0 })).toEqual({
      canDelete: true,
      message: "0 devices follow the level below again.",
    });
    expect(deleteMessage({ scope: "tag", agents: [], reach: 1 }).message).toBe(
      "1 device follows the level below again.",
    );
  });
});

describe("moreDevicesText", () => {
  it("closes a capped warning list", () => {
    expect(moreDevicesText(0)).toBe("");
    expect(moreDevicesText(1)).toBe("and 1 more device");
    expect(moreDevicesText(37)).toBe("and 37 more devices");
  });
});

describe("device reload and save", () => {
  const old = {
    keep_last: { value: 3, locked: false },
    target: { value: 1, locked: false },
  };
  it("a reload keeps edits and resets, minus fields it locked", () => {
    const fields = {
      keep_last: { value: 5, locked: false },
      target: { value: 2, locked: true },
    };
    const form = { keep_last: 9, target: 4 };
    expect(reloadState(old, form, ["target"], fields)).toEqual({
      form: { keep_last: 9, target: 2 },
      resets: ["target"],
    });
  });
  it("a clean form, a first load or another device takes the new values", () => {
    const fields = { keep_last: { value: 5 }, target: { value: 2 } };
    expect(reloadState(old, { keep_last: 3, target: 1 }, [], fields)).toEqual({
      form: { keep_last: 5, target: 2 },
      resets: [],
    });
    expect(reloadState(undefined, { keep_last: 9 }, ["x"], fields)).toEqual({
      form: { keep_last: 5, target: 2 },
      resets: [],
    });
  });
  it("the device save sends masked hooks with kept values and asks for step-up", () => {
    const hooks = [
      {
        key: "k1",
        script_id: 12,
        args_count: 1,
        env_vars: [{ name: "PGPASS", value: "", has_value: true }],
      },
    ];
    expect(deviceSaveBody({ set: { hooks }, reset: [] }, [])).toEqual({
      body: {
        set: {
          hooks: [{ key: "k1", script_id: 12, env_vars: [{ name: "PGPASS" }] }],
        },
        reset: [],
      },
      stepUp: true,
    });
    const plain = deviceSaveBody({ set: { keep_last: 2 }, reset: ["gfs"] }, []);
    expect(plain).toEqual({
      body: { set: { keep_last: 2 }, reset: ["gfs"] },
      stepUp: false,
    });
    expect(deviceSaveBody({ set: {}, reset: ["hooks"] }, []).stepUp).toBe(true);
  });
});

describe("browser test fixes", () => {
  it("B1: the delete prompt reads the tab's computed formatter", () => {
    const formatDate = computed(() => (iso) => `at ${iso}`);
    expect(
      deletePointPrompt(
        { id: "e875", status: "verified", created_at: "c", snapshot_at: "s" },
        formatDate,
      ),
    ).toEqual({
      title: "Delete system image?",
      message: "at s · verified · e875",
    });
  });
  it("B5: scope and script names from the answer, else kind and id", () => {
    const row = { scope: "client", client: 3, priority: 0, agents: [] };
    expect(scopeText({ ...row, scope_name: "Sued" })).toBe("Sued");
    expect(scopeText(row)).toBe("Client 3");
    expect(
      scopeText({ scope: "tag", tag: 6, priority: 10, scope_name: "laptops" }),
    ).toBe("laptops · priority 10");
    expect(scopeText({ scope: "global", priority: 0, scope_name: "" })).toBe(
      "Every device",
    );
    expect(hookName({ script_id: 1, script_name: "acc-pre-backup" })).toBe(
      "acc-pre-backup",
    );
    expect(hookName({ script_id: 1 }, [{ id: 1, name: "From list" }])).toBe(
      "From list",
    );
    expect(hookName({ script_id: 1, script_name: "" })).toBe("Script 1");
  });
  it("B6: a device without a native source is marked", () => {
    expect(
      reviewState({
        capability: { supported: true, native: null, reason: "" },
      }),
    ).toEqual({
      ready: false,
      noSource: true,
      reason: "No native backup source.",
    });
  });
  it("B7: names the levels a lock binds", () => {
    expect(enforcedText("client")).toBe(
      "Enforced settings cannot be changed by site, group, tag or assigned policies or on a device.",
    );
    expect(enforcedText("assigned")).toBe(
      "Enforced settings cannot be changed on a device.",
    );
  });
  it("B8: marks a field edited or reset since the save", () => {
    const pending = { set: { quota_bytes: 10 }, reset: ["keep_last"] };
    expect(fieldMark("quota_bytes", pending)).toBe("changed");
    expect(fieldMark("keep_last", pending)).toBe("reset");
    expect(fieldMark("gfs", pending)).toBe("");
    expect(fieldMark("gfs", null)).toBe("");
  });
  it("B9: a point is shown at its snapshot time", () => {
    expect(pointTime({ created_at: "c", snapshot_at: "s" })).toBe("s");
    expect(pointTime({ created_at: "c", snapshot_at: null })).toBe("c");
  });
});

describe("policy review and hook edits", () => {
  it("a typed value replaces the kept entry of that name", () => {
    expect(
      lastEnvPerName([{ name: "TOKEN", has_value: true }, "TOKEN=new"]),
    ).toEqual(["TOKEN=new"]);
    expect(lastEnvPerName(["B=1", "TOKEN=old", "A=2", "TOKEN=new"])).toEqual([
      "B=1",
      "A=2",
      "TOKEN=new",
    ]);
    const kept = { name: "PGPASS", has_value: true };
    expect(lastEnvPerName(["A=1", kept, "B=2"])).toEqual(["A=1", kept, "B=2"]);
  });
  it("names the settings the device sets over this policy", () => {
    const reply = {
      overrides: { schedule: {}, keep_last: 1, target: 2, smart: "off" },
      effective: {
        fields: {
          schedule: { origin: { level: "device" } },
          keep_last: { origin: { level: "device" } },
          target: { origin: { level: "device" } },
          compression: { origin: { level: "client", id: 3 } },
          // locked by the assigned policy the device is in now
          smart: { origin: { level: "assigned", id: 7 }, locked: true },
        },
      },
    };
    const draft = {
      config: {
        schedule: {},
        keep_last: 3,
        target: 1,
        compression: "gzip",
        smart: "warn",
      },
      enforced: ["target"],
    };
    expect(deviceWins(draft, reply)).toEqual([
      "schedule",
      "keep_last",
      "smart",
    ]);
    // a client policy that locks the setting keeps the device value out
    reply.effective.fields.smart.origin.level = "client";
    expect(deviceWins(draft, reply)).toEqual(["schedule", "keep_last"]);
    expect(deviceWins(draft, { error: "x" })).toEqual([]);
    expect(deviceWins(draft, undefined)).toEqual([]);
  });
  it("a new policy from a device with hidden hooks does not set hooks", () => {
    const hooks = [{ script_id: 1, args_count: 2, env_vars: [] }];
    expect(
      policyDraft(null, { agentId: "c", config: { hooks, keep_last: 2 } })
        .config,
    ).toEqual({ keep_last: 2 });
    expect(
      policyDraft(null, {
        agentId: "c",
        config: { hooks: [{ script_id: 1, args: [], env_vars: [] }] },
      }).config.hooks,
    ).toHaveLength(1);
  });
});
