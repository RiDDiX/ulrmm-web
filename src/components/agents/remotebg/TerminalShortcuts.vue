<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-btn
    v-bind="trigger"
    class="q-ml-sm"
    aria-label="Terminal keyboard shortcuts"
  >
    <!-- a menu, not a tooltip: opens on click, Enter and touch too -->
    <q-menu v-bind="placement" class="terminal-shortcuts">
      <div class="q-mb-xs text-weight-medium">Terminal shortcuts</div>
      <template v-for="(entry, index) in entries" :key="entry.label">
        <q-separator v-if="index === GROUP_START" dark class="q-my-xs" />
        <div class="shortcut">
          <span>{{ entry.label }}</span>
          <span class="shortcut__keys">
            <template v-for="(part, at) in entry.parts" :key="at">
              <kbd v-if="part.key">{{ part.text }}</kbd>
              <span v-else>{{ part.text }}</span>
            </template>
          </span>
        </div>
      </template>
    </q-menu>
  </q-btn>
</template>

<script setup lang="ts">
// "+" joins keys pressed together, "|" separates alternatives
const SHORTCUTS: [string, string][] = [
  ["Copy selected text", "Ctrl+Insert"],
  ["Paste", "Shift+Insert"],
  ["Interrupt command", "Ctrl+C"],
  ["Previous command", "↑"],
  ["Next command", "↓"],
  ["Move by word", "Ctrl+←|Ctrl+→"],
];
// clipboard keys first, then the shell ones
const GROUP_START = 2;

const trigger = { icon: "keyboard", flat: true, round: true, dense: true };
const placement = {
  anchor: "bottom right",
  self: "top right",
} as const;

function partsOf(keys: string) {
  return keys.split("|").flatMap((combo, alt) => {
    const pressed = combo.split("+").flatMap((key, n) => {
      const cap = { text: key, key: true };
      return n ? [{ text: "+", key: false }, cap] : [cap];
    });
    return alt ? [{ text: "/", key: false }, ...pressed] : pressed;
  });
}

const entries = SHORTCUTS.map(([label, keys]) => ({
  label,
  parts: partsOf(keys),
}));
</script>

<style scoped>
/* the tooltip look it had before */
:global(.q-menu.terminal-shortcuts) {
  max-width: 320px;
  padding: 6px 8px;
  color: var(--rmm-tooltip-text);
  border-color: transparent;
  border-radius: var(--rmm-radius-sm);
  background: var(--rmm-tooltip-bg);
  font-size: var(--rmm-fs-xs);
  line-height: 1.4;
}
:global(body.body--dark .q-menu.terminal-shortcuts) {
  border-color: var(--rmm-border-strong);
}
.shortcut {
  display: grid;
  grid-template-columns: minmax(130px, 1fr) auto;
  align-items: center;
  gap: 8px;
  margin-block: 4px;
  white-space: nowrap;
}
.shortcut__keys {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.shortcut kbd {
  display: inline-block;
  min-width: 20px;
  padding: 1px 5px;
  font: inherit;
  font-size: 14px;
  text-align: center;
  color: var(--rmm-tooltip-text);
  background: rgba(255, 255, 255, 0.16);
  border-radius: 4px;
}
</style>
