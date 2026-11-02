<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <EmptyState
    v-if="!data.total"
    icon="lan"
    title="No network devices"
    text="Add switches, printers and other devices under Agents › Network devices."
  />
  <div v-else class="netmon-widget">
    <StatTiles :tiles="tiles" />
    <p v-if="!data.problems.length" class="widget-note">
      No device is down, failing or degraded.
    </p>
    <section v-else aria-label="Devices with problems">
      <h3 class="widget-subhead">Problems</h3>
      <ul class="widget-list">
        <li v-for="device in data.problems" :key="device.id" class="widget-row">
          <span
            class="rmm-pill"
            :class="`rmm-pill--${stateOf(device.status)}`"
            >{{ labelOf(device.status) }}</span
          >
          <div class="widget-row__main">
            <span class="widget-row__title">{{ device.name }}</span>
            <div class="widget-row__meta">
              <span class="rmm-mono">{{ device.host }}</span>
              · {{ [device.client, device.site].filter(Boolean).join(" / ") }}
            </div>
          </div>
          <time
            class="widget-row__aside"
            :datetime="device.last_checked || undefined"
            :title="
              device.last_checked ? formatDate(device.last_checked) : undefined
            "
            >{{
              device.last_checked
                ? relativeTime(device.last_checked)
                : "not checked"
            }}</time
          >
        </li>
      </ul>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useStore } from "vuex";
import EmptyState from "@/components/ui/EmptyState.vue";
import StatTiles from "./StatTiles.vue";
import { STATE_DOT } from "@/utils/overview";
import { relativeTime } from "@/utils/format";

interface Problem {
  id: number;
  name: string;
  host: string;
  status: string;
  last_checked: string | null;
  client: string;
  site: string;
}

const props = defineProps<{
  data: {
    total: number;
    disabled: number;
    maintenance: number;
    pending: number;
    up: number;
    degraded: number;
    down: number;
    error: number;
    problems: Problem[];
  };
}>();

const store = useStore();
const formatDate = computed(() => store.getters.formatDate);

const STATUS: Record<string, { label: string; state: string }> = {
  up: { label: "Up", state: "positive" },
  degraded: { label: "Degraded", state: "warning" },
  down: { label: "Down", state: "negative" },
  error: { label: "Error", state: "negative" },
  pending: { label: "Pending", state: "neutral" },
};

const labelOf = (status: string) => STATUS[status]?.label || status;
const stateOf = (status: string) => STATUS[status]?.state || "neutral";

const tiles = computed(() => [
  ...(["up", "degraded", "down", "error", "pending"] as const).map(
    (status) => ({
      label: STATUS[status].label,
      value: props.data[status],
      dot: props.data[status] ? STATE_DOT[STATUS[status].state] : undefined,
      muted: !props.data[status],
    }),
  ),
  { label: "Maintenance", value: props.data.maintenance, muted: true },
  { label: "Disabled", value: props.data.disabled, muted: true },
]);
</script>

<style scoped>
.netmon-widget {
  display: grid;
  gap: 12px;
}
</style>
