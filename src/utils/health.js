// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

// health + nics.wol from agent (untrusted). type guard+cap on every read; text only.

export const list = (v) => (Array.isArray(v) ? v.slice(0, 64) : []);
export const obj = (v) =>
  v && typeof v === "object" && !Array.isArray(v) ? v : {};
export const str = (v) => (typeof v === "string" ? v.slice(0, 128) : "");
export const num = (v) => (Number.isFinite(v) ? v : null);
// own keys only: block agent strings (e.g. "constructor") from prototype
export const pick = (table, key, fallback) =>
  Object.prototype.hasOwnProperty.call(table, key) ? table[key] : fallback;

const WOL = {
  on: { label: "armed", cls: "rmm-pill--positive" },
  off: { label: "off", cls: "rmm-pill--warning" },
  unsupported: { label: "not supported", cls: "rmm-pill--neutral" },
};

export function wolLabel(state) {
  return pick(WOL, state, { label: "unknown", cls: "rmm-pill--neutral" });
}

export function onOff(value, on = "on", off = "off") {
  if (value === true) return { label: on, cls: "rmm-pill--positive" };
  if (value === false) return { label: off, cls: "rmm-pill--negative" };
  return { label: "unknown", cls: "rmm-pill--neutral" };
}

// bad states for status strip. linux and freebsd report, no alerts.
export function healthIssues(health, plat) {
  const h = obj(health);
  if (!Object.keys(h).length) return [];
  const issues = [];
  if (plat !== "linux" && plat !== "freebsd") {
    const av = list(h.av).map(obj);
    const wsc = av.some((a) => a.src === "wsc");
    const defender = obj(h.defender);
    const avOn =
      av.some((a) => a.enabled === true) ||
      (!wsc && defender.av === true && defender.rtp === true);
    if ((wsc || plat === "darwin") && !avOn) issues.push("Antivirus off");
    if (obj(h.firewall).enabled === false) issues.push("Firewall off");
  }
  if (list(h.disks).some((d) => obj(d).health === "failing"))
    issues.push("Disk failing");
  return issues;
}
