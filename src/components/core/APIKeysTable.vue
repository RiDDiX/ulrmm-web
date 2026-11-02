<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <div>
    <SettingsPanelHeader
      title="API Keys"
      :count="keys.length"
      text="Keys for scripts and integrations; each one acts with the role of the user it belongs to."
    >
      <q-btn v-bind="addButton" @click="openForm()" />
    </SettingsPanelHeader>
    <q-table
      v-model:pagination="pagination"
      v-sortable-headers
      v-bind="listTableAttrs"
      :rows="keys"
      :columns="columns"
      :loading="loading"
    >
      <template v-slot:header-cell-actions="head">
        <q-th :props="head" auto-width>
          <span class="sr-only">Key</span>
        </q-th>
      </template>
      <template v-slot:header-cell-expiration="head">
        <q-th :props="head">
          {{ head.col.label }}
          <q-tooltip
            >After this time the key is refused; Never means it does not
            expire</q-tooltip
          >
        </q-th>
      </template>
      <template v-slot:header-cell-rowactions="head">
        <q-th :props="head" auto-width>
          <span class="sr-only">{{ head.col.label }}</span>
        </q-th>
      </template>

      <template v-slot:loading>
        <q-inner-loading :showing="true" color="primary" />
      </template>

      <template v-slot:no-data>
        <NoDataPanel
          :loading="loading"
          :error="error"
          icon="key"
          title="No API keys yet"
          text="Create a key for a script or integration that needs to call the API."
          @retry="load"
        >
          <q-btn v-bind="addButton" @click="openForm()" />
        </NoDataPanel>
      </template>

      <template v-slot:body="line">
        <q-tr
          :props="line"
          class="cursor-pointer"
          @dblclick="openForm(line.row)"
        >
          <q-menu context-menu>
            <RowMenuList with-close :items="menuFor(line.row)" />
          </q-menu>
          <q-td>{{ line.row.name }}</q-td>
          <q-td>{{ line.row.username }}</q-td>
          <q-td>
            <span v-if="!line.row.expiration" class="rmm-muted">Never</span>
            <template v-else>
              {{ formatDate(line.row.expiration) }}
              <span
                v-if="isExpired(line.row.expiration)"
                class="rmm-pill rmm-pill--negative q-ml-xs"
                >Expired
                <q-tooltip
                  >The API refuses this key; edit it to set a later
                  expiry</q-tooltip
                ></span
              >
            </template>
          </q-td>
          <q-td>{{ formatDate(line.row.created_time) }}</q-td>
          <q-td>
            <q-icon name="lock" size="xs" class="rmm-muted" aria-hidden="true">
              <q-tooltip
                >The key is shown only once, when it is created</q-tooltip
              >
            </q-icon>
            <span class="sr-only">Key is shown only once, at creation</span>
          </q-td>
          <q-td @click.stop>
            <RowActions :label="`Actions for ${line.row.name}`">
              <RowMenuList :items="menuFor(line.row)" />
            </RowActions>
          </q-td>
        </q-tr>
      </template>
    </q-table>
  </div>
</template>

<script setup>
import { onMounted, ref } from "vue";
import { useStore } from "vuex";
import { useQuasar } from "quasar";
import { fetchAPIKeys, removeAPIKey } from "@/api/accounts";
import { askChangeCode } from "@/composables/accounts";
import { useAuthStore } from "@/stores/auth";
import { notifySuccess } from "@/utils/notify";
import { sortableHeaders as vSortableHeaders } from "@/utils/sortableHeaders";
import {
  listTableAttrs,
  nameSortedPagination,
  textColumn,
} from "@/core/ui/listTable";
import APIKeysForm from "@/components/core/APIKeysForm.vue";
import RowActions from "@/components/ui/RowActions.vue";
import SettingsPanelHeader from "@/components/modals/coresettings/SettingsPanelHeader.vue";
import NoDataPanel from "@/core/ui/NoDataPanel.vue";
import RowMenuList from "@/core/ui/RowMenuList.vue";

const $q = useQuasar();
const store = useStore();
const formatDate = (val) => store.getters.formatDate(val);

const keys = ref([]);
const loading = ref(false);
const error = ref("");
const pagination = ref(nameSortedPagination());

const addButton = {
  unelevated: true,
  "no-caps": true,
  color: "primary",
  icon: "add",
  label: "Add key",
};

const columns = [
  textColumn("name", "Name"),
  textColumn("username", "User"),
  textColumn("expiration", "Expiration"),
  textColumn("created_time", "Created"),
  { name: "actions", label: "", field: "actions" },
  { name: "rowactions", label: "Actions", align: "right", field: () => "" },
];

const isExpired = (expiration) => new Date(expiration).getTime() < Date.now();

async function load() {
  loading.value = true;
  error.value = "";
  try {
    keys.value = await fetchAPIKeys();
  } catch (e) {
    console.error(e);
    error.value =
      e?.response?.status === 403
        ? "Your role cannot view API keys."
        : "API keys could not be loaded.";
  }
  loading.value = false;
}

// a new key is already created when the form closes, so reload on dismiss
function openForm(key) {
  const dialog = $q.dialog({
    component: APIKeysForm,
    componentProps: key ? { APIKey: key } : undefined,
  });
  if (key) dialog.onOk(load);
  else dialog.onDismiss(load);
}

async function remove(key) {
  const title = `Delete API key: ${key.name}?`;
  const ok = { label: "Delete", color: "negative" };
  let code;
  // keys of other users need the current code
  if (key.username !== useAuthStore().username) {
    code = await askChangeCode($q, { title, ok });
    if (code === null) return;
  } else {
    const confirmed = await new Promise((resolve) =>
      $q
        .dialog({ title, cancel: true, ok })
        .onOk(() => resolve(true))
        .onCancel(() => resolve(false)),
    );
    if (!confirmed) return;
  }
  loading.value = true;
  try {
    notifySuccess(await removeAPIKey(key.id, code));
    load();
  } catch (e) {
    console.error(e);
  }
  loading.value = false;
}

const menuFor = (key) => [
  { label: "Edit", icon: "edit", run: () => openForm(key) },
  {
    label: "Delete",
    icon: "delete",
    danger: true,
    gap: true,
    run: () => remove(key),
  },
];

onMounted(load);
</script>
