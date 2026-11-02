<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-list dense style="min-width: 240px">
    <template v-for="entry in entries" :key="entry.event">
      <q-separator v-if="entry.dividerBefore" />
      <q-item
        clickable
        v-close-popup
        :class="entry.danger ? 'text-negative' : ''"
        @click="emit(entry.event)"
      >
        <q-item-section side>
          <q-icon :name="entry.icon" :color="entry.danger ? 'negative' : ''" />
        </q-item-section>
        <q-item-section v-if="entry.hint">
          <q-item-label>{{ entry.label }}</q-item-label>
          <q-item-label caption>{{ entry.hint }}</q-item-label>
        </q-item-section>
        <q-item-section v-else>{{ entry.label }}</q-item-section>
      </q-item>
    </template>

    <template v-if="withClose">
      <q-separator />
      <q-item clickable v-close-popup>
        <q-item-section>Close</q-item-section>
      </q-item>
    </template>
  </q-list>
</template>

<script setup>
import { computed } from "vue";

// row button and context menu share this list
const props = defineProps({
  policy: { type: Object, required: true },
  withClose: { type: Boolean, default: false },
});

const emit = defineEmits([
  "edit",
  "copy",
  "delete",
  "relations",
  "exclusions",
  "patch",
  "alert-template",
]);

const entries = computed(() => {
  const p = props.policy;
  return [
    { event: "edit", icon: "edit", label: "Edit" },
    {
      event: "copy",
      icon: "content_copy",
      label: "Copy",
      hint: "New policy with the same checks and tasks",
    },
    {
      event: "relations",
      icon: "account_tree",
      label: "Show Relations",
      hint: "Clients, sites and agents it is assigned to",
      dividerBefore: true,
    },
    {
      event: "exclusions",
      icon: "rule",
      label: "Policy Exclusions",
      hint: "Clients, sites or agents it skips",
    },
    {
      event: "patch",
      icon: "system_update",
      label:
        p.winupdatepolicy.length > 0
          ? "Modify Patch Policy"
          : "Create Patch Policy",
      hint: "Windows update approval and schedule",
    },
    {
      event: "alert-template",
      icon: "warning",
      label: p.alert_template
        ? "Modify Alert Template"
        : "Assign Alert Template",
      hint: "Alert rules for the agents it applies to",
    },
    {
      event: "delete",
      icon: "delete",
      label: "Delete",
      danger: true,
      dividerBefore: true,
    },
  ];
});
</script>
