<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-btn dense flat round icon="notifications" :aria-label="alertLabel">
    <q-tooltip v-if="!menuOpen">{{ alertLabel }}</q-tooltip>
    <q-badge
      v-if="alertsCount > 0"
      :color="badgeColor"
      :text-color="badgeTextColor"
      class="alerts-count-badge"
      floating
    >
      {{ countText }}
    </q-badge>
    <q-menu
      v-model="menuOpen"
      :style="{ 'max-height': `${$q.screen.height - 100}px` }"
    >
      <q-list separator>
        <EmptyState
          v-if="alertsCount === 0"
          icon="notifications_none"
          title="No active alerts"
          text="New device and monitoring alerts will appear here."
        />
        <q-item v-for="alert in topAlerts" :key="alert.id">
          <q-item-section>
            <q-item-label caption>
              <router-link
                v-if="alert.agent_id"
                :to="`/agents/${alert.agent_id}`"
                class="rmm-link"
                >{{ alert.client }} - {{ alert.site }} -
                <span class="text-no-wrap">{{
                  alert.hostname
                }}</span></router-link
              >
              <span v-else-if="alert.hostname"
                >{{ alert.client }} - {{ alert.site }} -
                <span class="text-no-wrap">{{ alert.hostname }}</span></span
              >
              <span v-else>Custom alert</span>
            </q-item-label>
            <q-item-label lines="1">
              <span class="sr-only">{{ severityLabel(alert.severity) }}:</span>
              <q-icon
                size="xs"
                :class="`text-${colorFor(alert.severity)}`"
                :name="alert.severity"
              >
                <q-tooltip>{{ severityLabel(alert.severity) }}</q-tooltip>
              </q-icon>
              {{ alert.message }}
            </q-item-label>
          </q-item-section>
          <q-item-section side top>
            <q-item-label caption>{{ ago(alert) }}</q-item-label>
            <q-item-label>
              <q-btn
                v-for="act in rowActions"
                :key="act.icon"
                v-close-popup
                v-bind="btnProps"
                :icon="act.icon"
                :aria-label="`${act.verb} alert for ${alert.hostname}`"
                @click="act.run(alert)"
              >
                <q-tooltip>{{ act.verb }} alert</q-tooltip>
              </q-btn>
            </q-item-label>
          </q-item-section>
        </q-item>
        <q-item clickable v-close-popup @click="showOverview"
          >View all alerts ({{ alertsCount }})</q-item
        >
      </q-list>
    </q-menu>
  </q-btn>
</template>

<script setup>
import axios from "axios";
import { useQuasar } from "quasar";
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useStore } from "vuex";
import AlertsOverview from "@/components/modals/alerts/AlertsOverview.vue";
import EmptyState from "@/components/ui/EmptyState.vue";
import { useDashboardStore } from "@/stores/dashboard";
import { getTimeLapse } from "@/utils/format";
import { notifySuccess } from "@/utils/notify";

defineOptions({ name: "AlertsIcon" });

// the rail's Alerts badge shows the same count
const emit = defineEmits(["count"]);

const $q = useQuasar();
const store = useStore();

const alertsCount = ref(0);
const topAlerts = ref([]);
const menuOpen = ref(false);
let timer = null;

const btnProps = { flat: true, round: true, dense: true, size: "sm" };

function colorFor(severity) {
  const key = { error: "negative", warning: "warning" }[severity] || "info";
  return store.state[`dash_${key}_color`];
}

const hasSeverity = (level) =>
  topAlerts.value.some((alert) => alert.severity === level);

const badgeColor = computed(() =>
  colorFor(
    hasSeverity("error") ? "error" : hasSeverity("warning") ? "warning" : "",
  ),
);
const badgeTextColor = computed(() =>
  hasSeverity("error") ? "white" : "dark",
);
const countText = computed(() =>
  alertsCount.value > 99 ? "99+" : alertsCount.value,
);
const alertLabel = computed(
  () =>
    `${alertsCount.value} active ${alertsCount.value === 1 ? "alert" : "alerts"} — open alerts`,
);

function severityLabel(severity) {
  return `${severity.charAt(0).toUpperCase()}${severity.slice(1)} severity`;
}

async function loadAlerts() {
  const { data } = await axios.patch("alerts/", { top: 10 });
  alertsCount.value = data.alerts_count;
  topAlerts.value = data.alerts;
  emit("count", alertsCount.value);
}

function sendAction(alert, body, doneMessage) {
  $q.loading.show();
  axios
    .put(`alerts/${alert.id}/`, { id: alert.id, ...body })
    .then(() => {
      loadAlerts();
      $q.loading.hide();
      notifySuccess(doneMessage);
    })
    .catch(() => {
      $q.loading.hide();
    });
}

const ago = (alert) => getTimeLapse(alert.alert_time);

// the server takes whole days from 1 to 3650
const daysPrompt = {
  model: "",
  type: "number",
  label: "Days",
  outlined: true,
  dense: true,
  isValid: (val) => Number.isInteger(Number(val)) && val >= 1 && val <= 3650,
};

function snooze(alert) {
  $q.dialog({
    title: "Snooze Alert",
    message: "How many days to snooze alert?",
    prompt: daysPrompt,
    cancel: true,
  }).onOk((days) =>
    sendAction(
      alert,
      { type: "snooze", snooze_days: days },
      `The alert has been snoozed for ${days} days`,
    ),
  );
}

function resolve(alert) {
  sendAction(alert, { type: "resolve" }, "The alert has been resolved");
}

const rowActions = [
  { icon: "snooze", verb: "Snooze", run: snooze },
  { icon: "flag", verb: "Resolve", run: resolve },
];

function showOverview() {
  $q.dialog({ component: AlertsOverview }).onDismiss(loadAlerts);
}

onMounted(() => {
  loadAlerts();
  timer = setInterval(() => {
    // paused while the backend is unreachable; MainLayout keeps the
    // probe alive and clears the flag
    if (useDashboardStore().isOffline) return;
    loadAlerts();
  }, 60000);
});

onBeforeUnmount(() => clearInterval(timer));
</script>
