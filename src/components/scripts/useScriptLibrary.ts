// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2
import { ref } from "vue";
import * as scriptApi from "@/api/scripts";
import { fetchAgents } from "@/api/agents";
import { notifySuccess } from "@/utils/notify";
import type { RunTarget } from "@/utils/scriptLibrary";
import type { Script } from "@/types/scripts";

export type LibraryRow = Script & { id: number };

export const byName = (a = "", b = "") =>
  a.localeCompare(b, undefined, { sensitivity: "base", numeric: true });

// extra sentences for the sync notification, keyed by the result counter
const SYNC_NOTES = [
  [
    "retired",
    "Removed scripts that checks or tasks still use were kept under the category Retired community scripts.",
  ],
  ["skipped", "Some entries were skipped; the server log names them."],
] as const;

const sentence = (text: string) => (/[.!?]$/.test(text) ? text : `${text}.`);

// the script list of the manager with its load state, the community sync and
// the code and agent lookups of the detail panel
export function useScriptLibrary() {
  const scripts = ref<LibraryRow[]>([]);
  const fetching = ref(false);
  const fetchFailed = ref(false);
  const syncing = ref(false);
  // one code request per script; cleared on reload, a failed one is retried
  const codeById = new Map<number, Promise<string>>();
  let agentsInFlight: Promise<RunTarget[]> | null = null;

  async function reload() {
    fetching.value = true;
    fetchFailed.value = false;
    try {
      // the view filters community and hidden scripts itself
      const list: LibraryRow[] = await scriptApi.fetchScripts({
        showCommunityScripts: true,
        showHiddenScripts: true,
      });
      scripts.value = list.sort((a, b) => byName(a.name, b.name));
      codeById.clear();
    } catch {
      fetchFailed.value = true;
    }
    fetching.value = false;
  }

  // the list stays usable while the sync runs
  async function syncCommunity() {
    syncing.value = true;
    try {
      const result = await scriptApi.syncCommunityScripts();
      const extra = SYNC_NOTES.filter(([counter]) => result[counter] > 0);
      const notes = [
        sentence(result.message),
        ...extra.map(([, note]) => note),
      ];
      notifySuccess(notes.join(" "), notes.length > 1 ? 9000 : 4000);
      await reload();
    } catch {
      // the http interceptor shows the server message
    }
    syncing.value = false;
  }

  function loadCode(id: number): Promise<string> {
    const known = codeById.get(id);
    if (known) return known;
    const pending: Promise<string> = scriptApi
      .downloadScript(id, { with_snippets: true })
      .then(({ code }: { code: string }) => code);
    codeById.set(id, pending);
    pending.catch(() => codeById.delete(id));
    return pending;
  }

  // every picker gets fresh online states, without parallel requests
  function loadAgents(): Promise<RunTarget[]> {
    if (!agentsInFlight)
      agentsInFlight = fetchAgents().finally(() => {
        agentsInFlight = null;
      });
    return agentsInFlight;
  }

  return {
    scripts,
    fetching,
    fetchFailed,
    syncing,
    reload,
    syncCommunity,
    loadCode,
    loadAgents,
  };
}
