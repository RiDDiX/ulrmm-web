// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

// Volume selection of the live Linux backup: table rows, the saved list and
// point labels. No component state, so it can be tested alone.

export const FILES_METHOD = "linux-files-v1";
const SELECTABLE = ["extra", "unmounted"];
const STATUS = {
  system: "System, always included",
  extra: "Extra volume",
  unmounted: "Not mounted",
  network: "Network storage, not backed up",
  unsupported: "Not supported",
};
const CONSISTENCY = {
  live: "Live, consistent per file",
  "lvm-snapshot": "LVM snapshot, point in time",
  "btrfs-snapshot": "Btrfs snapshot, point in time",
};

// one row per reported volume plus one per selector that matches none
export function volumeRows(volumes = [], selected = []) {
  const rows = volumes.map((volume) => ({
    ...volume,
    status: STATUS[volume.kind] ?? volume.kind,
    consistencyLabel: CONSISTENCY[volume.consistency] ?? "",
    locked: volume.kind === "system",
    tickable: volume.kind === "system" || SELECTABLE.includes(volume.kind),
    ticked:
      volume.kind === "system" ||
      (SELECTABLE.includes(volume.kind) && selected.includes(volume.mount)),
  }));
  const known = new Set(volumes.map((volume) => volume.mount));
  for (const mount of selected)
    if (!known.has(mount))
      rows.push({
        mount,
        fs: "",
        kind: "",
        reason: "",
        status: "Not on this device",
        consistencyLabel: "",
        locked: false,
        tickable: true,
        ticked: true,
      });
  return rows;
}

export const sameVolumes = (a = [], b = []) =>
  a.length === b.length && a.every((mount) => b.includes(mount));

// the device save only takes selectors without a volume or on an extra one;
// system, network and unsupported matches have no checkbox to untick
export function volumesPayload(volumes, selected = []) {
  if (!volumes?.length) return [];
  const fixed = new Set(
    volumes
      .filter((volume) => !SELECTABLE.includes(volume.kind))
      .map((volume) => volume.mount),
  );
  return selected.filter((mount) => !fixed.has(mount));
}

export const pointVolumes = (native) =>
  (native.include ?? []).map((id) => {
    const volume = native.volumes?.find((item) => item.id === id);
    return volume ? `${volume.mount} (${volume.fs})` : id;
  });

// same rule as the server: normalized absolute path other than / or a drive letter
export const validSelector = (value) =>
  /^[A-Z]:$/.test(value) ||
  (value.length <= 255 &&
    value.startsWith("/") &&
    ![...value].some((char) => char < " " || char === "\x7f") &&
    value
      .slice(1)
      .split("/")
      .every((part) => part && part !== "." && part !== ".."));

export function volumeWarning({ unmatched = [], unusable = [] }, label) {
  const parts = [];
  if (unmatched.length)
    parts.push(`not on the device: ${unmatched.join(", ")}`);
  if (unusable.length)
    parts.push(`not usable as an extra volume: ${unusable.join(", ")}`);
  return `${label}: ${parts.join("; ")}`;
}
