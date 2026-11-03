// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

interface Named {
  id: number;
  name: string;
}

export type Client = Named;
export type Site = Named;

export interface ClientWithSites extends Named {
  sites: Site[];
}
