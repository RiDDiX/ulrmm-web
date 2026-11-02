<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide">
    <q-card class="rmm-dialog--lg" style="height: 75vh">
      <DialogHeader
        title="Manage roles"
        subtitle="A role bundles permissions and the clients and sites a user may see"
      >
        <template #actions>
          <q-btn
            dense
            flat
            icon="refresh"
            aria-label="Refresh roles"
            @click="load"
          >
            <q-tooltip>Reload the role list</q-tooltip>
          </q-btn>
        </template>
      </DialogHeader>
      <q-table
        v-bind="tableAttrs"
        v-sortable-headers
        :rows="roles"
        :loading="loading"
        :pagination="{ sortBy: 'name', rowsPerPage: 0, descending: false }"
        :columns="columns"
      >
        <template v-slot:top>
          <div class="rmm-toolbar full-width">
            <q-btn
              v-bind="newRoleButton"
              dense
              class="q-px-sm"
              @click="openForm()"
            />
            <q-space />
            <span class="rmm-muted rmm-num"
              >{{ roles.length }} {{ roles.length === 1 ? "role" : "roles" }}
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
            icon="admin_panel_settings"
            title="No roles yet"
            text="Create a role, then assign it to users under User Administration."
            @retry="load"
          >
            <q-btn v-bind="newRoleButton" @click="openForm()" />
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
            <q-td key="name" :props="line">{{ line.row.name }}</q-td>
            <q-td key="is_superuser" :props="line">
              <template v-if="line.row.is_superuser">
                <q-icon name="done" color="primary" size="sm" />
                <span class="sr-only">Yes</span>
              </template>
            </q-td>
            <q-td key="user_count" :props="line" class="rmm-num">
              {{ line.row.user_count }}
            </q-td>
            <q-td key="actions" :props="line" @click.stop>
              <RowActions :label="`Actions for ${line.row.name}`">
                <RowMenuList :items="menuFor(line.row)" />
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
import { fetchRoles, removeRole } from "@/api/accounts";
import { askChangeCode } from "@/composables/accounts";
import { notifySuccess } from "@/utils/notify";
import { sortableHeaders as vSortableHeaders } from "@/utils/sortableHeaders";
import { actionsColumn, textColumn } from "@/core/ui/listTable";
import RolesForm from "@/components/accounts/RolesForm.vue";
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
  class: "tabs-tbl-sticky rmm-table",
  style: "max-height: calc(75vh - 64px)",
};
const newRoleButton = {
  unelevated: true,
  "no-caps": true,
  color: "primary",
  icon: "add",
  label: "New role",
};
const HEADER_TIPS = {
  is_superuser:
    "Superuser roles have every permission and see every client and site",
  user_count: "Users with this role; a role in use cannot be deleted",
};

const columns = [
  textColumn("name", "Name"),
  textColumn("is_superuser", "Superuser"),
  textColumn("user_count", "Assigned users"),
  actionsColumn,
];

const roles = ref([]);
const loading = ref(false);
const error = ref("");

async function load() {
  loading.value = true;
  error.value = "";
  try {
    roles.value = await fetchRoles();
  } catch (e) {
    console.error(e);
    error.value =
      e?.response?.status === 403
        ? "Your role cannot view roles."
        : "Roles could not be loaded.";
  }
  loading.value = false;
}

// add when no role is given
function openForm(role) {
  $q.dialog({
    component: RolesForm,
    componentProps: role ? { role } : undefined,
  }).onOk(load);
}

async function remove(role) {
  const code = await askChangeCode($q, {
    title: `Delete role ${role.name}?`,
    ok: { label: "Delete", color: "negative" },
  });
  if (code === null) return;
  try {
    $q.loading.show();
    notifySuccess(await removeRole(role.id, code));
    await load();
  } catch (e) {
    console.error(e);
  }
  $q.loading.hide();
}

const menuFor = (role) => [
  { label: "Edit", icon: "edit", run: () => openForm(role) },
  {
    label: "Delete",
    icon: "delete",
    danger: true,
    gap: true,
    disable: role.user_count > 0,
    tip:
      role.user_count > 0
        ? `Unassign the role from its ${role.user_count} users first`
        : undefined,
    run: () => remove(role),
  },
];

onMounted(load);
</script>
