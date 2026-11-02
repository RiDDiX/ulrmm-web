<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-table
    v-model:pagination="pagination"
    v-sortable-headers
    v-bind="listTableAttrs"
    :rows="data"
    :columns="columns"
    no-data-label="No custom fields"
  >
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

    <template v-slot:no-data>
      <EmptyState
        class="full-width"
        icon="dynamic_form"
        title="No custom fields here yet"
        text="Use Add custom field above to create one for this list."
      />
    </template>

    <template v-slot:body="line">
      <q-tr :props="line" class="cursor-pointer" @dblclick="edit(line.row)">
        <q-menu context-menu>
          <RowMenuList with-close :items="menuFor(line.row)" />
        </q-menu>
        <q-td>
          {{ line.row.name }}
          <q-tooltip :delay="600">ID: {{ line.row.id }}</q-tooltip>
        </q-td>
        <q-td>{{ capitalize(line.row.type) }}</q-td>
        <q-td v-for="flag in FLAGS" :key="flag">
          <template v-if="line.row[flag]">
            <q-icon name="check" />
            <span class="sr-only">Yes</span>
          </template>
        </q-td>
        <q-td v-if="line.row.type === 'checkbox'">
          {{ line.row.default_value_bool }}
        </q-td>
        <q-td v-else-if="line.row.type === 'multiple'">
          <span v-if="line.row.default_values_multiple.length > 0">{{
            line.row.default_values_multiple
          }}</span>
        </q-td>
        <q-td v-else>
          {{ truncateText(line.row.default_value_string, 60) }}
          <q-tooltip v-if="line.row.default_value_string?.length >= 60">{{
            line.row.default_value_string
          }}</q-tooltip>
        </q-td>
        <q-td>
          <template v-if="line.row.required">
            <q-icon name="check" />
            <span class="sr-only">Yes</span>
          </template>
        </q-td>
        <q-td @click.stop>
          <RowActions :label="`Actions for ${line.row.name}`">
            <RowMenuList :items="menuFor(line.row)" />
          </RowActions>
        </q-td>
      </q-tr>
    </template>
  </q-table>
</template>

<script setup>
import { ref } from "vue";
import axios from "axios";
import { useQuasar } from "quasar";
import { capitalize, truncateText } from "@/utils/format";
import { notifySuccess } from "@/utils/notify";
import { sortableHeaders as vSortableHeaders } from "@/utils/sortableHeaders";
import { confirmDelete } from "@/core/confirm";
import {
  actionsColumn,
  listTableAttrs,
  nameSortedPagination,
  textColumn,
} from "@/core/ui/listTable";
import CustomFieldsForm from "@/components/modals/coresettings/CustomFieldsForm.vue";
import RowActions from "@/components/ui/RowActions.vue";
import EmptyState from "@/components/ui/EmptyState.vue";
import RowMenuList from "@/core/ui/RowMenuList.vue";

defineProps({ data: Array });
const emit = defineEmits(["refresh"]);

const $q = useQuasar();
const pagination = ref(nameSortedPagination());

const HEADER_TIPS = {
  hide_in_ui:
    "Not shown in the client, site or agent edit forms; scripts can still use it",
  hide_in_summary: "Not listed on the agent Summary tab",
  required: "The edit forms cannot be saved without a value",
};
// the two hide columns sit before the default value
const FLAGS = ["hide_in_ui", "hide_in_summary"];

const columns = [
  textColumn("name", "Name"),
  textColumn("type", "Field type"),
  textColumn("hide_in_ui", "Hide in dashboard"),
  textColumn("hide_in_summary", "Hide in Summary tab"),
  textColumn("default_value", "Default value"),
  textColumn("required", "Required"),
  actionsColumn,
];

const refresh = () => emit("refresh");

function edit(field) {
  $q.dialog({
    component: CustomFieldsForm,
    componentProps: { field },
  }).onOk(refresh);
}

function remove(field) {
  confirmDelete($q, `Delete custom field ${field.name}?`).onOk(async () => {
    $q.loading.show();
    try {
      await axios.delete(`/core/customfields/${field.id}/`);
      refresh();
      $q.loading.hide();
      notifySuccess(`Custom field ${field.name} was deleted!`);
    } catch {
      $q.loading.hide();
    }
  });
}

const menuFor = (field) => [
  { label: "Edit", icon: "edit", run: () => edit(field) },
  {
    label: "Delete",
    icon: "delete",
    danger: true,
    gap: true,
    run: () => remove(field),
  },
];
</script>
