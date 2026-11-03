<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <EmptyState
    v-if="!data.items.length"
    icon="history"
    title="No activity yet"
    :text="
      widget.settings.types?.length
        ? 'Nothing of the chosen types yet. Change the types in the settings.'
        : 'Script runs, alerts, patches and other events show up here.'
    "
  />
  <ol v-else class="widget-list" aria-label="Latest activity, newest first">
    <li
      v-for="(item, i) in data.items"
      :key="`${item.type}:${item.ref?.kind}:${item.ref?.id}:${i}`"
      class="widget-row activity-row"
      :class="stateClass(item)"
    >
      <q-icon
        :name="typeMeta(item.type).icon"
        size="18px"
        class="widget-row__icon"
        aria-hidden="true"
      />
      <div class="widget-row__main">
        <div class="activity-row__head">
          <span class="widget-row__title">{{
            item.title || typeMeta(item.type).label
          }}</span>
          <span class="activity-row__type">{{
            typeMeta(item.type).label
          }}</span>
          <span
            v-if="severityState(item.severity)"
            class="rmm-pill"
            :class="`rmm-pill--${severityState(item.severity)}`"
            >{{ item.severity === "error" ? "Error" : "Warning" }}</span
          >
        </div>
        <div class="widget-row__meta">
          <router-link
            v-if="item.agent?.agent_id"
            :to="{
              name: 'Agent',
              params: { agent_id: item.agent.agent_id },
              query: { tab: tabOf(item) },
            }"
            class="rmm-link"
            >{{ item.agent.name || item.agent.agent_id }}</router-link
          >
          <template v-if="item.user"> · {{ item.user }}</template>
          <template v-if="item.detail"> · {{ item.detail }}</template>
        </div>
      </div>
      <time
        class="widget-row__aside"
        :datetime="item.ts"
        :title="formatDate(item.ts)"
        >{{ relativeTime(item.ts) }}</time
      >
    </li>
  </ol>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useStore } from "vuex";
import EmptyState from "@/components/ui/EmptyState.vue";
import { relativeTime } from "@/utils/format";
import {
  refTarget,
  severityState,
  typeMeta,
  type TimelineItem,
} from "@/utils/timeline";
import type { Widget } from "@/utils/overview";

type FeedItem = TimelineItem & {
  agent?: { agent_id: string; name: string } | null;
};

defineProps<{ data: { items: FeedItem[] }; widget: Widget }>();

const store = useStore();
const formatDate = computed(() => store.getters.formatDate);

// the device page tab with the item's source, else its timeline
function tabOf(item: FeedItem) {
  const target = refTarget(item.ref);
  return target && "tab" in target ? target.tab : "timeline";
}

function stateClass(item: FeedItem) {
  const state = severityState(item.severity);
  return state ? `activity-row--${state}` : undefined;
}
</script>

<style scoped>
.activity-row--negative {
  box-shadow: inset 3px 0 var(--rmm-status-negative);
}

.activity-row--warning {
  box-shadow: inset 3px 0 var(--rmm-dot-warning);
}

.activity-row--negative .widget-row__icon {
  color: var(--rmm-status-negative);
}

.activity-row--warning .widget-row__icon {
  color: var(--rmm-status-warning);
}

.activity-row__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px 8px;
}

.activity-row__type {
  color: var(--rmm-text-muted);
  font-size: var(--rmm-fs-xs);
}

.activity-row .rmm-pill {
  min-height: 18px;
  padding: 0 6px;
}
</style>
