// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

import { nextTick, ref } from "vue";
import type { Ref } from "vue";
import type { QTree } from "quasar";
import { fetchAgentRegistry } from "@/api/agents";
import type { RegistryNode } from "@/types/agents";
import {
  SEP,
  TEMP_MARK,
  findNode,
  loadMoreNode,
  ownerOfMoreId,
  parentIdOf,
  subkeysToNodes,
} from "@/components/agents/remotebg/registryPaths";
import type { SubkeyInfo } from "@/components/agents/remotebg/registryPaths";

type Done = (children: RegistryNode[]) => void;

const REVEAL_SETTLE_MS = 150;
const REVEAL_SCROLL: ScrollIntoViewOptions = {
  block: "center",
  inline: "nearest",
  behavior: "smooth",
};

// key tree of one agent: lazy subkeys, paging and opening a typed path
export function useRegistryTree(agentId: () => string, busy: Ref<boolean>) {
  const tree = ref<QTree | null>(null);
  const nodes = ref<RegistryNode[]>([]);
  const selected = ref<string | null>(null);
  const paging = ref<Record<string, boolean>>({});

  // last page fetched per key, unsaved new keys per parent and the lazy-load
  // callbacks that wait on a fetch already running
  const pages: Record<string, number> = {};
  const drafts: Record<string, RegistryNode[]> = {};
  const waiting: Record<string, Done[]> = {};
  let wholeHive = false;

  const find = (id: string) => findNode(nodes.value, id);
  const expand = (id: string) => tree.value?.setExpanded(id, true);

  // q-tree only notices nested edits through a fresh copy
  function publish() {
    nodes.value = JSON.parse(JSON.stringify(nodes.value));
  }

  function setRoots(keys: SubkeyInfo[]) {
    nodes.value = keys.map((key) => ({
      id: key.name + SEP,
      label: key.name,
      lazy: key.hasSubkeys,
    }));
  }

  async function lazyLoad(load: { node: RegistryNode; done: Done }) {
    const id = load.node.id;
    const known = find(id)?.children;
    if (known?.length) {
      load.done(known.filter((child) => !child.isLoadMore));
      return;
    }
    if (waiting[id]) {
      waiting[id].push(load.done);
      return;
    }
    waiting[id] = [load.done];
    const answer = (list: RegistryNode[]) =>
      waiting[id]?.forEach((cb) => cb(list));
    busy.value = true;
    try {
      const page = pages[id] || 1;
      const reply = await fetchAgentRegistry(agentId(), id, page, wholeHive);
      const kids = subkeysToNodes(id, reply?.subkeys || []);
      pages[id] = reply?.page ?? page;
      if (reply?.has_more) kids.push(loadMoreNode(id));
      const holder = find(id);
      if (holder) {
        holder.children = kids;
        publish();
      }
      answer(kids);
    } catch (err) {
      console.error("Failed to load registry children:", err);
      answer(drafts[id] || []);
    } finally {
      delete waiting[id];
      busy.value = false;
    }
  }

  async function loadMoreFrom(placeholder: RegistryNode) {
    const owner = find(ownerOfMoreId(placeholder.id));
    if (!owner?.id) return;
    const id = owner.id;
    paging.value[id] = true;
    try {
      const page = (pages[id] || 1) + 1;
      const reply = await fetchAgentRegistry(agentId(), id, page);
      const shown = (owner.children ?? []).filter((child) => !child.isLoadMore);
      owner.children = shown.concat(subkeysToNodes(id, reply?.subkeys || []));
      pages[id] = reply?.page ?? page;
      if (reply?.has_more) owner.children.push(loadMoreNode(id));
      publish();
    } catch (err) {
      console.error("Failed to load more subkeys:", err);
    } finally {
      paging.value[id] = false;
    }
  }

  // an unsaved key shown under parentId until its name is confirmed
  function addDraft(parentId: string, label: string) {
    const draft: RegistryNode = {
      id: parentId + TEMP_MARK,
      label,
      lazy: false,
    };
    (drafts[parentId] ??= []).unshift(draft);
    return draft;
  }

  function forget(parentId: string, id: string) {
    const list = drafts[parentId];
    if (list) drafts[parentId] = list.filter((draft) => draft.id !== id);
  }

  function unlink(parentId: string, id: string) {
    const parent = find(parentId);
    if (!parent?.children) return;
    parent.children = parent.children.filter((child) => child.id !== id);
    publish();
  }

  function swap(parentId: string, oldId: string, next: RegistryNode) {
    const list = find(parentId)?.children;
    const at = list ? list.findIndex((child) => child.id === oldId) : -1;
    if (!list || at < 0) return;
    list[at] = next;
    publish();
  }

  // drops what is known below node and fetches it again from page one
  function reloadChildren(node: RegistryNode) {
    node.children = [];
    pages[node.id] = 0;
    drafts[node.id] = [];
    expand(node.id);
    lazyLoad({
      node,
      done: (kids) => {
        node.children = kids;
        publish();
      },
    });
  }

  // double click opens or closes a key, except around a key being edited
  function toggle(node: RegistryNode, editing: string | null) {
    if (editing?.includes(node.id)) return;
    const qtree = tree.value;
    if (qtree) qtree.setExpanded(node.id, !qtree.isExpanded(node.id));
  }

  // lazy loads started while this runs fetch every page of the key
  async function searching(job: () => Promise<void>) {
    wholeHive = true;
    try {
      await job();
    } finally {
      wholeHive = false;
    }
  }

  async function reveal(path: string) {
    if (!tree.value) return;
    let id = "";
    for (const part of path.split(SEP).filter(Boolean)) {
      id += part + SEP;
      let hit = find(id);
      const parent = hit ? null : find(parentIdOf(id));
      if (parent) {
        await new Promise<void>((resolve) =>
          lazyLoad({ node: parent, done: () => resolve() }),
        );
        hit = find(id);
      }
      if (hit) expand(hit.id);
    }
    selected.value = id;
    await nextTick();
    await new Promise((resolve) => setTimeout(resolve, REVEAL_SETTLE_MS));
    nextTick(() => {
      const root: HTMLElement | undefined = tree.value?.$el;
      if (!root || !selected.value) return;
      root
        .querySelector(".q-tree__node--selected")
        ?.scrollIntoView?.(REVEAL_SCROLL);
    });
  }

  return {
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
  };
}
