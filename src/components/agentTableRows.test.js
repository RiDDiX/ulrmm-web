// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

import { describe, expect, it } from "vitest";
import { filterAgentRows } from "@/components/agentTableRows";

const daysAgo = (days) =>
  new Date(Date.now() - days * 86_400_000).toISOString();

const ROWS = [
  { hostname: "never", status: "offline", last_seen: null },
  { hostname: "old", status: "offline", last_seen: daysAgo(40) },
  { hostname: "recent", status: "offline", last_seen: daysAgo(3) },
  { hostname: "up", status: "online", last_seen: daysAgo(0) },
  { hostname: "lab", status: "online", description: "analysis:x" },
];

const cellValue = (col, row) =>
  typeof col.field === "function" ? col.field(row) : row[col.field];
const columns = [{ field: "description" }];

const shown = (terms) =>
  filterAgentRows(ROWS, terms, columns, cellValue).map((row) => row.hostname);

describe("filterAgentRows", () => {
  it.each([
    ["is:expired", ["old"]],
    ["is:online", ["up", "lab"]],
    ["is:offline old", ["old"]],
    ["analysis:x", ["lab"]],
    ["this:is:online", []],
    ["", ROWS.map((row) => row.hostname)],
  ])("%j", (terms, expected) => {
    expect(shown(terms)).toEqual(expected);
  });
});
