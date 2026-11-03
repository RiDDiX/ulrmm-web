// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

import { ref } from "vue";
import axios from "axios";

// maps a policy id (as CheckSerializer/AutomatedTaskSerializer expose it) to
// its name, so a policy-managed row can name its policy instead of only
// showing the generic lock icon. Uses the same /automation/policies/ list
// AutomationManager already loads; no new endpoint.
export function usePolicyNames() {
  const policyNames = ref({});

  async function loadPolicyNames() {
    try {
      const { data } = await axios.get("/automation/policies/");
      policyNames.value = Object.fromEntries(
        (data || []).map((policy) => [policy.id, policy.name]),
      );
    } catch (e) {
      console.error(e);
    }
  }

  return {
    policyNames,
    loadPolicyNames,
  };
}
