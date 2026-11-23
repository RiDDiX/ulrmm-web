<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<script setup>
import { computed } from "vue";
import { fmtBytes, NO_VALUE } from "@/utils/format";
import { volumeRows } from "./imagingVolumes";

const selected = defineModel({ type: Array, default: () => [] });
const props = defineProps({
  volumes: { type: Array, required: true },
  saved: { type: Array, default: () => [] },
  disabled: Boolean,
});

const rows = computed(() => volumeRows(props.volumes, selected.value));
const extraTicked = computed(() =>
  rows.value.some((row) => row.ticked && !row.locked && row.kind),
);
const dropped = computed(() =>
  props.saved.some((mount) => !selected.value.includes(mount)),
);
function tick(mount, on) {
  selected.value = on
    ? [...selected.value, mount]
    : selected.value.filter((item) => item !== mount);
}
</script>

<template>
  <q-markup-table flat dense class="rmm-table" aria-label="Volumes">
    <thead>
      <tr>
        <th class="text-left">Back up</th>
        <th class="text-left">Volume</th>
        <th class="text-left">File system</th>
        <th class="text-right">Size</th>
        <th class="text-right">Used</th>
        <th class="text-left">Status</th>
        <th class="text-left">Consistency</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="row in rows" :key="`${row.kind}:${row.mount}`">
        <td>
          <q-checkbox
            v-if="row.tickable"
            dense
            :model-value="row.ticked"
            :disable="disabled || row.locked"
            :aria-label="`Back up ${row.mount}`"
            @update:model-value="tick(row.mount, $event)"
          />
        </td>
        <td class="rmm-mono">{{ row.mount }}</td>
        <td>{{ row.fs || NO_VALUE }}</td>
        <td class="text-right rmm-num">
          {{ row.size ? fmtBytes(row.size) : NO_VALUE }}
        </td>
        <td class="text-right rmm-num">
          {{ row.used ? fmtBytes(row.used) : NO_VALUE }}
        </td>
        <td>
          {{ row.status }}
          <div v-if="row.reason" class="rmm-muted">{{ row.reason }}</div>
        </td>
        <td>{{ row.consistencyLabel || NO_VALUE }}</td>
      </tr>
    </tbody>
  </q-markup-table>
  <p v-if="rows.some((row) => row.ticked && row.consistency === 'live')">
    Live backups read files while the system runs. Each file is consistent on
    its own, but files that change together, such as a database and its journal,
    can come from different moments. Dump databases with a scheduled script
    shortly before the backup window.
  </p>
  <p v-if="rows.some((row) => row.kind === 'network')">
    Network storage is not backed up. Back it up on the server that holds it.
  </p>
  <p v-if="extraTicked">Each backup reads every ticked volume in full.</p>
  <p v-if="dropped">
    Older points that hold this volume stay until keep-last removes them.
  </p>
</template>
