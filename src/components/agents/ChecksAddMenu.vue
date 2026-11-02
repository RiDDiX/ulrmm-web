<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-btn-dropdown
    unelevated
    color="primary"
    icon="add"
    label="Add check"
    no-caps
    dense
  >
    <q-list dense class="add-check-menu">
      <template v-for="kind in visibleKinds" :key="kind.type">
        <q-item clickable v-close-popup @click="$emit('pick', kind.type)">
          <q-item-section avatar>
            <q-icon size="xs" :name="kind.icon" />
          </q-item-section>
          <q-item-section>
            <q-item-label>{{ kind.label }}</q-item-label>
            <q-item-label caption>{{ kind.caption }}</q-item-label>
          </q-item-section>
        </q-item>
      </template>
    </q-list>
  </q-btn-dropdown>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({ platform: String });
defineEmits(["pick"]);

const kinds = [
  {
    type: "diskspace",
    label: "Disk space check",
    icon: "far fa-hdd",
    caption: "Alerts when free space on a drive runs low",
  },
  {
    type: "ping",
    label: "Ping check",
    icon: "fas fa-network-wired",
    caption: "Alerts when a host stops answering ping from this agent",
  },
  {
    type: "cpuload",
    label: "CPU load check",
    icon: "fas fa-microchip",
    caption: "Alerts when CPU use stays above a limit",
  },
  {
    type: "memory",
    label: "Memory check",
    icon: "fas fa-memory",
    caption: "Alerts when memory use stays above a limit",
  },
  {
    type: "winsvc",
    label: "Windows service check",
    icon: "fas fa-cogs",
    caption: "Alerts when a Windows service is not running",
    only: ["windows"],
  },
  {
    type: "script",
    label: "Script check",
    icon: "fas fa-terminal",
    caption: "Runs a script and alerts on its exit code",
  },
  {
    type: "eventlog",
    label: "Event log check",
    icon: "fas fa-clipboard-list",
    caption:
      "Alerts when matching Windows event log entries appear, or are missing",
    only: ["windows"],
  },
  {
    type: "security",
    label: "Security check",
    icon: "fas fa-shield-alt",
    caption: "Alerts when antivirus or firewall is off or outdated",
  },
  {
    type: "hwhealth",
    label: "Hardware health check",
    icon: "fas fa-heartbeat",
    caption: "Alerts on failing disks, high temperatures or battery wear",
  },
  {
    type: "systemd",
    label: "Service check",
    icon: "fas fa-server",
    caption: "Alerts when a systemd unit or rc.d service is not running",
    only: ["linux", "freebsd"],
  },
  {
    type: "container",
    label: "Container check",
    icon: "fas fa-cubes",
    caption: "Alerts when a container or virtual machine is not running",
  },
  {
    type: "metric",
    label: "Metric threshold check",
    icon: "fas fa-chart-line",
    caption: "Alerts when a reported metric crosses a threshold",
  },
];

const visibleKinds = computed(() =>
  kinds.filter((k) => !k.only || k.only.includes(props.platform)),
);
</script>

<style scoped>
.add-check-menu {
  min-width: 280px;
}
</style>
