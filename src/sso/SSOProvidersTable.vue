<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <div>
    <SettingsPanelHeader
      title="SSO Providers"
      :count="providers.length"
      text="OpenID Connect providers that users can sign in with instead of a local password."
    >
      <q-btn
        outline
        no-caps
        color="primary"
        icon="settings"
        label="SSO Settings"
        @click="openSettings"
      >
        <q-tooltip>Turn SSO on or off and block local logins</q-tooltip>
      </q-btn>
      <div>
        <q-btn
          unelevated
          no-caps
          color="primary"
          icon="add"
          label="Add OIDC Provider"
          :disable="!settings.sso_enabled"
          @click="addProvider"
        />
        <q-tooltip v-if="!settings.sso_enabled"
          >Enable SSO in the settings to allow adding a provider.</q-tooltip
        >
      </div>
    </SettingsPanelHeader>

    <div class="row items-center q-gutter-sm q-mb-sm">
      <span
        class="rmm-pill"
        :class="
          settings.sso_enabled ? 'rmm-pill--positive' : 'rmm-pill--neutral'
        "
        >{{ settings.sso_enabled ? "SSO enabled" : "SSO disabled" }}
        <q-tooltip>{{
          settings.sso_enabled
            ? "The login page offers the providers below"
            : "The login page shows no SSO providers"
        }}</q-tooltip>
      </span>
      <span
        v-if="settings.sso_enabled && settings.block_local_user_logon"
        class="rmm-pill rmm-pill--warning"
        >Local logins blocked
        <q-tooltip
          >Only SSO accounts and the built-in superuser can sign in; a Super
          User role is not enough</q-tooltip
        >
      </span>
    </div>

    <q-table
      dense
      flat
      class="rmm-table"
      :rows="providers"
      :columns="columns"
      v-bind="TABLE_OPTIONS"
      v-model:pagination="pagination"
      :loading="loading"
      v-sortable-headers
    >
      <template #loading>
        <q-inner-loading showing color="primary" />
      </template>

      <template #header-cell-server_url="props">
        <q-th :props="props">
          {{ props.col.label }}
          <q-tooltip>The provider's OpenID Connect issuer URL</q-tooltip>
        </q-th>
      </template>

      <template #header-cell-callback_url="props">
        <q-th :props="props">
          {{ props.col.label }}
          <q-tooltip
            >Register this address as the redirect URI at your
            provider</q-tooltip
          >
        </q-th>
      </template>

      <template #no-data>
        <EmptyState
          v-if="!loading"
          class="full-width"
          icon="login"
          title="No OIDC providers yet"
          :text="
            settings.sso_enabled
              ? 'Add a provider such as Microsoft Entra ID, Google or Keycloak so users can sign in with it.'
              : 'Turn on SSO under SSO Settings, then add a provider.'
          "
        >
          <q-btn
            unelevated
            no-caps
            color="primary"
            icon="add"
            label="Add OIDC Provider"
            :disable="!settings.sso_enabled"
            @click="addProvider"
          />
        </EmptyState>
      </template>

      <template #body="props">
        <q-tr
          :props="props"
          class="cursor-pointer"
          @dblclick="editProvider(props.row)"
        >
          <q-menu context-menu>
            <MenuList :items="menuItems(props.row)" with-close />
          </q-menu>

          <q-td>
            {{ truncateText(props.row.name, 25) }}
            <q-tooltip>{{ props.row.name }}</q-tooltip>
            <q-badge
              v-if="props.row.blocked_reason"
              color="negative"
              label="Blocked"
              class="q-ml-sm"
            >
              <q-tooltip
                >{{ props.row.blocked_reason }} It is left out of the login
                page.</q-tooltip
              >
            </q-badge>
          </q-td>
          <q-td class="rmm-mono">
            {{ truncateText(props.row.server_url, 20) }}
            <q-tooltip>{{ props.row.server_url }}</q-tooltip>
          </q-td>
          <q-td class="rmm-mono">
            {{ truncateText(props.row.client_id, 20) }}
            <q-tooltip>{{ props.row.client_id }}</q-tooltip>
          </q-td>
          <q-td @click.stop>
            <q-btn
              flat
              round
              dense
              size="sm"
              icon="content_copy"
              :aria-label="`Copy callback URL for ${props.row.name}`"
              @click="copyUrl(props.row.callback_url)"
            >
              <q-tooltip>Copy the callback URL to the clipboard</q-tooltip>
            </q-btn>
          </q-td>
          <q-td @click.stop>
            <RowActions :label="`Actions for ${props.row.name}`">
              <MenuList :items="menuItems(props.row)" />
            </RowActions>
          </q-td>
        </q-tr>
      </template>
    </q-table>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useStore } from "vuex";
import { copyToClipboard, useQuasar, type QTableColumn } from "quasar";
import SettingsPanelHeader from "@/components/modals/coresettings/SettingsPanelHeader.vue";
import EmptyState from "@/components/ui/EmptyState.vue";
import MenuList from "@/components/ui/MenuList.vue";
import RowActions from "@/components/ui/RowActions.vue";
import SSOProviderForm from "@/sso/SSOProviderForm.vue";
import SSOSettingsDialog from "@/sso/SSOSettings.vue";
import {
  fetchSSOProviders,
  fetchSSOSettings,
  removeSSOProvider,
} from "@/sso/api";
import { truncateText } from "@/utils/format";
import { notifySuccess } from "@/utils/notify";
import { sortableHeaders as vSortableHeaders } from "@/utils/sortableHeaders";

import type { SSOProvider, SSOSettings } from "@/sso/types";
import type { MenuItem } from "@/types/menu";

const $q = useQuasar();
const store = useStore();

const providers = ref([] as SSOProvider[]);
const settings = ref<SSOSettings>({
  sso_enabled: false,
  block_local_user_logon: false,
});
const loading = ref(false);
const pagination = ref({ rowsPerPage: 0, sortBy: "name", descending: false });

// one page, no paging bar; rows scroll virtually
const TABLE_OPTIONS = {
  rowKey: "id",
  binaryStateSort: true,
  hidePagination: true,
  virtualScroll: true,
  rowsPerPageOptions: [0],
  noDataLabel: "No OIDC Providers added yet",
};

const textColumn = (name: string, label: string, sortable = true) =>
  ({ name, label, field: name, align: "left", sortable }) as QTableColumn;

const columns: QTableColumn[] = [
  textColumn("name", "Name"),
  textColumn("server_url", "Issuer URL"),
  textColumn("client_id", "Client ID"),
  textColumn("callback_url", "Callback URL", false),
  { name: "rowactions", label: "Actions", field: "id", align: "right" },
];

function menuItems(provider: SSOProvider): MenuItem[] {
  return [
    { label: "Edit", icon: "edit", action: () => editProvider(provider) },
    { separator: true },
    {
      label: "Copy Callback URL",
      caption: "The redirect URI to register at the provider",
      icon: "content_copy",
      action: () => copyUrl(provider.callback_url),
    },
    {
      label: "Copy Authorized JavaScript origin",
      caption: "Asked for by some providers, such as Google",
      icon: "content_copy",
      action: () => copyUrl(provider.javascript_origin_url),
    },
    { separator: true },
    {
      label: "Delete",
      icon: "delete",
      negative: true,
      action: () => deleteProvider(provider),
    },
  ];
}

async function getSettings() {
  try {
    settings.value = await fetchSSOSettings();
  } catch (e) {
    console.error(e);
  }
}

// failures are only logged
async function whileLoading(fn: () => Promise<unknown>) {
  loading.value = true;
  try {
    await fn();
  } catch (e) {
    console.error(e);
  }
  loading.value = false;
}

const getProviders = () =>
  whileLoading(async () => {
    providers.value = await fetchSSOProviders();
  });

function copyUrl(url: string) {
  copyToClipboard(url).then(() => notifySuccess("URL copied!"));
}

function openSettings() {
  $q.dialog({ component: SSOSettingsDialog }).onOk((saved: SSOSettings) => {
    store.commit("setSSOEnabled", saved.sso_enabled);
    store.commit("setBlockLocalUserLogon", saved.block_local_user_logon);
    settings.value = saved;
  });
}

function addProvider() {
  $q.dialog({ component: SSOProviderForm }).onOk(getProviders);
}

function editProvider(provider: SSOProvider) {
  $q.dialog({
    component: SSOProviderForm,
    componentProps: { provider },
  }).onOk(getProviders);
}

function deleteProvider(provider: SSOProvider) {
  $q.dialog({
    title: `Delete SSO Provider: ${provider.name}?`,
    cancel: true,
    ok: { label: "Delete", color: "negative" },
  }).onOk(() =>
    whileLoading(async () => {
      await removeSSOProvider(provider.id);
      await getProviders();
      notifySuccess(`SSO Provider: ${provider.name} was deleted!`);
    }),
  );
}

onMounted(() => getSettings().then(getProviders));
</script>
