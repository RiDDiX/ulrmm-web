// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

import { ref } from "vue";
import * as accounts from "@/api/accounts";
import { useLoadedOptions } from "@/composables/options";
import { formatUserOptions } from "@/utils/format";

const { fetchConsoleStepUp, sendConsoleStepUp } = accounts;

export function useUserDropdown(onMount = false) {
  const { options, load } = useLoadedOptions(
    async (flat = false) =>
      formatUserOptions(await accounts.fetchUsers(), flat),
    onMount,
  );
  const userDropdownLoading = ref(false);

  // q-select @filter: server-side search from the second character on
  function getDynamicUserOptions(val, update, abort) {
    if (!val || val.length < 2) {
      abort();
      return;
    }
    update(async () => {
      userDropdownLoading.value = true;
      try {
        const found = await accounts.fetchUsers({ search: val.toLowerCase() });
        options.value = found.map((u) => u.username);
      } catch (e) {
        console.error(e);
      }
      userDropdownLoading.value = false;
    });
  }

  return {
    userOptions: options,
    userDropdownLoading,
    getUserOptions: load,
    getDynamicUserOptions,
  };
}

export function useRoleDropdown(opts = {}) {
  const { options, load } = useLoadedOptions(async () => {
    const roles = await accounts.fetchRoles();
    return roles.map(({ id, name }) => ({ value: id, label: name }));
  }, opts.onMount);
  return { roleOptions: options, getRoleOptions: load };
}

// $q.dialog prompt for a 6-digit two-factor code. rmm-otp centres the
// digits and the label (app.sass), like every other code field.
export const CODE_PROMPT = {
  model: "",
  type: "text",
  label: "Two-factor code",
  outlined: true,
  dense: true,
  autofocus: true,
  autocomplete: "one-time-code",
  inputmode: "numeric",
  maxlength: 6,
  class: "rmm-otp",
  isValid: (val) => /^\d{6}$/.test(val),
};

// the buttons of the custom dialogs (FormActions): unelevated OK, flat Cancel
export const PROMPT_OK = { unelevated: true, noCaps: true };
export const PROMPT_CANCEL = { flat: true, noCaps: true };

// totp prompt unless >= minRemaining seconds are left on the 60 min
// console step-up window. true if open.
export async function ensureConsoleStepUp($q, minRemaining = 1) {
  const { remaining } = await fetchConsoleStepUp();
  if (remaining >= minRemaining) return true;

  return new Promise((resolve) => {
    $q.dialog({
      title: "Two-factor code",
      message:
        "Enter the current code from your authenticator app. Terminal, files, packages, credentials and recovery keys then stay unlocked for 60 minutes.",
      prompt: { ...CODE_PROMPT, label: "Code" },
      ok: { ...PROMPT_OK, label: "Unlock" },
      cancel: PROMPT_CANCEL,
      persistent: true,
    })
      .onOk(async (code) => {
        try {
          await sendConsoleStepUp(code);
          resolve(true);
        } catch {
          resolve(false);
        }
      })
      .onCancel(() => resolve(false));
  });
}

// code prompt for changes to other accounts and to roles. the code, or
// null on cancel. the server checks it.
export function askChangeCode($q, { ok, ...opts } = {}) {
  return new Promise((resolve) => {
    $q.dialog({
      message: "Enter the current code from your authenticator app.",
      prompt: { ...CODE_PROMPT },
      ok: { ...PROMPT_OK, ...ok },
      cancel: PROMPT_CANCEL,
      persistent: true,
      ...opts,
    })
      .onOk(resolve)
      .onCancel(() => resolve(null));
  });
}
