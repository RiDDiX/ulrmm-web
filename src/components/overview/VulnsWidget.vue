<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <div class="vulns-widget">
    <StatTiles :tiles="tiles" />
    <p class="widget-note">
      {{ note }}
      <template v-if="data.last_scan"
        >Last check {{ relativeTime(data.last_scan) }}.</template
      >
      <HelpTip v-if="data.coverage" :text="data.coverage" />
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import HelpTip from "@/components/ui/HelpTip.vue";
import StatTiles from "./StatTiles.vue";
import { formatCount } from "@/utils/overview";
import { relativeTime } from "@/utils/format";
import { SEVERITIES, severityMeta } from "@/utils/vulns";

const props = defineProps<{
  data: {
    // severities and agents_affected count open findings with a fix
    agents_affected: number;
    open: number;
    needs_update: number;
    no_fix: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    unknown: number;
    last_scan: string | null;
    coverage?: string;
  };
}>();

const note = computed(() => {
  const { needs_update, no_fix, agents_affected, last_scan } = props.data;
  if (!last_scan && !needs_update && !no_fix) return "No check has run yet.";
  const fix = needs_update
    ? `${formatCount(needs_update)} ${needs_update === 1 ? "needs" : "need"} an update on ${formatCount(agents_affected)} ${agents_affected === 1 ? "device" : "devices"}`
    : "Nothing needs an update";
  return no_fix
    ? `${fix}, ${formatCount(no_fix)} without a fix yet.`
    : `${fix}.`;
});

// unknown only when there is one
const tiles = computed(() =>
  SEVERITIES.filter((level) => level !== "unknown" || props.data.unknown).map(
    (level) => ({
      label: severityMeta(level).label,
      value: props.data[level],
      dot: props.data[level] ? severityMeta(level).color : undefined,
      muted: !props.data[level],
    }),
  ),
);
</script>

<style scoped>
.vulns-widget {
  display: grid;
  gap: 10px;
}
</style>
