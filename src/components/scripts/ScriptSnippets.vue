<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide">
    <q-card class="q-dialog-plugin" :style="cardStyle">
      <DialogHeader title="Script snippets" :subtitle="USAGE">
        <template #actions>
          <q-btn
            class="q-mr-sm"
            dense
            flat
            icon="refresh"
            aria-label="Refresh script snippets"
            @click="load"
          >
            <q-tooltip>Reload the snippet list</q-tooltip>
          </q-btn>
        </template>
      </DialogHeader>
      <q-table
        v-sortable-headers
        dense
        table-class="table-bgcolor"
        :style="{ 'max-height': `${$q.screen.height - 359}px` }"
        class="tbl-sticky rmm-table"
        :rows="rows"
        :columns="COLUMNS"
        :loading="loading"
        v-bind="TABLE_ATTRS"
        :pagination="{ rowsPerPage: 0, sortBy: 'name', descending: false }"
      >
        <template #top>
          <div class="rmm-toolbar full-width">
            <span class="text-weight-medium">Snippets</span>
            <span class="rmm-muted rmm-num">{{ rows.length }}</span>
            <q-space />
            <q-btn
              unelevated
              dense
              no-caps
              color="primary"
              icon="add"
              label="New snippet"
              class="q-px-sm"
              @click="openForm()"
            />
          </div>
        </template>
        <template #no-data>
          <EmptyState
            v-if="!loading"
            class="full-width"
            icon="data_object"
            title="No snippets yet"
            :text="`A snippet is a block of code you reuse in many scripts. ${USAGE}.`"
          >
            <q-btn
              unelevated
              no-caps
              color="primary"
              icon="add"
              label="New snippet"
              @click="openForm()"
            />
          </EmptyState>
        </template>
        <template #header-cell-shell="props">
          <q-th :props="props" auto-width> Shell </q-th>
        </template>

        <template #header-cell-actions="props">
          <q-th :props="props" auto-width>
            <span class="sr-only">{{ props.col.label }}</span>
          </q-th>
        </template>

        <template #body="props">
          <q-tr
            :props="props"
            class="cursor-pointer"
            @dblclick="openForm(props.row)"
          >
            <q-menu context-menu>
              <q-list dense style="min-width: 200px">
                <template v-for="(act, i) in menuActions" :key="act.label">
                  <q-separator v-if="i" />
                  <q-item
                    v-close-popup
                    clickable
                    :class="act.class"
                    @click="act.run(props.row)"
                  >
                    <q-item-section side>
                      <q-icon :name="act.icon" :color="act.color" />
                    </q-item-section>
                    <q-item-section>{{ act.label }}</q-item-section>
                  </q-item>
                </template>
                <q-separator />
                <q-item v-close-popup clickable>
                  <q-item-section>Close</q-item-section>
                </q-item>
              </q-list>
            </q-menu>
            <q-td>
              <ShellChip
                :shell="props.row.shell"
                tooltip="Sets editor syntax highlighting; the code is inserted as-is"
              />
            </q-td>
            <q-td>
              <span class="text-weight-medium">{{ props.row.name }}</span>
              <q-tooltip :delay="600"
                >Use in a script as {{ tagFor(props.row.name) }}</q-tooltip
              >
            </q-td>
            <q-td class="rmm-muted">{{ props.row.desc }}</q-td>
            <q-td @click.stop>
              <RowActions :label="`Actions for ${props.row.name}`">
                <q-list dense style="min-width: 200px">
                  <template v-for="(act, i) in menuActions" :key="act.label">
                    <q-separator v-if="i" />
                    <q-item
                      v-close-popup
                      clickable
                      :class="act.class"
                      @click="act.run(props.row)"
                    >
                      <q-item-section side>
                        <q-icon :name="act.icon" :color="act.color" />
                      </q-item-section>
                      <q-item-section>{{ act.label }}</q-item-section>
                    </q-item>
                  </template>
                </q-list>
              </RowActions>
            </q-td>
          </q-tr>
        </template>
      </q-table>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { useQuasar, useDialogPluginComponent } from "quasar";
import { fetchScriptSnippets, removeScriptSnippet } from "@/api/scripts";
import { notifySuccess as toastOk } from "@/utils/notify";
import { sortableHeaders as vSortableHeaders } from "@/utils/sortableHeaders";
import ScriptSnippetFormModal from "@/components/scripts/ScriptSnippetFormModal.vue";
import RowActions from "@/components/ui/RowActions.vue";
import DialogHeader from "@/components/ui/DialogHeader.vue";
import EmptyState from "@/components/ui/EmptyState.vue";
import ShellChip from "@/components/scripts/ShellChip.vue";

defineOptions({ name: "ScriptSnippetManager" });
defineEmits([...useDialogPluginComponent.emits]);

const TABLE_ATTRS = {
  virtualScroll: true,
  binaryStateSort: true,
  rowKey: "id",
  rowsPerPageOptions: [0],
};

const USAGE = "Insert one into a script with {{snippet name}}";

const COLUMNS = [
  { name: "shell", label: "Shell", field: "shell", sortable: true },
  { name: "name", label: "Name", field: "name", sortable: true },
  { name: "desc", label: "Description", field: "description", sortable: false },
]
  .map((c) => ({ ...c, align: "left" }))
  .concat({
    name: "actions",
    label: "Actions",
    align: "right",
    field: () => "",
  });

const { dialogRef, onDialogHide } = useDialogPluginComponent();
const $q = useQuasar();

const cardStyle = computed(() => {
  const w = `${$q.screen.width - 300}px`;
  const h = `${$q.screen.height - 300}px`;
  return { width: w, "max-width": w, height: h, "max-height": h };
});

const rows = ref([]);
const loading = ref(false);

const tagFor = (name) => `{{${name}}}`;

async function load() {
  loading.value = true;
  try {
    rows.value = await fetchScriptSnippets();
  } catch (e) {
    console.error(e);
  }
  loading.value = false;
}

function confirmDelete(snippet) {
  const prompt = {
    title: `Delete script snippet: ${snippet.name}?`,
    ok: { label: "Delete", color: "negative" },
    cancel: true,
  };
  $q.dialog(prompt).onOk(async () => {
    loading.value = true;
    try {
      toastOk(await removeScriptSnippet(snippet.id));
      load();
    } catch {}
    loading.value = false;
  });
}

function openForm(snippet) {
  const opts = snippet
    ? { component: ScriptSnippetFormModal, componentProps: { snippet } }
    : { component: ScriptSnippetFormModal };
  $q.dialog(opts).onOk(load);
}

const menuActions = [
  { label: "Edit", icon: "edit", run: openForm },
  {
    label: "Delete",
    icon: "delete",
    color: "negative",
    class: "text-negative",
    run: confirmDelete,
  },
];

onMounted(load);
</script>
