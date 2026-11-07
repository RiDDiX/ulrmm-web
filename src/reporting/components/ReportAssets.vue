<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-dialog
    ref="dialogRef"
    maximized
    transition-show="slide-up"
    transition-hide="slide-down"
    @show="openFolder(root.key)"
    @hide="onDialogHide"
  >
    <q-card class="column no-wrap">
      <DialogHeader
        title="Report Assets"
        subtitle="Images and files that report templates can embed"
      />

      <div class="rmm-toolbar">
        <template v-if="canManageReports">
          <q-btn
            unelevated
            no-caps
            dense
            color="primary"
            icon="upload"
            label="Upload"
            class="q-px-sm"
            :disable="!current || loading"
            @click="upload"
          >
            <q-tooltip>Upload files into the selected folder</q-tooltip>
          </q-btn>
          <q-btn
            flat
            no-caps
            dense
            icon="create_new_folder"
            label="New Folder"
            class="q-px-sm"
            :disable="!current || loading"
            @click="newFolder"
          >
            <q-tooltip>Create a folder inside the selected folder</q-tooltip>
          </q-btn>
          <q-btn-dropdown
            flat
            no-caps
            dense
            label="Bulk Actions"
            class="q-px-sm"
            :disable="ticked.length === 0"
          >
            <q-list dense>
              <q-item
                clickable
                v-close-popup
                class="text-negative"
                @click="remove(ticked)"
              >
                <q-item-section side>
                  <q-icon name="delete" color="negative" />
                </q-item-section>
                <q-item-section>Delete</q-item-section>
              </q-item>
            </q-list>
          </q-btn-dropdown>
        </template>
        <q-space />
        <span class="rmm-muted rmm-num">
          {{
            ticked.length
              ? `${ticked.length} selected`
              : "Tick rows to use Bulk Actions"
          }}
        </span>
      </div>

      <q-splitter v-model="treeWidth" class="col" style="min-height: 0">
        <template #before>
          <q-tree
            ref="treeRef"
            v-model:expanded="expanded"
            v-model:selected="selectedKey"
            :nodes="nodes"
            class="q-pa-sm"
            @lazy-load="loadFolder"
            label-key="label"
            node-key="key"
            no-selection-unset
            children-key="children"
            @update:selected="openFolder"
          />
        </template>
        <template #after>
          <q-table
            v-model:selected="ticked"
            dense
            flat
            class="rmm-table full-height"
            :columns="columns"
            :rows="rows"
            :loading="loading"
            row-key="id"
            :pagination="{ rowsPerPage: 0, sortBy: 'type', descending: true }"
            :rows-per-page-options="[0]"
            selection="multiple"
            binary-state-sort
            virtual-scroll
            v-sortable-headers
          >
            <template #header-selection="scope">
              <q-checkbox
                v-model="scope.selected"
                dense
                aria-label="Select everything in this folder"
              />
            </template>

            <template #loading>
              <q-inner-loading showing color="primary" />
            </template>

            <template #no-data>
              <EmptyState
                v-if="!loading"
                class="full-width"
                icon="folder_open"
                title="This folder is empty"
                text="Add files or folders with the toolbar above."
              />
            </template>

            <template #body="props">
              <q-tr
                :props="props"
                class="cursor-pointer"
                @dblclick="props.row.type === 'folder' && openRow(props.row)"
              >
                <q-menu context-menu>
                  <MenuList :items="menuItems(props.row)" />
                </q-menu>
                <q-td auto-width>
                  <q-checkbox
                    v-model="props.selected"
                    dense
                    :aria-label="`Select ${props.row.name}`"
                  />
                </q-td>
                <q-td key="name" :props="props">
                  <q-icon
                    :name="
                      props.row.type === 'folder' ? 'folder' : 'description'
                    "
                    :color="
                      props.row.type === 'folder' ? 'yellow-9' : undefined
                    "
                    size="20px"
                    class="q-mr-sm"
                  />
                  {{ props.row.name }}
                </q-td>
                <q-td key="type" :props="props">
                  {{ props.row.type === "folder" ? "Folder" : "File" }}
                </q-td>
                <q-td key="size" :props="props">
                  {{ props.row.size === null ? "" : fmtBytes(props.row.size) }}
                </q-td>
                <q-td key="actions" :props="props" @click.stop>
                  <RowActions :label="`Actions for ${props.row.name}`">
                    <MenuList :items="menuItems(props.row)" />
                  </RowActions>
                </q-td>
              </q-tr>
            </template>
          </q-table>
        </template>
      </q-splitter>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import {
  QTree,
  uid,
  useDialogPluginComponent,
  useQuasar,
  type QTableColumn,
} from "quasar";
import DialogHeader from "@/components/ui/DialogHeader.vue";
import EmptyState from "@/components/ui/EmptyState.vue";
import RowActions from "@/components/ui/RowActions.vue";
import { sortableHeaders as vSortableHeaders } from "@/utils/sortableHeaders";
import MenuList from "@/components/ui/MenuList.vue";
import ReportAssetUpload from "@/reporting/components/ReportAssetUpload.vue";
import {
  createReportAssetFolder,
  fetchReportAssets,
  removeReportAssets,
  renameReportAsset,
} from "@/reporting/api";
import { downloadReportAsset } from "@/reporting/actions";
import { useReportingPerms } from "@/reporting/permissions";
import { assetNameRule } from "@/reporting/utils";
import { fmtBytes } from "@/utils/format";

import type { AssetNode, UploadAssetsResponse } from "@/reporting/types";
import type { MenuItem } from "@/types/menu";

interface FileEntry {
  key: string;
  label: string;
  path: string;
  type: "file";
  // bytes
  size: number;
  asset_id?: string;
}

interface FolderEntry {
  key: string;
  label: string;
  path: string;
  type: "folder";
  icon: string;
  iconColor?: string;
  lazy: boolean;
  // set by the tree once loaded; folders only, files live in `files`
  children?: FolderEntry[];
  files: FileEntry[];
}

interface Row {
  id: string;
  name: string;
  path: string;
  type: "folder" | "file";
  size: number | null;
}

defineEmits([...useDialogPluginComponent.emits]);

const $q = useQuasar();
const { dialogRef, onDialogHide } = useDialogPluginComponent();
const { canManageReports } = useReportingPerms();

const treeRef = ref<QTree | null>(null);
const treeWidth = ref(25);
const loading = ref(false);

function folderEntry(label: string, path: string): FolderEntry {
  return {
    key: uid(),
    label,
    path,
    type: "folder",
    icon: "folder",
    iconColor: "yellow-9",
    lazy: true,
    files: [],
  };
}

function fileEntry(
  label: string,
  path: string,
  size: string | number | null,
  assetId?: string,
): FileEntry {
  return {
    key: uid(),
    label,
    path,
    type: "file",
    size: Number(size ?? 0),
    asset_id: assetId,
  };
}

const root: FolderEntry = {
  ...folderEntry("Assets", "/"),
  icon: "storage",
  iconColor: "primary",
};
const nodes = ref<FolderEntry[]>([root]);
const selectedKey = ref<string>(root.key);
const expanded = ref<string[]>([]);
const ticked = ref<Row[]>([]);

function findFolder(
  key: string,
  list: FolderEntry[] = nodes.value,
): FolderEntry | undefined {
  for (const folder of list) {
    if (folder.key === key) return folder;
    const found = folder.children && findFolder(key, folder.children);
    if (found) return found;
  }
  return undefined;
}

const current = computed(() => findFolder(selectedKey.value));

const rows = computed<Row[]>(() => {
  const folder = current.value;
  if (!folder) return [];
  return [
    ...(folder.children ?? []).map((entry) => ({
      id: entry.key,
      name: entry.label,
      path: entry.path,
      type: "folder" as const,
      size: null,
    })),
    ...folder.files.map((entry) => ({
      id: entry.key,
      name: entry.label,
      path: entry.path,
      type: "file" as const,
      size: entry.size,
    })),
  ];
});

const columns: QTableColumn<Row>[] = [
  { name: "name", label: "Name", field: "name", align: "left", sortable: true },
  { name: "type", label: "Type", field: "type", align: "left", sortable: true },
  { name: "size", label: "Size", field: "size", align: "left", sortable: true },
  { name: "actions", label: "Actions", field: () => "", align: "right" },
];

const lastSegment = (path: string) =>
  path.split("/").filter(Boolean).pop() ?? path;

async function loadFolder({
  node,
  done,
  fail,
}: {
  node: FolderEntry;
  done: (children: FolderEntry[]) => void;
  fail: () => void;
}) {
  loading.value = true;
  try {
    const entries: AssetNode[] = await fetchReportAssets(node.path);
    const folder = findFolder(node.key);
    if (folder)
      folder.files = entries
        .filter((entry) => entry.type === "file")
        .map((entry) => fileEntry(entry.name, entry.path, entry.size));
    done(
      entries
        .filter((entry) => entry.type === "folder")
        .map((entry) => folderEntry(entry.name, entry.path)),
    );
  } catch (e) {
    console.error(e);
    fail();
  }
  loading.value = false;
}

// the tree only exists while the dialog is shown, so the first call comes
// from @show, not from mounting
function openFolder(key: string) {
  ticked.value = [];
  treeRef.value?.setExpanded(key, true);
}

function openRow(row: Row) {
  selectedKey.value = row.id;
  openFolder(row.id);
}

function askName(title: string, value = ""): Promise<string | null> {
  return new Promise((resolve) => {
    let result: string | null = null;
    $q.dialog({
      title,
      prompt: {
        model: value,
        type: "text",
        isValid: (name: string) => assetNameRule(name) === true,
        rules: [assetNameRule],
      },
      cancel: true,
      persistent: true,
    })
      .onOk((name: string) => (result = name.trim()))
      .onDismiss(() => resolve(result));
  });
}

async function newFolder() {
  const folder = current.value;
  if (!folder) return;
  const name = await askName("Enter a folder name");
  if (!name) return;
  try {
    const path = await createReportAssetFolder(folder.path, name);
    // a folder that never loaded gets its children here; its first expand
    // still asks the server for the full listing
    (folder.children ??= []).push(folderEntry(lastSegment(path), path));
  } catch (e) {
    console.error(e);
  }
}

function upload() {
  const folder = current.value;
  if (!folder) return;
  $q.dialog({
    component: ReportAssetUpload,
    componentProps: { parentPath: folder.path },
  }).onOk(
    ({
      files,
      response,
    }: {
      files: File[];
      response: UploadAssetsResponse;
    }) => {
      for (const file of files) {
        const stored = response[file.name];
        if (!stored) continue;
        folder.files.push(
          fileEntry(
            lastSegment(stored.filename),
            stored.filename,
            file.size,
            stored.id,
          ),
        );
      }
    },
  );
}

function rebase(folder: FolderEntry, from: string, to: string) {
  const move = (path: string) =>
    path.startsWith(`${from}/`) ? to + path.slice(from.length) : path;
  for (const file of folder.files) file.path = move(file.path);
  for (const child of folder.children ?? []) {
    child.path = move(child.path);
    rebase(child, from, to);
  }
}

async function rename(row: Row) {
  const folder = current.value;
  if (!folder) return;
  const name = await askName(
    row.type === "folder" ? "Enter a new folder name" : "Enter a new file name",
    row.name,
  );
  if (!name || name === row.name) return;
  try {
    const path = await renameReportAsset(row.path, name);
    const entry =
      row.type === "folder"
        ? folder.children?.find((child) => child.key === row.id)
        : folder.files.find((file) => file.key === row.id);
    if (!entry) return;
    const oldPath = entry.path;
    entry.label = lastSegment(path);
    entry.path = path;
    if (entry.type === "folder") rebase(entry, oldPath, path);
  } catch (e) {
    console.error(e);
  }
}

function remove(targets: Row[]) {
  const folder = current.value;
  if (!folder || targets.length === 0) return;
  const count = targets.length;
  $q.dialog({
    title: count === 1 ? "Delete asset?" : `Delete ${count} assets?`,
    message:
      count === 1
        ? "You are about to delete an asset. This action isn't reversible"
        : `You are about to delete ${count} assets. This action isn't reversible`,
    persistent: true,
    cancel: true,
    ok: { label: "Delete", color: "negative" },
  }).onOk(async () => {
    try {
      await removeReportAssets(targets.map((row) => row.path));
    } catch (e) {
      console.error(e);
      return;
    }
    const gone = new Set(targets.map((row) => row.id));
    if (folder.children)
      folder.children = folder.children.filter((child) => !gone.has(child.key));
    folder.files = folder.files.filter((file) => !gone.has(file.key));
    ticked.value = ticked.value.filter((row) => !gone.has(row.id));
  });
}

function menuItems(row: Row): MenuItem[] {
  const items: MenuItem[] = [];
  if (canManageReports.value)
    items.push({
      label: "Rename",
      icon: "edit",
      action: () => rename(row),
    });
  items.push({
    label: "Download",
    icon: "cloud_download",
    action: () => downloadReportAsset({ path: row.path, name: row.name }),
  });
  if (canManageReports.value)
    items.push(
      { separator: true },
      {
        label: "Delete",
        icon: "delete",
        negative: true,
        action: () => remove([row]),
      },
    );
  return items;
}
</script>
