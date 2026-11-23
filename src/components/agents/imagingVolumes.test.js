// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

import { describe, expect, it } from "vitest";
import {
  pointVolumes,
  sameVolumes,
  validSelector,
  volumeRows,
  volumesPayload,
  volumeWarning,
} from "@/components/agents/imagingVolumes";

const DISK = "nvme-Samsung_SSD_980_1TB_S64ANS0T123456";
const VOLUMES = [
  {
    id: "0b6f3d0e-6f1c-4a51-9d0e-2b8a7c1d4e5f",
    mount: "/",
    fs: "ext4",
    kind: "system",
    disk: DISK,
    size: 999666221056,
    used: 41231686041,
    consistency: "live",
    reason: "",
  },
  {
    id: "abcd-1234",
    mount: "/boot/efi",
    fs: "vfat",
    kind: "system",
    disk: DISK,
    size: 536870912,
    used: 6291456,
    consistency: "live",
    reason: "",
  },
  {
    id: "5d1c9a7b-3e2f-4c8d-a6b5-9e0f1d2c3b4a",
    mount: "/media/frigate",
    fs: "ext4",
    kind: "extra",
    disk: "ata-WDC_WD40PURZ-85AKKY0_WD-WX12345678",
    size: 4000785960960,
    used: 2899102924800,
    consistency: "live",
    reason: "",
  },
  {
    id: "",
    mount: "/mnt/backups",
    fs: "cifs",
    kind: "network",
    disk: "",
    size: 0,
    used: 0,
    consistency: "",
    reason: "Network storage is not backed up.",
  },
];

const pick = (rows) =>
  rows.map(({ mount, status, consistencyLabel, locked, tickable, ticked }) => ({
    mount,
    status,
    consistencyLabel,
    locked,
    tickable,
    ticked,
  }));

describe("volumeRows", () => {
  it("locks system volumes and offers extras unticked", () => {
    expect(pick(volumeRows(VOLUMES, []))).toEqual([
      {
        mount: "/",
        status: "System, always included",
        consistencyLabel: "Live, consistent per file",
        locked: true,
        tickable: true,
        ticked: true,
      },
      {
        mount: "/boot/efi",
        status: "System, always included",
        consistencyLabel: "Live, consistent per file",
        locked: true,
        tickable: true,
        ticked: true,
      },
      {
        mount: "/media/frigate",
        status: "Extra volume",
        consistencyLabel: "Live, consistent per file",
        locked: false,
        tickable: true,
        ticked: false,
      },
      {
        mount: "/mnt/backups",
        status: "Network storage, not backed up",
        consistencyLabel: "",
        locked: false,
        tickable: false,
        ticked: false,
      },
    ]);
    expect(volumeRows(VOLUMES, [])[3].reason).toBe(
      "Network storage is not backed up.",
    );
  });

  it("ticks saved extras and lists selectors without a volume", () => {
    const rows = volumeRows(VOLUMES, [
      "/media/frigate",
      "/mnt/backups",
      "/media/gone",
    ]);
    expect(rows[2].ticked).toBe(true);
    expect(rows[3].ticked).toBe(false);
    expect(pick(rows.slice(4))).toEqual([
      {
        mount: "/media/gone",
        status: "Not on this device",
        consistencyLabel: "",
        locked: false,
        tickable: true,
        ticked: true,
      },
    ]);
  });

  it("labels the other kinds and consistencies", () => {
    const rows = volumeRows([
      {
        mount: "/srv",
        kind: "unmounted",
        consistency: "",
        reason: "Not mounted.",
      },
      { mount: "/data", kind: "unsupported", consistency: "" },
      { mount: "/home", kind: "extra", consistency: "lvm-snapshot" },
      { mount: "/var", kind: "extra", consistency: "btrfs-snapshot" },
    ]);
    expect(rows.map((row) => [row.status, row.consistencyLabel])).toEqual([
      ["Not mounted", ""],
      ["Not supported", ""],
      ["Extra volume", "LVM snapshot, point in time"],
      ["Extra volume", "Btrfs snapshot, point in time"],
    ]);
    expect(rows.map((row) => row.tickable)).toEqual([true, false, true, true]);
  });
});

describe("selection", () => {
  it("compares by value", () => {
    expect(sameVolumes(["/a", "/b"], ["/b", "/a"])).toBe(true);
    expect(sameVolumes(["/a"], [])).toBe(false);
    expect(sameVolumes(undefined, [])).toBe(true);
    expect(sameVolumes(["/a"], ["/b"])).toBe(false);
  });

  it("saves only selectors the device accepts", () => {
    expect(volumesPayload(undefined, ["/media/frigate"])).toEqual([]);
    expect(volumesPayload([], ["/media/frigate"])).toEqual([]);
    expect(
      volumesPayload(VOLUMES, [
        "/media/frigate",
        "/mnt/backups",
        "/boot/efi",
        "/media/gone",
      ]),
    ).toEqual(["/media/frigate", "/media/gone"]);
  });

  it("checks selector syntax like the server", () => {
    for (const value of ["/media/data", "/mnt/a b", "D:"])
      expect(validSelector(value)).toBe(true);
    for (const value of [
      "/",
      "media",
      "/media/",
      "//media",
      "/media/../etc",
      "/media/./x",
      "/media\tx",
      "d:",
      "D:\\",
      `/${"a".repeat(255)}`,
    ])
      expect(validSelector(value)).toBe(false);
  });
});

describe("points and warnings", () => {
  it("names included volumes by mount and file system", () => {
    expect(
      pointVolumes({
        volumes: VOLUMES,
        include: [VOLUMES[0].id, VOLUMES[1].id, VOLUMES[2].id, "gone"],
      }),
    ).toEqual([
      "/ (ext4)",
      "/boot/efi (vfat)",
      "/media/frigate (ext4)",
      "gone",
    ]);
    expect(pointVolumes({})).toEqual([]);
  });

  it("omits an empty half of a policy warning", () => {
    expect(
      volumeWarning(
        { unmatched: ["/media/x", "/media/y"], unusable: ["/mnt/backups"] },
        "nvr",
      ),
    ).toBe(
      "nvr: not on the device: /media/x, /media/y; not usable as an extra volume: /mnt/backups",
    );
    expect(volumeWarning({ unmatched: [], unusable: ["/mnt/b"] }, "nvr")).toBe(
      "nvr: not usable as an extra volume: /mnt/b",
    );
    expect(volumeWarning({ unmatched: ["/m"], unusable: [] }, "nvr")).toBe(
      "nvr: not on the device: /m",
    );
  });
});
