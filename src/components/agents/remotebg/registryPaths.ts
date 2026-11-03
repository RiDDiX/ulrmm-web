// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

import type { RegistryNode } from "@/types/agents";

export const SEP = "\\";
export const TEMP_MARK = "__temp_new_key__";
const MORE_MARK = "__load_more__";

export interface SubkeyInfo {
  name: string;
  hasSubkeys: boolean;
}

export const moreIdFor = (parentId: string) => parentId + MORE_MARK;
export const isMoreId = (id: string) => id.endsWith(MORE_MARK);
export const ownerOfMoreId = (id: string) =>
  id.slice(0, id.length - MORE_MARK.length);

export function childId(parentId: string, name: string) {
  return parentId.endsWith(SEP)
    ? `${parentId}${name}${SEP}`
    : `${parentId}${SEP}${name}${SEP}`;
}

// id of the key that contains `id` (keys always end in a separator)
export function parentIdOf(id: string) {
  return id.split(SEP).filter(Boolean).slice(0, -1).join(SEP) + SEP;
}

export function subkeysToNodes(parentId: string, keys: SubkeyInfo[]) {
  return keys.map<RegistryNode>((k) => ({
    id: childId(parentId, k.name),
    label: k.name,
    lazy: k.hasSubkeys,
  }));
}

export function loadMoreNode(parentId: string): RegistryNode {
  return {
    id: moreIdFor(parentId),
    label: "Load More",
    isLoadMore: true,
    lazy: false,
  };
}

export function findNode(
  nodes: RegistryNode[],
  id: string,
): RegistryNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    const hit = node.children ? findNode(node.children, id) : null;
    if (hit) return hit;
  }
  return null;
}

export function valueDefaults(type: string) {
  if (type === "REG_MULTI_SZ") return [];
  return type === "REG_DWORD" || type === "REG_QWORD" ? 0 : "";
}
