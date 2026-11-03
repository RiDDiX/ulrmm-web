// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

import { nextTick, ref } from "vue";

export type EditSource = "enter" | "blur";

// q-menu props for a right-click menu
export const contextMenu = {
  contextMenu: true,
  transitionShow: "jump-up",
  transitionHide: "jump-down",
};

// the menu that started an edit takes focus with it when it closes, so the
// input is focused a little later
export function focusSoon(host: () => Element | null | undefined) {
  nextTick(() => {
    setTimeout(() => host()?.querySelector("input")?.focus(), 50);
  });
}

// state of one inline rename box. A blur that follows the opening within
// graceMs comes from that closing menu and does not count.
export function useInlineRename(graceMs: number) {
  const target = ref<string | null>(null);
  const text = ref("");
  let openedAt: number | null = null;
  let saving = false;

  function open(id: string, initial: string, guardBlur = true) {
    target.value = id;
    text.value = initial;
    if (guardBlur) openedAt = Date.now();
  }

  function ready(source: EditSource) {
    if (saving) return false;
    const tooEarly = openedAt !== null && Date.now() - openedAt < graceMs;
    if (source === "blur" && tooEarly) return false;
    openedAt = null;
    return true;
  }

  async function save(job: () => Promise<void>) {
    saving = true;
    try {
      await job();
    } finally {
      target.value = null;
      saving = false;
    }
  }

  return { target, text, open, ready, save };
}
