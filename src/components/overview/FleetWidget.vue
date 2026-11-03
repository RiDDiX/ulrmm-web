<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <EmptyState
    v-if="!data.total"
    icon="devices"
    title="No devices yet"
    text="Install an agent and the device counts show up here."
  />
  <div v-else class="fleet-widget">
    <StatTiles :tiles="status" />
    <StatTiles :tiles="facts" />
    <section class="fleet-widget__plats" aria-label="Devices by platform">
      <h3 class="widget-subhead">Platforms</h3>
      <BarList :rows="plats" />
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import EmptyState from "@/components/ui/EmptyState.vue";
import StatTiles from "./StatTiles.vue";
import BarList from "./BarList.vue";
import { STATE_DOT } from "@/utils/overview";
import { platformMeta } from "@/utils/format";

interface Fleet {
  total: number;
  online: number;
  offline: number;
  overdue: number;
  servers: number;
  workstations: number;
  needs_reboot: number;
  maintenance_mode: number;
  by_plat: { plat: string; count: number }[];
}

const props = defineProps<{ data: Fleet }>();

const status = computed(() => [
  { label: "Total", value: props.data.total },
  { label: "Online", value: props.data.online, dot: STATE_DOT.positive },
  { label: "Offline", value: props.data.offline, dot: STATE_DOT.neutral },
  { label: "Overdue", value: props.data.overdue, dot: STATE_DOT.negative },
]);

const facts = computed(() => [
  { label: "Servers", value: props.data.servers, muted: true },
  { label: "Workstations", value: props.data.workstations, muted: true },
  { label: "Needs reboot", value: props.data.needs_reboot, muted: true },
  { label: "Maintenance", value: props.data.maintenance_mode, muted: true },
]);

const plats = computed(() =>
  (props.data.by_plat || []).map((row) => {
    const meta = platformMeta(row.plat);
    return {
      key: row.plat,
      label: meta.label || "Unknown",
      icon: meta.icon,
      text: String(row.count),
      fraction: props.data.total ? row.count / props.data.total : 0,
      detail: `${row.count} of ${props.data.total} devices`,
    };
  }),
);
</script>

<style scoped>
.fleet-widget {
  display: grid;
  gap: 12px;
}

.fleet-widget__plats {
  margin-top: 4px;
}
</style>
