// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

import { ref } from "vue";
import { fetchClients } from "@/api/clients";
import { useLoadedOptions } from "@/composables/options";
import * as format from "@/utils/format";
import DeleteClient from "@/components/clients/DeleteClient.vue";
import ConfirmYesDialog from "@/components/agents/ConfirmYesDialog.vue";

// DS-10: DashboardView, ClientsManager and SitesTable each copied this
// client/site delete flow verbatim (the DeleteClient reassignment dialog
// when agents are still attached, otherwise a plain "Are you sure?"
// confirm). This is that one flow; each caller still owns its own loading
// state and post-delete refresh since those genuinely differ (a global
// spinner and tree clear on the dashboard vs a local ref and table reload
// in the managers).
export function confirmDeleteClientOrSite({
  $q,
  object,
  type,
  onDeleteWithAgents,
  onDelete,
}) {
  if (object.agent_count > 0) {
    $q.dialog({
      component: DeleteClient,
      componentProps: { object, type },
    }).onOk(onDeleteWithAgents);
    return;
  }
  // typed name has to match. the totp code is what onDelete gets.
  $q.dialog({
    title: "Are you sure?",
    message: `Delete ${type}: ${object.name}.`,
    cancel: true,
    ok: { label: "Delete", color: "negative" },
  }).onOk(() =>
    $q
      .dialog({
        component: ConfirmYesDialog,
        componentProps: {
          hostname: object.name,
          confirmText: object.name,
          requireTotp: true,
          actionVerb: "deletion",
          title: `Delete ${type} ${object.name}`,
          okLabel: `Delete ${type}`,
        },
      })
      .onOk(onDelete),
  );
}

export function useClientDropdown(onMount = false) {
  const { options, load } = useLoadedOptions(
    async (flat = false) =>
      format.formatClientOptions(await fetchClients(), flat),
    onMount,
  );
  return {
    client: ref(null),
    clients: ref([]),
    clientOptions: options,
    getClientOptions: load,
  };
}

// sites grouped under their client
export function useSiteDropdown(onMount = false) {
  const { options, load } = useLoadedOptions(
    async () => format.formatSiteOptions(await fetchClients()),
    onMount,
  );
  return {
    site: ref(null),
    sites: ref([]),
    siteOptions: options,
    getSiteOptions: load,
  };
}
