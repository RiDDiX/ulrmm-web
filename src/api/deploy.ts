// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

import axios from "axios";
import { endpoint } from "@/api/http";
import { resolveChoiceRefs } from "@/utils/deploy";
import type { UploadId, UploadSession } from "@/utils/chunkedUpload";

const DEPLOY = "/deploy";
const deploy = endpoint(DEPLOY);
const automation = endpoint("/automation");

export type MonType = "server" | "workstation";
export type FileLanguage =
  | "xml"
  | "yaml"
  | "shell"
  | "powershell"
  | "json"
  | "ini"
  | "text";

// one row of GET /clients/deployments/
export interface Deployment {
  id: number;
  uid: string;
  name: string;
  client_id: number;
  site_id: number;
  client_name: string;
  site_name: string;
  mon_type: MonType;
  goarch: string;
  policy: number | null;
  policy_name: string | null;
  expiry: string | null;
  install_flags: Record<string, boolean> | null;
  created: string | null;
  // public installer link, <api>/clients/<uid>/deploy/
  url: string;
  // null: no limit; older servers send neither field
  max_enrollments?: number | null;
  enrollments?: number;
  // "********" for a deployment made before signed links; never the token
  legacy_token?: string | null;
}

// body of POST /clients/deployments/
export interface NewDeployment {
  site: number;
  name: string;
  expires: string;
  agenttype: MonType;
  goarch: string;
  power: boolean;
  ping: boolean;
  rdp: boolean;
  policy: number | null;
  max_enrollments: number | null;
}

export type FieldValue = string | number | boolean | null;

export interface FieldChoice {
  value: FieldValue;
  label: string;
  // a caption under the option; checkgroup choices also carry a section
  help?: string;
  section?: string;
}

// server metadata for one profile path; a field with choices is a select
export interface FieldMeta {
  label: string;
  help?: string;
  choices?: FieldChoice[];
  // names a list in Matrix.choice_sets instead of carrying it inline
  choices_ref?: string;
  kind?:
    | "select"
    | "multiline"
    | "secret"
    | "text"
    | "bool"
    | "number"
    | "list"
    // a list of choice values, shown as grouped checkboxes
    | "checkgroup";
  // shown only while every named path holds the value (or one of the list)
  show_if?: Record<string, FieldValue | FieldValue[]>;
  // a select whose choice applies Target.presets[path][value]
  preset?: boolean;
  // the capability that gates the field, the group it belongs to and its
  // place there; older servers send none of these
  capability?: string;
  group?: string;
  order?: number;
}

export interface TargetRelease {
  lts: boolean;
  // YYYY-MM-DD
  released: string;
  eol: string | null;
  status: "supported" | "interim" | "eol" | "prerelease";
}

// an official install image the library can fetch
export interface TargetDownload {
  label: string;
  url: string;
  sha256_url: string | null;
  size: string | null;
}

export interface Target {
  id: string;
  family: "windows" | "linux";
  group: string;
  label: string;
  formats: string[];
  capabilities: Record<string, unknown>;
  defaults: Record<string, unknown>;
  // keyed by dot path, e.g. "general.locale"
  fields?: Record<string, FieldMeta>;
  notes: string[];
  release?: TargetRelease;
  downloads?: TargetDownload[];
  // preset field path -> choice value -> field path -> value
  presets?: Record<string, Record<string, Record<string, unknown>>>;
}

export interface InstallerKind {
  fmt: string;
  plat: string;
  arches: string[];
  label: string;
}

export interface Matrix {
  targets: Target[];
  // choice lists shared by many fields (time zones, locales, keyboards)
  choice_sets?: Record<string, FieldChoice[]>;
  installers: InstallerKind[];
  pubkey_b64: string;
  pubkey_pem: string;
  kid: string;
  dist_ok: boolean;
  agent_version: string;
  win_signed: boolean;
}

export interface RenderRequest {
  deployment: number;
  target: string;
  profile: Record<string, unknown>;
}

export interface RenderedFile {
  name: string;
  language: FileLanguage;
  content: string;
}

export interface RenderResult {
  files: RenderedFile[];
  warnings: string[];
}

export interface PolicyChoice {
  id: number;
  name: string;
  active?: boolean;
}

// the builder shows these errors next to its fields instead of a toast
const QUIET = { silent: true };

export async function fetchMatrix() {
  return resolveChoiceRefs(await deploy.get<Matrix>("/matrix/"));
}

// secrets come back as "********"
export function renderTarget(body: RenderRequest) {
  return deploy.post<RenderResult>("/render/", body, QUIET);
}

// the answer file, or a zip with answer files, inject scripts and README.txt
export function downloadTarget(
  body: RenderRequest & { bundle: boolean },
  onProgress?: (loaded: number, total: number | null) => void,
) {
  return deploy.post<Blob>("/download/", body, {
    ...QUIET,
    responseType: "blob",
    onDownloadProgress: onProgress
      ? (e) => onProgress(e.loaded, e.total ?? null)
      : undefined,
  });
}

// scoped roles only get the policies they may assign
export function fetchPolicies() {
  return automation.get<PolicyChoice[]>("/policies/");
}

// bootable images

export type IsoOs =
  | "windows"
  | "ubuntu"
  | "debian"
  | "rhel"
  | "fedora"
  | "suse"
  | "arch"
  | "unknown"
  | "";

export interface BaseIso {
  id: number;
  name: string;
  filename: string;
  size: number;
  sha256: string;
  label: string;
  os: IsoOs;
  bios: boolean;
  efi: boolean;
  udf: boolean;
  status: "downloading" | "verifying" | "inspecting" | "ready" | "error";
  error: string;
  source_url: string;
  expected_sha256: string;
  progress: IsoProgress | null;
  added: string | null;
  // "built": made by the deployment builder, built_by and target say how
  kind: "base" | "built";
  built_by: string;
  target: string;
}

// live state of a library row that is downloading, verifying or failed
export interface IsoProgress {
  id: number;
  status: BaseIso["status"];
  filename: string;
  target: string;
  source_url: string;
  progressPercent: number;
  downloadedBytes: number;
  totalBytes: number;
  speedBytesPerSec: number;
  etaSeconds: number | null;
  error: string;
}

// Windows media fits Windows targets, anything else fits Linux targets
export function isoFitsFamily(os: IsoOs, family: string) {
  return (family === "windows") === (os === "windows");
}

export type IsoMode = "seed" | "full";

export interface IsoPlan {
  label: string | null;
  files: string[];
  notes: string[];
  agent: string | null;
  size_hint: number;
}

export interface IsoJob {
  state: "queued" | "running" | "done" | "error";
  pct: number;
  text: string;
  name: string;
  size: number;
  sha256: string;
  label: string;
  notes: string[];
  error: string;
  // the library row of the finished image, null until done
  iso: number | null;
}

// an ISO blob with the checksum headers the server sends along (empty when
// a proxy or CORS hides them)
export interface IsoDownload {
  blob: Blob;
  sha256: string;
  label: string;
}

type Progress = (loaded: number, total: number | null) => void;

export function fetchIsoLibrary() {
  return deploy.get<BaseIso[]>("/iso/library/", QUIET);
}

export function fetchIsoProgress() {
  return deploy.get<IsoProgress[]>("/iso/library/progress/", QUIET);
}

export function startIsoDownload(body: {
  url: string;
  sha256?: string;
  sha256_url?: string | null;
  target?: string;
}) {
  return deploy.post<BaseIso>("/iso/library/", body, QUIET);
}

export function cancelIsoDownload(id: number) {
  return deploy.post<BaseIso>(`/iso/library/${id}/cancel/`, {}, QUIET);
}

export function retryIsoDownload(id: number) {
  return deploy.post<BaseIso>(`/iso/library/${id}/retry/`, {}, QUIET);
}

export function addIso(
  body: { filename: string } | { url: string; sha256?: string },
) {
  return deploy.post<BaseIso>("/iso/library/", body, QUIET);
}

export function scanIsoFolder() {
  return deploy.post<BaseIso[]>("/iso/library/scan/", {}, QUIET);
}

// chunked upload like packages: {filename, size} -> {id, chunk_size, received}.
// starting and finishing need the console step-up, config comes from the caller
export function startIsoUpload(
  body: { filename: string; size: number },
  config?: object,
) {
  return deploy.post<UploadSession>("/iso/uploads/", body, {
    ...QUIET,
    ...config,
  });
}

export function fetchIsoUpload(id: UploadId) {
  return deploy.get<{ received: number }>(`/iso/uploads/${id}/`, QUIET);
}

// raw body; 409 {received} when start is not where the server stands
export function putIsoUploadChunk(
  id: UploadId,
  chunk: Blob,
  start: number,
  size: number,
  onProgress?: (loaded: number) => void,
) {
  return deploy.put<{ received: number }>(`/iso/uploads/${id}/`, chunk, {
    ...QUIET,
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Range": `bytes ${start}-${start + chunk.size - 1}/${size}`,
    },
    onUploadProgress: (e) => onProgress?.(e.loaded ?? 0),
  });
}

export function removeIsoUpload(id: UploadId) {
  return deploy.delete(`/iso/uploads/${id}/`, QUIET);
}

export function finishIsoUpload(id: UploadId, config?: object) {
  return deploy.post<BaseIso>(
    `/iso/uploads/${id}/finish/`,
    {},
    {
      ...QUIET,
      ...config,
    },
  );
}

// a download link valid for 10 minutes; nginx serves the file
export function isoDownloadLink(id: number) {
  return deploy.post<{ url: string }>(`/iso/library/${id}/link/`, {}, QUIET);
}

export function verifyIso(id: number) {
  return deploy.post<BaseIso>(`/iso/library/${id}/verify/`, {}, QUIET);
}

export function deleteIso(id: number) {
  return deploy.delete(`/iso/library/${id}/`, QUIET);
}

export function planIso(
  body: RenderRequest & { mode: IsoMode; base: number | null },
) {
  return deploy.post<IsoPlan>("/iso/plan/", body, QUIET);
}

// deploy.post returns the body only, so the checksum headers need axios
async function isoBlob(
  request: Promise<{ data: Blob; headers: Record<string, unknown> }>,
): Promise<IsoDownload> {
  const { data, headers } = await request;
  return {
    blob: data,
    sha256: String(headers["x-sha256"] ?? ""),
    label: String(headers["x-volume-label"] ?? ""),
  };
}

const blobConfig = (onProgress?: Progress) => ({
  ...QUIET,
  responseType: "blob" as const,
  onDownloadProgress: onProgress
    ? (e: { loaded: number; total?: number }) =>
        onProgress(e.loaded, e.total ?? null)
    : undefined,
});

export function downloadSeedIso(body: RenderRequest, onProgress?: Progress) {
  return isoBlob(
    axios.post(`${DEPLOY}/iso/seed/`, body, blobConfig(onProgress)),
  );
}

export function buildIso(body: RenderRequest & { base: number }) {
  return deploy.post<{ job: string }>("/iso/build/", body, QUIET);
}

export function fetchIsoJob(job: string) {
  return deploy.get<IsoJob>(`/iso/jobs/${job}/`, QUIET);
}

export function discardIsoJob(job: string) {
  return deploy.delete(`/iso/jobs/${job}/`, QUIET);
}
