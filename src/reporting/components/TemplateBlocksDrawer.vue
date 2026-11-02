<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <aside class="variables-drawer" :class="{ 'is-open': open }">
    <div class="row justify-end">
      <q-btn
        flat
        dense
        :icon="open ? 'chevron_left' : 'chevron_right'"
        :aria-label="`${open ? 'Collapse' : 'Expand'} variables panel`"
        @click="open = !open"
      >
        <q-tooltip>{{
          open
            ? "Collapse the blocks and variables panel"
            : "Show the base template blocks and available variables"
        }}</q-tooltip>
      </q-btn>
    </div>
    <VariablesSelector v-show="open" v-bind="props" />
  </aside>
</template>

<script setup lang="ts">
// side panel of the template editor: base template blocks and the
// variables the body can use, collapsed to a strip by default
import { ref } from "vue";
import VariablesSelector from "@/reporting/components/VariablesSelector.vue";
import type { ReportDependencies } from "@/reporting/types";

const props = defineProps<{
  body: string;
  variables: string;
  baseTemplate: number | null;
  dependencies: ReportDependencies;
  dependsOn: string[];
}>();

const open = ref(false);
</script>

<style scoped>
.variables-drawer {
  width: 40px;
  overflow: hidden auto;
  border-right: 1px solid var(--rmm-border);
  background: var(--rmm-surface);
  transition: width 0.15s ease;
}

.variables-drawer.is-open {
  width: 500px;
  max-width: 45vw;
}
</style>
