// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

import { endpoint } from "@/api/http";
import type { AxiosRequestConfig } from "axios";

type Config = AxiosRequestConfig & { silent?: boolean };

const deploy = endpoint("/deploy");

export type MtlsMode = "off" | "optional" | "required";

export interface MissingAgent {
  agent_id: string;
  hostname: string;
  version: string;
  last_seen: string | null;
}

export interface Coverage {
  agents: number;
  with_cert: number;
  seen_with_cert: number;
  // at most 50
  missing: MissingAgent[];
}

export type Sec2Mode = "off" | "optional" | "required";

export interface Sec2Coverage {
  agents: number;
  with_identity: number;
  with_family: number;
  // at most 50
  missing: MissingAgent[];
}

export interface AgentSecurity {
  mtls_mode: MtlsMode;
  // signed and encrypted commands; absent on servers before it
  sec2_mode?: Sec2Mode;
  sec2_coverage?: Sec2Coverage;
  cert_days: number;
  // set by the global rotation policy, wins over cert_days
  cert_ttl_hours?: number | null;
  ca_fingerprint_sha256: string;
  ca_not_after: string | null;
  // USE_NATS_STANDARD: agents reach NATS without nginx, so required is refused
  nats_standard: boolean;
  coverage: Coverage;
  // admin list, also sent to agents as the backup half of the pin set
  backup_pins: string[];
  // the pin set agents get now; null before the first one is stored
  pins: PinSet | null;
}

// base64 SHA-256 hashes of SubjectPublicKeyInfo DER
export interface PinSet {
  // grows by one whenever primary or backup change
  seq: number;
  // every certificate of the chain this server presents
  primary: string[];
  backup: string[];
  created: string | null;
  // command signing keys agents accept
  cmd?: CommandKey[];
}

export interface CommandKey {
  kid: string;
  state: "next" | "current" | "retired";
}

export const MAX_BACKUP_PINS = 8;

// one pin per line; blank lines are skipped. error is the first problem.
export function parseBackupPins(text: string): {
  pins: string[];
  error: string;
} {
  const pins: string[] = [];
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const pin = lines[i].trim();
    if (!pin) continue;
    let bytes = -1;
    try {
      bytes = atob(pin).length;
    } catch {
      bytes = -1;
    }
    if (pin.length !== 44 || bytes !== 32)
      return {
        pins,
        error: `Line ${i + 1} is not a base64 SHA-256 hash (44 characters, 32 bytes).`,
      };
    if (pins.includes(pin))
      return { pins, error: `Line ${i + 1} repeats an earlier pin.` };
    pins.push(pin);
  }
  if (pins.length > MAX_BACKUP_PINS)
    return { pins, error: `At most ${MAX_BACKUP_PINS} backup pins.` };
  return { pins, error: "" };
}

export interface AgentCert {
  serial: string;
  fingerprint_sha1?: string;
  fingerprint_sha256?: string;
  not_before: string;
  not_after: string;
  issued_at?: string;
  revoked_at?: string | null;
  last_seen?: string | null;
}

export function fetchAgentSecurity() {
  return deploy.get<AgentSecurity>("/security/");
}

// required without full coverage: 400 with the coverage unless force is set,
// which also needs the console step-up (403 {"stepup": true})
export function saveAgentSecurity(
  payload: {
    mtls_mode: MtlsMode;
    cert_days: number;
    sec2_mode?: Sec2Mode;
    force?: boolean;
    // changing it needs the console step-up
    backup_pins?: string[];
  },
  config?: Config,
) {
  return deploy.put<AgentSecurity>("/security/", payload, config);
}

// the active and the last certificates of one agent
export function fetchAgentCert(agentId: string) {
  return deploy.get(`/agents/${agentId}/cert/`);
}

// revokes the active certificates; needs the console step-up
export function resetAgentCert(agentId: string, config?: Config) {
  return deploy.post(`/agents/${agentId}/cert/reset/`, undefined, config);
}

// any of {active, last}, {certs} or a plain list -> newest first
export function certList(reply: unknown): AgentCert[] {
  if (Array.isArray(reply)) return reply;
  const body = (reply ?? {}) as {
    certs?: AgentCert[];
    active?: AgentCert | AgentCert[] | null;
    last?: AgentCert | AgentCert[] | null;
  };
  if (Array.isArray(body.certs)) return body.certs;
  const out: AgentCert[] = [];
  for (const cert of [body.active, body.last].flat()) {
    if (cert && !out.some((c) => c.serial === cert.serial)) out.push(cert);
  }
  return out;
}

export type IdentityState = "active" | "quarantined" | "blocked";
export type RotateWhat = "session" | "cert" | "token" | "identity";

export interface AgentIdentity {
  kid: string;
  state: IdentityState;
  caps: string[];
  nkey: string;
  pin_seq: number;
  registered_at: string;
  rotated_at: string | null;
  // last accepted handshake
  last_hs: string | null;
  quarantined_at: string | null;
  reason: string;
  // the agent may register new keys until then
  release_until: string | null;
  rotate_pending: RotateWhat[];
}

export interface AgentCredential {
  kind: "legacy" | "family";
  access_expires: string | null;
  refresh_expires: string | null;
  generation: number;
  rotated_at: string | null;
  revoked_at: string | null;
}

export interface AgentIdentityReply {
  identity: AgentIdentity | null;
  credential: AgentCredential | null;
  sec2_mode: Sec2Mode;
}

export function fetchAgentIdentity(agentId: string, config?: Config) {
  return deploy.get<AgentIdentityReply>(`/agents/${agentId}/identity/`, config);
}

// the emergency actions below need the console step-up
export function quarantineAgent(
  agentId: string,
  reason: string,
  config?: Config,
) {
  return deploy.post(`/agents/${agentId}/quarantine/`, { reason }, config);
}

export function releaseAgent(agentId: string, config?: Config) {
  return deploy.post(`/agents/${agentId}/release/`, undefined, config);
}

// the agent has to register new keys within 24 hours
export function resetAgentIdentity(agentId: string, config?: Config) {
  return deploy.post(`/agents/${agentId}/reset-identity/`, undefined, config);
}

// final; only deleting the agent undoes it
export function blockAgent(agentId: string, config?: Config) {
  return deploy.post(`/agents/${agentId}/block/`, undefined, config);
}

export function rotateAgents(
  payload: {
    scope: "agent" | "site" | "client" | "all";
    ids: (string | number)[];
    what: RotateWhat[];
  },
  config?: Config,
) {
  return deploy.post("/security/rotate/", payload, config);
}

export function rotateCommandKey(config?: Config) {
  return deploy.post("/security/command-key/rotate/", undefined, config);
}

// drops the old backup pins once the chain moved onto one of them
export function promotePins(config?: Config) {
  return deploy.post("/security/pins/promote/", undefined, config);
}

export type EventSeverity = "info" | "warning" | "high" | "critical";

export interface SecurityEvent {
  id: number;
  kind: string;
  severity: EventSeverity;
  // kept after the agent is deleted; "" for server-side events
  agent_id: string;
  hostname: string;
  source_ip: string | null;
  detail: string;
  // repeats of the same event within 10 minutes
  count: number;
  first_seen: string;
  last_seen: string;
}

export interface SecurityEventPage {
  results: SecurityEvent[];
  kinds: { value: string; label: string }[];
}

export interface SecurityEventQuery {
  severity?: EventSeverity | "";
  kind?: string;
  agent_id?: string;
  // ids below this one, for the next page
  before?: number;
  // at most 200, the server default is 100
  limit?: number;
}

// newest first; events of agents outside the user's scope are left out
export function fetchSecurityEvents(query: SecurityEventQuery = {}) {
  const params = Object.fromEntries(
    Object.entries(query).filter(([, v]) => v !== "" && v !== undefined),
  );
  return deploy.get<SecurityEventPage>("/security/events/", { params });
}

// null fields inherit from the level above (site -> client -> global)
export interface RotationPolicy {
  rekey_minutes: number | null;
  rekey_mb: number | null;
  cert_ttl_hours: number | null;
  renew_pct: number | null;
  offline_grace_days: number | null;
  auto_quarantine: boolean | null;
}

export type PolicyScope = "client" | "site";

export type PolicyOverride = {
  scope: PolicyScope;
  id: number;
  name: string;
  client_name: string | null;
} & RotationPolicy;

export interface PolicyReply {
  // every field set
  global: RotationPolicy;
  // [min, max] per numeric field
  limits: Record<keyof RotationPolicy, [number, number]>;
  overrides: PolicyOverride[];
}

export function fetchPolicies() {
  return deploy.get<PolicyReply>("/security/policies/");
}

// policy null deletes the override; needs the console step-up. Field
// errors arrive as 400 {"policy": {"field": ["text"]}}
export function savePolicy(
  body: {
    scope: "global" | PolicyScope;
    id: number | null;
    policy: RotationPolicy | null;
  },
  config?: Config,
) {
  return deploy.put<PolicyReply>("/security/policies/", body, config);
}

export type TrustStatus =
  | "valid"
  | "renewing"
  | "offline_grace"
  | "expired"
  | "revoked"
  | "clone_alert"
  | "quarantined"
  | "blocked"
  | "none";

export interface TrustRow {
  agent_id: string;
  hostname: string;
  client: string;
  site: string;
  status: TrustStatus;
  fingerprint: string | null;
  cert_not_after: string | null;
  // seconds until the certificate expires; negative once it has
  countdown_s: number | null;
  rotated_at: string | null;
  pin_seq: number;
  pin_current: boolean;
  identity_state: IdentityState | null;
  rotate_pending: RotateWhat[];
  // where the agent keeps its key-encryption key; null for older agents
  keystore?: string | null;
}

export interface TrustMatrix {
  total: number;
  counts: Record<string, number>;
  pin_seq: number | null;
  agents: TrustRow[];
}

export function fetchTrustMatrix(
  query: { q?: string; status?: string; limit?: number; offset?: number },
  config?: Config,
) {
  const params = Object.fromEntries(
    Object.entries(query).filter(([, v]) => v !== "" && v !== undefined),
  );
  return deploy.get<TrustMatrix>("/security/matrix/", { ...config, params });
}
