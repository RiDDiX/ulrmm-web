<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <div class="subtable-tabs">
    <div
      class="subtable-tabs__bar"
      :class="{ 'subtable-tabs__bar--compact': compact }"
    >
      <q-resize-observer @resize="barWidth = $event.width" />
      <q-tabs v-model="tabModel" v-bind="navProps" class="subtable-tabs__nav">
        <q-tab
          v-for="tab in stripTabs"
          :key="tab.name"
          content-class="min-width"
          :name="tab.name"
          :icon="tab.icon"
          :label="compact ? undefined : tab.label"
          :aria-label="tab.label"
        >
          <q-tooltip v-if="compact">{{ tab.label }}</q-tooltip>
        </q-tab>
        <!-- the rest of the tabs; shows the open one when it lives here.
             q-anchor--skip makes the whole tab the menu's anchor -->
        <q-tab
          v-if="moreTabs.length"
          class="subtable-tabs__more"
          content-class="min-width q-anchor--skip"
          :name="moreTab ? moreTab.name : MORE"
          :icon="moreTab ? moreTab.icon : 'more_horiz'"
          :label="compact ? undefined : moreTab ? moreTab.label : 'More'"
          :aria-label="moreTab ? `${moreTab.label}, more tabs` : 'More tabs'"
          aria-haspopup="menu"
          :aria-expanded="moreOpen ? 'true' : 'false'"
          @keyup.space="moreOpen = !moreOpen"
        >
          <q-icon name="arrow_drop_down" class="subtable-tabs__caret" />
          <q-tooltip v-if="compact && !moreOpen">{{
            moreTab ? `${moreTab.label} (more tabs)` : "More tabs"
          }}</q-tooltip>
          <q-menu
            v-model="moreOpen"
            anchor="bottom left"
            self="top left"
            @keydown="onMenuKeydown"
          >
            <q-list class="subtable-tabs__menu">
              <q-item
                v-for="(tab, i) in moreTabs"
                :key="tab.name"
                v-close-popup
                clickable
                :active="tab.name === subtab"
                :aria-current="tab.name === subtab ? 'true' : undefined"
                :autofocus="moreTab ? tab.name === subtab : i === 0"
                @click="subtab = tab.name"
              >
                <q-item-section avatar>
                  <q-icon :name="tab.icon" size="18px" />
                </q-item-section>
                <q-item-section>{{ tab.label }}</q-item-section>
              </q-item>
            </q-list>
          </q-menu>
        </q-tab>
      </q-tabs>
    </div>
    <q-separator />
    <q-tab-panels
      ref="panels"
      v-model="subtab"
      :animated="false"
      class="subtable-tabs__panels"
    >
      <q-tab-panel
        v-for="name in visibleNames"
        :key="name"
        :name="name"
        class="q-pa-none"
      >
        <slot v-if="name === 'overview'" name="overview" />
        <component :is="panelComponent(name)" v-else />
      </q-tab-panel>
    </q-tab-panels>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useStore } from "vuex";
import PerformanceTab from "@/components/agents/PerformanceTab.vue";
import VaultTab from "@/components/agents/VaultTab.vue";
import DebugTab from "@/components/agents/DebugTab.vue";
import ChecksTab from "@/components/agents/ChecksTab.vue";
import WinUpdateTab from "@/components/agents/WinUpdateTab.vue";
import TimelineTab from "@/components/agents/TimelineTab.vue";
import AssetsTab from "@/components/agents/AssetsTab.vue";
import AppsTab from "@/components/agents/AppsTab.vue";
import NotesTab from "@/components/agents/NotesTab.vue";
import EncryptionTab from "@/components/agents/EncryptionTab.vue";
import VulnsTab from "@/components/agents/VulnsTab.vue";
import AutomatedTasksTab from "@/components/agents/AutomatedTasksTab.vue";
import HistoryTab from "@/components/agents/HistoryTab.vue";
import AuditTab from "@/components/agents/AuditTab.vue";
import SoftwareTab from "@/components/agents/SoftwareTab.vue";
import DriversTab from "@/components/agents/DriversTab.vue";

defineOptions({ name: "SubTableTabs" });

// "overview" is filled through the parent's slot of the same name
const TABS = [
  ["overview", "info", "Overview"],
  ["performance", "speed", "Performance", PerformanceTab],
  ["checks", "checklist", "Checks", ChecksTab],
  ["tasks", "task", "Tasks", AutomatedTasksTab],
  ["patches", "system_update", "Patches"],
  ["software", "inventory_2", "Software", SoftwareTab],
  ["apps", "system_update_alt", "Apps", AppsTab],
  ["drivers", "settings_input_component", "Drivers", DriversTab],
  ["vulnerabilities", "gpp_maybe", "Vulnerabilities", VulnsTab],
  ["history", "history", "History", HistoryTab],
  ["timeline", "timeline", "Timeline", TimelineTab],
  ["notes", "sticky_note_2", "Notes", NotesTab],
  ["vault", "lock", "Vault", VaultTab],
  ["assets", "developer_board", "Assets", AssetsTab],
  ["encryption", "key", "Encryption", EncryptionTab],
  ["debug", "bug_report", "Debug", DebugTab],
  ["audit", "travel_explore", "Audit", AuditTab],
].map(([name, icon, label, component]) => ({ name, icon, label, component }));

const ALL_TABS = TABS.map((tab) => tab.name);

// the most used tabs stay in the strip, the rest go under "More"
const STRIP = new Set([
  "overview",
  "performance",
  "checks",
  "tasks",
  "patches",
  "software",
  "history",
  "notes",
]);
const MORE = "more";

const navProps = {
  activeColor: "primary",
  indicatorColor: "primary",
  align: "left",
  dense: true,
  inlineLabel: true,
  narrowIndicator: true,
  noCaps: true,
  outsideArrows: true,
};

// old links still carry ?tab=summary for the overview
const LEGACY = { summary: "overview" };

const props = defineProps({
  activeTabs: { type: Array, default: undefined },
});
const enabledTabs = () => props.activeTabs ?? ALL_TABS;

const store = useStore();
const route = useRoute();
const router = useRouter();

const agentPlatform = computed(() => store.state.agentPlatform);
// brew and mas keep their own tab; on Windows winget is the second source of
// the Patches tab (?src=winget), Linux has no app updates
const appsPlatform = computed(() => agentPlatform.value === "darwin");
const winget = computed(
  () => agentPlatform.value === "windows" && route.query.src === "winget",
);

function tabAvailable(name) {
  if (!enabledTabs().includes(name)) return false;
  if (name === "assets" || name === "drivers")
    return agentPlatform.value === "windows";
  if (name === "apps") return appsPlatform.value;
  return true;
}

function panelComponent(name) {
  if (name === "patches") return winget.value ? AppsTab : WinUpdateTab;
  return TABS.find((tab) => tab.name === name).component;
}

// a ?tab= from a link wins over the default tab; assets and drivers are
// windows-only, so a link naming one on a posix agent falls back
const wanted = LEGACY[route.query.tab] || route.query.tab;
const subtab = ref(wanted && tabAvailable(wanted) ? wanted : enabledTabs()[0]);

// a ?tab= with no panel behind it is corrected in the URL right away;
// without one the URL stays as it was opened
function writeTab(value) {
  router.replace({ query: { ...route.query, tab: value } });
}
if (route.query.tab && route.query.tab !== subtab.value) writeTab(subtab.value);

const visibleTabs = computed(() =>
  TABS.filter((tab) => tabAvailable(tab.name)),
);
const visibleNames = computed(() => visibleTabs.value.map((tab) => tab.name));
const stripTabs = computed(() =>
  visibleTabs.value.filter((tab) => STRIP.has(tab.name)),
);
const moreTabs = computed(() =>
  visibleTabs.value.filter((tab) => !STRIP.has(tab.name)),
);
const moreTab = computed(() =>
  moreTabs.value.find((tab) => tab.name === subtab.value),
);
const moreOpen = ref(false);

// the "More" tab only opens its menu, it never becomes the panel
const tabModel = computed({
  get: () => subtab.value,
  set: (value) => {
    if (value !== MORE) subtab.value = value;
  },
});

// arrow keys, Home and End walk the menu items
function onMenuKeydown(e) {
  const items = [...e.currentTarget.querySelectorAll(".q-item")];
  const last = items.length - 1;
  const at = items.indexOf(document.activeElement);
  const target = {
    ArrowDown: Math.min(at + 1, last),
    ArrowUp: Math.max(at - 1, 0),
    Home: 0,
    End: last,
  }[e.key];
  if (target === undefined) return;
  e.preventDefault();
  items[target].focus();
}

// ~115px per labelled tab ("More" counts as one; it can carry the longest
// label). Narrower than that shows icons, not labels
const barWidth = ref(0);
const compact = computed(
  () => barWidth.value < (stripTabs.value.length + 1) * 115,
);

// the assets and apps panels depend on the platform; an agent switch can
// leave the ref pointing at a tab that just lost its panel
watch(agentPlatform, () => {
  if (
    ["assets", "apps"].includes(subtab.value) &&
    !tabAvailable(subtab.value)
  ) {
    subtab.value = enabledTabs()[0];
  }
});

// the open tab lives in the URL for reloads and bookmarks. replace keeps
// history flat; the equality guard skips a navigation that closes menus
watch(subtab, (value) => {
  if (route.query.tab !== value) writeTab(value);
});

// Back button or a link elsewhere (a status pill, a KPI chip) changing ?tab=
// updates the panel without remounting this component
watch(
  () => route.query.tab,
  (value) => {
    if (!value || value === subtab.value) return;
    if (tabAvailable(value)) subtab.value = value;
    else writeTab(subtab.value);
  },
);

// tabHeight is this panel's clientHeight. Don't derive it from the hero; the
// pills and actions wrap. Math.floor, or a fractional pixel lets a table
// stick out and grow a second scrollbar
const panels = ref(null);
let observer;
let frame;
function updateTabHeight() {
  const height = panels.value?.$el?.clientHeight;
  if (height) store.state.tabHeight = `${Math.floor(height)}px`;
}
onMounted(() => {
  // resizing out of the observer callback keeps the browser from reporting
  // an undelivered resize loop
  observer = new ResizeObserver(() => {
    window.cancelAnimationFrame(frame);
    frame = window.requestAnimationFrame(updateTabHeight);
  });
  if (panels.value?.$el) observer.observe(panels.value.$el);
  updateTabHeight();
});
onBeforeUnmount(() => {
  window.cancelAnimationFrame(frame);
  observer?.disconnect();
});
</script>

<style scoped>
.subtable-tabs {
  display: flex;
  min-height: 0;
  flex: 1 1 auto;
  flex-direction: column;
  color: var(--rmm-text);
  background: var(--rmm-bg);
}

.subtable-tabs__bar {
  position: relative;
  display: flex;
  height: 37px;
  flex-shrink: 0;
  align-items: center;
  padding: 0 8px;
  background: var(--rmm-surface);
}

.subtable-tabs > :deep(.q-separator) {
  flex-shrink: 0;
  background: var(--rmm-border);
}

/* can get narrower than the tabs. Quasar's scroll arrows take over */
.subtable-tabs__nav {
  min-width: 0;
  min-height: 37px;
  flex: 0 1 auto;
}

.subtable-tabs__nav :deep(.q-tab) {
  min-height: 37px;
  padding: 0 12px;
  color: var(--rmm-text-muted);
  transition:
    color 0.15s ease-out,
    background-color 0.15s ease-out;
}

.subtable-tabs__nav :deep(.q-tab:hover) {
  background: var(--rmm-surface-3);
}

/* the strip clips anything outside a tab; keep the focus ring inside */
.subtable-tabs__nav :deep(.q-tab:focus-visible) {
  outline-offset: -2px;
}

.subtable-tabs__nav :deep(.q-tab--active) {
  color: var(--rmm-accent-text);
}

.subtable-tabs__nav :deep(.q-tab__icon) {
  font-size: 16px;
}

.subtable-tabs__nav :deep(.q-tab__label) {
  font-size: var(--rmm-fs-md);
}

.subtable-tabs__nav :deep(.q-tab__indicator) {
  border-radius: 2px 2px 0 0;
}

/* arrows have their own gutter, drop Quasar's text-shadow */
.subtable-tabs__nav :deep(.q-tabs__arrow) {
  color: var(--rmm-text-muted);
  text-shadow: none;
}

.subtable-tabs__bar--compact .subtable-tabs__nav :deep(.q-tab) {
  padding: 0 6px;
}

.subtable-tabs__caret {
  font-size: 18px;
}

.subtable-tabs__menu {
  min-width: 180px;
  padding: 4px;
}

/* the panel is the one scroll container under the hero; the tables inside
   size to tabHeight (measured from this element) and scroll their rows */
.subtable-tabs__panels {
  min-height: 240px;
  flex: 1 1 auto;
  background: var(--rmm-bg);
}

.subtable-tabs__panels :deep(.q-panel) {
  overflow-y: auto;
}
</style>
