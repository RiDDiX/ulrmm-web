<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useStore } from "vuex";
import { useRoute, useRouter } from "vue-router";
import { useQuasar } from "quasar";
import { StorageSerializers, useStorage } from "@vueuse/core";
import axios from "axios";
import AlertsIcon from "@/components/AlertsIcon.vue";
import FileBar from "@/components/FileBar.vue";
import { fetchPendingActionsCount } from "@/api/logs";
import { DASHBOARD_REFRESH_INTERVAL } from "@/constants/constants";
import { useBrandingStore } from "@/stores/branding";
import { useDashboardStore } from "@/stores/dashboard";
import AccountMenu from "./AccountMenu.vue";
import FleetStatusButton from "./FleetStatusButton.vue";
import { usePageContext } from "./pageContext";

type Timer = ReturnType<typeof setInterval> | undefined;
type HeaderButton = {
  key: string;
  icon: string;
  label: string;
  run: () => unknown;
};

const store = useStore();
const route = useRoute();
const router = useRouter();
const $q = useQuasar();
const branding = useBrandingStore();
const fleet = useDashboardStore();

// SummaryTab's Popout button opens a device with ?popout=1. That window gets
// neither the rail nor the dashboard shortcut: a focused device view, not a
// second shell
const isPopout = computed(() => route.query.popout === "1");
const { crumbs, dashboardRoute } = usePageContext(isPopout);

// ---- navigation rail

const drawerOpen = ref($q.screen.gt.sm);
// The operator's own choice wins once made. Until then the rail starts mini
// below 1440px so the fleet table keeps its width; writeDefaults off keeps
// storage empty until a toggle, so that breakpoint stays live. The explicit
// boolean serializer: with a null default the generic one would read a
// stored "false" back as a truthy string.
const railChoice = useStorage<boolean | null>(
  "rmm-nav-expanded-2",
  null,
  undefined,
  { writeDefaults: false, serializer: StorageSerializers.boolean },
);
const railOpen = computed(() => railChoice.value ?? $q.screen.gt.md);
// under the drawer breakpoint the drawer opens at full width, never mini
const railWide = computed(() => railOpen.value || $q.screen.lt.md);
const railToggle = computed(() =>
  railOpen.value
    ? { icon: "chevron_left", label: "Collapse sidebar" }
    : { icon: "chevron_right", label: "Expand sidebar" },
);

function toggleRail() {
  railChoice.value = !railOpen.value;
}

// ---- header state

const serverVersion = computed(() => store.state.currentVersion);
const latestVersion = computed(() => store.state.latestVersion);
const warnColor = computed(() => store.state.dash_warning_color);
const alarmColor = computed(() => store.state.dash_negative_color);
const logoAlt = computed(() => `${branding.productName} logo`);
// self-hosted administrators can follow the chip to the update page
const canUpdateServer = computed(
  () => store.state.can_manage_server_updates && !store.state.hosted,
);
// never on hosted servers, dev builds or a failed release lookup
const updateAvailable = computed(() => {
  const current = serverVersion.value;
  const blocked =
    latestVersion.value === "error" ||
    store.state.hosted ||
    current?.includes("-dev");
  return !blocked && current !== latestVersion.value;
});
const updateHint = computed(() =>
  canUpdateServer.value
    ? "A newer server version is available. Click for the changes and to update."
    : "A newer server version is available. Ask an administrator to update the server.",
);

function openUpdates() {
  if (canUpdateServer.value) router.push({ name: "updates" });
}

// the newer page build first, then the lost connection
const banners = computed(() => {
  const list = [];
  if (store.state.needrefresh)
    list.push({
      kind: "update",
      text: "A newer version of this page is available. Refresh to load it.",
      color: "primary",
      action: "Refresh",
      run: () => store.dispatch("reload"),
    });
  if (fleet.isOffline)
    list.push({
      kind: "offline",
      text: "Cannot reach the server. Retrying automatically.",
      color: "negative",
      action: "Retry",
      run: refreshHeader,
    });
  return list;
});

// sidebar toggle on small screens, then refresh on the dashboard or the way
// back to it from a device
const leadButtons = computed(() => {
  const list: HeaderButton[] = [];
  if (isPopout.value) return list;
  if ($q.screen.lt.md)
    list.push({
      key: "drawer",
      icon: "menu",
      label: drawerOpen.value ? "Close sidebar" : "Open sidebar",
      run: () => (drawerOpen.value = !drawerOpen.value),
    });
  if (route.name === "Dashboard")
    list.push({
      key: "refresh",
      icon: "refresh",
      label: "Refresh dashboard",
      run: () => store.dispatch("refreshDashboard"),
    });
  else if (route.name !== "Overview")
    list.push({
      key: "back",
      icon: "arrow_back",
      label: "Back to dashboard",
      run: () => router.push(dashboardRoute.value),
    });
  return list;
});

const darkMode = computed({
  get: () => $q.dark.isActive,
  set(dark: boolean) {
    axios.patch("/accounts/users/ui/", { dark_mode: dark });
    $q.dark.set(dark);
  },
});
const themeToggle = computed(() =>
  darkMode.value
    ? { icon: "light_mode", label: "Switch to light mode" }
    : { icon: "dark_mode", label: "Switch to dark mode" },
);

// ---- header search

// it opens the dashboard with ?search=, which the dashboard's own box shows;
// is: words belong to the dashboard's filters and are not shown here
const searchText = ref("");
const isFilterWord = (word: string) => word.startsWith("is:");

watch(
  () => route.query.search,
  (search) => {
    searchText.value = String(search || "")
      .split(/\s+/)
      .filter((word) => word && !isFilterWord(word))
      .join(" ");
  },
  { immediate: true },
);

function submitSearch() {
  const typed = (searchText.value || "").trim();
  const kept = String(route.query.search || "")
    .split(/\s+/)
    .filter(isFilterWord);
  const search = [typed, ...kept].filter(Boolean).join(" ") || undefined;
  // off the dashboard the store still holds the scope; keep it
  const base =
    route.name === "Dashboard" ? route.query : dashboardRoute.value.query;
  router.push({ name: "Dashboard", query: { ...base, search } });
}

// ---- polling

// active alerts, reported by AlertsIcon, shown on the rail
const alertTotal = ref(0);
// the rail's Actions badge: null until the first answer, and for good
// without the permission, which hides the entry
const pendingActions = ref<number | null>(null);
let headerTimer: Timer;
let actionsTimer: Timer;
let offlineProbe: Timer;
const HEADER_POLL_MS = 4 * 60 * 1000;
const ACTIONS_POLL_MS = 60_000;

function refreshHeader() {
  store.dispatch("checkVer");
  store.dispatch("getDashInfo", false);
}

async function countPendingActions() {
  try {
    const reply = await fetchPendingActionsCount();
    pendingActions.value = Number(reply?.pending) || 0;
  } catch (err) {
    const status = (err as { response?: { status?: number } })?.response
      ?.status;
    if (status !== 403) return;
    pendingActions.value = null;
    clearInterval(actionsTimer);
  }
}

// while the API is unreachable a quiet version check is the probe that ends
// the offline state
watch(
  () => fleet.isOffline,
  (offline) => {
    clearInterval(offlineProbe);
    offlineProbe = offline
      ? setInterval(
          () => store.dispatch("checkVer", { silent: true }),
          DASHBOARD_REFRESH_INTERVAL,
        )
      : undefined;
  },
  { immediate: true },
);

onMounted(() => {
  store.dispatch("getDashInfo");
  store.dispatch("checkVer");
  headerTimer = setInterval(
    () => fleet.isOffline || refreshHeader(),
    HEADER_POLL_MS,
  );
  void countPendingActions();
  actionsTimer = setInterval(
    () => fleet.isOffline || countPendingActions(),
    ACTIONS_POLL_MS,
  );
});

onBeforeUnmount(() => {
  for (const timer of [headerTimer, offlineProbe, actionsTimer])
    clearInterval(timer);
});
</script>

<template>
  <q-layout view="hHh LpR fFf">
    <a href="#main" class="skip-link">Skip to content</a>
    <q-drawer
      v-if="!isPopout"
      v-model="drawerOpen"
      class="app-nav"
      show-if-above
      bordered
      :width="232"
      :mini-width="56"
      :mini="!railWide"
    >
      <div class="nav-brand" :class="{ 'nav-brand--compact': !railWide }">
        <img
          v-if="branding.logo"
          class="nav-brand__logo"
          :src="branding.logo"
          :alt="logoAlt"
        />
        <q-icon v-else name="hub" size="24px" />
        <div v-if="railWide" class="nav-brand__copy">
          <strong>{{ branding.productName }}</strong>
          <span v-if="serverVersion">v{{ serverVersion }}</span>
        </div>
        <q-btn
          v-if="!$q.screen.lt.md"
          class="nav-collapse"
          size="sm"
          flat
          dense
          round
          :icon="railToggle.icon"
          :aria-label="railToggle.label"
          @click="toggleRail"
        >
          <q-tooltip>{{ railToggle.label }}</q-tooltip>
        </q-btn>
      </div>
      <FileBar
        :expanded="railWide"
        :alerts-count="alertTotal"
        :actions-count="pendingActions"
      />
      <AccountMenu :compact="!railWide" />
    </q-drawer>

    <q-header class="app-header" bordered>
      <q-banner
        v-for="banner in banners"
        :key="banner.kind"
        :class="`app-banner app-banner--${banner.kind} text-center`"
        inline-actions
      >
        {{ banner.text }}
        <q-btn
          icon="refresh"
          :color="banner.color"
          :label="banner.action"
          @click="banner.run"
        />
      </q-banner>
      <q-toolbar class="app-toolbar">
        <q-btn
          v-for="button in leadButtons"
          :key="button.key"
          :icon="button.icon"
          :aria-label="button.label"
          flat
          dense
          round
          @click="button.run"
        >
          <q-tooltip>{{ button.label }}</q-tooltip>
        </q-btn>
        <div v-if="!railWide || $q.screen.lt.md" class="header-brand">
          <img
            v-if="branding.logo"
            class="header-brand__logo"
            :src="branding.logo"
            :alt="logoAlt"
          />
          <strong v-else>{{ branding.productName }}</strong>
        </div>
        <nav class="page-context" aria-label="Breadcrumb">
          <ol class="page-context__crumbs">
            <li v-for="(crumb, i) in crumbs" :key="i">
              <router-link v-if="crumb.to" :to="crumb.to" class="rmm-link">{{
                crumb.label
              }}</router-link>
              <span
                v-else
                :class="{ 'page-context__current': i === crumbs.length - 1 }"
                :aria-current="i === crumbs.length - 1 ? 'page' : undefined"
                >{{ crumb.label }}</span
              >
            </li>
          </ol>
          <q-chip
            v-if="updateAvailable"
            class="update-chip"
            icon="update"
            dense
            :color="warnColor"
            :clickable="canUpdateServer"
            @click="openUpdates"
          >
            v{{ latestVersion }} available
            <q-tooltip>{{ updateHint }}</q-tooltip>
          </q-chip>
          <!-- only once the TLS certificate is close to expiry -->
          <q-chip
            v-if="
              fleet.daysUntilCertExpires != null &&
              fleet.daysUntilCertExpires <= 15
            "
            text-color="white"
            icon="warning"
            dense
            :color="alarmColor"
            :label="`SSL certificate expires in ${fleet.daysUntilCertExpires} days`"
          />
        </nav>
        <q-space />
        <q-input
          v-if="!isPopout"
          v-model="searchText"
          class="global-search"
          placeholder="Search devices, clients, sites…"
          aria-label="Search devices, clients and sites"
          outlined
          dense
          clearable
          @keyup.enter="submitSearch"
          @clear="submitSearch"
        >
          <template #prepend>
            <q-icon name="search" size="20px" class="rmm-muted" />
          </template>
        </q-input>
        <FleetStatusButton />
        <q-btn
          class="toolbar-control"
          flat
          dense
          round
          :icon="themeToggle.icon"
          :aria-label="themeToggle.label"
          @click="darkMode = !darkMode"
        >
          <q-tooltip>{{ themeToggle.label }}</q-tooltip>
        </q-btn>
        <AlertsIcon @count="alertTotal = $event" />
        <AccountMenu v-if="isPopout" in-header />
      </q-toolbar>
    </q-header>

    <q-page-container id="main" tabindex="-1">
      <router-view />
    </q-page-container>
  </q-layout>
</template>

<style scoped>
.skip-link {
  position: absolute;
  left: -9999px;
  top: 0;
  z-index: 10000;
  padding: 8px 16px;
  background: var(--rmm-nav-bg);
  color: var(--rmm-nav-text);
  border-radius: 0 0 4px 0;
}

.skip-link:focus {
  left: 0;
}

/* the drawer class lands on quasar's inner content div, which carries no
   scope attribute, so a scoped rule would never match it */
:global(.q-drawer__content.app-nav) {
  color: var(--rmm-nav-text);
  background: var(--rmm-nav-bg);
}

.nav-brand {
  display: flex;
  height: 58px;
  align-items: center;
  gap: 8px;
  padding: 0 8px 0 15px;
  border-bottom: 1px solid var(--rmm-nav-border);
}

.nav-brand--compact {
  flex-direction: column;
  justify-content: center;
  height: 78px;
  padding: 6px 0;
}

.nav-brand__logo {
  max-width: 150px;
  max-height: 28px;
  object-fit: contain;
}

.nav-brand--compact .nav-brand__logo {
  max-width: 26px;
}

.nav-brand__copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  line-height: 1.2;
}

.nav-brand__copy strong {
  overflow: hidden;
  color: var(--rmm-nav-text);
  font-size: 0.92rem;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.nav-brand__copy span {
  color: var(--rmm-nav-text-muted);
  font-size: var(--rmm-fs-xs);
  letter-spacing: 0.04em;
}

.nav-collapse {
  flex-shrink: 0;
  color: var(--rmm-nav-text-muted);
}

.app-header {
  color: var(--rmm-text);
  background: var(--rmm-surface);
}

.app-banner {
  margin: 0;
  border-width: 0 0 1px;
  border-radius: 0;
}

.app-banner--offline {
  color: var(--rmm-status-negative);
  background: color-mix(in srgb, var(--q-negative) 12%, var(--rmm-surface));
}

.app-banner--update {
  color: var(--rmm-status-info);
  background: color-mix(in srgb, var(--q-info) 10%, var(--rmm-surface));
}

.app-toolbar {
  min-height: 56px;
  gap: 8px;
  padding: 0 16px;
}

/* keeps the product visible while the rail is collapsed or off-screen */
.header-brand {
  display: flex;
  min-width: 0;
  flex-shrink: 0;
  align-items: center;
  padding-left: 4px;
  line-height: 1.1;
}

.header-brand__logo {
  max-width: 120px;
  max-height: 20px;
  object-fit: contain;
}

.header-brand strong {
  overflow: hidden;
  font-size: 0.86rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* the device name gives way first; brand, scope crumbs and connection
   state keep their width */
.page-context {
  display: flex;
  min-width: 0;
  flex-shrink: 100;
  align-items: center;
  gap: 9px;
  padding: 0 8px;
}

.page-context__crumbs {
  display: flex;
  min-width: 0;
  align-items: center;
  margin: 0;
  padding: 0;
  color: var(--rmm-text-muted);
  font-size: var(--rmm-fs-md);
  list-style: none;
}

.page-context__crumbs li {
  display: flex;
  align-items: center;
  min-inline-size: 0;
  white-space: nowrap;
  overflow: hidden;
}

.page-context__crumbs li:last-child {
  flex-shrink: 100;
}

.page-context__crumbs li + li::before {
  padding: 0 8px;
  color: var(--rmm-text-subtle);
  content: "/";
}

.page-context__crumbs .rmm-link {
  color: var(--rmm-text-muted);
}

.page-context__current {
  overflow: hidden;
  color: var(--rmm-text);
  font-weight: 600;
  text-overflow: ellipsis;
}

.update-chip {
  margin: 0 0 0 4px;
  font-size: var(--rmm-fs-xs);
}

.global-search {
  width: 320px;
}

.global-search :deep(.q-field__control) {
  height: 38px;
  border-radius: 999px;
  background: var(--rmm-surface-2);
}

.global-search :deep(.q-field__control::before) {
  border-color: var(--rmm-border-strong);
}

.global-search :deep(.q-field__marginal) {
  height: 38px;
}

.toolbar-control {
  margin: 0 2px;
}

@media (max-width: 1100px) {
  .update-chip {
    display: none;
  }

  /* still room for the whole placeholder */
  .global-search {
    width: 260px;
  }
}

@media (max-width: 800px) {
  .global-search {
    display: none;
  }

  .header-brand,
  .page-context {
    flex-shrink: 1;
  }
}
</style>
