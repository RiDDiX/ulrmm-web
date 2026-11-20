// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

import { describe, expect, it } from "vitest";
import { NO_VALUE } from "@/utils/format";
import {
  count,
  IMPORT_FILE_MAX,
  importFileError,
  importSummary,
  keptAgentText,
  partNotes,
  partsOffered,
  readOutcome,
  recoveryText,
  removalView,
  removalAskable,
  removalWaiting,
  saveErrors,
  skippedByPart,
  withoutSiteText,
} from "@/utils/importers";

const OLD_SIX = [
  "clients",
  "custom_fields",
  "scripts",
  "snippets",
  "keystore",
  "devices",
];

describe("partsOffered", () => {
  it("shows only what the source offers, sites with clients", () => {
    expect(partsOffered(OLD_SIX).map((p) => p.key)).toEqual([
      "clients",
      "sites",
      "custom_fields",
      "scripts",
      "snippets",
      "keystore",
      "devices",
    ]);
    expect(partsOffered(["users", "roles"]).map((p) => p.key)).toEqual([
      "roles",
      "users",
    ]);
  });
});

describe("partNotes", () => {
  it("adds a line only above zero", () => {
    expect(partNotes("roles", { unknown_permissions: 0 })).toEqual([]);
    expect(partNotes("roles", { unknown_permissions: 3 })[0]).toMatch(/^3 /);
    expect(partNotes("devices", { with_device_data: 2 })[0]).toMatch(/^2 /);
    expect(partNotes("users", { note: "as it is" })).toEqual(["as it is"]);
  });

  it("names the policies a run completes", () => {
    expect(partNotes("policies", { to_complete_count: 0 })).toEqual([]);
    expect(
      partNotes("policies", { to_complete: ["A", "B"], to_complete_count: 3 }),
    ).toEqual([
      "3 policies imported earlier are completed with the checks, tasks or alert template they still lack: A, B, ...",
    ]);
    expect(
      partNotes("policies", { to_complete: ["A"], to_complete_count: 1 })[0],
    ).toMatch(/^1 policy imported earlier is completed .* it still lacks: A$/);
  });
});

describe("importSummary", () => {
  it("names the chosen parts and the links", () => {
    const r = { clients: 2, sites: 3, users: 1, devices: 4, linked: 1 };
    expect(importSummary(r, ["clients", "users", "devices"])).toBe(
      "Added 2 clients, 3 sites, 1 user, 4 devices; 1 device linked to enrolled agents.",
    );
    expect(importSummary({ roles: 0 }, ["roles"])).toBe("Added 0 roles.");
    expect(
      importSummary({ url_actions: 1, policies: 1, keystore: 1 }, [
        "url_actions",
        "policies",
        "keystore",
      ]),
    ).toBe("Added 1 key store entry, 1 URL action, 1 policy.");
    expect(
      importSummary({ policies: 0, completed: { policies: 2 } }, ["policies"]),
    ).toBe("Added 0 policies; 2 policies completed.");
    expect(
      importSummary({ policies: 1, completed: { policies: 0 } }, ["policies"]),
    ).toBe("Added 1 policy.");
  });
});

describe("count", () => {
  it("uses the singular only for one", () => {
    expect(count(1, "device")).toBe("1 device");
    expect(count(0, "device")).toBe("0 devices");
    expect(count(2, "policy", "policies")).toBe("2 policies");
    expect(withoutSiteText(1)).toMatch(/^1 device has no site/);
    expect(withoutSiteText(3)).toMatch(/^3 devices have no site/);
    expect(partNotes("roles", { unknown_permissions: 1 })[0]).toMatch(
      /^1 permission .* is left out/,
    );
    expect(partNotes("devices", { with_device_data: 1 })[0]).toMatch(
      /^1 device brings its own/,
    );
  });
});

describe("skippedByPart", () => {
  it("keeps the import order and drops empty parts", () => {
    const item = { name: "a", reason: "b" };
    expect(
      skippedByPart({ devices: [item], policies: [item], roles: [] }),
    ).toEqual([
      {
        label: "Policies with their checks and tasks",
        items: [item],
        total: 1,
      },
      { label: "Devices", items: [item], total: 1 },
    ]);
    expect(skippedByPart(undefined)).toEqual([]);
  });

  it("counts what the server left out of the list", () => {
    const item = { name: "a", reason: "b" };
    expect(
      skippedByPart({ devices: [item], roles: [item] }, { devices: 350 }),
    ).toEqual([
      { label: "Roles", items: [item], total: 1 },
      { label: "Devices", items: [item], total: 350 },
    ]);
  });
});

describe("importFileError", () => {
  it("lets a file up to 64 MB through and stops a larger one", () => {
    expect(importFileError({ size: IMPORT_FILE_MAX })).toBe("");
    expect(importFileError({ size: IMPORT_FILE_MAX + 1 })).toBe(
      "The file is larger than 64 MB.",
    );
    expect(importFileError(null)).toBe("Choose the export file.");
    expect(IMPORT_FILE_MAX).toBe(64 * 1024 * 1024);
  });
});

describe("readOutcome", () => {
  it("waits until last_fetch moves or an error is set", () => {
    expect(readOutcome("t1", null)).toBe("running");
    expect(readOutcome("t1", { last_fetch: "t1", last_error: "" })).toBe(
      "running",
    );
    expect(readOutcome("t1", { last_fetch: "t2", last_error: "" })).toBe(
      "done",
    );
    expect(readOutcome(null, { last_fetch: "t2" })).toBe("done");
  });

  it("sees the same error as last time", () => {
    expect(readOutcome("t1", { last_fetch: "t1", last_error: "500" })).toBe(
      "failed",
    );
  });
});

describe("saveErrors", () => {
  const fields = ["name", "url", "secrets"];

  it("keeps known fields inline", () => {
    expect(saveErrors({ name: ["taken"], url: "bad" }, fields)).toEqual({
      fields: { name: "taken", url: "bad" },
      message: "",
    });
  });

  it("puts other keys into the message", () => {
    expect(
      saveErrors(
        {
          name: ["taken"],
          verify_tls: ["must be a boolean"],
          options: { client_id: ["required"] },
          non_field_errors: ["unknown kind"],
        },
        fields,
      ),
    ).toEqual({
      fields: { name: "taken" },
      message: "Verify tls: must be a boolean Options: required unknown kind",
    });
  });

  it("shows a detail and a text body", () => {
    expect(saveErrors({ detail: "no permission" }, fields)).toEqual({
      fields: {},
      message: "no permission",
    });
    expect(saveErrors("Bad request", fields).message).toBe("Bad request");
    const busy =
      "A read, an import or a send runs for this source; try again when it is done.";
    expect(saveErrors(busy, fields)).toEqual({ fields: {}, message: busy });
    expect(saveErrors("<html>500</html>", fields).message).toBe("");
    expect(saveErrors(undefined, fields)).toEqual({ fields: {}, message: "" });
  });
});

describe("removalView", () => {
  const fmt = (v: string) => `at ${v}`;

  it.each([
    ["", "", NO_VALUE],
    ["waiting_here", "offline here", "waiting for the device here"],
    [
      "waiting_there",
      "offline on the other server",
      "waiting for it on the other server",
    ],
    ["not_removed", "not removed within 7 days", "not removed"],
  ])("%s", (state, reason, label) => {
    const v = removalView({ remove_state: state, remove_reason: reason }, fmt);
    expect(v.label).toBe(label);
    expect(v.details).toEqual(reason ? [reason] : []);
  });

  it("shows the time and the repair of a removal", () => {
    const v = removalView(
      { remove_state: "removed", remove_at: "t", recovery: "failed: timeout" },
      fmt,
    );
    expect(v).toEqual({
      label: "removed",
      color: "positive",
      details: [
        "at t",
        "Repair of remote control failed and is tried again hourly: timeout",
      ],
    });
  });

  it("knows which rows still wait", () => {
    expect(removalWaiting({ remove_state: "waiting_there" })).toBe(true);
    expect(removalWaiting({ remove_state: "sending" })).toBe(false);
  });

  it("names an earlier removal in the send dialog", () => {
    expect(keptAgentText([{ remove_state: "" }])).toBe(
      "The old agent stays installed; remove it once the device shows up here.",
    );
    expect(
      keptAgentText([
        { remove_state: "waiting_here" },
        { remove_state: "" },
        { remove_state: "waiting_there" },
      ]),
    ).toBe(
      "The removal of the old agent asked for earlier still waits for 2 devices and is sent once they are online here; use Withdraw removal to keep the old agent.",
    );
  });

  it("asks again only where nothing waits, is sent or done", () => {
    const states = ["", "not_removed", "waiting_here", "sending", "removed"];
    expect(states.filter((s) => removalAskable({ remove_state: s }))).toEqual([
      "",
      "not_removed",
    ]);
  });
});

describe("recoveryText", () => {
  it.each([
    ["", ""],
    [
      "pending",
      "Repair of remote control is scheduled for 5 minutes after the removal.",
    ],
    ["ok", "Remote control repaired."],
    [
      "failed: no answer",
      "Repair of remote control failed and is tried again hourly: no answer",
    ],
    [
      "given up: never answered",
      "Remote control not repaired (never answered); reinstall it by hand.",
    ],
    [
      "no agent is linked here",
      "Remote control not repaired (no agent is linked here); reinstall it by hand.",
    ],
  ])("%s", (value, text) => {
    expect(recoveryText(value)).toBe(text);
  });
});
