<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-list dense style="min-width: 220px">
    <q-item v-close-popup clickable @click="$emit('copy-name')">
      <q-item-section avatar><q-icon name="content_copy" /></q-item-section>
      <q-item-section>Copy name</q-item-section>
    </q-item>
    <q-item v-close-popup clickable @click="$emit('copy-version')">
      <q-item-section avatar><q-icon name="content_copy" /></q-item-section>
      <q-item-section>Copy version</q-item-section>
    </q-item>
    <q-separator />
    <q-item
      v-close-popup
      clickable
      :disable="!uninstallEnabled"
      :class="{ 'text-negative': uninstallEnabled }"
      @click="$emit('uninstall')"
    >
      <q-item-section avatar>
        <q-icon
          name="delete_outline"
          :color="uninstallEnabled ? 'negative' : undefined"
        />
      </q-item-section>
      <q-item-section>
        <q-item-label>Uninstall…</q-item-label>
        <q-item-label caption>
          {{
            uninstallEnabled
              ? "Remove it from the device; you confirm first"
              : uninstallReason
          }}
        </q-item-label>
      </q-item-section>
    </q-item>
  </q-list>
</template>

<script setup>
defineProps({
  uninstallEnabled: Boolean,
  uninstallReason: { type: String, default: "" },
});

defineEmits(["uninstall", "copy-name", "copy-version"]);
</script>
