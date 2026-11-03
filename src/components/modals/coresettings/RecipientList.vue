<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <div class="settings-group-title">
    Recipients
    <q-space />
    <q-btn
      flat
      dense
      no-caps
      color="primary"
      icon="add"
      :label="addLabel"
      @click="emit('add')"
    />
  </div>
  <div class="settings-hint">
    Default recipients; an alert template with its own recipients sends there
    instead.
  </div>
  <q-card-section class="row">
    <div class="col-12">
      <q-list
        v-if="ready && items.length !== 0"
        dense
        bordered
        separator
        class="settings-recipients"
      >
        <q-item v-for="item in items" :key="item">
          <q-item-section>
            <q-item-label :class="{ 'rmm-num': mono }">{{ item }}</q-item-label>
          </q-item-section>
          <q-item-section side>
            <q-btn
              flat
              round
              dense
              size="sm"
              icon="delete"
              color="negative"
              :aria-label="`Remove recipient ${item}`"
              @click="emit('remove', item)"
            >
              <q-tooltip
                >Removes this {{ noun }}; takes effect when you save</q-tooltip
              >
            </q-btn>
          </q-item-section>
        </q-item>
      </q-list>
      <div v-else class="settings-empty">{{ emptyText }}</div>
    </div>
  </q-card-section>
</template>

<script setup>
defineProps({
  items: { type: Array, default: () => [] },
  ready: Boolean,
  mono: Boolean,
  addLabel: String,
  noun: String,
  emptyText: String,
});
const emit = defineEmits(["add", "remove"]);
</script>
