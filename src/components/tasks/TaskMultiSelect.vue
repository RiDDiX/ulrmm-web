<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-select
    v-model="picked"
    :options="options"
    :rules="[(v) => v?.length > 0 || 'Required']"
    outlined
    dense
    options-dense
    multiple
    emit-value
    map-options
  >
    <template v-if="allLabel" #before-options>
      <q-item>
        <q-item-section>
          <q-item-label>{{ allLabel }}</q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-checkbox dense v-model="allPicked" :aria-label="allLabel" />
        </q-item-section>
      </q-item>
    </template>

    <template #option="{ itemProps, opt, selected: isPicked, toggleOption }">
      <q-item v-bind="itemProps">
        <q-item-section>
          <q-item-label>{{ opt.label }}</q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-checkbox
            :model-value="isPicked"
            dense
            :aria-label="opt.label"
            @update:model-value="toggleOption(opt)"
          />
        </q-item-section>
      </q-item>
    </template>
  </q-select>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({
  options: { type: Array, required: true },
  allLabel: { type: String, default: "" },
});
const picked = defineModel({ type: Array, default: () => [] });

// ticked whenever every option is picked, also for a task loaded that way
const allPicked = computed({
  get: () =>
    props.options.length > 0 && picked.value?.length === props.options.length,
  set: (all) => {
    picked.value = all ? props.options.map((o) => o.value) : [];
  },
});
</script>
