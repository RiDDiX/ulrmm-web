<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <EmptyState
    v-if="!data.failing"
    icon="check_circle"
    title="No failing checks"
    text="Checks that fail on a device show up here."
  />
  <div v-else class="checks-widget">
    <StatTiles :tiles="tiles" />
    <ul class="widget-list" aria-label="Failing checks, latest run first">
      <li v-for="item in data.items" :key="item.id" class="widget-row">
        <span
          class="rmm-pill"
          :class="`rmm-pill--${alertState(item.severity)}`"
          >{{ alertLabel(item.severity) }}</span
        >
        <div class="widget-row__main">
          <router-link
            :to="{
              name: 'Agent',
              params: { agent_id: item.agent_id },
              query: { tab: 'checks' },
            }"
            class="widget-row__title rmm-link"
            >{{ item.check }}</router-link
          >
          <div class="widget-row__meta">
            {{ deviceName(item) }}
            <template v-if="item.more_info"> · {{ item.more_info }}</template>
          </div>
        </div>
        <time
          class="widget-row__aside"
          :datetime="item.last_run || undefined"
          :title="item.last_run ? formatDate(item.last_run) : undefined"
          >{{ item.last_run ? relativeTime(item.last_run) : "not run" }}</time
        >
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useStore } from "vuex";
import EmptyState from "@/components/ui/EmptyState.vue";
import StatTiles from "./StatTiles.vue";
import { STATE_DOT, alertLabel, alertState } from "@/utils/overview";
import { relativeTime } from "@/utils/format";
import { deviceName } from "@/utils/deviceName";

interface FailingCheck {
  id: number;
  check_id: number;
  agent_id: string;
  hostname: string;
  display_name: string | null;
  check: string;
  check_type: string;
  severity: string;
  last_run: string | null;
  more_info: string;
}

const props = defineProps<{
  data: {
    failing: number;
    error: number;
    warning: number;
    info: number;
    items: FailingCheck[];
  };
}>();

const store = useStore();
const formatDate = computed(() => store.getters.formatDate);

const tiles = computed(() =>
  (["error", "warning", "info"] as const).map((severity) => ({
    label: alertLabel(severity),
    value: props.data[severity],
    dot: props.data[severity] ? STATE_DOT[alertState(severity)] : undefined,
    muted: !props.data[severity],
  })),
);
</script>

<style scoped>
.checks-widget {
  display: grid;
  gap: 12px;
}
</style>
