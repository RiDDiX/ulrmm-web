// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

import { afterEach, describe, expect, it, vi } from "vitest";
import { nextScheduledInstallLabel } from "@/utils/patchSchedule";

// Sundays at 3 AM
const SUNDAY = {
  run_time_frequency: "daily",
  run_time_days: [6],
  run_time_day: 1,
  run_time_hour: 3,
};

describe("nextScheduledInstallLabel", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it.each([
    // Berlin starts summer time that night: Saturday 23:30 plus 24 h is Monday
    ["2026-03-28T22:30:00Z", "Europe/Berlin", "Sun Mar 29, 3 AM"],
    ["2026-03-29T00:30:00Z", "Europe/Berlin", "Sun Mar 29, 3 AM"],
    ["2026-03-29T02:30:00Z", "Europe/Berlin", "Sun Apr 5, 3 AM"],
    ["2026-03-28T10:30:00Z", "Pacific/Kiritimati", "Sun Mar 29, 3 AM"],
    ["2026-03-28T22:30:00Z", "Nowhere/City", null],
  ])("%s in %s", (now, zone, expected) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(now));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(nextScheduledInstallLabel(SUNDAY, zone)).toBe(expected);
  });
});
