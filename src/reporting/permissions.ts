// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

import { computed } from "vue";
import { useStore } from "vuex";

export interface ReportingPermsState {
  reporting_perms?: { view: boolean | null; manage: boolean | null };
}

// Hides reporting UI the role cannot use. The server checks every request on
// its own; this only spares users buttons that would answer 403. Superusers
// arrive with both flags set. A flag the server did not send counts as denied.
export function reportingPerms(state: ReportingPermsState) {
  const manage = state.reporting_perms?.manage === true;
  const view = manage || state.reporting_perms?.view === true;
  return { view, manage };
}

export function useReportingPerms() {
  const store = useStore();

  const canManageReports = computed(() => reportingPerms(store.state).manage);
  const canViewReports = computed(() => reportingPerms(store.state).view);

  return { canViewReports, canManageReports };
}
