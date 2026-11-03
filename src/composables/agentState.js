// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

import { computed, ref } from "vue";
import { fetchAgentState } from "@/api/metrics";
import { SILENT_REQUEST_CONFIG } from "@/constants/constants";

// one request feeds the system, interfaces and containers cards
export function useAgentState() {
  const state = ref(null);
  // 204 (404 on older servers): the agent has not pushed a state yet
  const missing = ref(false);
  let generation = 0;

  // silent: no state from an older agent is expected, not an error toast
  async function load(agentId) {
    const request = ++generation;
    try {
      const data = await fetchAgentState(agentId, SILENT_REQUEST_CONFIG);
      if (request !== generation) return;
      const found = data && typeof data === "object";
      state.value = found ? data : null;
      missing.value = !found;
    } catch (e) {
      if (request !== generation) return;
      // other errors keep the last good document on screen
      if (e?.response?.status === 404) {
        state.value = null;
        missing.value = true;
      } else if (e?.response?.status === 403) {
        state.value = null;
      }
    }
  }

  function reset() {
    generation += 1;
    state.value = null;
    missing.value = false;
  }

  return {
    state,
    missing,
    stale: computed(() => state.value?.stale === true),
    load,
    reset,
  };
}

export const arr = (v) => (Array.isArray(v) ? v : []);
export const isNum = (v) => typeof v === "number" && Number.isFinite(v);

const UNITS = ["B", "KB", "MB", "GB", "TB", "PB"];

export function fmtBytes(v) {
  if (!isNum(v)) return "—";
  let n = Math.abs(v);
  let i = 0;
  while (n >= 1024 && i < UNITS.length - 1) {
    n /= 1024;
    i += 1;
  }
  return `${v < 0 ? "-" : ""}${i ? n.toFixed(1) : Math.round(n)} ${UNITS[i]}`;
}

export const fmtRate = (v) => (isNum(v) ? `${fmtBytes(v)}/s` : "—");

export function fmtNum(v, digits = 1) {
  if (!isNum(v)) return "—";
  return String(Math.round(v * 10 ** digits) / 10 ** digits);
}

export const fmtPct = (v) => (isNum(v) ? `${Math.round(v)}%` : "—");
