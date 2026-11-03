<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <div class="variables-selector">
    <q-list dense>
      <q-item-label header>
        Base Template Blocks
        <span v-if="copied === 'block'" class="text-positive float-right">
          Copied
        </span>
      </q-item-label>
      <q-item
        v-for="block in blocks"
        :key="block.tag"
        clickable
        :inset-level="block.used ? 1 : 0"
        @click="copy(emptyBlock(block.name), 'block')"
      >
        <q-item-section v-if="!block.used" avatar>
          <q-icon name="warning" color="warning">
            <q-tooltip>
              This block is not used in the template yet. Click it to copy it,
              then paste it into the template.
            </q-tooltip>
          </q-icon>
        </q-item-section>
        <q-item-section class="rmm-mono">{{ block.name }}</q-item-section>
        <q-tooltip>Copy this block's tags to the clipboard</q-tooltip>
      </q-item>
      <q-item v-if="blocks.length === 0">
        <q-item-section class="rmm-muted text-caption">
          No blocks to fill. A Base Template lists its blocks here.
        </q-item-section>
      </q-item>
    </q-list>

    <q-list dense>
      <q-item-label header>
        Variables
        <q-spinner v-if="isLoading" size="14px" class="q-ml-sm" />
        <span v-if="copied === 'variable'" class="text-positive float-right">
          Copied
        </span>
      </q-item-label>
      <q-item v-for="name in missing" :key="`dep-${name}`">
        <q-item-section side>
          <q-icon name="warning" color="warning" size="xs" />
        </q-item-section>
        <q-item-section>
          Missing value for dependency: {{ name }} . Open Preview to set values
        </q-item-section>
      </q-item>
      <q-item v-for="path in emptyQueries" :key="`empty-${path}`">
        <q-item-section side>
          <q-icon name="warning" color="warning" size="xs" />
        </q-item-section>
        <q-item-section>
          Data Query: {{ path }} returned no results
        </q-item-section>
      </q-item>
      <q-item
        v-for="row in rows"
        :key="row.path"
        clickable
        class="variables-selector__row"
        @click="copy(variableSnippet(row.path, row.type), 'variable')"
      >
        <q-item-section side>
          <q-badge outline color="primary" :label="row.type">
            <q-tooltip>Type of this variable</q-tooltip>
          </q-badge>
        </q-item-section>
        <q-item-section class="rmm-mono ellipsis">
          {{ row.path }}
          <q-tooltip>
            {{
              row.type === "Array"
                ? `${row.path} - click to copy a for loop over it`
                : `${row.path} - click to copy it`
            }}
          </q-tooltip>
        </q-item-section>
        <q-item-section v-if="row.type === 'Array'" side>
          <q-badge
            class="variables-selector__loop cursor-pointer"
            color="secondary"
            label="for loop"
            @click.stop="copy(variableSnippet(row.path, row.type), 'variable')"
          >
            <q-tooltip>Copy a for loop over this list</q-tooltip>
          </q-badge>
        </q-item-section>
      </q-item>
    </q-list>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { copyToClipboard } from "quasar";
import { useDebounceFn } from "@vueuse/core";
import {
  useReportHTMLTemplatesShared,
  useVariableAnalysisShared,
} from "@/reporting/stores";
import {
  baseTemplateBlocks,
  emptyBlock,
  isArrayType,
  variableSnippet,
} from "@/reporting/editing";
import { missingDependencies } from "@/reporting/utils";

import type { ReportDependencies } from "@/reporting/types";

const props = defineProps<{
  body: string;
  variables: string;
  baseTemplate: number | null;
  dependencies: ReportDependencies;
  dependsOn: string[];
}>();

const { htmlTemplates } = useReportHTMLTemplatesShared;
const { variableAnalysis, isLoading, getVariableAnalysis } =
  useVariableAnalysisShared;

const blocks = computed(() => {
  const base = htmlTemplates.value.find(
    (template) => template.id === props.baseTemplate,
  );
  return base ? baseTemplateBlocks(base.html, props.body) : [];
});

const missing = computed(() =>
  missingDependencies(props.dependsOn, props.dependencies),
);

const emptyQueries = computed(() =>
  Object.entries(variableAnalysis.value)
    .filter(([, type]) => type.includes("0 Results"))
    .map(([path]) => path),
);

const rows = computed(() =>
  Object.entries(variableAnalysis.value).map(([path, type]) => ({
    path,
    type: isArrayType(type) ? "Array" : type,
  })),
);

let active = true;

// the server cannot resolve agent, client or site values it does not have
function analyze() {
  if (!active) return;
  const builtin = ["client", "site", "agent"].filter((name) =>
    props.dependsOn.includes(name),
  );
  if (missingDependencies(builtin, props.dependencies).length > 0) return;
  getVariableAnalysis(props.variables, props.dependencies);
}

const analyzeLater = useDebounceFn(analyze, 5000);

watch(() => props.variables, analyzeLater);
watch(() => props.dependencies, analyzeLater, { deep: true });

onMounted(analyze);

const copied = ref<"block" | "variable" | null>(null);
let copiedTimer: ReturnType<typeof setTimeout> | undefined;

async function copy(text: string, what: "block" | "variable") {
  try {
    await copyToClipboard(text);
  } catch (e) {
    console.error(e);
    return;
  }
  copied.value = what;
  clearTimeout(copiedTimer);
  copiedTimer = setTimeout(() => (copied.value = null), 2000);
}

onBeforeUnmount(() => {
  active = false;
  clearTimeout(copiedTimer);
});
</script>

<style scoped>
.variables-selector__loop {
  visibility: hidden;
}

.variables-selector__row:hover .variables-selector__loop,
.variables-selector__row:focus-within .variables-selector__loop {
  visibility: visible;
}
</style>
