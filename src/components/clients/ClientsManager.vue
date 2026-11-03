<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-dialog
    ref="dialogRef"
    aria-labelledby="clients-manager-title"
    @hide="onDialogHide"
  >
    <q-card class="q-dialog-plugin rmm-dialog--lg">
      <DialogHeader
        title-id="clients-manager-title"
        title="Clients"
        subtitle="Clients group sites, and every agent belongs to one site. Double-click a row to edit it."
      >
        <template #actions>
          <q-btn
            dense
            flat
            icon="refresh"
            aria-label="Refresh clients"
            @click="load"
          >
            <q-tooltip>Reload the client list</q-tooltip>
          </q-btn>
        </template>
      </DialogHeader>
      <q-table
        :rows="clients"
        :loading="loading"
        :columns="columns"
        :pagination="{ rowsPerPage: 0, sortBy: 'name', descending: false }"
        v-bind="tableAttrs"
      >
        <template v-slot:top>
          <div class="rmm-toolbar full-width">
            <q-btn
              v-bind="newClientButton"
              unelevated
              color="primary"
              @click="addClient"
            />
            <q-space />
            <span class="rmm-muted rmm-num">
              {{ clients.length }}
              {{ clients.length === 1 ? "client" : "clients" }}
            </span>
          </div>
        </template>

        <template
          v-for="(tip, name) in HEADER_TIPS"
          :key="name"
          v-slot:[`header-cell-${name}`]="head"
        >
          <q-th :props="head">
            {{ head.col.label }}
            <q-tooltip>{{ tip }}</q-tooltip>
          </q-th>
        </template>

        <template v-slot:loading>
          <q-inner-loading :showing="true" color="primary" />
        </template>

        <template v-slot:no-data>
          <NoDataPanel
            :loading="loading"
            :error="error"
            icon="business"
            title="No clients yet"
            text="Clients group sites, and agents are installed into a site. Add a client to get started."
            @retry="load"
          >
            <q-btn
              v-bind="newClientButton"
              outline
              color="primary"
              @click="addClient"
            />
          </NoDataPanel>
        </template>

        <template v-slot:body="line">
          <q-tr
            :props="line"
            class="cursor-pointer"
            @dblclick="editClient(line.row)"
          >
            <q-menu context-menu>
              <RowMenuList with-close :width="220" :items="menuFor(line.row)" />
            </q-menu>
            <q-td class="text-weight-medium">{{ line.row.name }}</q-td>
            <q-td>
              <a
                href="#"
                role="button"
                class="rmm-link"
                @click.prevent="openSites(line.row)"
                @keydown.space.prevent="openSites(line.row)"
                >Show sites ({{ line.row.sites.length }})</a
              >
              <q-tooltip>Open the sites of {{ line.row.name }}</q-tooltip>
            </q-td>
            <q-td class="rmm-num">{{ line.row.agent_count }}</q-td>
            <q-td class="text-right" @click.stop>
              <RowActions :label="`Actions for ${line.row.name}`">
                <RowMenuList :width="220" :items="menuFor(line.row)" />
              </RowActions>
            </q-td>
          </q-tr>
        </template>
      </q-table>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { onMounted, ref } from "vue";
import { useDialogPluginComponent, useQuasar } from "quasar";
import { fetchClients, removeClient } from "@/api/clients";
import { confirmDeleteClientOrSite } from "@/composables/clients";
import { notifySuccess } from "@/utils/notify";
import ClientsForm from "@/components/clients/ClientsForm.vue";
import SitesForm from "@/components/clients/SitesForm.vue";
import SitesTable from "@/components/clients/SitesTable.vue";
import VaultDialog from "@/components/vault/VaultDialog.vue";
import RowActions from "@/components/ui/RowActions.vue";
import DialogHeader from "@/components/ui/DialogHeader.vue";
import NoDataPanel from "@/core/ui/NoDataPanel.vue";
import RowMenuList from "@/core/ui/RowMenuList.vue";

defineEmits([...useDialogPluginComponent.emits]);

const $q = useQuasar();
const { dialogRef, onDialogHide } = useDialogPluginComponent();

const tableAttrs = {
  dense: true,
  flat: true,
  "row-key": "id",
  "binary-state-sort": true,
  "virtual-scroll": true,
  "rows-per-page-options": [0],
  "table-class": "table-bgcolor",
  class: "settings-tbl-sticky rmm-table",
  style: "height: 70vh",
};
const newClientButton = {
  label: "New client",
  icon: "add",
  dense: true,
  "no-caps": true,
  class: "q-pl-sm q-pr-md",
};
const HEADER_TIPS = {
  sites: "Sites of this client; open the list to manage them",
  agent_count: "Agents in all sites of this client",
};

const columns = [
  { name: "name", label: "Name", field: "name", align: "left" },
  { name: "sites", label: "Sites", field: "sites", align: "left" },
  { name: "agent_count", label: "Agents", field: "agent_count", align: "left" },
  { name: "actions", label: "Actions", align: "right", field: () => "" },
];

const clients = ref([]);
const loading = ref(false);
const error = ref("");

async function load() {
  loading.value = true;
  error.value = "";
  try {
    clients.value = await fetchClients();
  } catch (e) {
    error.value =
      e?.response?.status === 403
        ? "Your role cannot view clients."
        : "Clients could not be loaded.";
  }
  loading.value = false;
}

const addClient = () => $q.dialog({ component: ClientsForm }).onOk(load);

function editClient(client) {
  $q.dialog({ component: ClientsForm, componentProps: { client } }).onOk(load);
}

function addSite(client) {
  $q.dialog({
    component: SitesForm,
    componentProps: { client: client.id },
  }).onOk(load);
}

// sites added, moved or deleted there change this row's counts
function openSites(client) {
  $q.dialog({ component: SitesTable, componentProps: { client } }).onDismiss(
    load,
  );
}

function openVault(client) {
  $q.dialog({
    component: VaultDialog,
    componentProps: { scope: "client", scopeKey: client.id, name: client.name },
  });
}

function askDelete(client) {
  confirmDeleteClientOrSite({
    $q,
    object: client,
    type: "client",
    onDeleteWithAgents: load,
    onDelete: async (code) => {
      loading.value = true;
      try {
        notifySuccess(await removeClient(client.id, {}, code));
        await load();
      } catch (e) {
        console.error(e);
      }
      loading.value = false;
    },
  });
}

const menuFor = (client) => [
  { label: "Edit", icon: "edit", run: () => editClient(client) },
  { label: "Add site", icon: "add", run: () => addSite(client) },
  { label: "Vault…", icon: "lock", run: () => openVault(client) },
  {
    label: "Delete",
    icon: "delete",
    danger: true,
    gap: true,
    caption: "Asks for the client name and a 2FA code",
    run: () => askDelete(client),
  },
];

onMounted(load);
</script>
