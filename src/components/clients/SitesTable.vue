<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-dialog
    ref="dialogRef"
    aria-labelledby="sites-table-title"
    @hide="onDialogHide"
  >
    <q-card class="q-dialog-plugin rmm-dialog--md">
      <DialogHeader
        title-id="sites-table-title"
        :title="`Sites of ${client.name}`"
        subtitle="Double-click a row to edit it"
      >
        <template #actions>
          <q-btn
            dense
            flat
            icon="refresh"
            aria-label="Refresh sites"
            @click="load"
          >
            <q-tooltip>Reload the site list</q-tooltip>
          </q-btn>
        </template>
      </DialogHeader>
      <q-table
        :rows="sites"
        :loading="loading"
        :columns="columns"
        :pagination="{ rowsPerPage: 0, sortBy: 'name', descending: false }"
        v-bind="tableAttrs"
      >
        <template v-slot:top>
          <div class="rmm-toolbar full-width">
            <q-btn
              label="New site"
              dense
              unelevated
              no-caps
              color="primary"
              icon="add"
              @click="addSite"
            />
            <q-space />
            <span class="rmm-muted rmm-num">
              {{ sites.length }} {{ sites.length === 1 ? "site" : "sites" }}
            </span>
          </div>
        </template>

        <template v-slot:header-cell-agent_count="head">
          <q-th :props="head">
            {{ head.col.label }}
            <q-tooltip>Agents installed in this site</q-tooltip>
          </q-th>
        </template>

        <template v-slot:loading>
          <q-inner-loading :showing="true" color="primary" />
        </template>

        <template v-slot:no-data>
          <NoDataPanel
            :loading="loading"
            :error="error"
            icon="location_city"
            title="No sites"
            text="Sites group the agents of a client. Add a site to install agents into it."
            @retry="load"
          >
            <q-btn
              dense
              unelevated
              no-caps
              color="primary"
              icon="add"
              label="New site"
              @click="addSite"
            />
          </NoDataPanel>
        </template>

        <template v-slot:body="line">
          <q-tr
            :props="line"
            class="cursor-pointer"
            @dblclick="editSite(line.row)"
          >
            <q-menu context-menu>
              <RowMenuList with-close :width="220" :items="menuFor(line.row)" />
            </q-menu>
            <q-td class="text-weight-medium">{{ line.row.name }}</q-td>
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
import { fetchClient, removeSite } from "@/api/clients";
import { confirmDeleteClientOrSite } from "@/composables/clients";
import { notifySuccess } from "@/utils/notify";
import SitesForm from "@/components/clients/SitesForm.vue";
import VaultDialog from "@/components/vault/VaultDialog.vue";
import RowActions from "@/components/ui/RowActions.vue";
import DialogHeader from "@/components/ui/DialogHeader.vue";
import NoDataPanel from "@/core/ui/NoDataPanel.vue";
import RowMenuList from "@/core/ui/RowMenuList.vue";

const props = defineProps({ client: Object });
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
  style: "height: 65vh",
};

const columns = [
  { name: "name", label: "Name", field: "name", align: "left" },
  { name: "agent_count", label: "Agents", field: "agent_count", align: "left" },
  { name: "actions", label: "Actions", align: "right", field: () => "" },
];

const sites = ref([]);
const loading = ref(false);
const error = ref("");

async function load() {
  loading.value = true;
  error.value = "";
  try {
    sites.value = (await fetchClient(props.client.id)).sites;
  } catch (e) {
    error.value =
      e?.response?.status === 403
        ? "Your role cannot view sites."
        : "Sites could not be loaded.";
  }
  loading.value = false;
}

function addSite() {
  $q.dialog({
    component: SitesForm,
    componentProps: { client: props.client.id },
  }).onOk(load);
}

function editSite(site) {
  $q.dialog({
    component: SitesForm,
    componentProps: { site, lastSite: sites.value.length === 1 },
  }).onOk(load);
}

function openVault(site) {
  $q.dialog({
    component: VaultDialog,
    componentProps: {
      scope: "site",
      scopeKey: site.id,
      name: `${props.client.name} / ${site.name}`,
    },
  });
}

function askDelete(site) {
  confirmDeleteClientOrSite({
    $q,
    object: site,
    type: "site",
    onDeleteWithAgents: load,
    onDelete: async (code) => {
      loading.value = true;
      try {
        notifySuccess(await removeSite(site.id, {}, code));
        await load();
      } catch (e) {
        console.error(e);
      }
      loading.value = false;
    },
  });
}

const menuFor = (site) => [
  { label: "Edit", icon: "edit", run: () => editSite(site) },
  { label: "Vault…", icon: "lock", run: () => openVault(site) },
  {
    label: "Delete",
    icon: "delete",
    danger: true,
    gap: true,
    caption:
      sites.value.length === 1
        ? "Only site shown for this client. The server refuses to delete a client's last site."
        : "Asks for the site name and a 2FA code",
    run: () => askDelete(site),
  },
];

onMounted(load);
</script>
