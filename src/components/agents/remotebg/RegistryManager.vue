<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <div>
    <div class="path-bar row items-center text-body2">
      <q-input
        v-model="address"
        v-bind="addressInput"
        @keyup.enter="openTypedPath"
      >
        <template #prepend>
          <q-icon v-bind="pathIcon" />
        </template>
        <template #append>
          <HelpTip
            text="Type a key path such as HKEY_LOCAL_MACHINE\SOFTWARE and press Enter to open it"
          />
        </template>
      </q-input>
    </div>

    <q-splitter v-model="split" :style="splitHeight">
      <template #before>
        <q-tree
          ref="tree"
          v-bind="treeSetup"
          v-model:selected="selected"
          :nodes="nodes"
          :loading="busy"
          @lazy-load="lazyLoad"
          @update:selected="openKey"
        >
          <template #default-header="{ node }">
            <div v-if="node.isLoadMore" class="q-ml-xs q-my-xs">
              <q-btn
                v-bind="moreButton"
                :loading="paging[ownerOfMoreId(node.id)]"
                @click.stop="loadMoreFrom(node)"
              >
                <q-tooltip>Load the next page of subkeys</q-tooltip>
              </q-btn>
            </div>
            <template v-else>
              <div
                class="key-label row no-wrap items-center cursor-pointer"
                @dblclick="toggle(node, editingKey)"
              >
                <q-icon name="folder" size="18px" class="key-icon q-mr-sm" />
                <span v-if="editingKey !== node.id">{{ node.label }}</span>
                <q-input
                  v-else
                  ref="keyInput"
                  v-model="keyText"
                  class="rename-box"
                  dense
                  outlined
                  autofocus
                  @blur="saveKey(node, 'blur')"
                  @keyup.enter="saveKey(node, 'enter')"
                />
                <RowActions :label="`Actions for ${node.label}`" @dblclick.stop>
                  <RegistryKeyMenu v-bind="keyActions(node)" />
                </RowActions>
              </div>
              <q-menu v-bind="contextMenu">
                <RegistryKeyMenu v-bind="keyActions(node)" />
              </q-menu>
            </template>
          </template>
        </q-tree>
      </template>

      <template #after>
        <RegistryValuesPane
          ref="pane"
          v-model:draft="valueText"
          :rows="rows"
          :loading="busy"
          :failure="failureText"
          :renaming="renamingValue"
          @retry="loadRoot"
          @create="addHere"
          @modify="editValue"
          @rename="startValueRename"
          @remove="askRemoveValue"
          @save-name="saveValueName"
        />
      </template>
    </q-splitter>

    <ConfirmDialog
      v-for="prompt in prompts"
      :key="prompt.id"
      v-model="shown[prompt.id]"
      v-bind="prompt.text"
      @confirm="prompt.onConfirm"
    />
    <RegistryValueModal
      v-model="shown.editor"
      :row="editorRow"
      @save="saveValue"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref, watch } from "vue";
import type { QInput } from "quasar";
import * as api from "@/api/agents";
import type { RegistryNode, RegistryValue } from "@/types/agents";
import { notifyWarning } from "@/utils/notify";
import ConfirmDialog from "@/components/ui/ConfirmDialog.vue";
import HelpTip from "@/components/ui/HelpTip.vue";
import RowActions from "@/components/ui/RowActions.vue";
import RegistryKeyMenu from "@/components/agents/remotebg/RegistryKeyMenu.vue";
import RegistryValueModal from "@/components/agents/remotebg/RegistryValueModal.vue";
import RegistryValuesPane from "@/components/agents/remotebg/RegistryValuesPane.vue";
import {
  SEP,
  TEMP_MARK,
  isMoreId,
  ownerOfMoreId,
  parentIdOf,
  subkeysToNodes,
  valueDefaults,
} from "@/components/agents/remotebg/registryPaths";
import {
  contextMenu,
  focusSoon,
  useInlineRename,
} from "@/components/agents/remotebg/registryEditing";
import type { EditSource } from "@/components/agents/remotebg/registryEditing";
import { useRegistryTree } from "@/components/agents/remotebg/useRegistryTree";

const props = defineProps<{ agent_id: string }>();

// the hive list lives under this pseudo key
const ROOT = "Computer";
const NEW_KEY = "New_Key";

const busy = ref(false);
const failure = ref<unknown>(null);
const rows = ref<RegistryValue[]>([]);
const address = ref("");
const keyPath = ref<string>();
const split = ref(25);
const keyInput = ref<QInput | null>(null);
const pane = ref<InstanceType<typeof RegistryValuesPane> | null>(null);
const editorRow = ref({} as RegistryValue);
const doomedKey = ref<RegistryNode | null>(null);
const doomedValue = ref<RegistryValue | null>(null);
const shown = reactive({
  dropKey: false,
  dropValue: false,
  pickKey: false,
  editor: false,
});

const {
  tree,
  nodes,
  selected,
  paging,
  find,
  expand,
  publish,
  setRoots,
  lazyLoad,
  loadMoreFrom,
  addDraft,
  forget,
  unlink,
  swap,
  reloadChildren,
  toggle,
  searching,
  reveal,
} = useRegistryTree(() => props.agent_id, busy);

const keyEdit = useInlineRename(150);
const valueEdit = useInlineRename(150);
const { target: editingKey, text: keyText } = keyEdit;
const { target: renamingValue, text: valueText } = valueEdit;

const addressInput = {
  class: "col",
  dense: true,
  borderless: true,
  inputClass: "rmm-mono",
  "aria-label": "Registry path",
};
const pathIcon = {
  class: "path-bar__icon q-mr-sm",
  name: "fa-solid fa-display",
  size: "16px",
};
const splitHeight = { height: "calc(100vh - 121px)" };
const treeSetup = {
  class: "q-pb-md q-pt-xs",
  nodeKey: "id",
  labelKey: "label",
  selectedColor: "primary",
  noTransition: true,
  lazy: true,
};
const moreButton = {
  label: "Load more keys",
  icon: "expand_more",
  color: "primary",
  size: "sm",
  dense: true,
  flat: true,
  noCaps: true,
};

const failureText = computed(() => {
  if (!failure.value) return "";
  const reply = (failure.value as { response?: { status?: number } }).response;
  if (reply?.status === 403)
    return "Your role cannot view the registry for this agent.";
  return "Registry could not be loaded.";
});

// runs a request under the busy flag; a failure only reaches the console
async function run(job: () => Promise<void>, failureLog: string) {
  busy.value = true;
  try {
    await job();
    return true;
  } catch (error) {
    console.error(failureLog, error);
    return false;
  } finally {
    busy.value = false;
  }
}

async function loadRoot() {
  busy.value = true;
  try {
    address.value = ROOT;
    const reply = await api.fetchAgentRegistry(props.agent_id, ROOT);
    setRoots(reply?.subkeys || []);
    if (reply?.values) rows.value = reply.values;
    keyPath.value = ROOT;
    failure.value = null;
  } catch (error: unknown) {
    console.error("Registry hives could not be read:", error);
    failure.value = error;
  } finally {
    busy.value = false;
  }
}

// selecting a key shows its values
async function openKey(id: string | null) {
  if (!id || id === editingKey.value) return;
  if (id.includes(TEMP_MARK) || isMoreId(id)) return;
  const loaded = await run(async () => {
    const reply = await api.fetchAgentRegistry(props.agent_id, id);
    rows.value = reply?.values || [];
    keyPath.value = id;
  }, "Failed to load registry values:");
  if (!loaded) rows.value = [];
}

async function openTypedPath() {
  if (!address.value) return;
  let target = address.value.trim();
  if (target.startsWith(ROOT)) target = target.replace(/^Computer[\\/]*/, "");
  busy.value = true;
  try {
    await searching(async () => {
      const reply = await api.fetchAgentRegistry(
        props.agent_id,
        target,
        1,
        true,
      );
      keyPath.value = target;
      rows.value = reply.values || [];
      await reveal(target);
    });
  } catch (error) {
    console.error("Registry path could not be opened:", error);
  } finally {
    busy.value = false;
  }
}

function refreshKey(id: string) {
  const node = find(id);
  if (node) {
    openKey(id);
    reloadChildren(node);
    keyPath.value = id;
  }
  selected.value = id;
}

// new keys start as a draft child in rename mode and exist on the agent
// once the name is confirmed
async function addKey(parent: RegistryNode) {
  const listing = await api
    .fetchAgentRegistry(props.agent_id, parent.id)
    .catch((error: unknown) => {
      console.error("Subkeys could not be read before adding a key:", error);
      return null;
    });
  if (!listing) {
    parent.children = [];
    return;
  }
  const kids = subkeysToNodes(parent.id, listing.subkeys || []);
  parent.children = kids;
  expand(parent.id);
  await nextTick();
  const draft = addDraft(parent.id, NEW_KEY);
  kids.unshift(draft);
  selected.value = parent.id;
  publish();
  await nextTick();
  keyEdit.open(draft.id, NEW_KEY, false);
  expand(parent.id);
}

function startKeyRename(node: RegistryNode) {
  keyEdit.open(node.id, node.label);
  focusSoon(() => keyInput.value?.$el);
}

function dropDraft(node: RegistryNode) {
  const parentId = parentIdOf(node.id);
  unlink(parentId, node.id);
  forget(parentId, node.id);
}

async function saveKey(node: RegistryNode, source: EditSource = "enter") {
  if (!keyEdit.ready(source) || busy.value) return;
  const label = (keyText.value ?? "").trim() || NEW_KEY;
  const before = node.id;
  const parentId = parentIdOf(before);
  const after = parentId + label + SEP;
  const isDraft = before.includes(TEMP_MARK);
  await keyEdit.save(async () => {
    try {
      busy.value = true;
      if (isDraft) await api.createRegistryKey(props.agent_id, after);
      else if (before !== after)
        await api.renameRegistryKey(props.agent_id, before, after);
      Object.assign(node, { id: after, label });
      swap(parentId, before, { id: after, label, lazy: true });
      if (isDraft) forget(parentId, before);
      refreshKey(after);
    } catch (error) {
      console.error("Registry key could not be saved:", error);
      if (isDraft) {
        dropDraft(node);
      } else {
        node.label = before.split(SEP).filter(Boolean).pop() as string;
        node.id = before;
        publish();
      }
    } finally {
      busy.value = false;
    }
  });
}

function askRemoveKey(node: RegistryNode) {
  doomedKey.value = node;
  shown.dropKey = true;
}

async function removeKey() {
  const node = doomedKey.value;
  if (!node) return;
  await run(async () => {
    await api.deleteRegistryKey(props.agent_id, node.id);
    const parentId = node.id.split(SEP).slice(0, -2).join(SEP) + SEP;
    unlink(parentId, node.id);
    selected.value = parentId;
    await nextTick();
    openKey(parentId);
  }, "Failed to delete key:");
  shown.dropKey = false;
  doomedKey.value = null;
}

// value dialogs write into keyPath, the key whose values are listed
function addValue(node: RegistryNode | undefined, type: string) {
  const target = node || find(selected.value || "");
  if (!target?.id) {
    shown.pickKey = true;
    return;
  }
  editorRow.value = {
    name: "",
    type,
    data: valueDefaults(type),
    newKey: true,
    isNew: true,
  };
  shown.editor = true;
  keyPath.value = target.id;
}

function editValue(row: RegistryValue) {
  if (row.type === "REG_BINARY") {
    notifyWarning("Modifying REG_BINARY values access denied.");
    return;
  }
  editorRow.value = { ...row };
  shown.editor = true;
}

async function saveValue(row: RegistryValue) {
  const path = keyPath.value;
  if (!path) return;
  await run(async () => {
    const listed = rows.value.find((r) => r.name === row.name);
    const agent = props.agent_id;
    // a multi-string goes as a JSON array, so entries may contain commas
    const data = Array.isArray(row.data)
      ? JSON.stringify(row.data)
      : String(row.data);
    const args = [agent, path, row.name, row.type, data] as const;
    if (listed && !row.newKey) {
      const reply = await api.modifyRegistryValue(...args);
      listed.data = reply.data.data;
    } else {
      // the list shown when the request went out
      const list = rows.value;
      const reply = await api.createRegistryValue(...args);
      list.push(reply.data);
    }
    shown.editor = false;
  }, "Failed to save value:");
}

function askRemoveValue(row: RegistryValue) {
  doomedValue.value = row;
  shown.dropValue = true;
}

async function removeValue() {
  const row = doomedValue.value;
  const path = keyPath.value;
  if (!row || !path) return;
  await run(async () => {
    await api.deleteRegistryValue(props.agent_id, path, row.name);
    rows.value = rows.value.filter((r) => r.name !== row.name);
  }, "Failed to delete registry value:");
  shown.dropValue = false;
  doomedValue.value = null;
}

function startValueRename(row: RegistryValue) {
  valueEdit.open(row.name, row.name);
  pane.value?.focusRename();
}

async function saveValueName(row: RegistryValue, source: EditSource) {
  if (!valueEdit.ready(source) || !keyPath.value) return;
  const name = valueText.value.trim() || row.name;
  if (name === row.name) {
    renamingValue.value = null;
    return;
  }
  await valueEdit.save(async () => {
    try {
      busy.value = true;
      await api.renameRegistryValue(
        props.agent_id,
        keyPath.value,
        row.name,
        name,
      );
      const listed = rows.value.find((r) => r.name === row.name);
      if (listed) listed.name = name;
    } catch (error) {
      console.error("Registry value could not be renamed:", error);
    } finally {
      busy.value = false;
    }
  });
}

// "KEY" from a New menu creates a subkey, any other entry a value
function addIn(node: RegistryNode, type: string) {
  if (type === "KEY") addKey(node);
  else addValue(node, type);
}

function addHere(type: string) {
  if (type !== "KEY") return addValue(undefined, type);
  const parent = selected.value ? find(selected.value) : null;
  if (parent) addKey(parent);
  else shown.pickKey = true;
}

const keyActions = (node: RegistryNode) => ({
  hive: !node.id.slice(0, -1).includes(SEP),
  onCreate: (type: string) => addIn(node, type),
  onRefresh: () => refreshKey(node.id),
  onRename: () => startKeyRename(node),
  onRemove: () => askRemoveKey(node),
});

const prompts = [
  {
    id: "dropKey",
    text: {
      title: "Delete registry key?",
      message:
        "This permanently deletes the key and all of its subkeys on the agent.",
      type: "confirm",
      okLabel: "Delete",
      icon: "warning",
      iconColor: "warning",
    },
    onConfirm: removeKey,
  },
  {
    id: "dropValue",
    text: {
      title: "Delete registry value?",
      message:
        "Deleting certain registry values could cause system instability. The value is permanently deleted on the agent.",
      type: "confirm",
      okLabel: "Delete",
      icon: "warning",
      iconColor: "warning",
    },
    onConfirm: removeValue,
  },
  {
    id: "pickKey",
    text: {
      title: "Select a key first",
      message:
        "Select a hive or key in the tree, then create the new key or value in it.",
      icon: "info",
      iconColor: "info",
    },
    // only an OK button
    onConfirm: undefined,
  },
] as const;

watch(keyPath, (path) => {
  if (path) address.value = path;
});

onMounted(loadRoot);
</script>

<style scoped>
.path-bar {
  padding-inline: 6px;
  border: 1px solid var(--rmm-border);
  background: var(--rmm-surface-2);
}
.path-bar__icon,
.key-icon {
  color: var(--rmm-text-subtle);
}
.key-label {
  padding-right: 10px;
  text-wrap: nowrap;
}
.rename-box {
  max-width: 200px;
}
</style>
