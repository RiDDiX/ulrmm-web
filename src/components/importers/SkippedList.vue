<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<!-- What an import or a link left out, each with the reason -->
<template>
  <q-list dense class="q-pa-sm text-caption">
    <q-item v-for="(s, i) in items" :key="i" dense class="q-px-none">
      <q-item-section>
        <q-item-label>{{ s.name }}</q-item-label>
        <q-item-label caption>{{ s.reason }}</q-item-label>
      </q-item-section>
    </q-item>
    <q-item v-if="more > 0" dense class="q-px-none rmm-muted">
      and {{ more }} more
    </q-item>
  </q-list>
</template>

<script setup>
defineProps({
  items: { type: Array, required: true },
  more: { type: Number, default: 0 },
});
</script>
