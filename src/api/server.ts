// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

import axios, { type AxiosRequestConfig } from "axios";
import { endpoint } from "@/api/http";

const core = endpoint("/core");

type RequestConfig = AxiosRequestConfig & {
  silent?: boolean;
  noAuthRedirect?: boolean;
};

export interface Release {
  version: string;
  date: string | null;
  items: string[];
}

export interface PendingComponent {
  current?: string;
  next?: string;
  releases?: Release[];
  error?: string;
}

export interface TaskState {
  action: string;
  state: "idle" | "running" | "done" | "failed" | "interrupted";
  exit_code: number | null;
  started?: number | null;
  finished?: number | null;
}

export interface ServerUpdateInfo {
  current_version: string;
  latest_version: string;
  runner_installed: boolean;
  busy: string | null;
  state: TaskState;
  pending: { server: PendingComponent; web: PendingComponent };
}

export interface TaskLog {
  text: string;
  offset: number;
  size: number;
  state: TaskState;
  version: string;
}

export interface ReleaseSource {
  name: string;
  kind: string;
  api: string;
  ok: boolean;
  status: number | null;
  latest: string | null;
  checked_at: string;
  error: string | null;
}

export interface ReleaseSources {
  active: string | null;
  latest: string | null;
  key_id: string;
  sources: ReleaseSource[];
}

// an extra release repository, e.g. a sponsor alpha one; the token is
// write-only, the server only says whether one is stored
export interface ReleaseRepo {
  id: number;
  name: string;
  repo_url: string;
  has_token: boolean;
  enabled: boolean;
  position: number;
  kind: string | null;
  api: string | null;
}

export interface ReleaseRepoInput {
  name?: string;
  repo_url?: string;
  token?: string;
  enabled?: boolean;
  position?: number;
}

export type UpdatePhase =
  | "preflight"
  | "download"
  | "verify"
  | "backup"
  | "apply"
  | "migrate"
  | "restart"
  | "health"
  | "done"
  | "failed"
  | "rollback";

// update.progress.json plus the runner state; phase null before a run
export interface UpdateProgress {
  phase: UpdatePhase | null;
  percent?: number | null;
  bytes?: number;
  total?: number;
  rate_bps?: number;
  source?: "github" | "gitea" | "git" | null;
  version?: string;
  message?: string;
  updated_at?: string;
  state: TaskState;
}

export interface Health {
  status: "ok" | "degraded";
  version: string;
  db: boolean;
}

export type UpdateMode =
  | { mode: "release"; version: string | null }
  | { mode: "git" };

export interface Backup {
  type: "manual" | "pre-update" | "daily" | "weekly" | "monthly";
  name: string;
  size: number;
  created: string;
}

export interface BackupSettings {
  daily_keep_days: number;
  weekly_keep_days: number;
  monthly_keep_days: number;
  pre_update_keep: number;
  schedule_enabled: boolean;
  schedule_time: string;
}

export interface BackupsInfo {
  backups: Backup[];
  settings: BackupSettings;
  runner_installed: boolean;
  busy: string | null;
  state: TaskState;
  disk: { free?: number; total?: number };
  can_download: boolean;
}

export async function fetchServerUpdate(refresh = false) {
  const { data } = await axios.get<ServerUpdateInfo>("core/server/update/", {
    params: refresh ? { refresh: 1 } : {},
  });
  return data;
}

// starting an update or a backup needs the console step-up, 403 {"stepup": true}
export async function startServerUpdate(
  body: UpdateMode,
  config: RequestConfig = {},
) {
  const { data } = await axios.post("core/server/update/", body, config);
  return data;
}

export function fetchReleaseSources(refresh = false) {
  return core.get<ReleaseSources>("/server/update/sources/", {
    params: refresh ? { refresh: 1 } : {},
  });
}

export function fetchReleaseRepos() {
  return core.get<ReleaseRepo[]>("/server/update/repos/");
}

// writes need the console step-up, 403 {"stepup": true}
export async function addReleaseRepo(
  body: ReleaseRepoInput,
  config: RequestConfig = {},
) {
  const { data } = await axios.post<ReleaseRepo>(
    "core/server/update/repos/",
    body,
    config,
  );
  return data;
}

export async function changeReleaseRepo(
  id: number,
  body: ReleaseRepoInput,
  config: RequestConfig = {},
) {
  const { data } = await axios.put<ReleaseRepo>(
    `core/server/update/repos/${id}/`,
    body,
    config,
  );
  return data;
}

export async function removeReleaseRepo(
  id: number,
  config: RequestConfig = {},
) {
  const { data } = await axios.delete(
    `core/server/update/repos/${id}/`,
    config,
  );
  return data;
}

// polled during the update; nginx and the API vanish for the restart
export function fetchUpdateProgress() {
  return core.get<UpdateProgress>("/server/update/progress/", {
    silent: true,
    noAuthRedirect: true,
  } as RequestConfig);
}

// unauthenticated, polled while the server comes back
export function fetchHealth() {
  return core.get<Health>("/health/", {
    silent: true,
    noAuthRedirect: true,
    timeout: 4000,
  } as RequestConfig);
}

// silent: polled while the server restarts, failures are expected
export async function fetchTaskLog(action: string, offset: number) {
  const { data } = await axios.get<TaskLog>(
    `core/server/tasks/${action}/log/`,
    {
      params: { offset },
      silent: true,
      // update.sh signs every session out at the end
      noAuthRedirect: true,
    } as RequestConfig,
  );
  return data;
}

export async function fetchBackups() {
  const { data } = await axios.get<BackupsInfo>("core/server/backups/");
  return data;
}

export async function startBackup(config: RequestConfig = {}) {
  const { data } = await axios.post("core/server/backups/", {}, config);
  return data;
}

export async function saveBackupSettings(
  payload: BackupSettings,
  config: RequestConfig = {},
) {
  const { data } = await axios.put<BackupSettings>(
    "core/server/backups/settings/",
    payload,
    config,
  );
  return data;
}

export async function deleteBackup(b: Backup, config: RequestConfig = {}) {
  const { data } = await axios.delete(
    `core/server/backups/${b.type}/${encodeURIComponent(b.name)}/`,
    config,
  );
  return data;
}

export async function downloadBackup(b: Backup, config: RequestConfig = {}) {
  const { data } = await axios.get<Blob>(
    `core/server/backups/${b.type}/${encodeURIComponent(b.name)}/`,
    { ...config, responseType: "blob" },
  );
  return data;
}
