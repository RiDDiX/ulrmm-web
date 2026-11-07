// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

import { describe, expect, it } from "vitest";
import type { ScriptVariable } from "@/types/scripts";
import { normalizeEnv, setEnvValue, splitEnv } from "@/utils/scriptVariables";

const variable = (name: string, extra: Partial<ScriptVariable> = {}) =>
  ({ name, type: "string", required: false, ...extra }) as ScriptVariable;

describe("splitEnv", () => {
  it.each([
    ["A=b=c", ["A", "b=c"]],
    ["A=", ["A", ""]],
    ["A", ["A", ""]],
  ])("%s", (entry, expected) => {
    expect(splitEnv(entry)).toEqual(expected);
  });
});

describe("normalizeEnv", () => {
  it.each([
    ["last duplicate wins, any case", ["a=1", "B=x", "A=2"], ["A=2", "B=x"]],
    ["empty optional value dropped", ["A=", "B=x"], ["B=x"]],
    ["other names untouched", ["OTHER=1", "other=2"], ["OTHER=1", "other=2"]],
  ])("%s", (_, env, expected) => {
    expect(normalizeEnv(env, [variable("A")])).toEqual(expected);
  });

  it("sets a required checkbox without value to false", () => {
    const box = variable("FLAG", { type: "checkbox", required: true });
    expect(normalizeEnv([], [box])).toEqual(["FLAG=false"]);
  });
});

describe("setEnvValue", () => {
  it.each([
    ["", ["B=x"]],
    [undefined, ["B=x"]],
    ["3", ["A=3", "B=x"]],
  ])("value %j", (value, expected) => {
    expect(setEnvValue(["a=1", "B=x", "A=2"], "A", value)).toEqual(expected);
  });
});
