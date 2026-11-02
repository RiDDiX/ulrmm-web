// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

export type AgentPlatformType = "windows" | "linux" | "darwin" | "freebsd";
export type AgentTab = "mixed" | "server" | "workstation";

type Placement = { client: string; site: string };
type AgentKind = { plat: AgentPlatformType; monitoring_type: AgentTab };

export interface Agent extends Placement, AgentKind {
  id: number;
  agent_id: string;
  hostname: string;
  display_name?: string | null;
}

// registry editor: tree node and value row
type NodeFlags = { lazy?: boolean; isComputer?: boolean; isLoadMore?: boolean };

export interface RegistryNode extends NodeFlags {
  id: string;
  label: string;
  children?: RegistryNode[];
}

// isNew is set while a value is being created; an empty name is the
// default value
type ValueDraft = { newKey?: boolean; isNew?: boolean };

export interface RegistryValue extends ValueDraft {
  name: string;
  type: string;
  data: string | number | string[];
}
