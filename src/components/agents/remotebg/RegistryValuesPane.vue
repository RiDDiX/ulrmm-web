<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <div class="column full-height q-pb-md">
    <div class="col relative-position" :style="scrollArea">
      <q-menu v-bind="contextMenu">
        <q-list dense class="blank-menu">
          <RegistryNewMenu
            item-style="padding-right: 3px; padding-left: 12px"
            @pick="(type) => emit('create', type)"
          />
        </q-list>
      </q-menu>
      <q-table
        v-bind="tableSetup"
        class="col rmm-table"
        :rows="rows"
        :loading="loading"
      >
        <template #no-data>
          <div v-if="!loading" class="full-width">
            <EmptyState v-bind="emptyCopy">
              <template v-if="failure" #default>
                <q-btn v-bind="retryButton" @click="emit('retry')" />
              </template>
            </EmptyState>
          </div>
        </template>

        <template #body-cell-name="cell">
          <q-td :props="cell" class="value-cell">
            <div class="value-line">
              <q-icon v-bind="kindIcon(cell.row.type)" size="14px" />
              <div
                v-if="renaming !== cell.row.name"
                class="value-name"
                @dblclick="emit('modify', cell.row)"
              >
                <div class="value-name__short">{{ shownName(cell.row) }}</div>
                <div v-if="cell.row.name" class="value-name__long">
                  {{ cell.row.name }}
                </div>
              </div>
              <q-input
                v-else
                ref="nameInput"
                v-model="draft"
                class="rename-box"
                dense
                outlined
                @click.stop
                @keyup.enter="emit('saveName', cell.row, 'enter')"
                @blur="emit('saveName', cell.row, 'blur')"
              />
            </div>
            <q-menu v-bind="contextMenu">
              <RegistryValueMenu v-bind="menuFor(cell.row)" />
            </q-menu>
          </q-td>
        </template>

        <template #body-cell-type="cell">
          <q-td :props="cell" class="rmm-mono">{{ cell.row.type }}</q-td>
        </template>

        <template #body-cell-data="cell">
          <q-td :props="cell" class="rmm-mono">
            <span>
              {{ dataText(cell.row.data) }}
              <q-tooltip v-bind="dataTip">{{
                dataText(cell.row.data)
              }}</q-tooltip>
            </span>
          </q-td>
        </template>

        <template #body-cell-actions="cell">
          <q-td :props="cell" @click.stop>
            <RowActions :label="`Actions for ${shownName(cell.row)}`">
              <RegistryValueMenu v-bind="menuFor(cell.row)" />
            </RowActions>
          </q-td>
        </template>
      </q-table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import type { QInput } from "quasar";
import type { RegistryValue } from "@/types/agents";
import { registryTableColumns } from "@/constants/constants";
import EmptyState from "@/components/ui/EmptyState.vue";
import RowActions from "@/components/ui/RowActions.vue";
import RegistryNewMenu from "@/components/agents/remotebg/RegistryNewMenu.vue";
import RegistryValueMenu from "@/components/agents/remotebg/RegistryValueMenu.vue";
import {
  contextMenu,
  focusSoon,
} from "@/components/agents/remotebg/registryEditing";
import type { EditSource } from "@/components/agents/remotebg/registryEditing";

const props = defineProps<{
  rows: RegistryValue[];
  loading: boolean;
  // why the registry did not load; empty once it did
  failure: string;
  // name of the value whose rename box is open
  renaming: string | null;
}>();

const draft = defineModel<string>("draft", { required: true });

const emit = defineEmits<{
  retry: [];
  create: [type: string];
  modify: [row: RegistryValue];
  rename: [row: RegistryValue];
  remove: [row: RegistryValue];
  saveName: [row: RegistryValue, source: EditSource];
}>();

const TEXT_KINDS = new Set(["REG_SZ", "REG_MULTI_SZ", "REG_EXPAND_SZ"]);

const scrollArea = { flex: "1", overflow: "auto" };
const tableSetup = {
  columns: registryTableColumns,
  rowKey: "name",
  flat: true,
  dense: true,
  hidePagination: true,
  pagination: { rowsPerPage: 0 },
};
const retryButton = {
  label: "Retry",
  icon: "refresh",
  color: "primary",
  outline: true,
  noCaps: true,
};
const dataTip = {
  anchor: "top middle",
  self: "bottom middle",
  offset: [10, 10],
} as const;

const emptyCopy = computed(() =>
  props.failure
    ? {
        icon: "error_outline",
        title: "Registry could not be loaded",
        text: props.failure,
      }
    : {
        icon: "data_object",
        title: "No values in this key",
        text: "Right-click here or use a key's actions menu to add a value.",
      },
);

// text types get letters, everything else digits
function kindIcon(type: string) {
  const text = TEXT_KINDS.has(type);
  return {
    name: text ? "mdi-alphabetical-variant" : "mdi-numeric",
    class: ["value-line__icon", text ? "is-text" : "is-number"],
  };
}

// a value without a name is the default value of its key
const shownName = (row: RegistryValue) =>
  row.name !== "" ? row.name : "(Default)";

// multi-string data reads as a comma separated list
function dataText(data: RegistryValue["data"]) {
  // multi-strings as written, without JSON escaping of backslashes
  return Array.isArray(data) ? data.join(", ") : data;
}

const menuFor = (row: RegistryValue) => ({
  renamable: Boolean(row.name),
  onModify: () => emit("modify", row),
  onRename: () => emit("rename", row),
  onRemove: () => emit("remove", row),
});

const nameInput = ref<QInput | null>(null);

defineExpose({
  focusRename: () => focusSoon(() => nameInput.value?.$el),
});
</script>

<style scoped>
:deep(.q-table__middle) {
  overflow: visible !important;
}
.blank-menu {
  min-width: 130px;
}
.rename-box {
  max-width: 200px;
}
.value-cell,
.value-line {
  position: relative;
  overflow: visible !important;
}
.value-line {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 2px 4px;
}
.value-line__icon {
  flex-shrink: 0;
  opacity: 0.85;
  transition:
    transform 0.15s ease,
    opacity 0.15s ease;
}
.value-line__icon.is-text {
  color: var(--rmm-status-negative);
}
.value-line__icon.is-number {
  color: var(--rmm-status-info);
}
.value-line:hover .value-line__icon {
  transform: scale(1.1);
  opacity: 1;
}
.value-name {
  position: relative;
  flex: 1 1 0%;
  min-width: 0;
  cursor: pointer;
}
.value-name__short {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.value-name__long {
  display: none;
  position: absolute;
  inset: -6px auto auto 0;
  z-index: 100;
  color: var(--rmm-text);
  background: var(--rmm-surface);
  min-width: 100%;
  padding: 5px;
  border: 1px solid var(--rmm-border);
  border-radius: var(--rmm-radius-sm);
  box-shadow: var(--rmm-shadow-lg);
  white-space: nowrap;
}
.value-cell:hover .value-name__long {
  display: block;
}
.value-cell:hover .value-name__short {
  visibility: hidden;
}
</style>
