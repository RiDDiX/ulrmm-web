<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<script setup>
import IntegrationsContextMenu from "@/components/ui/IntegrationsContextMenu.vue";

// entries come from DashboardClientsPanel: separators, the two submenus
// (URL actions, reporting) and plain actions with run()
defineProps({
  entries: { type: Array, required: true },
  urlActions: { type: Array, default: () => [] },
});
</script>

<template>
  <q-list dense style="min-width: 200px">
    <template v-for="entry in entries" :key="entry.key">
      <q-separator v-if="entry.separator" />
      <q-item
        v-else-if="entry.submenu"
        v-ripple="!!entry.load"
        clickable
        @click="entry.load?.()"
      >
        <q-item-section side
          ><q-icon :name="entry.icon" class="client-node-menu__icon"
        /></q-item-section>
        <q-item-section>{{ entry.label }}</q-item-section>
        <q-item-section side
          ><q-icon name="keyboard_arrow_right"
        /></q-item-section>
        <q-menu v-if="entry.load" anchor="top end" self="top start" auto-close>
          <q-list>
            <q-item
              v-for="act in urlActions"
              :key="act.id"
              v-close-popup
              clickable
              dense
              @click="entry.pick(act)"
              >{{ act.name }}</q-item
            >
          </q-list>
        </q-menu>
        <IntegrationsContextMenu v-else :id="entry.id" :type="entry.kind" />
      </q-item>
      <q-item
        v-else
        v-close-popup
        clickable
        :class="entry.class"
        @click="entry.run"
      >
        <q-item-section v-if="entry.icon" side
          ><q-icon
            :name="entry.icon"
            :class="{
              'client-node-menu__icon': entry.class !== 'text-negative',
            }"
        /></q-item-section>
        <q-item-section v-if="entry.boxed">
          <q-item-label>{{ entry.label }}</q-item-label>
          <q-item-label caption>{{ entry.caption }}</q-item-label>
        </q-item-section>
        <q-item-section v-else>
          {{ entry.label }}
          <q-item-label v-if="entry.caption" caption>{{
            entry.caption
          }}</q-item-label>
        </q-item-section>
      </q-item>
    </template>
  </q-list>
</template>

<style scoped>
/* the subtle colour of the device action menu; Delete keeps its red */
.client-node-menu__icon {
  color: var(--rmm-text-subtle);
}
</style>
