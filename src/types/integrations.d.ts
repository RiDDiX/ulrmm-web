// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

// menu entries set up in boot/integrations.ts
export interface IntegrationEntry {
  name: string;
  type: string;
  icon?: string;
  uri?: string;
  component?: unknown;
  props?: (id: string | number, type: string) => Record<string, unknown>;
}

declare module "vue" {
  interface ComponentCustomProperties {
    $integrations: Record<
      | "fileBarIntegrations"
      | "clientMenuIntegrations"
      | "siteMenuIntegrations"
      | "agentMenuIntegrations",
      IntegrationEntry[]
    >;
  }
}
