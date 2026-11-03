<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <nav class="script-rail" aria-label="Script filters">
    <!-- one tab stop. arrows, Home and End move between filters -->
    <div
      ref="scrollEl"
      class="script-rail__scroll"
      role="toolbar"
      aria-orientation="vertical"
      aria-label="Filters"
      @focusin="onFocusIn"
      @keydown="onKeydown"
    >
      <div class="script-rail__section">
        <button
          v-for="q in QUICK_FILTERS"
          :key="q.value"
          type="button"
          class="script-rail__item"
          :class="{ 'script-rail__item--active': filters.quick === q.value }"
          :aria-pressed="filters.quick === q.value"
          :data-quick="q.value"
          :data-rail-key="`quick:${q.value}`"
          :tabindex="tabindexOf(`quick:${q.value}`)"
          @click="update({ quick: q.value })"
        >
          <q-icon :name="q.icon" size="18px" class="script-rail__icon" />
          <span class="script-rail__label">{{ q.label }}</span>
          <span class="script-rail__count rmm-num">{{
            counts.quick[q.value]
          }}</span>
        </button>
      </div>

      <div
        class="script-rail__section"
        role="group"
        aria-labelledby="rail-plat"
      >
        <div id="rail-plat" class="script-rail__heading">Platform</div>
        <button
          v-for="p in PLATFORM_FACETS"
          :key="p.value"
          type="button"
          class="script-rail__item"
          :class="itemClass('platforms', p.value)"
          :aria-pressed="filters.platforms.includes(p.value)"
          :data-facet="`platform:${p.value}`"
          :data-rail-key="`platform:${p.value}`"
          :tabindex="tabindexOf(`platform:${p.value}`)"
          @click="toggle('platforms', p.value)"
        >
          <q-icon :name="p.icon" size="18px" class="script-rail__icon" />
          <span class="script-rail__label">{{ p.label }}</span>
          <span class="script-rail__count rmm-num">{{
            counts.platforms[p.value] ?? 0
          }}</span>
        </button>
      </div>

      <div
        v-if="shells.length"
        class="script-rail__section"
        role="group"
        aria-labelledby="rail-shell"
      >
        <div id="rail-shell" class="script-rail__heading">Language</div>
        <button
          v-for="sh in shells"
          :key="sh"
          type="button"
          class="script-rail__item"
          :class="itemClass('shells', sh)"
          :aria-pressed="filters.shells.includes(sh)"
          :data-facet="`shell:${sh}`"
          :data-rail-key="`shell:${sh}`"
          :tabindex="tabindexOf(`shell:${sh}`)"
          @click="toggle('shells', sh)"
        >
          <span class="script-rail__label">{{ shellLabel(sh) }}</span>
          <span class="script-rail__count rmm-num">{{
            counts.shells[sh] ?? 0
          }}</span>
        </button>
      </div>

      <div
        v-if="groups.length"
        class="script-rail__section"
        role="group"
        aria-labelledby="rail-cat"
      >
        <div id="rail-cat" class="script-rail__heading">Category</div>
        <div v-for="g in groups" :key="g.name" class="script-rail__group">
          <button
            type="button"
            class="script-rail__item script-rail__group-head"
            :aria-expanded="isOpen(g.name)"
            :data-group="g.name"
            :data-rail-key="`group:${g.name}`"
            :tabindex="tabindexOf(`group:${g.name}`)"
            @click="toggleGroup(g.name)"
          >
            <q-icon
              name="chevron_right"
              size="18px"
              class="script-rail__chevron"
              :class="{ 'script-rail__chevron--open': isOpen(g.name) }"
            />
            <span class="script-rail__label">{{ g.name }}</span>
            <span
              v-if="selectedIn(g)"
              class="script-rail__selected-dot"
              aria-hidden="true"
            ></span>
            <span class="script-rail__count rmm-num">{{ g.total }}</span>
          </button>
          <div v-if="isOpen(g.name)" class="script-rail__group-items">
            <button
              v-for="c in g.items"
              :key="c.value"
              type="button"
              class="script-rail__item script-rail__item--nested"
              :class="itemClass('categories', c.value)"
              :aria-pressed="filters.categories.includes(c.value)"
              :aria-label="`${g.name} / ${c.label}, ${c.count} scripts`"
              :data-facet="`category:${c.value}`"
              :data-rail-key="`category:${c.value}`"
              :tabindex="tabindexOf(`category:${c.value}`)"
              @click="toggle('categories', c.value)"
            >
              <span class="script-rail__label">{{ c.label }}</span>
              <span class="script-rail__count rmm-num">{{ c.count }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="script-rail__footer">
      <q-toggle
        dense
        size="sm"
        :model-value="showCommunityScripts"
        label="Show community scripts in script pickers"
        @update:model-value="$emit('toggle-community', $event)"
      />
      <HelpTip
        text="Only changes the script pickers in run dialogs, checks, tasks and alert actions. This library always lists community scripts; the Community filter shows only them."
      />
    </div>
  </nav>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import HelpTip from "@/components/ui/HelpTip.vue";
import {
  QUICK_FILTERS,
  PLATFORM_FACETS,
  shellLabel,
  groupCategories,
  type CategoryGroup,
  type FacetCounts,
  type FacetKey,
  type LibraryFilters,
} from "@/utils/scriptLibrary";

const props = defineProps<{
  filters: LibraryFilters;
  counts: FacetCounts;
  shells: string[];
  categories: string[];
  openGroups: string[];
  showCommunityScripts: boolean;
}>();

const emit = defineEmits<{
  (e: "update:filters", value: LibraryFilters): void;
  (e: "update:openGroups", value: string[]): void;
  (e: "toggle-community", value: boolean): void;
}>();

const groups = computed(() =>
  groupCategories(props.categories, props.counts.categories),
);

function update(patch: Partial<LibraryFilters>) {
  emit("update:filters", { ...props.filters, ...patch });
}

function toggle(key: FacetKey, value: string) {
  const list = props.filters[key];
  update({
    [key]: list.includes(value)
      ? list.filter((v) => v !== value)
      : [...list, value],
  });
}

function itemClass(key: FacetKey, value: string) {
  const active = props.filters[key].includes(value);
  const count =
    key === "platforms"
      ? props.counts.platforms[value]
      : key === "shells"
        ? props.counts.shells[value]
        : props.counts.categories[value];
  return {
    "script-rail__item--active": active,
    "script-rail__item--empty": !active && !count,
  };
}

function isOpen(name: string) {
  return props.openGroups.includes(name);
}

function toggleGroup(name: string) {
  emit(
    "update:openGroups",
    isOpen(name)
      ? props.openGroups.filter((g) => g !== name)
      : [...props.openGroups, name],
  );
}

// roving tabindex. the rail is one tab stop: last focused filter,
// or the active quick filter
const scrollEl = ref<HTMLElement | null>(null);
const focusKey = ref("");
const railKeys = computed(() => [
  ...QUICK_FILTERS.map((q) => `quick:${q.value}`),
  ...PLATFORM_FACETS.map((p) => `platform:${p.value}`),
  ...props.shells.map((sh) => `shell:${sh}`),
  ...groups.value.flatMap((g) => [
    `group:${g.name}`,
    ...(isOpen(g.name) ? g.items.map((c) => `category:${c.value}`) : []),
  ]),
]);
const currentKey = computed(() =>
  railKeys.value.includes(focusKey.value)
    ? focusKey.value
    : `quick:${props.filters.quick}`,
);

function tabindexOf(key: string) {
  return key === currentKey.value ? 0 : -1;
}

function onFocusIn(e: FocusEvent) {
  const key = (e.target as HTMLElement).dataset?.railKey;
  if (key) focusKey.value = key;
}

function onKeydown(e: KeyboardEvent) {
  if (e.altKey || e.ctrlKey || e.metaKey) return;
  const keys = railKeys.value;
  const last = keys.length - 1;
  const i = keys.indexOf(currentKey.value);
  const to = (
    {
      ArrowDown: Math.min(i + 1, last),
      ArrowUp: Math.max(i - 1, 0),
      Home: 0,
      End: last,
    } as Record<string, number>
  )[e.key];
  if (to === undefined) return;
  e.preventDefault();
  scrollEl.value
    ?.querySelector<HTMLElement>(`[data-rail-key="${CSS.escape(keys[to])}"]`)
    ?.focus();
}

function selectedIn(g: CategoryGroup) {
  return g.items.some((c) => props.filters.categories.includes(c.value));
}
</script>

<style scoped>
.script-rail {
  display: flex;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  border-right: 1px solid var(--rmm-border);
  background: var(--rmm-surface-2);
  color: var(--rmm-text);
}

.script-rail__scroll {
  min-height: 0;
  flex: 1;
  overflow-y: auto;
  padding: 10px 8px;
}

.script-rail__section + .script-rail__section {
  margin-top: 14px;
}

.script-rail__heading {
  padding: 0 8px 4px;
  color: var(--rmm-text-muted);
  font-size: var(--rmm-fs-xs);
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.script-rail__item {
  display: flex;
  width: 100%;
  min-height: 32px;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  border: 0;
  border-radius: var(--rmm-radius-sm);
  color: var(--rmm-text);
  background: transparent;
  font: inherit;
  font-size: 13px;
  text-align: left;
  cursor: pointer;
}

.script-rail__item:hover {
  background: var(--rmm-surface-3);
}

.script-rail__item:focus-visible {
  outline: 2px solid var(--rmm-focus);
  outline-offset: -2px;
}

.script-rail__item--active,
.script-rail__item--active:hover {
  color: var(--rmm-accent-text);
  background: var(--rmm-accent-soft);
  font-weight: 600;
}

.script-rail__item--empty .script-rail__label {
  color: var(--rmm-text-muted);
}

.script-rail__item--nested {
  padding-left: 34px;
}

.script-rail__icon,
.script-rail__chevron {
  flex-shrink: 0;
  color: var(--rmm-text-muted);
}

.script-rail__item--active .script-rail__icon {
  color: inherit;
}

.script-rail__chevron {
  transition: transform 0.15s ease;
}

.script-rail__chevron--open {
  transform: rotate(90deg);
}

.script-rail__group-head {
  font-weight: 600;
}

.script-rail__label {
  overflow: hidden;
  min-width: 0;
  flex: 1;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.script-rail__count {
  flex-shrink: 0;
  color: var(--rmm-text-muted);
  font-size: var(--rmm-fs-xs);
  font-weight: 500;
}

.script-rail__item--active .script-rail__count {
  color: inherit;
}

.script-rail__selected-dot {
  width: 6px;
  height: 6px;
  flex-shrink: 0;
  border-radius: 50%;
  background: var(--rmm-accent);
}

.script-rail__footer {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 10px 12px;
  border-top: 1px solid var(--rmm-border);
  font-size: 13px;
}
</style>
