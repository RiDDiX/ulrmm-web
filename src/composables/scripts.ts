// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

import { computed, onMounted, ref, watch } from "vue";
import { useStore } from "vuex";
import { fetchScripts } from "@/api/scripts";
import type { AgentPlatformType } from "@/types/agents";
import type { Script, ScriptVariable } from "@/types/scripts";
import * as format from "@/utils/format";
import { applyVariableDefaults } from "@/utils/scriptVariables";

export type ScriptOption = Script & { label: string; value: number };

export interface useScriptDropdownParams {
  // preselected script id
  script?: number;
  // platform that filterByPlatformOptions narrows to
  plat?: AgentPlatformType;
  onMount?: boolean;
}

const DEFAULT_TIMEOUT = 30;

// group headers and scripts without a platform list always pass
function onlyFor(options: ScriptOption[], platform: AgentPlatformType) {
  const fits = (o: ScriptOption) =>
    o.category ||
    !o.supported_platforms?.length ||
    o.supported_platforms.includes(platform);
  return format.removeExtraOptionCategories(
    options.filter(fits),
  ) as ScriptOption[];
}

export function useScriptDropdown(opts?: useScriptDropdownParams) {
  const vuex = useStore();
  const communityOn = computed<boolean>(() => vuex.state.showCommunityScripts);

  const scriptOptions = ref<ScriptOption[]>([]);
  const script = ref<number | undefined>(opts?.script);
  const plat = ref<AgentPlatformType | undefined>(opts?.plat);
  const scriptName = ref<string>("");
  const syntax = ref<string | undefined>("");
  // inputs of the selected script
  const variables = ref<ScriptVariable[]>([]);
  const defaultTimeout = ref<number>(DEFAULT_TIMEOUT);
  const defaultArgs = ref<string[]>([]);
  const defaultEnvVars = ref<string[]>([]);

  // community scripts follow the user setting. A preselected script (opened
  // from the library) stays pickable even when hidden or switched off
  async function loadScripts(): Promise<Script[]> {
    const keep = script.value;
    if (!keep) {
      return fetchScripts({ showCommunityScripts: communityOn.value });
    }
    const all: Script[] = await fetchScripts({
      showCommunityScripts: true,
      showHiddenScripts: true,
    });
    const visible = (s: Script) =>
      !s.hidden && (communityOn.value || s.script_type !== "builtin");
    return all.filter((s) => s.id === keep || visible(s));
  }

  async function loadOptions() {
    const rows = await loadScripts();
    scriptOptions.value = Object.freeze(
      format.formatScriptOptions(rows),
    ) as ScriptOption[];
  }

  // a picked script brings its timeout, args, inputs and env (its env_vars
  // plus each input's default)
  watch([script, scriptOptions], () => {
    const id = script.value;
    const picked = id && scriptOptions.value.find((o) => o.value === id);
    if (!picked) return;
    scriptName.value = picked.label;
    syntax.value = picked.syntax;
    defaultTimeout.value = picked.default_timeout;
    defaultArgs.value = picked.args;
    variables.value = picked.variables || [];
    defaultEnvVars.value = applyVariableDefaults(
      picked.env_vars,
      variables.value,
    );
  });

  // server-side scripts run on the linux host
  const forServer = computed(() => onlyFor(scriptOptions.value, "linux"));

  const forPlatform = computed(() =>
    plat.value ? onlyFor(scriptOptions.value, plat.value) : scriptOptions.value,
  );

  function clearSelection() {
    script.value = undefined;
    syntax.value = "";
    variables.value = [];
    defaultTimeout.value = DEFAULT_TIMEOUT;
    defaultArgs.value = [];
    defaultEnvVars.value = [];
  }

  if (opts?.onMount) onMounted(loadOptions);

  return {
    script,
    scriptName,
    syntax,
    variables,
    plat,
    defaultTimeout,
    defaultArgs,
    defaultEnvVars,
    scriptOptions,
    serverScriptOptions: forServer,
    filterByPlatformOptions: forPlatform,
    getScriptOptions: loadOptions,
    reset: clearSelection,
  };
}

export const shellOptions = [
  ["PowerShell", "powershell"],
  ["Batch", "cmd"],
  ["Python", "python"],
  ["Shell", "shell"],
  ["Nushell", "nushell"],
  ["Deno", "deno"],
].map(([label, value]) => ({ label, value }));
