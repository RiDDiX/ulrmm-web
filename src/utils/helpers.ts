// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

import { copyToClipboard } from "quasar";
import { notifySuccess } from "@/utils/notify";

export function copyOutput(val: string) {
  copyToClipboard(val).then(() => notifySuccess("Copied to clipboard"));
}

// the server's agent_ver: N.DD.MM.YYYY sorts by date, then by the release
// of that day, and above every legacy MAJOR.MINOR.PATCH build
function versionKey(v: string) {
  const dated = /^v?(\d+)\.(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(v);
  if (dated) return [1, +dated[4], +dated[3], +dated[2], +dated[1]];
  return [0, ...v.split(".").map((part) => parseInt(part, 10) || 0)];
}

export function isNewer(a: string, b: string) {
  const ka = versionKey(a);
  const kb = versionKey(b);
  for (let i = 0; i < Math.max(ka.length, kb.length); i++) {
    if ((ka[i] ?? 0) !== (kb[i] ?? 0)) return (ka[i] ?? 0) > (kb[i] ?? 0);
  }
  return false;
}

// the fleet view scoped like the store's tree selection ("Client|3",
// "Site|5" or ""), for every link that leads back to the dashboard
export function dashboardScopeRoute(selectedTree: string | null | undefined) {
  const [type, id] = String(selectedTree || "").split("|");
  return {
    name: "Dashboard",
    query:
      type === "Client" ? { client: id } : type === "Site" ? { site: id } : {},
  };
}

const NO_BARS = Object.fromEntries(
  ["scrollbars", "location", "status", "toolbar", "menubar"].map((bar) => [
    bar,
    false,
  ]),
);

export function getCenteredWindowOptions(width: number, height: number) {
  const screen = typeof window === "undefined" ? null : window.screen;
  return {
    // own pages only: noopener (openURL default) drops sessionStorage
    noopener: false,
    popup: true,
    ...NO_BARS,
    width,
    height,
    left: screen ? Math.round((screen.width - width) / 2) : 0,
    top: screen ? Math.round((screen.height - height) / 2) : 0,
  };
}
