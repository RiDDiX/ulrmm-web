<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-select
    :model-value="modelValue"
    dense
    outlined
    options-dense
    multiple
    use-input
    input-debounce="0"
    label="Template Dependencies"
    style="min-width: 200px"
    :options="shown"
    :display-value="modelValue.length ? `${modelValue.length} Selected` : ''"
    @update:model-value="(names) => emit('update:modelValue', names)"
    @filter="narrow"
    @new-value="add"
  />
</template>

<script setup lang="ts">
import { ref } from "vue";
import { notifyWarning } from "@/utils/notify";

const RESERVED = ["data_sources", "charts"];

const props = defineProps<{ modelValue: string[] }>();
const emit = defineEmits<{ "update:modelValue": [names: string[]] }>();

// the defaults plus the names the template already uses; names typed in
// stay on the list for the rest of this editor session
const known = ref<string[]>([
  ...new Set(["client", "site", "agent", ...props.modelValue]),
]);
const shown = ref<string[]>(known.value);

function narrow(text: string, update: (fn: () => void) => void) {
  update(() => {
    const needle = text.toLowerCase();
    shown.value = known.value.filter((name) =>
      name.toLowerCase().includes(needle),
    );
  });
}

function add(
  text: string,
  done: (item?: string, mode?: "add" | "add-unique" | "toggle") => void,
) {
  const name = text.trim();
  if (!name) return done();
  // the server stores up to 20 characters and keeps these names for itself
  if (name.length > 20 || RESERVED.includes(name)) {
    notifyWarning(
      RESERVED.includes(name)
        ? `${name} is reserved for the template variables`
        : "A dependency name can have up to 20 characters",
    );
    return done();
  }
  if (!known.value.includes(name)) known.value.push(name);
  done(name, "add-unique");
}
</script>
