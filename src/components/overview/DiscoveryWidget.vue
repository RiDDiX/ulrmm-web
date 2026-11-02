<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <EmptyState
    v-if="!data.total && !data.last_scan"
    icon="travel_explore"
    title="No scan yet"
    text="Start a scan under Agents › Network discovery to find devices."
  />
  <div v-else class="discovery-widget">
    <StatTiles :tiles="tiles" />
    <p v-if="scan" class="widget-note">
      Last scan {{ statusLabel(scan.status) }}
      {{ relativeTime(scan.finished_at || scan.started_at) }}:
      <span class="rmm-mono">{{ (scan.networks || []).join(", ") }}</span
      >, {{ formatCount(scan.hosts_up) }} of {{ formatCount(scan.hosts_total) }}
      addresses answered.
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import EmptyState from "@/components/ui/EmptyState.vue";
import StatTiles from "./StatTiles.vue";
import { STATE_DOT, formatCount } from "@/utils/overview";
import { relativeTime } from "@/utils/format";

interface Scan {
  id: number;
  status: string;
  networks: string[];
  started_at: string | null;
  finished_at: string | null;
  hosts_total: number;
  hosts_up: number;
}

const props = defineProps<{
  data: {
    total: number;
    new: number;
    agent: number;
    netmon: number;
    ignored: number;
    last_scan: Scan | null;
  };
}>();

const scan = computed(() => props.data.last_scan);

const STATUS: Record<string, string> = {
  queued: "queued",
  running: "running since",
  done: "finished",
  failed: "failed",
};

function statusLabel(status: string) {
  return STATUS[status] || status;
}

const tiles = computed(() => [
  {
    label: "New",
    value: props.data.new,
    dot: props.data.new ? STATE_DOT.info : undefined,
    muted: !props.data.new,
  },
  { label: "With agent", value: props.data.agent, muted: true },
  { label: "Monitored", value: props.data.netmon, muted: true },
  { label: "Ignored", value: props.data.ignored, muted: true },
]);
</script>

<style scoped>
.discovery-widget {
  display: grid;
  gap: 10px;
}
</style>
