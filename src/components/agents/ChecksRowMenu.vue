<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-list dense class="check-row-menu">
    <q-item :disable="managed" clickable v-close-popup @click="$emit('edit')">
      <q-item-section side><q-icon name="edit" /></q-item-section>
      <q-item-section>
        <q-item-label>Edit</q-item-label>
        <q-item-label v-if="managed" caption>Managed by a policy</q-item-label>
      </q-item-section>
    </q-item>
    <q-item
      clickable
      v-close-popup
      :disable="!!resetBlocked"
      @click="$emit('reset')"
    >
      <q-item-section side>
        <q-icon name="restart_alt" />
      </q-item-section>
      <q-item-section>
        <q-item-label>Reset check status</q-item-label>
        <q-item-label caption>{{
          resetBlocked || "Mark as passing and resolve its alert"
        }}</q-item-label>
      </q-item-section>
      <q-tooltip v-if="resetBlocked">{{ resetBlocked }}</q-tooltip>
    </q-item>
    <q-item v-if="managed" clickable v-close-popup @click="$emit('policy')">
      <q-item-section side>
        <q-icon name="policy" />
      </q-item-section>
      <q-item-section>Open policy: {{ policyName }}</q-item-section>
    </q-item>
    <q-separator />
    <q-item
      clickable
      v-close-popup
      class="text-negative"
      :disable="managed"
      @click="$emit('delete')"
    >
      <q-item-section side>
        <q-icon name="delete" color="negative" />
      </q-item-section>
      <q-item-section>
        <q-item-label>Delete</q-item-label>
        <q-item-label v-if="managed" caption>Managed by a policy</q-item-label>
      </q-item-section>
    </q-item>
    <template v-if="closeItem">
      <q-separator />
      <q-item clickable v-close-popup>
        <q-item-section>Close</q-item-section>
      </q-item>
    </template>
  </q-list>
</template>

<style scoped>
.check-row-menu {
  min-width: 220px;
}
</style>

<script setup>
defineProps({
  managed: Boolean,
  resetBlocked: String,
  policyName: String,
  closeItem: Boolean,
});
defineEmits(["edit", "reset", "policy", "delete"]);
</script>
