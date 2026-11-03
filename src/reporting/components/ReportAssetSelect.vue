<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide">
    <q-card class="q-dialog-plugin rmm-dialog--md">
      <DialogHeader
        title="Insert Image"
        subtitle="Adds an image tag at the cursor in the template"
      />
      <q-form @submit="onDialogOK(output)">
        <q-card-section class="q-gutter-y-sm">
          <div class="row items-center q-gutter-x-md">
            <span class="rmm-label">Image source</span>
            <q-radio
              v-model="source"
              val="link"
              label="Link"
              dense
              @update:model-value="reset"
            />
            <q-radio
              v-model="source"
              val="asset"
              label="Report Asset"
              dense
              @update:model-value="reset"
            />
          </div>

          <template v-if="source === 'link'">
            <q-input
              v-model="alt"
              dense
              outlined
              label="Text"
              hint="Alternative text shown when the image cannot load"
            />
            <q-input
              v-model="url"
              dense
              outlined
              label="URL"
              hint="Full image address, e.g. https://example.com/logo.png"
            />
          </template>

          <template v-else>
            <div class="asset-tree q-pa-xs">
              <q-tree
                v-if="hasFiles"
                :nodes="nodes"
                node-key="path"
                label-key="name"
                children-key="children"
                default-expand-all
                no-selection-unset
                :selected="selected"
                @update:selected="select"
              />
              <EmptyState
                v-else-if="!loading"
                icon="perm_media"
                title="No report assets yet"
                text="Upload images under Reports Manager > Report Assets, then pick them here."
              />
              <q-inner-loading :showing="loading" />
            </div>
          </template>

          <q-input
            :model-value="output"
            dense
            outlined
            readonly
            class="rmm-mono"
            :label="source === 'link' ? 'Output' : 'Selected'"
          />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat no-caps label="Cancel" @click="onDialogCancel" />
          <q-btn
            unelevated
            no-caps
            color="primary"
            label="Insert"
            type="submit"
          />
        </q-card-actions>
      </q-form>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useDialogPluginComponent } from "quasar";
import DialogHeader from "@/components/ui/DialogHeader.vue";
import EmptyState from "@/components/ui/EmptyState.vue";
import { fetchReportAssetTree } from "@/reporting/api";
import { escapeHtml } from "@/utils/patchStatus";

import type { AssetTreeNode, ReportTemplateType } from "@/reporting/types";

const props = defineProps<{ templateType: ReportTemplateType }>();

defineEmits([...useDialogPluginComponent.emits]);

const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } =
  useDialogPluginComponent();

const source = ref<"link" | "asset">("link");
const alt = ref("");
const url = ref("");
const selected = ref<string | null>(null);

const loading = ref(false);
const nodes = ref<AssetTreeNode[]>([]);
const files = new Map<string, AssetTreeNode>();

function reset() {
  alt.value = "";
  url.value = "";
  selected.value = null;
}

const output = computed(() => {
  if (!url.value) return "";
  return props.templateType === "markdown"
    ? `![${alt.value}](${url.value})`
    : `<img src="${escapeHtml(url.value)}" alt="${escapeHtml(alt.value)}">`;
});

// folders only group files and cannot be picked
function prepare(node: AssetTreeNode): AssetTreeNode {
  if (node.type === "file") {
    files.set(node.path, node);
    return { ...node, selectable: true, icon: node.icon || "image" };
  }
  return {
    ...node,
    selectable: false,
    icon: node.icon || "folder",
    children: (node.children ?? []).map(prepare),
  };
}

const hasFiles = computed(() => nodes.value.length > 0 && files.size > 0);

function select(path: string | null) {
  const node = path ? files.get(path) : undefined;
  if (!node?.id) return;
  selected.value = node.path;
  alt.value = node.name;
  url.value = `asset://${node.id}`;
}

onMounted(async () => {
  loading.value = true;
  try {
    files.clear();
    nodes.value = (await fetchReportAssetTree()).map(prepare);
  } catch (e) {
    console.error(e);
  }
  loading.value = false;
});
</script>

<style scoped>
.asset-tree {
  position: relative;
  min-height: 120px;
  max-height: 45vh;
  overflow: auto;
  border: 1px solid var(--rmm-border);
  border-radius: var(--rmm-radius-sm);
}
</style>
