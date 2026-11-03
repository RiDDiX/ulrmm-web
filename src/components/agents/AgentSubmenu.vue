<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-menu auto-close v-bind="placement">
    <q-list dense :class="{ 'agent-action-menu__submenu': framed }">
      <component
        :is="entry.gate ? GatedEntry : Unwrapped"
        v-for="entry in items"
        :key="entry.id"
        v-bind="entry.gate"
      >
        <q-item
          v-ripple="ripple"
          v-close-popup="closes"
          :dense="dense"
          :disable="entry.disable"
          :aria-label="entry.aria"
          clickable
          @click="entry.run"
        >
          <q-item-section v-if="entry.caption">
            <q-item-label>{{ entry.label }}</q-item-label>
            <q-item-label caption>{{ entry.caption }}</q-item-label>
          </q-item-section>
          <q-item-section v-else>{{ entry.label }}</q-item-section>
        </q-item>
      </component>
    </q-list>
  </q-menu>
</template>

<script setup>
import { computed } from "vue";
import { useQuasar } from "quasar";
import GatedEntry from "@/components/agents/GatedEntry.vue";

const props = defineProps({
  // { id, label, caption, aria, disable, gate, run }; gate is GatedEntry's props
  items: { type: Array, required: true },
  // q-menu anchor and self
  place: { type: Object, required: true },
  framed: Boolean,
  ripple: Boolean,
  closes: Boolean,
  dense: Boolean,
});

// a phone has no room beside the full-width menu, so the submenu opens below
// its entry
const $q = useQuasar();
const placement = computed(() =>
  $q.screen.lt.sm ? { anchor: "bottom left", self: "top left" } : props.place,
);

// entries without a gate get no tooltip wrapper div
const Unwrapped = (_, { slots }) => slots.default?.();
</script>

<style scoped>
.agent-action-menu__submenu {
  min-width: 240px;
}

/* the gate wrapper is a div, so these rows miss q-list's dense spacing */
.agent-action-menu__submenu > div > .q-item {
  min-height: 36px;
  padding: 2px 16px;
}
</style>
