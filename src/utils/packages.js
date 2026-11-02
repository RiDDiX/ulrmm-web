// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

// kind and run-as follow the server

export const PACKAGE_ACCEPT =
  ".exe,.msi,.msix,.msixbundle,.appx,.appxbundle,.pkg,.deb,.rpm,.zip,.cab,.7z,.tar.gz,.tgz";

export const PLAT_LABELS = {
  windows: "Windows",
  darwin: "macOS",
  linux: "Linux",
};

// "user" only on windows, the server refuses it elsewhere
export const RUN_AS_OPTIONS = [
  { value: "system", label: "System / Administrator" },
  { value: "user", label: "Current logged-in user" },
];

export const RUN_AS_LABELS = Object.fromEntries(
  RUN_AS_OPTIONS.map((o) => [o.value, o.label]),
);

export const INSTALL_STATES = {
  queued: {
    label: "Queued",
    cls: "rmm-pill--neutral",
    tip: "Waiting to be sent to the agent",
  },
  running: {
    label: "Running",
    cls: "rmm-pill--info",
    tip: "The agent is downloading and installing it",
  },
  succeeded: {
    label: "Succeeded",
    cls: "rmm-pill--positive",
    tip: "Installed",
  },
  reboot_required: {
    label: "Reboot required",
    cls: "rmm-pill--warning",
    tip: "Installed, the device needs a reboot to finish",
  },
  failed: {
    label: "Failed",
    cls: "rmm-pill--negative",
    tip: "The installer or the agent reported an error; see the output",
  },
  refused: {
    label: "Refused",
    cls: "rmm-pill--negative",
    tip: "Not run, e.g. signature or hash check failed, or nobody logged in",
  },
  skipped: {
    label: "Skipped",
    cls: "rmm-pill--neutral",
    tip: "Not sent: the agent was offline or on another platform",
  },
};

export function isPending(install) {
  return install.state === "queued" || install.state === "running";
}

// same map as the server. bundles keep their file name. a .zip is a driver
// package unless the upload says archive
export function packageKind(filename) {
  const name = (filename || "").toLowerCase();
  if (/\.(7z|tar\.gz|tgz)$/.test(name)) return "archive";
  const ext = name.split(".").pop();
  return (
    { msixbundle: "msix", appxbundle: "appx", zip: "driver", cab: "driver" }[
      ext
    ] ?? ext
  );
}

export const KIND_LABELS = { driver: "driver", archive: "archive" };

// installer arguments for windows exe/msi and the command of an archive
export function takesArgs(kind) {
  return kind === "exe" || kind === "msi" || kind === "archive";
}

// archive: the command is a path inside the archive or one of these
export const ARCHIVE_COMMANDS = [
  "msiexec.exe",
  "powershell.exe",
  "pwsh.exe",
  "sh",
  "bash",
];

export const DEFAULT_SUCCESS_CODES = [0];
export const DEFAULT_REBOOT_CODES = [3010, 1641];

// seconds; archives may take up to 4 h
export const timeoutMax = (kind) => (kind === "archive" ? 14400 : 7200);

// relative, without .. and without a drive letter
export function archiveCommandError(command) {
  const c = (command || "").trim();
  if (!c) return "Required";
  if (/^([a-z]:|[\\/])/i.test(c))
    return "A path inside the archive, not absolute";
  if (c.split(/[\\/]/).includes("..")) return "No .. in the path";
  return "";
}

// "0, 3010" -> [0, 3010]; null when a part is not a whole number
export function parseCodes(text) {
  const parts = String(text ?? "")
    .split(/[\s,]+/)
    .filter(Boolean);
  if (!parts.every((p) => /^-?\d+$/.test(p))) return null;
  return [...new Set(parts.map(Number))];
}

// table: logged_username; italic = last user, nobody on now
// detail: logged_in_username, "None" when nobody is on
export function loggedInUser(agent) {
  const user = agent.italic
    ? ""
    : (agent.logged_in_username ?? agent.logged_username);
  return user && user !== "None" && user !== "-" ? user : "";
}
