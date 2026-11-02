<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <div class="actions-widget">
    <StatTiles :tiles="tiles" />
    <section v-for="list in lists" :key="list.title" :aria-label="list.label">
      <h3 class="widget-subhead">{{ list.title }}</h3>
      <p v-if="!list.rows.length" class="widget-note">{{ list.empty }}</p>
      <ul v-else class="widget-list">
        <li v-for="row in list.rows" :key="row.id" class="widget-row">
          <div class="widget-row__main">
            <div class="widget-row__title">{{ row.description }}</div>
            <div class="widget-row__meta">
              <router-link
                :to="{ name: 'Agent', params: { agent_id: row.agent_id } }"
                class="rmm-link"
                >{{ row.hostname }}</router-link
              >
              · {{ row.client }}
            </div>
          </div>
          <time
            class="widget-row__aside"
            :datetime="row.entry_time"
            :title="formatDate(row.entry_time)"
            >{{ relativeTime(row.entry_time) }}</time
          >
        </li>
      </ul>
    </section>
    <div class="widget-footer">
      <q-btn
        flat
        dense
        no-caps
        color="primary"
        icon-right="open_in_new"
        label="All actions"
        @click="openActions"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useQuasar } from "quasar";
import { useStore } from "vuex";
import PendingActions from "@/components/logs/PendingActions.vue";
import StatTiles from "./StatTiles.vue";
import { STATE_DOT } from "@/utils/overview";
import { relativeTime } from "@/utils/format";

interface Action {
  id: number;
  agent_id: string;
  hostname: string;
  client: string;
  action_type: string;
  description: string;
  status: string;
  entry_time: string;
}

const props = defineProps<{
  data: {
    pending: number;
    // last 24 hours
    completed: number;
    pending_rows: Action[];
    completed_rows: Action[];
  };
}>();

const $q = useQuasar();
const store = useStore();
const formatDate = computed(() => store.getters.formatDate);

function openActions() {
  $q.dialog({ component: PendingActions });
}

const tiles = computed(() => [
  {
    label: "Pending",
    value: props.data.pending,
    dot: props.data.pending ? STATE_DOT.warning : undefined,
    muted: !props.data.pending,
    onClick: openActions,
    action: "Open all actions",
  },
  {
    label: "Completed (24 h)",
    hint: "queued in the last 24 hours",
    value: props.data.completed,
    dot: props.data.completed ? STATE_DOT.positive : undefined,
    muted: !props.data.completed,
  },
]);

const lists = computed(() => [
  {
    title: "Pending",
    label: "Pending actions, oldest first",
    rows: props.data.pending_rows,
    empty: "Nothing pending.",
  },
  {
    title: "Recently completed",
    label: "Completed actions, newest first",
    rows: props.data.completed_rows,
    empty: "Nothing queued in the last 24 hours has completed.",
  },
]);
</script>

<style scoped>
.actions-widget {
  display: grid;
  gap: 12px;
}
</style>
