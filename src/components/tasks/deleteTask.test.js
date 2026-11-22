// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

import { describe, expect, it } from "vitest";
import { deleteTaskMessage } from "@/components/tasks/deleteTask";

const devices = [
  { hostname: "pc1", direct: true },
  { hostname: "pc2", direct: false },
];

describe("deleteTaskMessage", () => {
  it("stays silent for a task with one source", () => {
    expect(
      deleteTaskMessage({
        devices,
        policies: [{ name: "P", assigned: false }],
      }),
    ).toBe("");
  });

  it("names a single policy source the tab's device is not part of", () => {
    expect(
      deleteTaskMessage(
        { devices: [], policies: [{ name: "P", assigned: true }] },
        false,
      ),
    ).toBe(
      "This deletes the task definition and removes it from all of its sources: P.",
    );
  });

  it("names every source the definition is removed from", () => {
    expect(
      deleteTaskMessage({ devices, policies: [{ name: "P", assigned: true }] }),
    ).toBe(
      "This deletes the task definition and removes it from all of its sources: pc1, P.",
    );
  });
});
