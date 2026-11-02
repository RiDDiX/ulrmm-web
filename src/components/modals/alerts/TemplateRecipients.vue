<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-card-section class="row items-start">
    <!-- padded to the first row's text line -->
    <div class="col-12 col-sm-3 q-mb-sm q-pt-sm rmm-label">{{ title }}</div>
    <div class="col-12 col-sm-6" :class="gap">
      <q-list v-if="items.length !== 0" dense>
        <q-item v-for="item in items" :key="item" dense class="q-pl-none">
          <q-item-section>
            <q-item-label :class="{ 'rmm-mono': mono }">{{
              item
            }}</q-item-label>
          </q-item-section>
          <q-item-section side>
            <q-btn
              flat
              round
              dense
              size="sm"
              icon="delete"
              color="negative"
              :aria-label="`Remove ${item}`"
              @click="emit('remove', item)"
            >
              <q-tooltip>{{ removeTip }}</q-tooltip>
            </q-btn>
          </q-item-section>
        </q-item>
      </q-list>
      <div v-else class="text-caption rmm-muted q-pt-sm">{{ emptyText }}</div>
    </div>
    <div class="col-12 col-sm-3 q-mb-sm">
      <q-btn
        flat
        dense
        no-caps
        icon="add"
        :label="addLabel"
        @click="emit('add')"
      />
    </div>
  </q-card-section>
</template>

<script setup>
defineProps({
  title: String,
  items: { type: Array, required: true },
  mono: Boolean,
  gap: { type: String, default: "q-mb-sm" },
  removeTip: String,
  emptyText: String,
  addLabel: String,
});
const emit = defineEmits(["add", "remove"]);
</script>
