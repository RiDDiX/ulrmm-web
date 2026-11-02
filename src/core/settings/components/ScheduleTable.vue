<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <div>
    <div class="row items-center q-mb-sm">
      <div>
        <div class="text-subtitle2">Schedules</div>
        <div class="rmm-muted text-caption">
          Reusable time plans that report schedules run on. Double-click a row
          to edit it.
        </div>
      </div>
      <q-space />
      <q-btn v-bind="addButton" @click="openForm()" />
    </div>

    <rmm-data-table
      :rows="schedules"
      :columns="columns"
      :loading="isLoading"
      v-bind="tableAttrs"
    >
      <template #no-data>
        <EmptyState
          v-if="!isLoading"
          class="full-width"
          icon="event_repeat"
          title="No schedules yet"
          text="A schedule sets when reports run. Add one here or while creating a report schedule."
        >
          <q-btn v-bind="addButton" @click="openForm()" />
        </EmptyState>
      </template>

      <template #body="{ row, cols }">
        <q-tr class="cursor-pointer" @dblclick="openForm(row)">
          <q-menu context-menu>
            <q-list dense style="min-width: 200px">
              <template v-for="(a, i) in [...rowMenu, CLOSE]" :key="a.label">
                <q-separator v-if="i > 0" />
                <q-item
                  v-close-popup
                  clickable
                  :class="a.class"
                  @click="a.run?.(row)"
                >
                  <q-item-section>
                    <q-item-label>{{ a.label }}</q-item-label>
                  </q-item-section>
                </q-item>
              </template>
            </q-list>
          </q-menu>

          <q-td
            v-for="col in cols"
            :key="col.id"
            @click="col.name === 'rowactions' && $event.stopPropagation()"
          >
            <RowActions
              v-if="col.name === 'rowactions'"
              :label="`Actions for ${row.name}`"
            >
              <q-list dense style="min-width: 200px">
                <template v-for="(a, i) in rowMenu" :key="a.label">
                  <q-separator v-if="i > 0" />
                  <q-item
                    v-close-popup
                    clickable
                    :class="a.class"
                    @click="a.run(row)"
                  >
                    <q-item-section>
                      <q-item-label>{{ a.label }}</q-item-label>
                    </q-item-section>
                  </q-item>
                </template>
              </q-list>
            </RowActions>
            <template v-else>{{ col.value }}</template>
          </q-td>
        </q-tr>
      </template>
    </rmm-data-table>
  </div>
</template>

<script lang="ts" setup>
import { onMounted } from "vue";
import { useQuasar, type QTableColumn } from "quasar";

import { useScheduleShared } from "../api";
import { capitalize } from "@/utils/format";
import RmmDataTable from "@/core/dashboard/ui/RmmDataTable.vue";
import RowActions from "@/components/ui/RowActions.vue";
import EmptyState from "@/components/ui/EmptyState.vue";
import ScheduleForm from "./ScheduleForm.vue";

import type { Schedule } from "../types";

const $q = useQuasar();
const { schedules, getSchedules, deleteSchedule, isLoading } =
  useScheduleShared;

const MONTHS = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" ");
// 0 = Monday: form and server both count from Monday
const WEEKDAYS = "Mon Tue Wed Thu Fri Sat Sun".split(" ");
// week 5 is the last one of the month
const WEEKS = ["1st", "2nd", "3rd", "4th", "Last"];

const tableAttrs = {
  "rows-per-page-options": [0],
  "storage-key": "schedule-table",
  "row-key": "id",
  "binary-state-sort": true,
  "virtual-scroll": true,
  "column-select": true,
  dense: true,
};

const addButton = {
  dense: true,
  unelevated: true,
  "no-caps": true,
  color: "primary",
  icon: "add",
  label: "Add schedule",
};

// a list column is "every ..." once it holds `full` entries
const listColumn = (
  name: string,
  label: string,
  names: (n: number) => string | number | undefined,
  every: string,
  full: (len: number) => boolean,
): QTableColumn => ({
  name,
  label,
  align: "left",
  field: name,
  format: (val: number[]) =>
    full(val.length) ? every : val.map(names).join(", "),
});

const plain = (
  name: string,
  label: string,
  extra: Partial<QTableColumn> = {},
): QTableColumn => ({ name, label, field: name, align: "left", ...extra });

const columns: QTableColumn[] = [
  plain("name", "Name", { sortable: true, required: true }),
  plain("schedule_type", "Repeat", {
    sortable: true,
    format: (val: string) => capitalize(val),
  }),
  plain("run_time", "Run at", {
    sortable: true,
    format: (val: string) => val.split(":").slice(0, 2).join(":"),
  }),
  listColumn(
    "run_time_weekdays",
    "Weekdays",
    (d) => WEEKDAYS[d],
    "Every day",
    (len) => len === 7,
  ),
  listColumn(
    "monthly_months_of_year",
    "Months",
    (m) => MONTHS[m - 1],
    "Every month",
    (len) => len === 12,
  ),
  listColumn(
    "monthly_days_of_month",
    "Days of month",
    (d) => (d !== 32 ? d : "Last"),
    "Every day",
    (len) => len >= 31,
  ),
  listColumn(
    "monthly_weeks_of_month",
    "Weeks of month",
    (w) => WEEKS[w - 1],
    "Every week",
    (len) => len === 5,
  ),
  { name: "rowactions", label: "Actions", align: "right", field: () => "" },
];

function openForm(schedule?: Schedule) {
  $q.dialog({ component: ScheduleForm, componentProps: { schedule } });
}

function removeSchedule(schedule: Schedule) {
  $q.dialog({
    color: "primary",
    message: `Are you sure you want to delete schedule: ${schedule.name}?`,
    ok: { color: "negative" },
    cancel: true,
  }).onOk(() => deleteSchedule(schedule.id));
}

const rowMenu = [
  { label: "Edit", run: openForm },
  { label: "Delete", class: "text-negative", run: removeSchedule },
];
const CLOSE: { label: string; class?: string; run?: (s: Schedule) => void } = {
  label: "Close",
};

onMounted(getSchedules);
</script>
