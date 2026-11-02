<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <article
    class="widget-card"
    :class="`widget-card--${widget.size}`"
    :aria-labelledby="titleId"
    :data-type="widget.type"
  >
    <header class="widget-card__head">
      <q-icon
        :name="meta?.icon || 'widgets'"
        size="20px"
        class="widget-card__icon"
        aria-hidden="true"
      />
      <div class="widget-card__heading">
        <h2 :id="titleId" class="widget-card__title">{{ title }}</h2>
        <div class="widget-card__meta">
          <template v-if="failure && data">
            <span class="widget-card__failed">Update failed</span>
            ·
            <button type="button" class="widget-card__retry" @click="load()">
              Retry
            </button>
          </template>
          <span v-else-if="loading && !data">Loading…</span>
          <time
            v-else-if="updatedAt"
            :datetime="updatedAt.toISOString()"
            :title="formatDate(updatedAt.toISOString())"
            >Updated {{ clock(updatedAt) }}</time
          >
        </div>
      </div>
      <q-btn
        flat
        round
        dense
        icon="drag_indicator"
        class="widget-card__action"
        :data-move="widget.id"
        :aria-label="`Move ${title}, position ${index + 1} of ${count}`"
        aria-keyshortcuts="ArrowLeft ArrowRight Home End"
        aria-haspopup="menu"
        :aria-expanded="moveOpen ? 'true' : 'false'"
        @keydown="onMoveKey"
      >
        <q-tooltip v-if="!moveOpen"
          >Move. Arrow keys, Home and End move it too</q-tooltip
        >
        <q-menu v-model="moveOpen" auto-close>
          <q-list dense class="widget-card__menu">
            <q-item
              v-for="move in MOVES"
              :key="move.where"
              clickable
              :disable="
                move.edge === 'start' ? index === 0 : index === count - 1
              "
              @click="emit('move', move.where)"
            >
              <q-item-section avatar>
                <q-icon :name="move.icon" />
              </q-item-section>
              <q-item-section>{{ move.label }}</q-item-section>
            </q-item>
          </q-list>
        </q-menu>
      </q-btn>
      <q-btn
        flat
        round
        dense
        icon="more_vert"
        class="widget-card__action"
        :aria-label="`Options for ${title}`"
        aria-haspopup="menu"
        :aria-expanded="menuOpen ? 'true' : 'false'"
      >
        <q-tooltip v-if="!menuOpen">Size, settings and remove</q-tooltip>
        <q-menu v-model="menuOpen" auto-close>
          <q-list dense class="widget-card__menu">
            <q-item-label header>Size</q-item-label>
            <q-item
              v-for="size in SIZES"
              :key="size"
              clickable
              :active="widget.size === size"
              @click="emit('resize', size)"
            >
              <q-item-section avatar>
                <q-icon
                  :name="
                    widget.size === size
                      ? 'radio_button_checked'
                      : 'radio_button_unchecked'
                  "
                />
              </q-item-section>
              <q-item-section
                >{{ SIZE_LABELS[size]
                }}<span v-if="widget.size === size" class="sr-only">
                  (current)</span
                ></q-item-section
              >
            </q-item>
            <q-separator />
            <q-item
              v-if="hasSettings(widget.type)"
              clickable
              @click="openSettings"
            >
              <q-item-section avatar><q-icon name="tune" /></q-item-section>
              <q-item-section>Settings…</q-item-section>
            </q-item>
            <q-item v-if="fetches" clickable @click="load()">
              <q-item-section avatar><q-icon name="refresh" /></q-item-section>
              <q-item-section>Refresh now</q-item-section>
            </q-item>
            <q-separator />
            <q-item clickable class="text-negative" @click="emit('remove')">
              <q-item-section avatar
                ><q-icon name="delete_outline"
              /></q-item-section>
              <q-item-section>Remove</q-item-section>
            </q-item>
          </q-list>
        </q-menu>
      </q-btn>
    </header>

    <div
      class="widget-card__body"
      :class="{ 'widget-card__body--busy': loading && data }"
      :aria-busy="loading ? 'true' : 'false'"
    >
      <EmptyState
        v-if="!meta"
        icon="extension_off"
        title="Not supported"
        :text="`This dashboard version cannot show “${widget.type}” widgets. Remove it, or update the dashboard.`"
      />
      <NotesWidget
        v-else-if="widget.type === 'notes'"
        :widget="widget"
        @edit="openSettings"
      />
      <div v-else-if="loading && !data" class="widget-card__loading">
        <q-spinner size="28px" color="primary" />
      </div>
      <EmptyState
        v-else-if="failure && !data"
        :icon="failureState.icon"
        :title="failureState.title"
        :text="failureState.text"
      >
        <q-btn
          v-if="failure.status === 400 && hasSettings(widget.type)"
          outline
          dense
          no-caps
          color="primary"
          label="Settings"
          @click="openSettings"
        />
        <q-btn
          v-else-if="![403, 404].includes(failure.status)"
          outline
          dense
          no-caps
          color="primary"
          icon="refresh"
          label="Retry"
          @click="load()"
        />
      </EmptyState>
      <component
        :is="COMPONENTS[widget.type]"
        v-else-if="data"
        v-bind="
          WITH_SETTINGS.has(widget.type)
            ? { data, widget, onEdit: openSettings }
            : { data }
        "
      />
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch, type Component } from "vue";
import { date, useQuasar } from "quasar";
import { useStore } from "vuex";
import { fetchWidget } from "@/api/dashboard";
import { fetchClients } from "@/api/clients";
import { SILENT_REQUEST_CONFIG } from "@/constants/constants";
import {
  SIZES,
  SIZE_LABELS,
  errorMessage,
  hasSettings,
  widgetMeta,
  widgetParams,
  type MoveTarget,
  type Widget,
  type WidgetSize,
} from "@/utils/overview";
import EmptyState from "@/components/ui/EmptyState.vue";
import WidgetSettings from "./WidgetSettings.vue";
import FleetWidget from "./FleetWidget.vue";
import AlertsWidget from "./AlertsWidget.vue";
import OfflineWidget from "./OfflineWidget.vue";
import PatchesWidget from "./PatchesWidget.vue";
import ChecksWidget from "./ChecksWidget.vue";
import ActivityWidget from "./ActivityWidget.vue";
import VulnsWidget from "./VulnsWidget.vue";
import NetmonWidget from "./NetmonWidget.vue";
import TopUsageWidget from "./TopUsageWidget.vue";
import DiscoveryWidget from "./DiscoveryWidget.vue";
import GroupsWidget from "./GroupsWidget.vue";
import EncryptionWidget from "./EncryptionWidget.vue";
import NotesWidget from "./NotesWidget.vue";
import ActionsWidget from "./ActionsWidget.vue";

const COMPONENTS: Record<string, Component> = {
  fleet: FleetWidget,
  alerts: AlertsWidget,
  offline: OfflineWidget,
  patches: PatchesWidget,
  checks: ChecksWidget,
  activity: ActivityWidget,
  vulns: VulnsWidget,
  netmon: NetmonWidget,
  top_cpu: TopUsageWidget,
  top_mem: TopUsageWidget,
  discovery: DiscoveryWidget,
  groups: GroupsWidget,
  encryption: EncryptionWidget,
  actions: ActionsWidget,
};

// these read their settings, groups can open them
const WITH_SETTINGS = new Set(["activity", "groups"]);

const MOVES: {
  where: MoveTarget;
  label: string;
  icon: string;
  edge: "start" | "end";
}[] = [
  { where: "first", label: "Move first", icon: "first_page", edge: "start" },
  { where: "left", label: "Move left", icon: "chevron_left", edge: "start" },
  { where: "right", label: "Move right", icon: "chevron_right", edge: "end" },
  { where: "last", label: "Move last", icon: "last_page", edge: "end" },
];

const KEY_MOVES: Record<string, MoveTarget> = {
  ArrowLeft: "left",
  ArrowUp: "left",
  ArrowRight: "right",
  ArrowDown: "right",
  Home: "first",
  End: "last",
};

const props = defineProps<{
  widget: Widget;
  index: number;
  count: number;
  // bumped by the page's auto refresh
  tick: number;
}>();

const emit = defineEmits<{
  move: [where: MoveTarget];
  resize: [size: WidgetSize];
  remove: [];
  settings: [settings: Record<string, unknown>];
}>();

const $q = useQuasar();
const store = useStore();
const formatDate = computed(() => store.getters.formatDate);

const meta = computed(() => widgetMeta(props.widget.type));
const label = computed(() => meta.value?.label || props.widget.type);

// a client filter shows in the title
const clientIds = computed(() => {
  const ids = props.widget.settings?.client_ids;
  return Array.isArray(ids) ? (ids as number[]) : [];
});
const clientNames = ref<Record<number, string>>({});
watch(
  () => clientIds.value.join(","),
  async (ids) => {
    if (!ids) return;
    try {
      const list: { id: number; name: string }[] = await fetchClients(
        SILENT_REQUEST_CONFIG,
      );
      clientNames.value = Object.fromEntries(list.map((c) => [c.id, c.name]));
    } catch {
      // the ids stay in the title
    }
  },
  { immediate: true },
);
const title = computed(() => {
  const names = clientIds.value.map(
    (id) => clientNames.value[id] ?? `Client #${id}`,
  );
  if (!names.length) return label.value;
  const more = names.length > 3 ? ` +${names.length - 3}` : "";
  return `${label.value}: ${names.slice(0, 3).join(", ")}${more}`;
});
const titleId = computed(() => `widget-title-${props.widget.id}`);
// notes live in the layout, no request
const fetches = computed(() => !!meta.value && props.widget.type !== "notes");

const data = ref<unknown>(null);
const loading = ref(false);
const failure = ref<{ status: number; text: string } | null>(null);
const updatedAt = ref<Date | null>(null);
const moveOpen = ref(false);
const menuOpen = ref(false);
let seq = 0;

const failureState = computed(() => {
  const status = failure.value?.status;
  if (status === 403)
    return {
      icon: "lock",
      title: "No access",
      text: "Your role does not include the permission this widget needs. Remove it, or ask an administrator for access.",
    };
  if (status === 404)
    return {
      icon: "help_outline",
      title: "Not available",
      text: "The server does not offer this widget. Remove it from the overview.",
    };
  if (status === 400)
    return {
      icon: "tune",
      title: "Settings rejected",
      text: failure.value?.text || "",
    };
  return {
    icon: "cloud_off",
    title: "Could not load",
    text: failure.value?.text || "",
  };
});

function clock(value: Date) {
  return date.formatDate(value, "HH:mm");
}

// quiet: auto refresh. Leave the card as it is until data arrives
async function load(quiet = false) {
  if (!fetches.value) return;
  const n = ++seq;
  if (!quiet) loading.value = true;
  try {
    const result = await fetchWidget(
      props.widget.type,
      widgetParams(props.widget.settings),
    );
    if (n !== seq) return;
    data.value = result;
    failure.value = null;
    updatedAt.value = new Date();
  } catch (e) {
    if (n !== seq) return;
    const status =
      (e as { response?: { status?: number } }).response?.status ?? 0;
    failure.value = { status, text: errorMessage(e) };
    // 400/403/404 clears the old numbers; other failures keep them
    if ([400, 403, 404].includes(status)) data.value = null;
  } finally {
    if (n === seq) loading.value = false;
  }
}

function onMoveKey(e: KeyboardEvent) {
  const where = KEY_MOVES[e.key];
  if (!where || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
  e.preventDefault();
  emit("move", where);
}

function openSettings() {
  $q.dialog({
    component: WidgetSettings,
    componentProps: { widget: props.widget, title: label.value },
  }).onOk((settings: Record<string, unknown>) => emit("settings", settings));
}

watch(
  () => JSON.stringify(props.widget.settings),
  () => load(),
);
watch(
  () => props.tick,
  () => load(true),
);
onMounted(() => load());
</script>

<style scoped>
.widget-card {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 12px;
  padding: 14px 16px 16px;
  border: 1px solid var(--rmm-border);
  border-radius: var(--rmm-radius-lg);
  background: var(--rmm-surface);
  box-shadow: var(--rmm-shadow);
  color: var(--rmm-text);
}

.widget-card__head {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.widget-card__icon {
  margin-top: 2px;
  color: var(--rmm-tile-icon-text);
}

.widget-card__heading {
  min-width: 0;
  flex: 1;
}

.widget-card__title {
  margin: 0;
  overflow-wrap: anywhere;
  font-size: var(--rmm-fs-lg);
  font-weight: 600;
  letter-spacing: -0.01em;
  line-height: 1.4;
}

.widget-card__meta {
  min-height: 18px;
  color: var(--rmm-text-muted);
  font-size: var(--rmm-fs-xs);
}

.widget-card__failed {
  color: var(--rmm-status-negative);
}

.widget-card__retry {
  padding: 0;
  border: 0;
  color: var(--rmm-accent-text);
  background: none;
  font: inherit;
  cursor: pointer;
  text-decoration: underline;
}

.widget-card__action {
  flex-shrink: 0;
  color: var(--rmm-text-muted);
}

.widget-card__body {
  min-height: 0;
  max-height: 440px;
  flex: 1;
  /* room for focus rings of links on the edge */
  margin: -4px;
  padding: 4px;
  overflow-y: auto;
  transition: opacity 0.2s ease;
}

.widget-card__body--busy {
  opacity: 0.55;
}

.widget-card__loading {
  display: flex;
  min-height: 140px;
  align-items: center;
  justify-content: center;
}

.widget-card__menu {
  min-width: 180px;
}
</style>

<style>
/* styles the widget components share */
.widget-card .widget-subhead {
  margin: 0 0 6px;
  color: var(--rmm-text-muted);
  font-size: var(--rmm-fs-xs);
  font-weight: 600;
  line-height: 1.4;
}

.widget-card .widget-note {
  margin: 0;
  color: var(--rmm-text-muted);
  font-size: var(--rmm-fs-xs);
  line-height: 1.5;
}

.widget-card .widget-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.widget-card .widget-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 8px 4px;
  border-bottom: 1px solid var(--rmm-border);
  font-size: var(--rmm-fs-sm);
}

.widget-card .widget-row:last-child {
  border-bottom: 0;
}

.widget-card .widget-row > .rmm-pill {
  flex-shrink: 0;
  min-height: 20px;
}

.widget-card .widget-row__icon {
  flex-shrink: 0;
  margin-top: 1px;
  color: var(--rmm-text-subtle);
}

.widget-card .widget-row__main {
  min-width: 0;
  flex: 1;
}

.widget-card .widget-row__title {
  color: var(--rmm-text);
  font-weight: 600;
  overflow-wrap: anywhere;
}

.widget-card .widget-row__title.rmm-link {
  color: var(--rmm-accent-text);
}

.widget-card .widget-row__meta {
  display: -webkit-box;
  overflow: hidden;
  color: var(--rmm-text-muted);
  font-size: var(--rmm-fs-xs);
  overflow-wrap: anywhere;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
}

.widget-card .widget-row__aside {
  display: flex;
  flex-shrink: 0;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
  color: var(--rmm-text-muted);
  font-size: var(--rmm-fs-xs);
  white-space: nowrap;
}

/* a small card has no room for the time beside the title, which then
   broke after every word; the time moves under the title */
.widget-card--s .widget-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  row-gap: 2px;
}

.widget-card--s .widget-row > :is(.widget-row__main, .widget-row__aside) {
  grid-column: 2;
}

.widget-card--s .widget-row > .widget-row__main:first-child,
.widget-card--s .widget-row > .widget-row__main:first-child ~ * {
  grid-column: 1 / -1;
}

.widget-card--s .widget-row__aside {
  align-items: flex-start;
}

.widget-card .widget-footer {
  display: flex;
  justify-content: flex-end;
}
</style>
