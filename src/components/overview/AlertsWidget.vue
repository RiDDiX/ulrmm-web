<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <div class="alerts-widget">
    <StatTiles :tiles="tiles" />
    <p v-if="!data.total" class="widget-note">No open alerts.</p>
    <section v-else aria-label="Latest open alerts">
      <h3 class="widget-subhead">Latest</h3>
      <ul class="widget-list">
        <li v-for="alert in data.latest" :key="alert.id" class="widget-row">
          <span
            class="rmm-pill"
            :class="`rmm-pill--${alertState(alert.severity)}`"
            >{{ alertLabel(alert.severity) }}</span
          >
          <div class="widget-row__main">
            <a
              href="#"
              role="button"
              class="widget-row__title rmm-link"
              @click.prevent="openAlerts()"
              @keydown.space.prevent="openAlerts()"
              >{{ alert.message || "Alert" }}</a
            >
            <div class="widget-row__meta">
              <router-link
                v-if="alert.agent_id"
                :to="{ name: 'Agent', params: { agent_id: alert.agent_id } }"
                class="rmm-link"
                >{{ alert.name || alert.agent_id }}</router-link
              >
              <span v-else>{{ alert.name }}</span>
            </div>
          </div>
          <time
            class="widget-row__aside"
            :datetime="alert.alert_time"
            :title="formatDate(alert.alert_time)"
            >{{ relativeTime(alert.alert_time) }}</time
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
        label="Open alerts overview"
        @click="openAlerts()"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useQuasar } from "quasar";
import { useStore } from "vuex";
import AlertsOverview from "@/components/modals/alerts/AlertsOverview.vue";
import StatTiles from "./StatTiles.vue";
import { STATE_DOT, alertLabel, alertState } from "@/utils/overview";
import { relativeTime } from "@/utils/format";

interface Alert {
  id: number;
  severity: string;
  message: string;
  alert_time: string;
  alert_type: string;
  agent_id: string | null;
  name: string;
}

const props = defineProps<{
  data: {
    total: number;
    error: number;
    warning: number;
    info: number;
    latest: Alert[];
  };
}>();

const $q = useQuasar();
const store = useStore();
const formatDate = computed(() => store.getters.formatDate);

function openAlerts(severity?: string) {
  $q.dialog({
    component: AlertsOverview,
    componentProps: severity ? { initialSeverityFilter: [severity] } : {},
  });
}

const tiles = computed(() =>
  (["error", "warning", "info"] as const).map((severity) => ({
    label: alertLabel(severity),
    value: props.data[severity],
    dot: props.data[severity] ? STATE_DOT[alertState(severity)] : undefined,
    muted: !props.data[severity],
    onClick: () => openAlerts(severity),
    action: `Open the ${alertLabel(severity).toLowerCase()} alerts`,
  })),
);
</script>

<style scoped>
.alerts-widget {
  display: grid;
  gap: 12px;
}
</style>
