// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

import { onMounted, ref } from "vue";

// a ref of dropdown options plus the loader that fills it; a failed load
// is logged and leaves the previous options in place
export function useLoadedOptions(build, onMount = false) {
  const options = ref([]);

  async function load(...args) {
    try {
      options.value = await build(...args);
    } catch (e) {
      console.error(e);
    }
  }

  if (onMount) onMounted(() => load());
  return { options, load };
}
