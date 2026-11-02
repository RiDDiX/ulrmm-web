// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

import { useStore } from "vuex";
import { useQuasar } from "quasar";
import ResetPass from "@/components/accounts/ResetPass.vue";
import UserPreferences from "@/components/modals/coresettings/UserPreferences.vue";
import { resetTwoFactor } from "@/api/accounts";
import { CODE_PROMPT, PROMPT_CANCEL, PROMPT_OK } from "@/composables/accounts";
import { useAuthStore } from "@/stores/auth";
import { notifySuccess } from "@/utils/notify";

export type AccountEntry = {
  key: string;
  label: string;
  caption?: string;
  run?: () => unknown;
  children?: AccountEntry[];
};

// what the account menu offers besides logging out
export function useAccountActions() {
  const store = useStore();
  const $q = useQuasar();

  function openPreferences() {
    // the tree sort is read from the store, so it reloads after dashinfo
    $q.dialog({ component: UserPreferences }).onOk(async () => {
      await store.dispatch("getDashInfo");
      store.dispatch("loadTree");
    });
  }

  function openPasswordReset() {
    $q.dialog({ component: ResetPass });
  }

  // a current code proves it is the user; the next login sets 2FA up again
  function confirmTwoFactorReset() {
    $q.dialog({
      title: "Reset 2FA",
      message:
        "This removes your authenticator key, ends your other sessions and deletes your API keys. Enter a current code to confirm. You must set up two-factor authentication again at your next login.",
      prompt: { ...CODE_PROMPT },
      persistent: true,
      cancel: PROMPT_CANCEL,
      // destructive, like the same reset under User Administration
      ok: { ...PROMPT_OK, label: "Reset", color: "negative" },
    }).onOk(async (code: string) => {
      try {
        notifySuccess(await resetTwoFactor(code), 3000);
      } catch {
        // the request helper already reported it
      }
    });
  }

  const preferences: AccountEntry = {
    key: "prefs",
    label: "Preferences",
    run: openPreferences,
  };
  // SSO sign-ins have no local password or key; the server refuses both
  const resets: AccountEntry[] = useAuthStore().ssoLoginProvider
    ? []
    : [
        { key: "password", label: "Reset Password", run: openPasswordReset },
        {
          key: "2fa",
          label: "Reset 2FA",
          caption:
            "Removes your authenticator key; set it up again at next login",
          run: confirmTwoFactorReset,
        },
      ];

  return { preferences, resets };
}
