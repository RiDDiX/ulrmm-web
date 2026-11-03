<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <div class="row q-gutter-sm items-center">
    <div class="col-auto copy-clip__label">{{ label }}</div>
    <div class="col-auto">
      <q-btn
        dense
        flat
        size="md"
        icon="content_copy"
        class="copy-clip__btn"
        :aria-label="copyLabel"
        @click="copyText"
      >
        <q-tooltip>{{ copyLabel }}</q-tooltip>
      </q-btn>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { copyOutput } from "@/utils/helpers";

const props = defineProps({
  label: String,
  data: { type: String, required: true },
});

const copyLabel = computed(() =>
  props.label
    ? `Copy ${props.label.toLowerCase()} to clipboard`
    : "Copy to clipboard",
);

function copyText() {
  copyOutput(props.data);
}
</script>

<style scoped>
.copy-clip__label {
  font-weight: 600;
}

.copy-clip__btn {
  color: var(--rmm-text-muted);
}
</style>
