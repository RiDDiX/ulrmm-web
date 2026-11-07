// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

import { defineStore } from "pinia";
import { ref } from "vue";
import {
  cancelIsoDownload,
  fetchIsoLibrary,
  fetchIsoProgress,
  isoFitsFamily,
  retryIsoDownload,
  startIsoDownload,
  type BaseIso,
  type IsoProgress,
} from "@/api/deploy";
import { fmtBytes } from "@/utils/format";

export type IsoState =
  | "ready"
  | "downloading"
  | "verifying"
  | "error"
  | "missing";

const ACTIVE = ["downloading", "verifying", "inspecting"];
let timer: ReturnType<typeof setTimeout> | undefined;
// set when a view unmounts, so a refresh still in flight does not re-arm
let halted = false;

export function fmtRate(bps: number) {
  return `${fmtBytes(bps)}/s`;
}

export function fmtEta(sec: number | null) {
  if (sec == null) return "";
  if (sec >= 90) return `~${Math.round(sec / 60)} min`;
  return `~${Math.max(1, Math.round(sec))} s`;
}

export const useIsoDownloads = defineStore("isoDownloads", () => {
  const library = ref<BaseIso[]>([]);
  const progress = ref<Record<number, IsoProgress>>({});
  const loading = ref(false);
  const error = ref("");

  function clear() {
    clearTimeout(timer);
    timer = undefined;
  }

  function stop() {
    halted = true;
    clear();
  }

  async function refresh() {
    clear();
    halted = false;
    loading.value = true;
    try {
      const [lib, prog] = await Promise.all([
        fetchIsoLibrary(),
        fetchIsoProgress(),
      ]);
      library.value = lib;
      progress.value = Object.fromEntries(prog.map((p) => [p.id, p]));
      error.value = "";
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
    } finally {
      loading.value = false;
    }
    // a concurrent refresh may have scheduled already
    clear();
    if (!halted && library.value.some((i) => ACTIVE.includes(i.status))) {
      timer = setTimeout(refresh, 1000);
    }
  }

  async function start(
    url: string,
    opts?: { sha256?: string; sha256_url?: string | null; target?: string },
  ) {
    const row = await startIsoDownload({ url, ...opts });
    await refresh();
    return row;
  }

  async function cancel(id: number) {
    await cancelIsoDownload(id);
    await refresh();
  }

  async function retry(id: number) {
    await retryIsoDownload(id);
    await refresh();
  }

  function percent(p: IsoProgress | null | undefined) {
    if (!p) return 0;
    return p.totalBytes > 0
      ? Math.min(100, (p.downloadedBytes / p.totalBytes) * 100)
      : (p.progressPercent ?? 0);
  }

  const rowFor = (url: string) =>
    library.value.find((i) => i.source_url === url);

  function activeFor(urls: string[]) {
    const row = library.value.find(
      (i) =>
        urls.includes(i.source_url) &&
        (i.status === "downloading" || i.status === "verifying"),
    );
    return row
      ? (progress.value[row.id] ?? row.progress ?? undefined)
      : undefined;
  }

  const readyFor = (family: string) =>
    library.value.filter(
      (i) =>
        i.status === "ready" &&
        i.kind === "base" &&
        isoFitsFamily(i.os, family),
    );

  function stateFor(urls: string[], family: string): IsoState {
    const rows = library.value.filter((i) => urls.includes(i.source_url));
    if (rows.some((i) => i.status === "ready" && i.kind === "base"))
      return "ready";
    if (rows.some((i) => i.status === "verifying")) return "verifying";
    if (
      rows.some((i) => i.status === "downloading" || i.status === "inspecting")
    )
      return "downloading";
    if (rows.some((i) => i.status === "error")) return "error";
    void family;
    return "missing";
  }

  return {
    library,
    progress,
    loading,
    error,
    refresh,
    start,
    cancel,
    retry,
    stop,
    percent,
    rowFor,
    activeFor,
    readyFor,
    stateFor,
  };
});
