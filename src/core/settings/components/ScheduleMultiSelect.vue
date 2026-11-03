<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-select
    v-model="picked"
    class="col-4 q-pa-sm"
    :label="label"
    :hint="hint"
    :options="options"
    :rules="[(val) => val.length > 0 || '*Required']"
    outlined
    dense
    options-dense
    multiple
    emit-value
    map-options
  >
    <template v-if="allLabel" v-slot:before-options>
      <q-item>
        <q-item-section>
          <q-item-label>{{ allLabel }}</q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-checkbox v-model="all" dense :aria-label="allLabel" />
        </q-item-section>
      </q-item>
    </template>

    <template v-slot:option="{ itemProps, opt, selected, toggleOption }">
      <q-item v-bind="itemProps">
        <q-item-section>
          <q-item-label>{{ opt.label }}</q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-checkbox
            :model-value="selected"
            dense
            :aria-label="opt.label"
            @update:model-value="toggleOption(opt)"
          />
        </q-item-section>
      </q-item>
    </template>
  </q-select>
</template>

<script lang="ts" setup>
import { computed } from "vue";

const picked = defineModel<number[]>({ required: true });
const props = defineProps<{
  label: string;
  options: { label: string; value: number }[];
  hint?: string;
  // adds an "all" row on top of the list
  allLabel?: string;
}>();

// ticking "all" picks every option, unticking clears the list; it shows
// ticked whenever every option is picked, also for a loaded schedule
const all = computed({
  get: () =>
    props.options.length > 0 && picked.value?.length === props.options.length,
  set: (on: boolean) => {
    picked.value = on ? props.options.map((o) => o.value) : [];
  },
});
</script>
