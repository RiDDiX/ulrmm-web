// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

import { onMounted, ref } from "vue";
import { useStore } from "vuex";
import { fetchAgents } from "@/api/agents";
import { formatAgentOptions } from "@/utils/format";

// flat gives plain hostnames instead of { label, value } entries grouped
// by client and site
export function useAgentDropdown(opts = {}) {
  const agentOptions = ref([]);

  async function getAgentOptions(flat = false) {
    const list = await fetchAgents({ detail: false });
    agentOptions.value = formatAgentOptions(list, flat);
  }

  if (opts.onMount) onMounted(() => getAgentOptions());

  return { agent: ref(null), agents: ref([]), agentOptions, getAgentOptions };
}

// the run-command example text the server sends per shell
export function cmdPlaceholder(shell) {
  const examples = useStore().state.run_cmd_placeholder_text;
  if (shell === "cmd" || shell === "powershell") return examples[shell];
  return examples.shell;
}

export const agentPlatformOptions = [
  ["windows", "Windows"],
  ["linux", "Linux"],
  ["darwin", "macOS"],
  ["freebsd", "FreeBSD"],
].map(([value, label]) => ({ value, label }));
