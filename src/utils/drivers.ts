// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

// Windows driver inventory (GET /software/<agent_id>/drivers/): row types
// and the Device Manager problem codes

import type { QDialogOptions } from "quasar";
import { bytes2Human } from "@/utils/format";

export interface Driver {
  device: string;
  class: string;
  manufacturer: string;
  provider: string;
  version: string;
  // YYYY-MM-DD or ""
  date: string;
  inf: string;
  signed: boolean | null;
  device_id: string;
  // an oem*.inf outside the boot classes; the server decides
  removable?: boolean;
  // newest applicable Microsoft Update Catalog entry that beats the
  // installed version, null when there is none
  catalog?: DriverCatalogEntry | null;
  // oldest check among the search keys, null = never checked
  catalog_checked?: string | null;
  // "" or why the catalog could not be read; never means "no update"
  catalog_error?: string;
  // newest applicable SDIO index entry that beats the installed driver
  sdio?: SdioEntry | null;
  // when the hardware ids were last looked up in the index, null = never
  sdio_checked?: string | null;
  // latest SDIO install job for this device (30 days)
  sdio_job?: SdioJob | null;
}

export interface SdioEntry {
  pack: string;
  pack_size: number;
  // path inside the pack, ends with "/"
  folder: string;
  inf: string;
  version: string;
  // YYYY-MM-DD
  date: string;
  provider: string;
  desc: string;
  hwid: string;
  approved: boolean;
  // the SDIO mirror serves the pack; others are only in the BitTorrent swarm
  pack_http: boolean;
  // false: the first or last piece of the pack cannot be checked
  pack_verified: boolean;
}

export type SdioJobState =
  | "queued"
  | "downloading"
  | "installing"
  | "done"
  | "failed";

export interface SdioJob {
  id: string;
  state: SdioJobState;
  detail: string;
  updated: string;
  // bytes of the current download
  done?: number;
  total?: number;
}

// GET /software/sdio/offers/: one row per hardware id and version
export interface SdioOffer extends SdioEntry {
  // all devices; the devices list stops at 200
  device_count: number;
  devices: {
    agent_id: string;
    hostname: string;
    device: string;
    class: string;
    version: string;
    date: string;
  }[];
}

// a running index refresh; total 0 = not counted
export interface SdioProgress {
  phase: string;
  done: number;
  total: number;
}

// GET /software/sdio/approvals/
export interface SdioIndex {
  updated: string | null;
  // creation date of the torrent, unix seconds
  torrent_time: number | null;
  error: string;
  files: number;
  http_packs: number;
}

export interface SdioApproval {
  id: number;
  hwid: string;
  version: string;
  desc: string;
  provider: string;
  date: string;
  created_by: string;
  created: string;
  // devices in your scope that can take this version
  devices: number;
}

export interface DriverCatalogEntry {
  version: string;
  // YYYY-MM-DD
  date: string;
  title: string;
  update_id: string;
  size: number;
  classification: string;
  // the hardware id searched for
  query: string;
}

export interface DriverProblem {
  name: string;
  device_id: string;
  class: string;
  code: number;
}

export interface DriverInventory {
  received: string;
  // older than three days
  stale: boolean;
  drivers: Driver[];
  problems: DriverProblem[];
  errors: string[];
  sdio_index?: { updated: string | null; error: string };
}

// removing a network driver can cut the device off, the agent included
export const NET_CLASS = "net";

// ConfigManagerErrorCode (CM_PROB_*), worded like Device Manager
const PROBLEM_TEXT: Record<number, string> = {
  1: "The device is not configured correctly.",
  2: "Windows cannot load the driver for this device.",
  3: "The driver may be damaged, or the system is low on memory.",
  4: "The device is not working properly; a driver or registry entry may be damaged.",
  5: "The driver needs a resource that Windows cannot manage.",
  6: "The boot configuration conflicts with other devices.",
  7: "Cannot filter.",
  8: "The driver loader for the device is missing.",
  9: "The firmware reports the device's resources incorrectly.",
  10: "The device cannot start.",
  11: "The device failed.",
  12: "There are not enough free resources for this device.",
  13: "Windows cannot verify this device's resources.",
  14: "The device needs a restart to work properly.",
  15: "The device has a re-enumeration problem.",
  16: "Windows cannot identify all resources this device uses.",
  17: "The driver asks for an unknown resource type.",
  18: "Reinstall the drivers for this device.",
  19: "Its configuration in the registry is incomplete or damaged.",
  20: "The virtual device loader failed.",
  21: "Windows is removing this device.",
  22: "The device is disabled.",
  23: "The device loader is not ready.",
  24: "The device is not present, not working properly, or lacks drivers.",
  25: "Windows is still setting up this device.",
  26: "Windows is still setting up this device.",
  27: "Windows cannot specify the resources for this device.",
  28: "The drivers for this device are not installed.",
  29: "The device is disabled in the firmware.",
  30: "The device shares an interrupt it cannot share.",
  31: "Windows cannot load the drivers this device needs.",
  32: "The driver's service is disabled.",
  33: "Windows cannot determine which resources the device needs.",
  34: "Windows cannot determine the device's settings.",
  35: "The firmware lacks the information to configure this device.",
  36: "The device asks for a PCI interrupt but is set up for an ISA one.",
  37: "Windows cannot initialize the device driver.",
  38: "A previous instance of the driver is still in memory.",
  39: "The driver is damaged or missing.",
  40: "The driver's service key in the registry is missing or wrong.",
  41: "The driver loaded but cannot find the hardware.",
  42: "A duplicate device is already running.",
  43: "Windows stopped the device because it reported problems.",
  44: "An application or service shut down this device.",
  45: "The device is not connected.",
  46: "Windows is shutting down.",
  47: "The device is prepared for safe removal.",
  48: "The driver is blocked because it has known problems.",
  49: "The system registry is too large.",
  50: "Windows cannot apply all of the device's properties.",
  51: "The device is waiting on another device.",
  52: "Windows cannot verify the driver's digital signature.",
  53: "The device is reserved for the kernel debugger.",
  54: "The device failed and is being reset.",
  55: "The device is waiting for the console to unlock.",
  56: "Windows is still setting up the device's class configuration.",
};

export function problemText(code: unknown): string {
  const n = Number(code);
  return `code ${Number.isFinite(n) ? n : "?"}: ${PROBLEM_TEXT[n] || "Unknown problem."}`;
}

export function signedMeta(signed: unknown) {
  if (signed === true) return { label: "Signed", tone: "positive" };
  if (signed === false) return { label: "Unsigned", tone: "warning" };
  return { label: "Unknown", tone: "neutral" };
}

const SDIO_JOB: Record<string, { label: string; tone: string }> = {
  queued: { label: "queued", tone: "neutral" },
  downloading: { label: "downloading", tone: "info" },
  installing: { label: "installing", tone: "info" },
  done: { label: "installed", tone: "positive" },
  failed: { label: "failed", tone: "negative" },
};

// percent is set while a download with a known size runs
export function sdioJobMeta(job: SdioJob) {
  const meta = SDIO_JOB[job.state] ?? {
    label: String(job.state || "?"),
    tone: "neutral",
  };
  const total = Number(job.total) || 0;
  if (job.state !== "downloading" || total <= 0)
    return { ...meta, percent: null };
  const percent = Math.min(
    100,
    Math.floor(((Number(job.done) || 0) * 100) / total),
  );
  return { ...meta, label: `${meta.label} ${percent}%`, percent };
}

export function isSdioJobActive(job?: SdioJob | null): boolean {
  return ["queued", "downloading", "installing"].includes(job?.state ?? "");
}

export const NET_WARNING =
  "This is a network driver: the device can lose its network connection and the agent with it.";
export const BOOT_WARNING =
  "This driver belongs to a boot-critical class (storage, system): a wrong driver can keep Windows from starting.";
export const BITTORRENT_ONLY =
  "The SDIO mirror does not serve this pack, it is only in the BitTorrent swarm. The agent cannot download it.";

export const sdioName = (e: SdioEntry) => e.desc || e.inf;

export const sdioPackText = (e: SdioEntry) =>
  e.pack_size > 0 ? `${e.pack} (${bytes2Human(e.pack_size)})` : e.pack;

// confirm for a fleet-wide approval; classes of the devices it reaches pick
// the warnings
export function sdioApproveDialog(
  entry: SdioEntry,
  classes: string[],
): QDialogOptions {
  const facts = [
    `version ${entry.version}`,
    entry.date && `from ${entry.date}`,
    entry.provider && `by ${entry.provider}`,
  ].filter(Boolean);
  const parts = [
    `${sdioName(entry)} (${facts.join(", ")}), hardware id ${entry.hwid}, pack ${sdioPackText(entry)}.`,
    "Approves this driver for every device with this hardware id. Devices whose patch policy excludes drivers are skipped. The agent downloads the pack from the SDIO mirror into its work folder, installs the driver with pnputil as system and deletes the files.",
  ];
  if (!entry.pack_verified)
    parts.push(
      "The mirror lacks files next to this pack in the torrent, so its first or last megabyte cannot be checked against the torrent. Windows still checks the driver's signature before it installs.",
    );
  if (classes.some(isNetClass)) parts.push(NET_WARNING);
  if (classes.some(isBootClass)) parts.push(BOOT_WARNING);
  return {
    title: "Approve driver for all devices",
    message: parts.join(" "),
    cancel: true,
    ok: { label: "Approve", color: "primary", unelevated: true, noCaps: true },
    persistent: true,
  };
}

export function isNetClass(cls: unknown): boolean {
  return String(cls || "").toLowerCase() === NET_CLASS;
}

// same list as the server's boot classes: a wrong driver here can keep
// Windows from starting
const BOOT_CLASSES = new Set([
  "scsiadapter",
  "hdc",
  "diskdrive",
  "volume",
  "volumesnapshot",
  "system",
  "processor",
  "computer",
]);

export function isBootClass(cls: unknown): boolean {
  return BOOT_CLASSES.has(String(cls || "").toLowerCase());
}

export function catalogSearchUrl(query: string): string {
  return `https://www.catalog.update.microsoft.com/Search.aspx?q=${encodeURIComponent(query)}`;
}
