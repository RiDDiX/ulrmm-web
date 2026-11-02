<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-btn
    round
    flat
    dense
    icon="archive"
    aria-label="Export table as CSV"
    @click="exportCsv"
  >
    <q-tooltip>Export table as CSV</q-tooltip>
  </q-btn>
</template>

<script setup>
import { exportTableToCSV } from "@/utils/csv";

const props = defineProps({
  columns: null,
  data: null,
});

// the row menu column has no data, the export leaves it out
const exportCsv = () =>
  exportTableToCSV(
    props.data,
    props.columns.filter((col) => col.name !== "actions"),
  );
</script>
