<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-list dense class="task-row-menu">
    <q-item clickable v-close-popup @click="$emit('run')">
      <q-item-section side>
        <q-icon name="play_arrow" />
      </q-item-section>
      <q-item-section>
        <q-item-label>Run task now</q-item-label>
        <q-item-label caption>Runs once now, outside its schedule</q-item-label>
      </q-item-section>
    </q-item>
    <q-item v-if="!managed" clickable v-close-popup @click="$emit('edit')">
      <q-item-section side>
        <q-icon name="edit" />
      </q-item-section>
      <q-item-section>Edit</q-item-section>
    </q-item>
    <q-item v-else clickable v-close-popup @click="$emit('policy')">
      <q-item-section side>
        <q-icon name="policy" />
      </q-item-section>
      <q-item-section>Open policy: {{ policyName }}</q-item-section>
    </q-item>
    <template v-if="!managed">
      <q-separator />
      <q-item
        clickable
        v-close-popup
        class="text-negative"
        @click="$emit('delete')"
      >
        <q-item-section side>
          <q-icon name="delete" color="negative" />
        </q-item-section>
        <q-item-section>Delete</q-item-section>
      </q-item>
    </template>
    <template v-if="closeItem">
      <q-separator />
      <q-item clickable v-close-popup>
        <q-item-section>Close</q-item-section>
      </q-item>
    </template>
  </q-list>
</template>

<script setup>
defineProps({ managed: Boolean, policyName: String, closeItem: Boolean });
defineEmits(["run", "edit", "policy", "delete"]);
</script>

<style scoped>
.task-row-menu {
  min-width: 220px;
}
</style>
