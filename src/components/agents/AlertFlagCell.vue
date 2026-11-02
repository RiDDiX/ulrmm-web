<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-td>
    <q-checkbox
      v-if="templateLocks"
      :model-value="template[templateKey]"
      :aria-label="ariaLabel"
      disable
      dense
    >
      <q-tooltip>
        Setting is overridden by alert template: {{ template.name }}
      </q-tooltip>
    </q-checkbox>
    <q-checkbox
      v-else
      :model-value="row[field]"
      :disable="!!row.policy"
      :aria-label="ariaLabel"
      dense
      @update:model-value="(value) => $emit('change', { [field]: value })"
    />
    <q-icon
      v-if="override"
      :name="override.icon"
      :aria-label="override.tooltip"
      size="14px"
      class="rmm-muted q-ml-xs"
      role="img"
    >
      <q-tooltip>{{ override.tooltip }}</q-tooltip>
    </q-icon>
  </q-td>
</template>

<script setup>
import { computed } from "vue";
import { alertOverrideMeta } from "@/utils/format";

const props = defineProps({
  row: { type: Object, required: true },
  field: { type: String, required: true },
  templateKey: { type: String, required: true },
  label: { type: String, required: true },
  // what the row is called in the screen reader label
  subject: { type: String, required: true },
  // !== null, so a missing template key locks as well
  strictNull: Boolean,
});
defineEmits(["change"]);

const template = computed(() => props.row.alert_template);
const templateLocks = computed(() => {
  const value = template.value?.[props.templateKey];
  if (!template.value) return false;
  return props.strictNull ? value !== null : value != null;
});
const ariaLabel = computed(() => `${props.label} for ${props.subject}`);
const override = computed(() =>
  alertOverrideMeta(
    template.value?.[props.templateKey],
    template.value?.name,
    !!props.row.policy,
  ),
);
</script>
