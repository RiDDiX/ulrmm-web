// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

import { describe, expect, it } from "vitest";
import { NO_VALUE } from "@/utils/format";
import {
  count,
  importSummary,
  partNotes,
  partsOffered,
  recoveryText,
  removalView,
  removalAskable,
  removalWaiting,
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
      { label: "Policies with their checks and tasks", items: [item] },
      { label: "Devices", items: [item] },
    ]);
    expect(skippedByPart(undefined)).toEqual([]);
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
      details: ["at t", "Remote control not repaired: timeout"],
    });
  });

  it("knows which rows still wait", () => {
    expect(removalWaiting({ remove_state: "waiting_there" })).toBe(true);
    expect(removalWaiting({ remove_state: "sending" })).toBe(false);
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
    ["pending", "Remote control is repaired a few minutes after the removal."],
    ["ok", "Remote control repaired."],
    [
      "no agent is linked here",
      "Remote control not repaired: no agent is linked here",
    ],
  ])("%s", (value, text) => {
    expect(recoveryText(value)).toBe(text);
  });
});
