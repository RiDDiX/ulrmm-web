<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-dialog
    ref="dialogRef"
    @hide="onDialogHide"
    aria-labelledby="eventlog-output-title"
  >
    <q-card class="q-dialog-plugin" style="min-width: 80vw">
      <DialogHeader
        title-id="eventlog-output-title"
        :title="evtLogData.readable_desc"
        subtitle="Events that matched this check on its last run"
      />
      <q-table
        v-if="events"
        v-model:pagination="pagination"
        :rows="events.log"
        :columns="columns"
        :filter="filter"
        :rows-per-page-options="[0]"
        row-key="uid"
        no-data-label="No matching events were found on the last run"
        style="height: 65vh"
        table-class="table-bgcolor"
        class="tabs-tbl-sticky rmm-table"
        dense
        flat
        binary-state-sort
        virtual-scroll
      >
        <template #top>
          <div class="rmm-toolbar full-width">
            <div class="rmm-card__title">
              Matching events
              <span class="rmm-muted rmm-num">({{ events.log.length }})</span>
            </div>
            <q-space />
            <q-input
              v-model="filter"
              label="Search"
              aria-label="Search events"
              outlined
              dense
              clearable
            >
              <template #prepend>
                <q-icon name="search" />
              </template>
            </q-input>
            <export-table-btn :data="events.log" :columns="columns" />
          </div>
        </template>
        <template #body-cell-eventType="cell">
          <q-td :props="cell">
            <span
              class="rmm-pill"
              :class="`rmm-pill--${eventTypePill[cell.value] || 'neutral'}`"
              >{{ cell.value }}</span
            >
          </q-td>
        </template>
      </q-table>
      <EmptyState
        v-else
        icon="event_note"
        title="Check has not run yet"
        text="Matching events show here after the agent runs this check for the first time."
      />
    </q-card>
  </q-dialog>
</template>

<script setup>
import { computed, ref } from "vue";
import { useDialogPluginComponent } from "quasar";
import ExportTableBtn from "@/components/ui/ExportTableBtn.vue";
import DialogHeader from "@/components/ui/DialogHeader.vue";
import EmptyState from "@/components/ui/EmptyState.vue";

const props = defineProps({ evtLogData: null });
defineEmits([...useDialogPluginComponent.emits]);

const { dialogRef, onDialogHide } = useDialogPluginComponent();

const columns = [
  ["eventType", "Type"],
  ["source", "Source"],
  ["eventID", "Event ID"],
  ["time", "Time"],
  ["message", "Message"],
].map(([name, label]) => ({
  name,
  label,
  field: name,
  align: "left",
  sortable: true,
}));

// agent event type -> pill colour
const eventTypePill = {
  INFO: "info",
  WARNING: "warning",
  ERROR: "negative",
  SUCCESS: "positive",
  AUDIT_SUCCESS: "positive",
  AUDIT_FAILURE: "negative",
};

const events = computed(() => props.evtLogData.check_result.extra_details);

const filter = ref("");
const pagination = ref({ rowsPerPage: 0, sortBy: "time", descending: true });
</script>
