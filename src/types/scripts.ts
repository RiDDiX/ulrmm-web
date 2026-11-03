// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

import type { AgentPlatformType } from "@/types/agents";

export type ScriptShellType =
  | "powershell"
  | "cmd"
  | "shell"
  | "python"
  | "nushell"
  | "deno";

export type ScriptVariableType =
  | "string"
  | "text"
  | "integer"
  | "decimal"
  | "checkbox"
  | "select"
  | "ip"
  | "date"
  | "datetime"
  | "password";

// script input. the run form sends each value as NAME=value
export interface ScriptVariable {
  name: string;
  label: string;
  type: ScriptVariableType;
  required?: boolean;
  default?: string;
  help?: string;
  options?: string[];
}

type Listed = { description?: string; category?: string; filename?: string };
type Body = { shell: ScriptShellType; script_body: string; syntax?: string };
type Inputs = {
  args: string[];
  env_vars: string[];
  variables?: ScriptVariable[];
};
type RunOptions = { default_timeout: number; run_as_user: boolean };
type Flags = { favorite: boolean; hidden: boolean };
type Identity = { id?: number; guid?: string; name: string };

export interface Script
  extends Identity,
    Listed,
    Body,
    Inputs,
    RunOptions,
    Flags {
  script_type: "userdefined" | "builtin";
  supported_platforms?: AgentPlatformType[];
}

export interface ScriptSnippet extends Pick<Script, "id" | "name" | "shell"> {
  desc?: string;
  code: string;
}
