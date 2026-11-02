<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <component
    :is="clickable ? 'button' : 'span'"
    :type="clickable ? 'button' : undefined"
    class="tag-chip"
    :class="{ 'tag-chip--clickable': clickable, 'tag-chip--active': active }"
    :style="{ '--tag-color': color }"
    :aria-pressed="clickable ? active : undefined"
    :title="hint || tag.name"
    @click="clickable && $emit('click', tag)"
  >
    <span class="tag-chip__dot" aria-hidden="true" />
    <span class="tag-chip__name">{{ tag.name }}</span>
    <span v-if="count !== null" class="tag-chip__count">{{ count }}</span>
    <button
      v-if="removable"
      type="button"
      class="tag-chip__remove"
      :aria-label="`Remove tag ${tag.name}`"
      @click.stop="$emit('remove', tag)"
    >
      <q-icon name="close" size="12px" />
    </button>
  </component>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { tagColor } from "@/utils/groupRules";

const props = withDefaults(
  defineProps<{
    tag: { id: number; name: string; color?: string };
    clickable?: boolean;
    removable?: boolean;
    active?: boolean;
    count?: number | null;
    // what a click does, as the hover text
    hint?: string;
  }>(),
  {
    clickable: false,
    removable: false,
    active: false,
    count: null,
    hint: "",
  },
);
defineEmits(["click", "remove"]);

// the text keeps the text colour; the tag colour is dot, border and tint
const color = computed(() => tagColor(props.tag.color));
</script>

<style scoped>
.tag-chip {
  display: inline-flex;
  max-width: 160px;
  min-height: 22px;
  align-items: center;
  gap: 5px;
  padding: 1px 8px;
  border: 1px solid color-mix(in srgb, var(--tag-color) 45%, transparent);
  border-radius: 999px;
  color: var(--rmm-text);
  background: color-mix(in srgb, var(--tag-color) 12%, var(--rmm-surface));
  font: inherit;
  font-size: var(--rmm-fs-xs);
  font-weight: 600;
  line-height: 1.4;
  vertical-align: middle;
}

.tag-chip--clickable {
  cursor: pointer;
}

.tag-chip--clickable:hover {
  border-color: var(--tag-color);
}

.tag-chip--active {
  border-color: var(--tag-color);
  box-shadow: inset 0 0 0 1px var(--tag-color);
}

.tag-chip:focus-visible,
.tag-chip__remove:focus-visible {
  outline: 2px solid var(--rmm-focus);
  outline-offset: 2px;
}

.tag-chip__dot {
  width: 7px;
  height: 7px;
  flex-shrink: 0;
  border-radius: 50%;
  background: var(--tag-color);
}

.tag-chip__name {
  overflow: hidden;
  min-width: 0;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tag-chip__count {
  color: var(--rmm-text-muted);
  font-variant-numeric: tabular-nums;
}

.tag-chip__remove {
  display: inline-flex;
  /* 20px to hit, the chip keeps its height */
  margin: -4px -7px -4px -3px;
  padding: 4px;
  border: 0;
  border-radius: 50%;
  color: var(--rmm-text-muted);
  background: transparent;
  cursor: pointer;
}

.tag-chip__remove:hover {
  color: var(--rmm-text);
  background: color-mix(in srgb, var(--tag-color) 25%, transparent);
}
</style>
