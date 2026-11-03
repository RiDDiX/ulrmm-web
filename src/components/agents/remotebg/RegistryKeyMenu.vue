<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-list dense style="min-width: 180px">
    <RegistryNewMenu @pick="(type) => emit('create', type)" />
    <q-item v-close-popup clickable @click="emit('refresh')">
      <q-item-section>
        <q-item-label>Refresh</q-item-label>
        <q-item-label caption
          >Reload subkeys and values from the agent</q-item-label
        >
      </q-item-section>
    </q-item>
    <!-- a hive cannot be renamed or deleted -->
    <q-item v-if="!hive" v-close-popup clickable @click="emit('rename')">
      <q-item-section>Rename</q-item-section>
    </q-item>
    <q-separator v-if="!hive" />
    <q-item
      v-if="!hive"
      v-close-popup
      clickable
      class="text-negative"
      @click="emit('remove')"
    >
      <q-item-section>
        <q-item-label>Delete</q-item-label>
        <q-item-label caption
          >Removes the key and all of its subkeys</q-item-label
        >
      </q-item-section>
    </q-item>
  </q-list>
</template>

<script setup lang="ts">
import RegistryNewMenu from "@/components/agents/remotebg/RegistryNewMenu.vue";

defineProps<{ hive?: boolean }>();

const emit = defineEmits<{
  (e: "create", type: string): void;
  (e: "refresh"): void;
  (e: "rename"): void;
  (e: "remove"): void;
}>();
</script>
