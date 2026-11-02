<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <span
    class="help-tip"
    tabindex="0"
    role="img"
    :aria-label="text"
    @focus="shown = true"
    @blur="shown = false"
    @keydown.esc="shown = false"
  >
    <q-icon name="help_outline" size="16px" />
    <q-tooltip v-model="shown" max-width="320px">{{ text }}</q-tooltip>
  </span>
</template>

<script setup lang="ts">
import { ref } from "vue";

defineProps<{
  text: string;
}>();

const shown = ref(false);
</script>

<style scoped>
.help-tip {
  display: inline-flex;
  color: var(--rmm-text-subtle);
  cursor: help;
  vertical-align: middle;
}

/* checkbox, toggle and radio labels sit flush against the control */
.q-checkbox + .help-tip,
.q-toggle + .help-tip,
.q-radio + .help-tip {
  margin-left: 4px;
}
</style>
