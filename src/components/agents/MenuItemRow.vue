<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-item
    v-close-popup="close"
    v-ripple="ripple"
    :to="to"
    :disable="disable"
    :class="{ 'text-negative': danger }"
    clickable
  >
    <q-item-section side>
      <q-icon
        size="xs"
        :name="icon"
        :color="danger ? 'negative' : undefined"
        :class="{ 'agent-action-menu__icon': !danger && !plain }"
      />
    </q-item-section>
    <q-item-section>
      <q-item-label :lines="lines">{{ label }}</q-item-label>
      <q-item-label v-if="caption" caption>{{ caption }}</q-item-label>
    </q-item-section>
    <q-item-section v-if="arrow" side>
      <q-icon name="keyboard_arrow_right" />
    </q-item-section>
    <q-tooltip v-if="hint" anchor="center right" self="center left">
      {{ hint }}
    </q-tooltip>
    <slot />
  </q-item>
</template>

<script setup>
defineProps({
  icon: { type: String, required: true },
  label: { type: String, required: true },
  caption: String,
  hint: String,
  to: Object,
  disable: Boolean,
  danger: Boolean,
  ripple: Boolean,
  // the uninstall code entry keeps the plain icon colour
  plain: Boolean,
  arrow: Boolean,
  lines: String,
  close: { type: Boolean, default: true },
});
</script>
