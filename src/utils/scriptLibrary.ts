// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

import type { Script } from "@/types/scripts";
import type { AgentPlatformType } from "@/types/agents";

// community script for the "Activate via KMS" device action
export const KMS_ACTIVATION_FILE = "win_system_kms_activation.ps1";

// filters, facet counts and category groups for the script library.
// groups combine with AND, values inside a group with OR.

export type QuickFilter = "all" | "favorites" | "mine" | "community" | "hidden";
export type FacetKey = "platforms" | "shells" | "categories";

export interface LibraryFilters {
  quick: QuickFilter;
  platforms: string[];
  shells: string[];
  categories: string[];
}

export interface FacetCounts {
  quick: Record<QuickFilter, number>;
  platforms: Record<string, number>;
  shells: Record<string, number>;
  categories: Record<string, number>;
}

export interface CategoryItem {
  value: string;
  label: string;
  count: number;
}

export interface CategoryGroup {
  name: string;
  total: number;
  items: CategoryItem[];
}

// fields the device picker needs from a GET /agents/ row
export interface RunTarget {
  agent_id: string;
  hostname: string;
  display_name?: string | null;
  plat: AgentPlatformType;
  status?: string;
  client_name?: string;
  site_name?: string;
}

type LibraryScript = Pick<
  Script,
  | "name"
  | "description"
  | "category"
  | "filename"
  | "shell"
  | "supported_platforms"
  | "variables"
  | "script_type"
  | "favorite"
  | "hidden"
>;

export const ANY_PLATFORM = "any";
export const OTHER_GROUP = "Other";
export const UNCATEGORIZED = "Uncategorized";

export const QUICK_FILTERS: {
  value: QuickFilter;
  label: string;
  icon: string;
}[] = [
  { value: "all", label: "All scripts", icon: "apps" },
  { value: "favorites", label: "Favorites", icon: "star_outline" },
  { value: "mine", label: "My scripts", icon: "person_outline" },
  { value: "community", label: "Community", icon: "groups" },
  { value: "hidden", label: "Hidden", icon: "visibility_off" },
];

export const PLATFORM_FACETS = [
  { value: "windows", label: "Windows", icon: "mdi-microsoft-windows" },
  { value: "linux", label: "Linux", icon: "mdi-linux" },
  { value: "darwin", label: "macOS", icon: "mdi-apple" },
  { value: "freebsd", label: "FreeBSD", icon: "mdi-freebsd" },
  { value: ANY_PLATFORM, label: "Any platform", icon: "devices" },
];

export const SHELL_LABELS: Record<string, string> = {
  powershell: "PowerShell",
  cmd: "Batch",
  python: "Python",
  shell: "Shell",
  nushell: "Nushell",
  deno: "Deno",
};

export function shellLabel(shell?: string): string {
  return SHELL_LABELS[shell ?? ""] ?? shell ?? "";
}

export function platformLabel(plat: string): string {
  return PLATFORM_FACETS.find((p) => p.value === plat)?.label ?? plat;
}

export function emptyFilters(): LibraryFilters {
  return { quick: "all", platforms: [], shells: [], categories: [] };
}

export function hasFacetFilters(f: LibraryFilters): boolean {
  return (
    f.quick !== "all" ||
    f.platforms.length > 0 ||
    f.shells.length > 0 ||
    f.categories.length > 0
  );
}

export function isCommunity(s: Pick<Script, "script_type">): boolean {
  return s.script_type === "builtin";
}

export function scriptPlatforms(
  s: Pick<Script, "supported_platforms">,
): string[] {
  return s.supported_platforms?.length ? s.supported_platforms : [ANY_PLATFORM];
}

export function categoryKey(s: Pick<Script, "category">): string {
  return s.category?.trim() || UNCATEGORIZED;
}

// "Linux / Monitoring" -> group "Linux", label "Monitoring".
// no " / ": group Other, label is the whole category
export function splitCategory(category: string): {
  group: string;
  label: string;
} {
  const i = category.indexOf(" / ");
  if (i > 0 && i + 3 < category.length) {
    return { group: category.slice(0, i), label: category.slice(i + 3) };
  }
  return { group: OTHER_GROUP, label: category };
}

const haystacks = new WeakMap<object, string>();

function haystack(s: LibraryScript): string {
  let text = haystacks.get(s);
  if (text === undefined) {
    text = [
      s.name,
      s.description,
      s.category,
      s.filename,
      ...(s.variables ?? []).flatMap((v) => [v.name, v.label]),
    ]
      .filter(Boolean)
      .join("\n")
      .toLowerCase();
    haystacks.set(s, text);
  }
  return text;
}

// each whitespace-separated term has to show up somewhere
export function matchesSearch(s: LibraryScript, query: string): boolean {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return true;
  const text = haystack(s);
  return terms.every((t) => text.includes(t));
}

export function matchesQuick(s: LibraryScript, quick: QuickFilter): boolean {
  if (quick === "hidden") return !!s.hidden;
  if (s.hidden) return false;
  if (quick === "favorites") return !!s.favorite;
  if (quick === "mine") return !isCommunity(s);
  if (quick === "community") return isCommunity(s);
  return true;
}

function matches(
  s: LibraryScript,
  f: LibraryFilters,
  query: string,
  skip?: FacetKey | "quick",
): boolean {
  if (skip !== "quick" && !matchesQuick(s, f.quick)) return false;
  if (
    skip !== "platforms" &&
    f.platforms.length &&
    !scriptPlatforms(s).some((p) => f.platforms.includes(p))
  )
    return false;
  if (skip !== "shells" && f.shells.length && !f.shells.includes(s.shell))
    return false;
  if (
    skip !== "categories" &&
    f.categories.length &&
    !f.categories.includes(categoryKey(s))
  )
    return false;
  return matchesSearch(s, query);
}

export function filterScripts<T extends LibraryScript>(
  scripts: T[],
  f: LibraryFilters,
  query: string,
): T[] {
  return scripts.filter((s) => matches(s, f, query));
}

function bump(counts: Record<string, number>, key: string) {
  counts[key] = (counts[key] ?? 0) + 1;
}

// a group's counts ignore its own selection and apply the other filters
export function facetCounts(
  scripts: LibraryScript[],
  f: LibraryFilters,
  query: string,
): FacetCounts {
  const counts: FacetCounts = {
    quick: { all: 0, favorites: 0, mine: 0, community: 0, hidden: 0 },
    platforms: {},
    shells: {},
    categories: {},
  };
  for (const s of scripts) {
    if (matches(s, f, query, "quick")) {
      for (const q of QUICK_FILTERS) {
        if (matchesQuick(s, q.value)) counts.quick[q.value]++;
      }
    }
    if (matches(s, f, query, "platforms")) {
      scriptPlatforms(s).forEach((p) => bump(counts.platforms, p));
    }
    if (matches(s, f, query, "shells")) bump(counts.shells, s.shell);
    if (matches(s, f, query, "categories")) {
      bump(counts.categories, categoryKey(s));
    }
  }
  return counts;
}

const byName = (a: string, b: string) =>
  a.localeCompare(b, undefined, { sensitivity: "base", numeric: true });

export function groupCategories(
  categories: string[],
  counts: Record<string, number>,
): CategoryGroup[] {
  const groups = new Map<string, CategoryGroup>();
  for (const value of new Set(categories)) {
    const { group, label } = splitCategory(value);
    let g = groups.get(group);
    if (!g) {
      g = { name: group, total: 0, items: [] };
      groups.set(group, g);
    }
    const count = counts[value] ?? 0;
    g.items.push({ value, label, count });
    g.total += count;
  }
  const list = [...groups.values()];
  list.forEach((g) => g.items.sort((a, b) => byName(a.label, b.label)));
  return list.sort((a, b) =>
    a.name === OTHER_GROUP
      ? 1
      : b.name === OTHER_GROUP
        ? -1
        : byName(a.name, b.name),
  );
}
