<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <div>
    <SettingsPanelHeader
      title="Global Key Store"
      :count="keystore.length"
      text="Values stored once and used in scripts, URL actions and web hooks as {{global.Name}}."
    >
      <q-btn
        flat
        no-caps
        :label="masked ? 'Show values' : 'Hide values'"
        :icon="masked ? 'visibility' : 'visibility_off'"
        @click="masked = !masked"
      >
        <q-tooltip>{{
          masked
            ? "Shows the stored values in the table"
            : "Masks the stored values in the table"
        }}</q-tooltip>
      </q-btn>
      <q-btn
        unelevated
        no-caps
        color="primary"
        icon="add"
        label="Add key"
        @click="openForm()"
      />
    </SettingsPanelHeader>
    <q-table
      v-model:pagination="pagination"
      v-sortable-headers
      v-bind="listTableAttrs"
      :rows="keystore"
      :columns="columns"
      :loading="loading"
    >
      <template v-slot:loading>
        <q-inner-loading :showing="true" color="primary" />
      </template>

      <template v-slot:no-data>
        <NoDataPanel
          :loading="loading"
          :error="error"
          icon="vpn_key"
          title="No keys yet"
          text="Store a value once, such as a share path or token, and use it everywhere as {{global.Name}}."
          @retry="load"
        >
          <q-btn
            unelevated
            no-caps
            color="primary"
            icon="add"
            label="Add key"
            @click="openForm()"
          />
        </NoDataPanel>
      </template>

      <template v-slot:body="{ row, ...tr }">
        <q-tr
          :props="{ row, ...tr }"
          class="cursor-pointer"
          @dblclick="openForm(row)"
        >
          <q-menu context-menu>
            <RowMenuList with-close :items="menuFor(row)" />
          </q-menu>
          <q-td>{{ row.name }}</q-td>
          <q-td :class="{ 'rmm-mono': !masked }">
            <template v-if="masked">
              <span aria-hidden="true">****</span>
              <span class="sr-only">Hidden value</span>
            </template>
            <template v-else>{{ row.value }}</template>
          </q-td>
          <q-td @click.stop>
            <RowActions :label="`Actions for ${row.name}`">
              <RowMenuList :items="menuFor(row)" />
            </RowActions>
          </q-td>
        </q-tr>
      </template>
    </q-table>
  </div>
</template>

<script setup>
import { onMounted, ref } from "vue";
import axios from "axios";
import { useQuasar } from "quasar";
import { notifySuccess } from "@/utils/notify";
import { confirmDelete } from "@/core/confirm";
import { sortableHeaders as vSortableHeaders } from "@/utils/sortableHeaders";
import {
  actionsColumn,
  listTableAttrs,
  nameSortedPagination,
  textColumn,
} from "@/core/ui/listTable";
import KeyStoreForm from "@/components/modals/coresettings/KeyStoreForm.vue";
import RowActions from "@/components/ui/RowActions.vue";
import SettingsPanelHeader from "@/components/modals/coresettings/SettingsPanelHeader.vue";
import NoDataPanel from "@/core/ui/NoDataPanel.vue";
import RowMenuList from "@/core/ui/RowMenuList.vue";

const $q = useQuasar();

const keystore = ref([]);
const loading = ref(false);
const error = ref("");
const masked = ref(true);
const pagination = ref(nameSortedPagination());

const columns = [
  textColumn("name", "Name"),
  textColumn("value", "Value"),
  actionsColumn,
];

async function load() {
  loading.value = true;
  error.value = "";
  try {
    keystore.value = (await axios.get("/core/keystore/")).data;
  } catch (err) {
    error.value =
      err?.response?.status === 403
        ? "Your role cannot view the key store."
        : "Key store could not be loaded.";
  }
  loading.value = false;
}

// add when no key is given
function openForm(globalKey) {
  $q.dialog({
    component: KeyStoreForm,
    componentProps: globalKey ? { globalKey } : undefined,
  }).onOk(load);
}

function remove(key) {
  confirmDelete($q, `Delete key: ${key.name}?`).onOk(async () => {
    $q.loading.show();
    try {
      await axios.delete(`/core/keystore/${key.id}/`);
      load();
      $q.loading.hide();
      notifySuccess(`key: ${key.name} was deleted!`);
    } catch {
      $q.loading.hide();
    }
  });
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
