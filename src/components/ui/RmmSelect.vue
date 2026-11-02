<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-select
    class="rmm-select"
    v-bind="{ ...selectProps, ...$attrs }"
    @update:model-value="(value) => $emit('update:modelValue', value)"
    @[filterEvent]="filterFn"
    @popup-show="focused = true"
    @popup-hide="focused = false"
    @input-value="(value) => value === '' && (filtered = false)"
    @blur="
      filtered = false;
      focused = false;
    "
  >
    <template v-for="(_, slot) in $slots" #[slot]="scope">
      <slot :name="slot" v-bind="scope || {}" />
    </template>

    <template #option="scope">
      <q-item
        v-if="!scope.opt.category"
        class="q-pl-lg"
        v-bind="scope.itemProps"
        :key="optionKey(scope.opt)"
        :title="optionText(scope.opt)"
      >
        <q-item-section>
          <!-- text only: labels are names from the server -->
          <q-item-label>{{ optionText(scope.opt) }}</q-item-label>
          <q-item-label v-if="mapOptions && scope.opt.help" caption>{{
            scope.opt.help
          }}</q-item-label>
        </q-item-section>
        <q-item-section v-if="showSide(scope.opt)" side>
          {{ scope.opt.cat || "" }}
          <img
            v-if="scope.opt.img_right"
            :src="scope.opt.img_right"
            class="rmm-select__img"
          />
        </q-item-section>
      </q-item>
      <q-item-label v-else :key="scope.opt.category" class="q-pa-sm" header>{{
        scope.opt.category
      }}</q-item-label>
    </template>
  </q-select>
</template>

<script setup>
import { computed, ref } from "vue";

defineOptions({ name: "rmm-select", inheritAttrs: false });

const props = defineProps({
  modelValue: null,
  mapOptions: Boolean,
  multiple: Boolean,
  filterable: Boolean,
  // outlined unless a caller passes outlined=false or filled via attrs
  outlined: { type: Boolean, default: true },
  options: null,
});

defineEmits(["update:modelValue"]);

// filteredOptions only counts while `filtered` is set; a late input-value
// after a pick used to hide the chosen value behind an empty option list
const filtered = ref(false);
const filteredOptions = ref([]);
const focused = ref(false);

const filterEvent = computed(() => (props.filterable ? "filter" : null));

const selectProps = computed(() => ({
  dense: true,
  "options-dense": true,
  "input-debounce": "0",
  outlined: props.outlined,
  options: filtered.value ? filteredOptions.value : props.options,
  "model-value": props.modelValue,
  "map-options": props.mapOptions,
  "emit-value": props.mapOptions,
  multiple: props.multiple,
  "use-chips": props.multiple,
  "use-input": props.filterable,
  "hide-selected": !props.multiple && (focused.value || filtered.value),
}));

const optionKey = (opt) => (props.mapOptions ? opt.value : opt);
const optionText = (opt) => (props.mapOptions ? opt.label : opt);

const showSide = (opt) =>
  (filtered.value && props.mapOptions && opt.cat) || opt.img_right;

function filterFn(val, update) {
  update(() => {
    filtered.value = val !== "";
    if (val === "") return;
    const needle = val.toLowerCase();
    filteredOptions.value = props.mapOptions
      ? props.options.filter(
          (o) => !o.category && o.label.toLowerCase().includes(needle),
        )
      : props.options.filter((o) => o.toLowerCase().includes(needle));
  });
}
</script>

<style scoped>
.rmm-select__img {
  height: 20px;
  max-width: 20px;
}

.rmm-select :deep(.q-chip) {
  color: var(--rmm-text);
  background: var(--rmm-surface-3);
}
</style>
