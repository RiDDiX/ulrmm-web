<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <EmptyState
    v-if="!data.agents.length"
    icon="check_circle"
    title="All devices are online"
    text="Devices that stop reporting show up here."
  />
  <div v-else class="offline-widget">
    <StatTiles :tiles="tiles" />
    <ul class="widget-list" aria-label="Offline devices, last seen first">
      <li v-for="agent in data.agents" :key="agent.agent_id" class="widget-row">
        <q-icon
          :name="platformMeta(agent.plat).icon"
          size="18px"
          class="widget-row__icon"
          aria-hidden="true"
        />
        <div class="widget-row__main">
          <router-link
            :to="{ name: 'Agent', params: { agent_id: agent.agent_id } }"
            class="widget-row__title rmm-link"
            >{{ deviceName(agent) }}</router-link
          >
          <div class="widget-row__meta">
            {{ [agent.client, agent.site].filter(Boolean).join(" / ") }}
          </div>
        </div>
        <div class="widget-row__aside">
          <span
            class="rmm-pill"
            :class="agent.overdue ? 'rmm-pill--negative' : 'rmm-pill--neutral'"
            >{{ agent.overdue ? "Overdue" : "Offline" }}</span
          >
          <time
            :datetime="agent.last_seen || undefined"
            :title="agent.last_seen ? formatDate(agent.last_seen) : undefined"
            >{{
              agent.last_seen ? relativeTime(agent.last_seen) : "never seen"
            }}</time
          >
        </div>
      </li>
    </ul>
    <p v-if="hidden > 0" class="widget-note">{{ hidden }} more not listed.</p>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useStore } from "vuex";
import EmptyState from "@/components/ui/EmptyState.vue";
import StatTiles from "./StatTiles.vue";
import { STATE_DOT } from "@/utils/overview";
import { platformMeta, relativeTime } from "@/utils/format";
import { deviceName } from "@/utils/deviceName";

interface OfflineAgent {
  agent_id: string;
  hostname: string;
  display_name: string | null;
  client: string;
  site: string;
  plat: string;
  last_seen: string | null;
  overdue: boolean;
}

const props = defineProps<{
  data: { offline: number; overdue: number; agents: OfflineAgent[] };
}>();

const store = useStore();
const formatDate = computed(() => store.getters.formatDate);

const tiles = computed(() => [
  { label: "Offline", value: props.data.offline, dot: STATE_DOT.neutral },
  { label: "Overdue", value: props.data.overdue, dot: STATE_DOT.negative },
]);

const hidden = computed(
  () => props.data.offline + props.data.overdue - props.data.agents.length,
);
</script>

<style scoped>
.offline-widget {
  display: grid;
  gap: 12px;
}
</style>
