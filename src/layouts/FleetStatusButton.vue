<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<script setup lang="ts">
import { computed } from "vue";
import { useStore } from "vuex";
import { useDashboardStore } from "@/stores/dashboard";

// Connection state in the header; its menu breaks the fleet down into
// servers and workstations, total and offline.
const store = useStore();
const fleet = useDashboardStore();

const offlineColor = computed(() => store.state.dash_negative_color);

// API reachability first, then the live socket
const link = computed(() => {
  if (fleet.isOffline) return { state: "negative", label: "Offline" };
  return fleet.wsStatus === "OPEN"
    ? { state: "positive", label: "Connected" }
    : { state: "neutral", label: "Connecting" };
});

const countHint = computed(() => {
  if (!fleet.agentCountReady || fleet.wsStatus !== "OPEN")
    return "Live agent count unavailable — show breakdown";
  const total = fleet.serverCount + fleet.workstationCount;
  const down = fleet.serverOfflineCount + fleet.workstationOfflineCount;
  const noun = total === 1 ? "agent" : "agents";
  return `${total} ${noun}, ${total - down} online — show breakdown`;
});

const fleetGroup = (
  title: string,
  icon: string,
  total: number,
  offline: number,
) => ({
  title,
  rows: [
    { icon, label: "Total", count: total, negative: false },
    { icon: "power_off", label: "Offline", count: offline, negative: true },
  ],
});

const breakdown = computed(() => [
  fleetGroup("Servers", "dns", fleet.serverCount, fleet.serverOfflineCount),
  fleetGroup(
    "Workstations",
    "computer",
    fleet.workstationCount,
    fleet.workstationOfflineCount,
  ),
]);
</script>

<template>
  <q-btn
    flat
    no-caps
    dense
    class="conn-indicator"
    :class="`conn-indicator--${link.state}`"
    :aria-label="`${link.label} — ${countHint}`"
  >
    <span class="conn-indicator__dot" aria-hidden="true" />
    {{ link.label }}
    <q-tooltip :delay="600" anchor="top middle" self="top middle">{{
      countHint
    }}</q-tooltip>
    <q-menu>
      <q-list dense>
        <template v-for="group in breakdown" :key="group.title">
          <q-item-label header>{{ group.title }}</q-item-label>
          <q-item v-for="row in group.rows" :key="row.icon">
            <q-item-section avatar
              ><q-icon
                size="sm"
                :name="row.icon"
                :color="row.negative ? offlineColor : 'primary'"
            /></q-item-section>
            <q-item-section no-wrap
              ><q-item-label
                >{{ row.label }}: {{ row.count }}</q-item-label
              ></q-item-section
            >
          </q-item>
        </template>
      </q-list>
    </q-menu>
  </q-btn>
</template>

<style scoped>
.conn-indicator {
  --conn-color: var(--rmm-text-muted);
  flex-shrink: 0;
  min-height: 36px;
  padding: 0 10px;
  color: var(--conn-color);
  font-size: 13px;
  font-weight: 500;
}

.conn-indicator :deep(.q-btn__content) {
  gap: 7px;
}

.conn-indicator__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--conn-color);
}

.conn-indicator--positive {
  --conn-color: var(--rmm-status-positive);
}

.conn-indicator--negative {
  --conn-color: var(--rmm-status-negative);
}
</style>
