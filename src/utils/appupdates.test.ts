// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

import { describe, expect, it } from "vitest";
import {
  historyActivityRow,
  historyOutcome,
  updatePollStart,
  UPDATE_POLL_LIMIT_MS,
} from "@/utils/appupdates";

const line = (app: string, outcome: string) => `${app} 1.0 -> 2.0: ${outcome}`;

describe("historyOutcome", () => {
  it("reads each ending the server writes", () => {
    expect(historyOutcome(line("a", "ok")).label).toBe("Success");
    expect(historyOutcome(`${line("a", "failed")}\nexit 1603`)).toEqual({
      label: "Failed",
      icon: "error",
      color: "negative",
    });
    expect(
      historyOutcome(`${line("a", "timed out")}\nTime limit reached`),
    ).toMatchObject({ label: "Timed out", color: "warning" });
    expect(historyOutcome(line("a", "not started"))).toMatchObject({
      label: "Not started",
      color: null,
    });
  });

  it("puts failed before timed out before not started before ok", () => {
    const ok = line("a", "ok");
    const notStarted = line("b", "not started");
    const timedOut = `${line("c", "timed out")}\ntail`;
    const failed = `${line("d", "failed")}\ntail`;
    expect(historyOutcome([ok, notStarted].join("\n")).label).toBe(
      "Not started",
    );
    expect(historyOutcome([ok, notStarted, timedOut].join("\n")).label).toBe(
      "Timed out",
    );
    expect(
      historyOutcome([ok, failed, notStarted, timedOut].join("\n")).label,
    ).toBe("Failed");
  });

  it("does not read an outcome out of tail lines", () => {
    expect(historyOutcome(`${line("a", "ok")}\nstep 2: failed`).label).toBe(
      "Success",
    );
  });

  it("has no outcome for empty results", () => {
    expect(historyOutcome("").label).toBe("Unknown");
    expect(historyOutcome(null).label).toBe("Unknown");
    expect(historyOutcome(undefined).label).toBe("Unknown");
  });
});

describe("historyActivityRow", () => {
  it("shows an app update with its command and outcome", () => {
    const row = historyActivityRow({
      id: 7,
      time: "2026-11-13T10:00:00Z",
      type: "app_update",
      command: "winget upgrade ['Git.Git']",
      script_name: null,
      username: "admin",
      results: `${line("Git.Git", "timed out")}\nTime limit reached`,
    });
    expect(row).toMatchObject({
      key: "history-7",
      icon: "system_update_alt",
      state: "warning",
      title: "winget upgrade ['Git.Git']",
      caption: "App update by admin · timed out",
    });
  });

  it("keeps scripts and commands as before", () => {
    expect(
      historyActivityRow({
        id: 1,
        time: "t",
        type: "script_run",
        script_name: "Clean temp",
        username: null,
        script_results: { retcode: 2 },
      }),
    ).toMatchObject({
      icon: "code",
      state: "negative",
      title: "Clean temp",
      caption: "Script by system · failed (exit 2)",
    });
    expect(
      historyActivityRow({
        id: 2,
        time: "t",
        type: "cmd_run",
        command: "whoami",
        username: "admin",
        results: "x",
      }),
    ).toMatchObject({
      icon: "terminal",
      title: "whoami",
      caption: "Command by admin · output received",
    });
  });
});

describe("updatePollStart", () => {
  const updating = [{ state: "available" }, { state: "updating" }];

  it("starts while a row is updating and keeps the first start", () => {
    expect(updatePollStart(updating, null, 1000)).toBe(1000);
    expect(updatePollStart(updating, 1000, 60_000)).toBe(1000);
  });

  it("stops when nothing is updating", () => {
    expect(updatePollStart([{ state: "done" }], 1000, 2000)).toBeNull();
    expect(updatePollStart([], null, 2000)).toBeNull();
  });

  it("does not count a timed-out update waiting for the next scan", () => {
    const timedOut = [{ state: "updating", last_error: "Time limit reached" }];
    expect(updatePollStart(timedOut, null, 2000)).toBeNull();
    expect(
      updatePollStart(
        [...timedOut, { state: "updating", last_error: "" }],
        null,
        2000,
      ),
    ).toBe(2000);
  });

  it("stops after the limit", () => {
    expect(updatePollStart(updating, 0, UPDATE_POLL_LIMIT_MS - 1)).toBe(0);
    expect(updatePollStart(updating, 0, UPDATE_POLL_LIMIT_MS)).toBeNull();
  });
});
