<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <EmptyState
    v-if="!data.agents.length"
    :icon="metric === 'cpu' ? 'speed' : 'memory'"
    title="No samples yet"
    :text="`Online devices are sampled every five minutes. ${range} has none so far.`"
  />
  <div v-else class="top-widget">
    <p class="widget-note">
      {{ range }}, average {{ metric === "cpu" ? "CPU load" : "memory use" }}
    </p>
    <BarList :rows="rows" />
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import EmptyState from "@/components/ui/EmptyState.vue";
import BarList from "./BarList.vue";
import { RANGE_LABELS } from "@/utils/overview";
import { usageLevel } from "@/utils/format";
import { deviceName } from "@/utils/deviceName";

interface TopAgent {
  agent_id: string;
  hostname: string;
  display_name: string | null;
  client: string;
  site: string;
  avg: number;
  max: number;
  samples: number;
}

const props = defineProps<{
  data: { range: string; metric: string; agents: TopAgent[] };
}>();

const metric = computed(() => props.data.metric);
const range = computed(
  () => RANGE_LABELS[props.data.range] || props.data.range || "This range",
);

const pct = (n: number) => `${n.toFixed(1)} %`;

const rows = computed(() =>
  props.data.agents.map((agent) => ({
    key: agent.agent_id,
    label: deviceName(agent),
    to: {
      name: "Agent",
      params: { agent_id: agent.agent_id },
      query: { tab: "performance" },
    },
    text: pct(agent.avg),
    fraction: agent.avg / 100,
    level: usageLevel(agent.avg),
    sub: `${[agent.client, agent.site].filter(Boolean).join(" / ")} · peak ${pct(agent.max)}`,
    detail: `Average ${pct(agent.avg)}, peak ${pct(agent.max)}, ${agent.samples} samples`,
  })),
);
</script>

<style scoped>
.top-widget {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 10px;
}

.top-widget .widget-note {
  margin: 0;
}
</style>
