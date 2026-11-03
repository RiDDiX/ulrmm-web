<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <span
    class="rmm-pill severity-pill"
    :class="{ 'severity-pill--solid': meta.solid }"
    :style="{ '--rmm-pill-color': meta.color, '--rmm-pill-text': meta.text }"
    ><slot>{{ meta.label }}</slot></span
  >
</template>

<script setup lang="ts">
import { computed } from "vue";
import { severityMeta } from "@/utils/vulns";

const props = defineProps<{ level: string }>();
const meta = computed(() => severityMeta(props.level));
</script>

<style scoped>
.severity-pill {
  white-space: nowrap;
}

.severity-pill--solid {
  border-color: transparent;
  background: var(--rmm-pill-color);
}

.severity-pill--solid::before {
  background: var(--rmm-pill-text);
}
</style>
