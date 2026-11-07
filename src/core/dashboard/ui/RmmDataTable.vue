<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-table
    ref="table"
    v-sortable-headers
    v-bind="$attrs"
    class="rmm-table"
    :rows="rows"
    :columns="allColumns"
    :visible-columns="visibleColumns"
    :table-class="tableClass"
  >
    <template v-for="(_, slotName) in $slots" v-slot:[slotName]="slotProps">
      <slot :name="slotName" v-bind="slotProps ?? {}" />
    </template>

    <template v-slot:header-cell-columnSelect="props">
      <q-th :props="props" auto-width>
        <q-btn flat round dense icon="view_column" aria-label="Choose columns">
          <q-tooltip v-if="!menuOpen">Choose visible columns</q-tooltip>
          <q-menu v-model="menuOpen">
            <q-option-group
              v-model="visibleColumns"
              type="checkbox"
              class="q-py-xs q-pr-md"
              :options="pickerOptions"
            />
          </q-menu>
        </q-btn>
      </q-th>
    </template>
  </q-table>
</template>

<script lang="ts">
import { defineComponent } from "vue";

export default defineComponent({ inheritAttrs: false });
</script>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useStorage } from "@vueuse/core";
import type { QTableColumn } from "quasar";
import { sortableHeaders as vSortableHeaders } from "@/utils/sortableHeaders";

interface Props {
  rows: readonly unknown[];
  columns: QTableColumn[];
  columnSelect?: boolean;
  excludeColumns?: string[];
  storageKey?: string;
}
const props = withDefaults(defineProps<Props>(), {
  columnSelect: false,
  excludeColumns: () => [],
});

const PICKER_COLUMN: QTableColumn = {
  name: "columnSelect",
  label: "Columns",
  field: "columnSelect",
};

// the picker button lives in an extra trailing header cell
const allColumns = computed(() =>
  props.columnSelect ? [...props.columns, PICKER_COLUMN] : [...props.columns],
);

const tableClass = computed(() => ({
  "table-bgcolor": true,
  "sticky-header-right-column": props.columnSelect,
  "tbl-sticky": !props.columnSelect,
}));

const isHidden = (name: string) => props.excludeColumns.includes(name);
const menuOpen = ref(false);

const chosen = props.storageKey
  ? useStorage<string[]>(`${props.storageKey}columns`, [])
  : ref<string[]>([]);

// a stored choice that names no current column falls back to all of them
const visibleColumns = computed<string[]>({
  get() {
    const known = chosen.value.filter((name) =>
      allColumns.value.some((col) => col.name === name),
    );
    return known.length
      ? known
      : allColumns.value.map((col) => col.name).filter((n) => !isHidden(n));
  },
  set(names) {
    chosen.value = names;
  },
});

const pickerOptions = computed(() =>
  allColumns.value
    .filter((col) => col !== PICKER_COLUMN && !isHidden(col.name))
    .map(({ label, name }) => ({ label, value: name })),
);
</script>

<style lang="scss">
$header-row: 48px;

.sticky-header-right-column {
  tr th {
    position: sticky;
    z-index: 2;
  }

  // second header row holds the loading bar
  thead tr:last-child th {
    z-index: 3;
    top: $header-row;
  }

  // with one header row both rules match; this one must win
  thead tr:first-child th {
    z-index: 1;
    top: 0;
  }

  tr:last-child th:last-child {
    z-index: 3;
  }

  th:last-child {
    right: 0;
    position: sticky;
  }

  // keep focused rows out from under the sticky header
  tbody {
    scroll-margin-top: $header-row;
  }
}

td.filter-inputs {
  .q-field--dense .q-field__control,
  .q-field--dense .q-field__marginal {
    height: 30px;
  }

  .q-field--auto-height.q-field--dense {
    .q-field__control,
    .q-field__native {
      min-height: 30px;
    }
  }

  .q-field__control {
    padding-left: 10px;
    padding-right: 5px;
  }
}
</style>
