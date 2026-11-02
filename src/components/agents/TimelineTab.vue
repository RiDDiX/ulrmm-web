<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <div ref="root" class="timeline-tab">
    <TabToolbar title="Timeline" :count="items.length">
      <div
        v-if="options.length"
        class="row items-center q-gutter-xs"
        role="group"
        aria-label="Filter by type"
      >
        <q-chip
          v-for="opt in options"
          :key="opt.type"
          clickable
          dense
          role="button"
          :icon="opt.icon"
          :aria-pressed="activeTypes.includes(opt.type)"
          :outline="!activeTypes.includes(opt.type)"
          color="primary"
          :text-color="activeTypes.includes(opt.type) ? 'white' : undefined"
          @click="toggleType(opt.type)"
        >
          {{ opt.label }}
          <span class="timeline-tab__count rmm-num">{{ opt.count }}</span>
          <q-tooltip>{{
            activeTypes.includes(opt.type)
              ? `Remove ${opt.label.toLowerCase()} from the filter`
              : `Show only ${opt.label.toLowerCase()} entries`
          }}</q-tooltip>
        </q-chip>
      </div>
      <q-space />
      <q-btn
        dense
        flat
        round
        icon="refresh"
        aria-label="Reload the timeline"
        @click="load"
      >
        <q-tooltip>Reload the newest entries</q-tooltip>
      </q-btn>
    </TabToolbar>

    <div class="timeline-tab__body">
      <q-banner
        v-if="error && items.length"
        dense
        rounded
        class="rmm-banner-warning q-ma-sm"
      >
        <template #avatar>
          <q-icon name="warning_amber" color="warning" />
        </template>
        {{ errorMessage }} Showing the entries loaded before.
        <template #action>
          <q-btn
            flat
            dense
            no-caps
            color="primary"
            label="Retry"
            @click="load"
          />
        </template>
      </q-banner>

      <template v-if="!items.length">
        <EmptyState
          v-if="error && !loading"
          icon="error_outline"
          title="Unable to load the timeline"
          :text="errorMessage"
        >
          <q-btn
            outline
            dense
            no-caps
            color="primary"
            label="Retry"
            @click="load"
          />
        </EmptyState>
        <EmptyState
          v-else-if="loaded && !loading && activeTypes.length"
          icon="filter_alt_off"
          title="No entries of these types"
          text="This device has no entries of the chosen types."
        >
          <q-btn
            outline
            dense
            no-caps
            color="primary"
            label="Clear filter"
            @click="setTypes([])"
          />
        </EmptyState>
        <EmptyState
          v-else-if="loaded && !loading"
          icon="timeline"
          title="Nothing happened here yet"
          text="Scripts, commands, alerts, patches, package installs and changes to this device appear here as they happen."
        />
        <div v-else class="timeline-tab__placeholder" />
      </template>

      <section
        v-for="group in groups"
        :key="group.key"
        class="timeline-day"
        :aria-label="group.label"
      >
        <h3 class="timeline-day__label">
          {{ group.label }}
          <span class="rmm-muted rmm-num">{{ group.items.length }}</span>
        </h3>
        <ol class="timeline-day__list">
          <li
            v-for="item in group.items"
            :key="itemKey(item)"
            class="timeline-row"
            :class="stateClass(item)"
          >
            <time
              class="timeline-row__time rmm-num"
              :datetime="item.ts"
              :title="formatDate(item.ts)"
              >{{ clock(item.ts) }}</time
            >
            <q-icon
              :name="typeMeta(item.type).icon"
              class="timeline-row__icon"
              size="18px"
              aria-hidden="true"
            />
            <div class="timeline-row__main">
              <div class="timeline-row__head">
                <router-link
                  v-if="tabOf(item)"
                  class="timeline-row__title rmm-link"
                  :to="{ query: { ...route.query, tab: tabOf(item) } }"
                  replace
                  >{{ item.title || typeMeta(item.type).label }}</router-link
                >
                <a
                  v-else-if="dialogOf(item)"
                  href="#"
                  role="button"
                  class="timeline-row__title rmm-link"
                  @click.prevent="openDialog(item)"
                  @keydown.space.prevent="openDialog(item)"
                  >{{ item.title || typeMeta(item.type).label }}</a
                >
                <span v-else class="timeline-row__title">{{
                  item.title || typeMeta(item.type).label
                }}</span>
                <span class="timeline-row__type">{{
                  typeMeta(item.type).label
                }}</span>
                <span
                  v-if="severityState(item.severity)"
                  class="rmm-pill"
                  :class="`rmm-pill--${severityState(item.severity)}`"
                  >{{ item.severity === "error" ? "Error" : "Warning" }}</span
                >
              </div>
              <div
                v-if="item.detail"
                :ref="(el) => trackDetail(itemKey(item), el)"
                class="timeline-row__detail"
                :class="{
                  'timeline-row__detail--open': expanded.has(itemKey(item)),
                }"
              >
                {{ item.detail }}
              </div>
              <button
                v-if="expanded.has(itemKey(item)) || clipped.has(itemKey(item))"
                type="button"
                class="timeline-row__more rmm-link"
                :aria-expanded="expanded.has(itemKey(item))"
                @click="toggleDetail(itemKey(item))"
              >
                {{ expanded.has(itemKey(item)) ? "Show less" : "Show more" }}
              </button>
            </div>
            <span v-if="item.user" class="timeline-row__user">
              <q-icon name="person_outline" size="14px" aria-hidden="true" />
              <span class="sr-only">by</span>
              {{ item.user }}
            </span>
          </li>
        </ol>
      </section>

      <div v-if="items.length" class="timeline-tab__more">
        <template v-if="hasMore">
          <q-btn
            outline
            dense
            no-caps
            color="primary"
            icon="expand_more"
            label="Load older"
            :loading="loadingOlder"
            @click="loadOlder"
          />
          <span v-if="olderError" class="rmm-muted" role="status">
            Older entries could not be loaded.
          </span>
        </template>
        <span v-else class="rmm-muted">No older entries</span>
      </div>

      <q-inner-loading :showing="loading" color="primary" />
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  computed,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  watch,
} from "vue";
import { useQuasar, date } from "quasar";
import { useStore } from "vuex";
import { useRoute } from "vue-router";
import { fetchAgentTimeline } from "@/api/timeline";
import {
  groupByDay,
  refTarget,
  severityState,
  typeMeta,
  typeOptions,
  type TimelineItem,
} from "@/utils/timeline";
import TabToolbar from "@/components/agents/TabToolbar.vue";
import EmptyState from "@/components/ui/EmptyState.vue";
import DialogWrapper from "@/components/ui/DialogWrapper.vue";
import AlertsOverview from "@/components/modals/alerts/AlertsOverview.vue";
import PendingActions from "@/components/logs/PendingActions.vue";
import PackageInstalls from "@/components/packages/PackageInstalls.vue";

const store = useStore();
const formatDate = computed(() => store.getters.formatDate);
const LIMIT = 100;
const selectedAgent = computed(() => store.state.selectedRow);
const route = useRoute();
const $q = useQuasar();

const items = ref<TimelineItem[]>([]);
// the chips come from the unfiltered pages, so a chip stays while the
// server filters by it
const unfiltered = ref<TimelineItem[]>([]);
const nextBefore = ref<string | null>(null);
const hasMore = ref(false);
const loaded = ref(false);
const loading = ref(false);
const loadingOlder = ref(false);
const error = ref<{ response?: { status?: number } } | null>(null);
const olderError = ref(false);
const activeTypes = ref<string[]>([]);
const expanded = reactive(new Set<string>());
const clipped = reactive(new Set<string>());
let generation = 0;

const errorMessage = computed(() =>
  error.value?.response?.status === 403
    ? "Your role cannot view this device's timeline."
    : "The timeline could not be loaded.",
);

const options = computed(() =>
  typeOptions(unfiltered.value, activeTypes.value),
);
const groups = computed(() => groupByDay(items.value));

function itemKey(item: TimelineItem) {
  return `${item.type}:${item.ref?.kind}:${item.ref?.id}:${item.ts}:${item.title}`;
}

function clock(ts: string) {
  return date.formatDate(ts, "HH:mm");
}

function stateClass(item: TimelineItem) {
  const state = severityState(item.severity);
  return state ? `timeline-row--${state}` : undefined;
}

function tabOf(item: TimelineItem) {
  const target = refTarget(item.ref);
  return target && "tab" in target ? target.tab : null;
}

function dialogOf(item: TimelineItem) {
  const target = refTarget(item.ref);
  return target && "dialog" in target ? target.dialog : null;
}

function openDialog(item: TimelineItem) {
  const kind = dialogOf(item);
  if (kind === "alerts") {
    $q.dialog({ component: AlertsOverview });
  } else if (kind === "pending") {
    $q.dialog({
      component: PendingActions,
      componentProps: {
        agent: {
          agent_id: selectedAgent.value,
          hostname: store.state.agentName,
        },
      },
    });
  } else if (kind === "packages") {
    $q.dialog({
      component: DialogWrapper,
      componentProps: {
        vuecomponent: PackageInstalls,
        title: "Package installs",
        size: "lg",
        height: "40",
        componentProps: {},
      },
    });
  }
}

function setTypes(types: string[]) {
  activeTypes.value = types;
  void load();
}

function toggleType(type: string) {
  setTypes(
    activeTypes.value.includes(type)
      ? activeTypes.value.filter((t) => t !== type)
      : [...activeTypes.value, type],
  );
}

// the server filters by type, older pages included
function feedParams(params: Record<string, unknown>) {
  return activeTypes.value.length
    ? { ...params, types: activeTypes.value.join(",") }
    : params;
}

function toggleDetail(key: string) {
  if (expanded.has(key)) expanded.delete(key);
  else expanded.add(key);
}

// detail is clamped to two lines. Overflow depends on the width, so
// measure after each render and on resize
const detailEls = new Map<string, HTMLElement>();
function trackDetail(key: string, el: unknown) {
  if (el instanceof HTMLElement) detailEls.set(key, el);
  else detailEls.delete(key);
}

function measure() {
  for (const [key, el] of detailEls) {
    if (!el.isConnected) {
      detailEls.delete(key);
      continue;
    }
    if (expanded.has(key)) continue;
    const cut = el.scrollHeight > el.clientHeight + 1;
    if (cut && !clipped.has(key)) clipped.add(key);
    else if (!cut && clipped.has(key)) clipped.delete(key);
  }
}

let frame = 0;
function scheduleMeasure() {
  window.cancelAnimationFrame(frame);
  frame = window.requestAnimationFrame(measure);
}
const resizeObserver = new ResizeObserver(scheduleMeasure);

watch(groups, scheduleMeasure, { flush: "post" });

function setPage(data: {
  items?: TimelineItem[];
  next_before?: string | null;
}) {
  const page = Array.isArray(data?.items) ? data.items : [];
  nextBefore.value = data?.next_before || null;
  // a short page is the last one even when the server still names a cursor
  hasMore.value = Boolean(nextBefore.value) && page.length >= LIMIT;
  return page;
}

async function load() {
  const agentId = selectedAgent.value;
  if (!agentId) return;
  const request = ++generation;
  loading.value = true;
  loadingOlder.value = false;
  olderError.value = false;
  try {
    const data = await fetchAgentTimeline(
      agentId,
      feedParams({ limit: LIMIT }),
    );
    if (request !== generation) return;
    items.value = setPage(data);
    if (!activeTypes.value.length) unfiltered.value = items.value;
    expanded.clear();
    error.value = null;
    loaded.value = true;
  } catch (e) {
    if (request !== generation) return;
    error.value = e as typeof error.value;
  } finally {
    if (request === generation) loading.value = false;
  }
}

async function loadOlder() {
  const agentId = selectedAgent.value;
  if (!agentId || !nextBefore.value || loadingOlder.value) return;
  const request = generation;
  loadingOlder.value = true;
  olderError.value = false;
  try {
    const data = await fetchAgentTimeline(
      agentId,
      feedParams({ before: nextBefore.value, limit: LIMIT }),
    );
    if (request !== generation) return;
    items.value = [...items.value, ...setPage(data)];
    if (!activeTypes.value.length) unfiltered.value = items.value;
  } catch {
    if (request !== generation) return;
    olderError.value = true;
  } finally {
    if (request === generation) loadingOlder.value = false;
  }
}

watch(selectedAgent, () => {
  generation += 1;
  items.value = [];
  unfiltered.value = [];
  nextBefore.value = null;
  hasMore.value = false;
  loaded.value = false;
  error.value = null;
  activeTypes.value = [];
  void load();
});

const root = ref<HTMLElement | null>(null);
onMounted(() => {
  if (root.value) resizeObserver.observe(root.value);
  void load();
});

onBeforeUnmount(() => {
  generation += 1;
  window.cancelAnimationFrame(frame);
  resizeObserver.disconnect();
});
</script>

<style scoped>
.timeline-tab__body {
  position: relative;
  min-height: 240px;
}

.timeline-tab__placeholder {
  min-height: 240px;
}

.timeline-tab__count {
  margin-left: 6px;
  font-weight: 600;
}

.timeline-day__label {
  position: sticky;
  z-index: 1;
  top: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  padding: 6px 12px;
  border-bottom: 1px solid var(--rmm-border);
  color: var(--rmm-text);
  background: var(--rmm-surface-2);
  font-size: var(--rmm-fs-xs);
  font-weight: 600;
  line-height: 20px;
  letter-spacing: normal;
}

.timeline-day__list {
  margin: 0;
  padding: 0;
  list-style: none;
  background: var(--rmm-surface);
}

.timeline-row {
  display: grid;
  grid-template-areas: "time icon main user";
  grid-template-columns: 44px 20px minmax(0, 1fr) auto;
  align-items: start;
  gap: 2px 10px;
  padding: 7px 12px;
  border-bottom: 1px solid var(--rmm-border);
  font-size: var(--rmm-fs-sm);
}

.timeline-row--negative {
  box-shadow: inset 3px 0 var(--rmm-status-negative);
}

.timeline-row--warning {
  box-shadow: inset 3px 0 var(--rmm-dot-warning);
}

.timeline-row__time {
  grid-area: time;
  color: var(--rmm-text-muted);
  line-height: 20px;
}

.timeline-row__icon {
  grid-area: icon;
  margin-top: 1px;
  color: var(--rmm-text-subtle);
}

.timeline-row--negative .timeline-row__icon {
  color: var(--rmm-status-negative);
}

.timeline-row--warning .timeline-row__icon {
  color: var(--rmm-status-warning);
}

.timeline-row__main {
  grid-area: main;
  min-width: 0;
}

.timeline-row__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px 8px;
  line-height: 20px;
}

.timeline-row__title {
  min-width: 0;
  overflow-wrap: anywhere;
  color: var(--rmm-text);
  font-weight: 600;
}

.timeline-row__title.rmm-link {
  color: var(--rmm-accent-text);
}

.timeline-row__type {
  color: var(--rmm-text-muted);
  font-size: var(--rmm-fs-xs);
}

.timeline-row__head .rmm-pill {
  min-height: 18px;
  padding: 0 7px;
}

.timeline-row__detail {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  color: var(--rmm-text-muted);
  overflow-wrap: anywhere;
  white-space: pre-line;
}

.timeline-row__detail--open {
  display: block;
  -webkit-line-clamp: unset;
  white-space: pre-wrap;
}

.timeline-row__more {
  padding: 0;
  border: 0;
  background: none;
  font: inherit;
  font-size: var(--rmm-fs-xs);
}

.timeline-row__user {
  grid-area: user;
  display: inline-flex;
  max-width: 200px;
  align-items: center;
  gap: 4px;
  overflow: hidden;
  color: var(--rmm-text-muted);
  line-height: 20px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.timeline-tab__more {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 12px;
  font-size: var(--rmm-fs-sm);
}

@media (max-width: 600px) {
  .timeline-row {
    grid-template-areas:
      "time icon main"
      ". . user";
    grid-template-columns: 40px 18px minmax(0, 1fr);
  }

  .timeline-row__user {
    max-width: 100%;
    justify-self: start;
  }
}
</style>
