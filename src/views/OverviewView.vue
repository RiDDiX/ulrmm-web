<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-page class="overview-page" :style-fn="fitPage">
    <header class="overview-heading">
      <div>
        <h1>Overview</h1>
        <p>
          Your own selection of widgets. Changes are saved as you make them.
        </p>
      </div>
      <div class="overview-heading__actions">
        <span class="overview-save" role="status">{{ saveText }}</span>
        <q-btn
          outline
          no-caps
          icon="restart_alt"
          label="Reset to default"
          :disable="!loaded"
          @click="confirmReset"
        />
        <q-btn
          unelevated
          no-caps
          color="primary"
          icon="add"
          label="Add widget"
          :disable="!loaded || widgets.length >= MAX_WIDGETS"
          @click="openPicker"
        >
          <q-tooltip v-if="widgets.length >= MAX_WIDGETS"
            >The overview holds at most {{ MAX_WIDGETS }} widgets</q-tooltip
          >
        </q-btn>
      </div>
    </header>

    <q-banner
      v-if="saveError"
      dense
      rounded
      class="bg-negative overview-banner"
      role="alert"
    >
      <template #avatar><q-icon name="error_outline" /></template>
      Your last change was not saved: {{ saveError }}
      <template #action>
        <q-btn flat no-caps label="Try again" @click="persist" />
        <q-btn flat no-caps label="Load saved layout" @click="loadLayout" />
      </template>
    </q-banner>

    <div v-if="!loaded && !loadError" class="overview-loading">
      <q-spinner size="36px" color="primary" />
    </div>
    <EmptyState
      v-else-if="loadError"
      icon="cloud_off"
      title="The overview could not be loaded"
      :text="loadError"
    >
      <q-btn
        outline
        no-caps
        color="primary"
        icon="refresh"
        label="Retry"
        @click="loadLayout"
      />
    </EmptyState>
    <EmptyState
      v-else-if="!widgets.length"
      icon="space_dashboard"
      title="No widgets yet"
      text="Add the numbers you check every day, or start from the default selection."
    >
      <q-btn
        unelevated
        no-caps
        color="primary"
        icon="add"
        label="Add widget"
        @click="openPicker"
      />
      <q-btn
        outline
        no-caps
        color="primary"
        label="Use the default"
        @click="reset"
      />
    </EmptyState>
    <WidgetGrid
      v-else
      :widgets="widgets"
      :tick="tick"
      @update:widgets="onChange"
    />
  </q-page>
</template>

<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from "vue";
import { useQuasar } from "quasar";
import { fetchLayout, resetLayout, saveLayout } from "@/api/dashboard";
import { useDashboardStore } from "@/stores/dashboard";
import EmptyState from "@/components/ui/EmptyState.vue";
import WidgetGrid from "@/components/overview/WidgetGrid.vue";
import WidgetPicker from "@/components/overview/WidgetPicker.vue";
import {
  MAX_WIDGETS,
  addWidget,
  defaultLayout,
  errorMessage,
  layoutError,
  type Widget,
} from "@/utils/overview";

const REFRESH = 60_000;

const $q = useQuasar();
const dashboardStore = useDashboardStore();

const widgets = ref<Widget[]>([]);
const loaded = ref(false);
const loadError = ref("");
const saving = ref(false);
const saveError = ref("");
const saved = ref(false);
const tick = ref(0);
let lastRefresh = Date.now();

const saveText = computed(() => {
  if (saving.value) return "Saving…";
  if (saved.value && !saveError.value) return "Saved";
  return "";
});

function fitPage(offset: number, height: number) {
  return { height: `${height - offset}px` };
}

async function loadLayout() {
  loaded.value = false;
  loadError.value = "";
  try {
    const data = await fetchLayout();
    widgets.value = Array.isArray(data?.widgets) ? data.widgets : [];
    saveError.value = "";
    saved.value = false;
    loaded.value = true;
    lastRefresh = Date.now();
  } catch (e) {
    loadError.value = errorMessage(e);
  }
}

// one request at a time; changes made meanwhile go out with the next one
let dirty = false;
let resetting = false;
let running = false;
async function persist() {
  dirty = true;
  if (running) return;
  running = true;
  saving.value = true;
  while (dirty) {
    dirty = false;
    if (resetting) {
      resetting = false;
      try {
        const data = await resetLayout();
        // the role's default replaces the full one shown meanwhile,
        // unless that was changed since
        if (!dirty && Array.isArray(data?.widgets))
          widgets.value = data.widgets;
        saveError.value = "";
        saved.value = true;
      } catch (e) {
        saveError.value = errorMessage(e);
      }
      continue;
    }
    const layout = { widgets: widgets.value };
    const invalid = layoutError(layout);
    if (invalid) {
      saveError.value = invalid;
      break;
    }
    try {
      await saveLayout(layout);
      saveError.value = "";
      saved.value = true;
    } catch (e) {
      saveError.value = errorMessage(e);
    }
  }
  running = false;
  saving.value = false;
}

function onChange(next: Widget[]) {
  widgets.value = next;
  persist();
}

function reset() {
  widgets.value = defaultLayout();
  resetting = true;
  persist();
}

function confirmReset() {
  $q.dialog({
    title: "Reset the overview?",
    message:
      "Your widgets and their settings are replaced by the default selection.",
    cancel: { flat: true, noCaps: true, label: "Cancel" },
    ok: { unelevated: true, noCaps: true, color: "negative", label: "Reset" },
  }).onOk(reset);
}

function openPicker() {
  $q.dialog({
    component: WidgetPicker,
    componentProps: { count: widgets.value.length },
  }).onOk((type: string) => {
    const next = addWidget(widgets.value, type);
    if (next === widgets.value) return;
    onChange(next);
    const id = next[next.length - 1].id;
    nextTick(() => {
      const button = document.querySelector<HTMLElement>(`[data-move="${id}"]`);
      button?.scrollIntoView({ block: "nearest" });
      button?.focus();
    });
  });
}

// each card reloads once a minute while the page is visible, no spinner
let timer: number | undefined;
function refresh() {
  if (!loaded.value || dashboardStore.isOffline) return;
  lastRefresh = Date.now();
  tick.value += 1;
}
function onVisibility() {
  if (
    document.visibilityState === "visible" &&
    Date.now() - lastRefresh >= REFRESH
  )
    refresh();
}
watch(
  () => dashboardStore.isOffline,
  (offline) => {
    if (!offline) refresh();
  },
);

onMounted(() => {
  loadLayout();
  timer = window.setInterval(() => {
    if (document.visibilityState === "visible") refresh();
  }, REFRESH);
  document.addEventListener("visibilitychange", onVisibility);
});

onBeforeUnmount(() => {
  window.clearInterval(timer);
  document.removeEventListener("visibilitychange", onVisibility);
});
</script>

<style scoped>
.overview-page {
  padding: 28px;
  overflow-y: auto;
  color: var(--rmm-text);
  background: var(--rmm-bg);
}

.overview-heading {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 24px;
}

.overview-heading h1 {
  margin: 0 0 6px;
  font-size: 32px;
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: -0.02em;
}

.overview-heading p {
  margin: 0;
  color: var(--rmm-text-muted);
}

.overview-heading__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.overview-heading .q-btn {
  min-height: 42px;
}

.overview-save {
  color: var(--rmm-text-muted);
  font-size: var(--rmm-fs-sm);
}

/* stays in view while the change that failed is further down */
.overview-banner {
  position: sticky;
  z-index: 2;
  top: 0;
  margin-bottom: 16px;
  box-shadow: var(--rmm-shadow-lg);
}

.overview-loading {
  display: flex;
  min-height: 240px;
  align-items: center;
  justify-content: center;
}

@media (max-width: 599px) {
  .overview-page {
    padding: 16px;
  }

  .overview-heading h1 {
    font-size: 26px;
  }
}
</style>
