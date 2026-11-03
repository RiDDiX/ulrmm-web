// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

import type { IdentityState, RotateWhat, TrustStatus } from "@/api/security";

export const IDENTITY_STATE: Record<
  IdentityState,
  { label: string; cls: string }
> = {
  active: { label: "Active", cls: "rmm-pill--positive" },
  quarantined: { label: "Quarantined", cls: "rmm-pill--warning" },
  blocked: { label: "Blocked", cls: "rmm-pill--negative" },
};

export function identityState(v: string | null) {
  if (v === null) return { label: "No identity key", cls: "rmm-pill--neutral" };
  return (
    IDENTITY_STATE[v as IdentityState] ?? { label: v, cls: "rmm-pill--neutral" }
  );
}

// hardware-backed stores are positive, a plain root-only file is a warning
const KEY_STORE: Record<string, { label: string; cls: string; tip: string }> = {
  tpm: {
    label: "TPM",
    cls: "rmm-pill--positive",
    tip: "Wrapped by a TPM key of the Windows Platform Crypto Provider",
  },
  "creds-tpm": {
    label: "TPM",
    cls: "rmm-pill--positive",
    tip: "systemd-creds, sealed to the TPM",
  },
  keychain: {
    label: "Keychain",
    cls: "rmm-pill--neutral",
    tip: "macOS System keychain",
  },
  dpapi: {
    label: "DPAPI",
    cls: "rmm-pill--neutral",
    tip: "Windows DPAPI, machine scope (no TPM provider)",
  },
  "creds-host": {
    label: "Host key",
    cls: "rmm-pill--neutral",
    tip: "systemd-creds with the host key (no TPM)",
  },
  file: {
    label: "File",
    cls: "rmm-pill--warning",
    tip: "Root-only file next to the agent configuration",
  },
};

export function keyStore(v: string | null | undefined) {
  if (!v)
    return {
      label: "—",
      cls: "",
      tip: "Not reported, the agent is older than this check",
    };
  return KEY_STORE[v] ?? { label: v, cls: "rmm-pill--neutral", tip: "" };
}

export const ROTATE_LABEL: Record<RotateWhat, string> = {
  session: "Encrypted session",
  cert: "Certificate",
  token: "Agent token",
  identity: "Identity key",
};

export const ROTATE_OPTIONS = (Object.keys(ROTATE_LABEL) as RotateWhat[]).map(
  (value) => ({ value, label: ROTATE_LABEL[value] }),
);

export const TRUST_STATUS: Record<
  TrustStatus,
  { label: string; cls: string; icon?: string }
> = {
  valid: { label: "Valid", cls: "rmm-pill--positive" },
  renewing: { label: "Renewing", cls: "rmm-pill--info" },
  offline_grace: { label: "Offline grace", cls: "rmm-pill--warning" },
  expired: { label: "Expired", cls: "rmm-pill--negative" },
  revoked: { label: "Revoked", cls: "rmm-pill--negative" },
  clone_alert: {
    label: "Clone alert",
    cls: "rmm-pill--negative trust-pill--alert",
    icon: "warning",
  },
  quarantined: {
    label: "Quarantined",
    cls: "rmm-pill--neutral trust-pill--dark",
  },
  blocked: { label: "Blocked", cls: "rmm-pill--neutral trust-pill--dark" },
  none: { label: "No certificate", cls: "rmm-pill--negative" },
};

export function trustStatus(v: string) {
  return (
    TRUST_STATUS[v as TrustStatus] ?? { label: v, cls: "rmm-pill--neutral" }
  );
}

// "3d 4h 12m", or how long ago it expired
export function countdownText(seconds: number | null) {
  if (seconds === null) return "—";
  const abs = Math.abs(seconds);
  const d = Math.floor(abs / 86_400);
  const h = Math.floor((abs % 86_400) / 3_600);
  const m = Math.floor((abs % 3_600) / 60);
  if (seconds < 0) return d ? `expired ${d}d ago` : `expired ${h}h ${m}m ago`;
  return d ? `${d}d ${h}h ${m}m` : `${h}h ${m}m`;
}
