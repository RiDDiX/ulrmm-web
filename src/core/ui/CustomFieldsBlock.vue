<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <div v-if="fields.length > 0" class="text-subtitle2 q-px-md q-pt-md">
    Custom fields
  </div>
  <div v-if="failed" class="q-px-md text-negative">
    Custom fields could not be loaded.
  </div>
  <q-card-section v-for="field in fields" :key="field.id" class="q-pb-none">
    <CustomField v-model="current[field.name]" :field="field" />
  </q-card-section>
</template>

<script setup>
import { toRef } from "vue";
import CustomField from "@/components/ui/CustomField.vue";

// the custom field inputs of a client or site form; edits go straight into `values`
const props = defineProps({
  fields: { type: Array, required: true },
  values: { type: Object, required: true },
  failed: Boolean,
});
const current = toRef(props, "values");
</script>
