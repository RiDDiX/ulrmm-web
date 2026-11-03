<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-bar class="dialog-header">
    <div class="dialog-header__copy">
      <div :id="titleId" class="dialog-header__title">{{ title }}</div>
      <div v-if="subtitle" class="dialog-header__subtitle">
        {{ subtitle }}
      </div>
    </div>
    <q-space />
    <slot name="actions" />
    <q-btn
      v-close-popup
      dense
      flat
      icon="close"
      aria-label="Close"
      :disable="closeDisable"
    >
      <q-tooltip>{{ closeTooltip }}</q-tooltip>
    </q-btn>
  </q-bar>
</template>

<script setup>
// One dialog chrome (DS-6): title, optional subtitle, one labelled close
// button. Used directly by dialogs that render their own q-card instead of
// going through DialogWrapper.
defineProps({
  title: { type: String, required: true },
  subtitle: { type: String, default: "" },
  titleId: { type: String, default: undefined },
  closeTooltip: { type: String, default: "Close" },
  closeDisable: { type: Boolean, default: false },
});
</script>

<style scoped>
.dialog-header {
  height: auto;
}

.dialog-header__copy {
  min-width: 0;
  padding: 2px 0;
}

.dialog-header__title {
  display: -webkit-box;
  overflow: hidden;
  font-size: var(--rmm-fs-lg);
  font-weight: 600;
  letter-spacing: -0.01em;
  line-height: 1.3;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
}

.dialog-header__subtitle {
  color: var(--rmm-text-muted);
  font-size: var(--rmm-fs-xs);
  font-weight: 400;
  line-height: 1.4;
}
</style>
