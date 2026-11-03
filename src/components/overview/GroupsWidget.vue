<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <EmptyState
    v-if="!data.groups.length"
    icon="workspaces"
    :title="
      widget.settings.group_ids?.length
        ? 'Groups not found'
        : 'No device groups'
    "
    :text="
      widget.settings.group_ids?.length
        ? 'The chosen groups no longer exist. Pick others in the settings.'
        : 'Create groups under Settings › Device groups.'
    "
  >
    <q-btn
      v-if="widget.settings.group_ids?.length"
      outline
      dense
      no-caps
      color="primary"
      label="Settings"
      @click="emit('edit')"
    />
  </EmptyState>
  <table v-else class="groups-table">
    <thead>
      <tr>
        <th scope="col">Group</th>
        <th scope="col" class="groups-table__num">Members</th>
        <th scope="col" class="groups-table__num">Offline</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="group in data.groups" :key="group.id">
        <th scope="row">
          <span class="groups-table__name">{{ group.name }}</span>
          <span class="groups-table__kind">{{
            group.kind === "dynamic" ? "Dynamic" : "Static"
          }}</span>
        </th>
        <td class="groups-table__num">{{ formatCount(group.members) }}</td>
        <td class="groups-table__num">
          <span
            v-if="group.offline"
            class="groups-table__dot"
            :style="{ background: STATE_DOT.warning }"
            aria-hidden="true"
          />{{ formatCount(group.offline) }}
        </td>
      </tr>
    </tbody>
  </table>
</template>

<script setup lang="ts">
import EmptyState from "@/components/ui/EmptyState.vue";
import { STATE_DOT, formatCount, type Widget } from "@/utils/overview";

defineProps<{
  data: {
    groups: {
      id: number;
      name: string;
      kind: string;
      members: number;
      offline: number;
    }[];
  };
  widget: Widget;
}>();

const emit = defineEmits<{ edit: [] }>();
</script>

<style scoped>
.groups-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--rmm-fs-sm);
}

.groups-table th,
.groups-table td {
  padding: 7px 4px;
  border-bottom: 1px solid var(--rmm-border);
  text-align: left;
}

.groups-table thead th {
  color: var(--rmm-text-muted);
  font-size: var(--rmm-fs-xs);
  font-weight: 600;
}

.groups-table tbody th {
  font-weight: 400;
  overflow-wrap: anywhere;
}

.groups-table__name {
  margin-right: 8px;
  color: var(--rmm-text);
  font-weight: 600;
}

.groups-table__kind {
  color: var(--rmm-text-muted);
  font-size: var(--rmm-fs-xs);
}

.groups-table__num {
  width: 1%;
  padding-left: 16px !important;
  font-variant-numeric: tabular-nums;
  text-align: right !important;
  white-space: nowrap;
}

.groups-table__dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  margin-right: 6px;
  border-radius: 50%;
}
</style>
