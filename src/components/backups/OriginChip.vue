<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<script setup>
import { computed } from "vue";
import { originLabel } from "./backups";

const props = defineProps({
  origin: { type: Object, default: null },
  locked: Boolean,
});
const label = computed(() => originLabel(props.origin));
</script>

<template>
  <span
    class="rmm-pill"
    :class="origin?.level === 'device' ? 'rmm-pill--info' : 'rmm-pill--neutral'"
  >
    <q-icon v-if="locked" name="lock" size="14px" class="q-mr-xs" />
    <span v-if="locked" class="sr-only">Enforced by</span>
    {{ label }}
    <q-tooltip v-if="locked"
      >Enforced by {{ label }}. Lower levels and the device cannot change
      it.</q-tooltip
    >
  </span>
</template>
