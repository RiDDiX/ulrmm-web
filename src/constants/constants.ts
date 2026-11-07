// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

import type { QTableColumn } from "quasar";

// background refreshes: no loading bar, no error toast
export const SILENT_REQUEST_CONFIG = {
  adapter: "fetch",
  silent: true,
} as const;

export const DASHBOARD_REFRESH_INTERVAL = 30_000;

export const runAsUserToolTip =
  "Run in the context of the logged in user. If no user is logged in, the script will run as SYSTEM";

const CLIP = " overflow: hidden; text-overflow: ellipsis;";

// a single-line left column; width is the css shared by cell and header
function registryColumn(
  name: string,
  label: string,
  width: string,
  clip: boolean,
): QTableColumn {
  return {
    name,
    label,
    field: name,
    align: "left",
    style: `${width} white-space: nowrap;${clip ? CLIP : ""}`,
    headerStyle: width,
  };
}

export const registryTableColumns: QTableColumn[] = [
  registryColumn("name", "Name", "width: 240px; max-width: 240px;", true),
  registryColumn("type", "Type", "width: 160px; max-width: 160px;", false),
  registryColumn("data", "Data", "min-width: 300px; max-width: 300px;", true),
  { name: "actions", label: "Actions", field: () => "", align: "right" },
];

export const registryValueTypes = [
  ["Key", "KEY"],
  ["String Value", "REG_SZ"],
  ["DWORD (32-bit) Value", "REG_DWORD"],
  ["QWORD (64-bit) Value", "REG_QWORD"],
  ["Multi-String Value", "REG_MULTI_SZ"],
  ["Expandable String Value", "REG_EXPAND_SZ"],
].map(([label, type]) => ({ label, type }));

// agent build architectures (GOARCH)
export const GOARCH_AMD64 = "amd64";
export const GOARCH_i386 = "386";
export const GOARCH_ARM64 = "arm64";
export const GOARCH_ARM32 = "arm";
