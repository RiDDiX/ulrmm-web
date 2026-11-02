<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-item
    v-close-popup
    clickable
    :disable="item.disable"
    :class="item.danger ? 'text-negative' : undefined"
    @click="item.run?.()"
  >
    <q-item-section v-if="item.icon" side>
      <q-icon :name="item.icon" :color="item.danger ? 'negative' : undefined" />
    </q-item-section>
    <q-item-section v-if="item.caption">
      <q-item-label>{{ item.label }}</q-item-label>
      <q-item-label caption>{{ item.caption }}</q-item-label>
    </q-item-section>
    <q-item-section v-else>{{ item.label }}</q-item-section>
  </q-item>
</template>

<script setup>
defineProps({ item: { type: Object, required: true } });
</script>
