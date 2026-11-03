<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <div>
    <SettingsPanelHeader
      :title="copy.title"
      :count="actions.length"
      :text="copy.text"
    >
      <q-btn v-bind="addButton" @click="openForm()" />
    </SettingsPanelHeader>
    <q-table
      v-sortable-headers
      v-bind="listTableAttrs"
      :rows="actions"
      :columns="columns"
      :pagination="{ rowsPerPage: 0, sortBy: 'name', descending: false }"
      :loading="loading"
    >
      <template v-slot:header-cell-pattern="head">
        <q-th :props="head">
          {{ head.col.label }}
          <q-tooltip
            >Address with variables such as
            <span v-pre>{{ agent.hostname }}</span
            >, filled in when the action runs</q-tooltip
          >
        </q-th>
      </template>

      <template v-slot:loading>
        <q-inner-loading :showing="true" color="primary" />
      </template>

      <template v-slot:no-data>
        <NoDataPanel
          :loading="loading"
          :error="error"
          :icon="copy.icon"
          :title="copy.emptyTitle"
          :text="copy.emptyText"
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
          <q-td>{{ truncateText(line.row.name, 30) }}</q-td>
          <q-td>
            {{ truncateText(line.row.desc, 20) }}
            <q-tooltip v-if="line.row.desc && line.row.desc.length >= 20">{{
              line.row.desc
            }}</q-tooltip>
          </q-td>
          <q-td class="rmm-mono">
            {{ truncateText(line.row.pattern, 20) }}
            <q-tooltip v-if="line.row.pattern.length >= 20">{{
              line.row.pattern
            }}</q-tooltip>
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

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useQuasar, type QTableColumn } from "quasar";
import { fetchURLActions, removeURLAction } from "@/api/core";
import { notifySuccess } from "@/utils/notify";
import { truncateText } from "@/utils/format";
import { sortableHeaders as vSortableHeaders } from "@/utils/sortableHeaders";
import { confirmDelete } from "@/core/confirm";
import { actionsColumn, listTableAttrs, textColumn } from "@/core/ui/listTable";
import URLActionsForm from "@/components/modals/coresettings/URLActionsForm.vue";
import RowActions from "@/components/ui/RowActions.vue";
import SettingsPanelHeader from "@/components/modals/coresettings/SettingsPanelHeader.vue";
import NoDataPanel from "@/core/ui/NoDataPanel.vue";
import RowMenuList from "@/core/ui/RowMenuList.vue";

import type { URLAction, URLActionType } from "@/types/core/urlactions";

const props = defineProps<{ type: URLActionType }>();
const $q = useQuasar();

const actions = ref<URLAction[]>([]);
const loading = ref(false);
const error = ref("");

// the same table lists URL actions and web hooks
const copy = computed(() =>
  props.type === "web"
    ? {
        title: "URL Actions",
        text: "Links opened from the agent, site or client menu, filled in with that record's values such as {{agent.hostname}}.",
        icon: "open_in_new",
        emptyTitle: "No URL actions yet",
        emptyText:
          "Add a link, for example to your ticket system, that opens with the agent's details filled in.",
      }
    : {
        title: "Web Hooks for Alert Failure/Resolved Actions",
        text: "HTTP requests the server sends when an alert template runs a failure or resolved action.",
        icon: "webhook",
        emptyTitle: "No web hooks yet",
        emptyText:
          "Add a web hook, then pick it as a failure or resolved action in an alert template.",
      },
);

const addButton = computed(() => ({
  unelevated: true,
  "no-caps": true,
  color: "primary",
  icon: "add",
  label: `Add ${props.type === "web" ? "URL Action" : "Web Hook"}`,
}));

const columns: QTableColumn[] = [
  textColumn("name", "Name"),
  textColumn("desc", "Description"),
  textColumn("pattern", "URL Pattern"),
  actionsColumn,
];

async function load() {
  loading.value = true;
  error.value = "";
  try {
    const all = await fetchURLActions();
    actions.value = all.filter((a) => a.action_type === props.type);
  } catch (e) {
    console.error(e);
    const status = (e as { response?: { status?: number } })?.response?.status;
    error.value =
      status === 403
        ? "Your role cannot view this list."
        : "The list could not be loaded.";
  }
  loading.value = false;
}

// add when no action is given
function openForm(action?: URLAction) {
  $q.dialog({
    component: URLActionsForm,
    componentProps: { type: props.type, action },
  }).onOk(load);
}

function remove(action: URLAction) {
  confirmDelete($q, `Delete URL Action: ${action.name}?`).onOk(async () => {
    loading.value = true;
    try {
      await removeURLAction(action.id);
      await load();
      notifySuccess(`URL Action: ${action.name} was deleted!`);
    } catch (e) {
      console.error(e);
    }
    loading.value = false;
  });
}

const menuFor = (action: URLAction) => [
  { label: "Edit", icon: "edit", run: () => openForm(action) },
  {
    label: "Delete",
    icon: "delete",
    danger: true,
    gap: true,
    run: () => remove(action),
  },
];

onMounted(load);
</script>
