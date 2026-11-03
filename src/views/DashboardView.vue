<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<script setup>
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  provide,
  reactive,
  ref,
  watch,
} from "vue";
import { useStore } from "vuex";
import { useRoute, useRouter } from "vue-router";
import { useQuasar } from "quasar";
import { StorageSerializers, useStorage } from "@vueuse/core";
import { useDashboardStore } from "@/stores/dashboard";
import { DASHBOARD_REFRESH_INTERVAL } from "@/constants/constants";
import { needsAttention } from "@/utils/format";
import { deviceName } from "@/utils/deviceName";
import AgentTable from "@/components/AgentTable.vue";
import DeviceQuickPanel from "@/components/dashboard/DeviceQuickPanel.vue";
import FleetOverview from "@/components/dashboard/FleetOverview.vue";
import InstallAgent from "@/components/modals/agents/InstallAgent.vue";
import DashboardClientsPanel from "./DashboardClientsPanel.vue";
import {
  ATTENTION_HINT,
  FILTER_MENU,
  SEARCH_WORDS,
  useDashboardFilters,
} from "./dashboardFilters";

// ---- table columns

// most failing checks first, then warnings, then info
function bySeverity(a, b) {
  for (const level of ["failing", "warning", "info"]) {
    const diff = parseInt(b[level]) - parseInt(a[level]);
    if (diff) return diff;
  }
  return 0;
}

const STATUS_ORDER = ["online", "offline", "overdue"];
const statusRank = (status) =>
  STATUS_ORDER.includes(status) ? STATUS_ORDER.indexOf(status) : 3;

const sortable = (name, label, field, sort) => ({
  name,
  label,
  field,
  align: "left",
  sortable: true,
  ...(sort && { sort }),
});

// status, device and the other telling columns come first and survive a
// narrow table; the alert switches change once per agent and come last
const COLUMNS = [
  sortable("hostname", "Device", deviceName),
  sortable("client_name", "Client / Site", "client_name"),
  sortable("site_name", "Site", "site_name"),
  sortable("tags", "Tags", (row) =>
    (row.tags || []).map((tag) => tag.name).join(", "),
  ),
  sortable("agentstatus", "Status", "status", (a, b) => {
    return statusRank(a) - statusRank(b);
  }),
  sortable("checks-status", "Checks", "checks", bySeverity),
  sortable("plat", "OS", "plat"),
  sortable("mon-type", "Type", "monitoring_type"),
  sortable("patchespending", "Patches pending", "has_patches_pending"),
  sortable("pendingactions", "Pending actions", "pending_actions_count"),
  sortable("needs_reboot", "Reboot", "needs_reboot"),
  sortable("last_seen", "Last Response", "last_seen"),
  sortable("user", "User", "logged_username"),
  { name: "italic", field: "italic" },
  sortable("description", "Description", "description"),
  sortable("boot_time", "Boot time", "boot_time"),
  { name: "smsalert", label: "SMS alert", align: "left" },
  { name: "emailalert", label: "Email alert", align: "left" },
  { name: "dashboardalert", label: "Dashboard alert", align: "left" },
  { name: "actions", label: "Actions", align: "right", field: () => "" },
];
const SHOWN_COLUMNS = COLUMNS.map((col) => col.name).filter(
  (name) => name !== "italic",
);

const TYPE_TABS = [
  {
    name: "mixed",
    label: "All devices",
    tip: "Show all agents — closes the open agent panel",
  },
  { name: "attention", label: "Needs attention", tip: ATTENTION_HINT },
  {
    name: "server",
    label: "Servers",
    tip: "Show servers only — closes the open agent panel",
  },
  {
    name: "workstation",
    label: "Workstations",
    tip: "Show workstations only — closes the open agent panel",
  },
];
const TAB_LOOK = {
  dense: true,
  noCaps: true,
  activeColor: "primary",
  indicatorColor: "primary",
  align: "left",
  narrowIndicator: true,
};

// ?client= or ?site= as the store's tree key
const scopeOfQuery = (query) =>
  query.client
    ? `Client|${query.client}`
    : query.site
      ? `Site|${query.site}`
      : "";

// ---- store, URL and state

const store = useStore();
const route = useRoute();
const router = useRouter();
const $q = useQuasar();
const fleet = useDashboardStore();

// A bookmarked or shared link opens the same view with one request: its
// scope and device reach the store before the watchers below load anything.
// Plain commits, so nothing is pushed back onto the URL.
const linkedScope = scopeOfQuery(route.query);
if (linkedScope && linkedScope !== store.state.selectedTree)
  store.commit("setSelectedTree", linkedScope);
if (route.query.agent) store.commit("setActiveRow", route.query.agent);

const clientsOpen = useStorage("rmm-dashboard-clients-open", false);
// the type shown in this browser session; the server preference picks the
// first one only
const sessionType = useStorage("rmm-dashboard-tab", null, sessionStorage, {
  writeDefaults: false,
});
// the details' share of the stacked split, saved once the separator is dragged
const splitShare = useStorage("rmm-dashboard-split", null, undefined, {
  writeDefaults: false,
  serializer: StorageSerializers.number,
});

const {
  filters,
  tableSearch,
  filtering,
  chips,
  summary,
  resetFilters,
  resetAll,
  dropChip,
  restore,
  applyWord,
} = useDashboardFilters(route.query.search);

// the store stays on "mixed" so one request holds every type and the tab
// counts are exact; this is the type the table shows
const shownType = ref(
  sessionType.value || store.state.defaultAgentTblTab || null,
);
const overviewOpen = ref(false);
const installer = reactive({ open: false, site: null });
const menus = reactive({ filter: false, help: false, columns: false });
const shownCount = ref(null);
const pageRef = ref(null);
const agentTableRef = ref(null);
// set while a scope change must keep the search (links, "search all clients")
let keepSearch = false;
let refreshTimer;

// children reload the table through this
provide("refreshDashboard", (clearScope, closeDetails) => {
  if (closeDetails) store.commit("destroySubTable");
  store.dispatch("refreshDashboard", clearScope);
});

// ---- derived state

const agents = computed(() => store.state.agents);
const activeId = computed(() => store.state.selectedRow);
const nodes = computed(() => store.state.tree);

const scope = computed({
  get: () => store.state.selectedTree,
  set(raw) {
    store.commit("setSelectedTree", raw);
    store.commit("destroySubTable");
  },
});

const typeRows = computed(() =>
  shownType.value === "mixed"
    ? agents.value
    : agents.value.filter((a) => a.monitoring_type === shownType.value),
);

// the groups rail narrows the table only; tiles and tabs keep the scope
const tableRows = computed(() => {
  const members = filters.group?.members;
  const tagId = filters.tag?.id;
  if (!members && !tagId) return typeRows.value;
  return typeRows.value.filter(
    (a) =>
      (!members || members.has(a.agent_id)) &&
      (!tagId || (a.tags || []).some((tag) => tag.id === tagId)),
  );
});

// the rows the table holds for this scope and type; a tile filters the same
// set
const tileCounts = computed(() => {
  const { agentTableLoading, agentsError } = store.state;
  if (!shownType.value || agentTableLoading || agentsError) return null;
  const rows = typeRows.value;
  const count = (status) => rows.filter((a) => a.status === status).length;
  return {
    total: rows.length,
    online: count("online"),
    offline: count("offline"),
    overdue: count("overdue"),
    attention: rows.filter(needsAttention).length,
  };
});

// every type is loaded, so each tab count is exact
const tabCounts = computed(() => {
  const all = agents.value;
  const count = (test) => all.filter(test).length;
  return {
    mixed: all.length,
    attention: count(needsAttention),
    server: count((a) => a.monitoring_type === "server"),
    workstation: count((a) => a.monitoring_type === "workstation"),
  };
});

// "Needs attention" is All plus the preset filter
const tabModel = computed({
  get: () =>
    filters.flags.needsAttention && shownType.value === "mixed"
      ? "attention"
      : shownType.value,
  set(name) {
    if (name === "attention") {
      shownType.value = "mixed";
      filters.flags.needsAttention = true;
    } else {
      filters.flags.needsAttention = false;
      shownType.value = name;
    }
  },
});

// tile wording follows the shown type, not the client or site
const deviceKind = computed(
  () =>
    ({ server: "servers", workstation: "workstations" })[shownType.value] ||
    "devices",
);

const scopeLabel = computed(() => {
  const raw = scope.value;
  for (const client of nodes.value) {
    if (client.raw === raw) return client.label;
    const site = (client.children || []).find((s) => s.raw === raw);
    if (site) return `${client.label} / ${site.label}`;
  }
  return "All clients";
});

const tiles = computed(() => {
  const counts = tileCounts.value;
  const show = (key) => (counts ? counts[key] : "—");
  return [
    {
      key: "total",
      icon: "devices",
      label: `Total ${deviceKind.value}`,
      value: show("total"),
      filter: "all",
    },
    {
      key: "online",
      dot: "positive",
      label: "Online",
      value: show("online"),
      filter: "online",
    },
    {
      key: "offline",
      dot: "neutral",
      label: "Offline",
      value: show("offline"),
      filter: "offline",
      tip: "Missed check-in, often just shut down, and not overdue",
    },
    {
      key: "overdue",
      dot: "negative",
      label: "Overdue",
      value: show("overdue"),
      filter: "overdue",
      tip: "Monitored for outages and silent past its overdue time",
    },
    {
      key: "attention",
      dot: "warning",
      label: "Needs attention",
      value: show("attention"),
      filter: "attention",
      tip: ATTENTION_HINT,
    },
  ];
});

const clientOptions = computed(() => [
  { label: "All clients", value: "" },
  ...nodes.value.map((c) => ({ label: c.label, value: c.raw })),
]);

// the client a site scope belongs to
const scopeClient = computed(() => {
  const raw = scope.value || "";
  if (!raw || raw.startsWith("Client|")) return raw;
  const owner = nodes.value.find((c) => c.children?.some((s) => s.raw === raw));
  return owner?.raw || "";
});

const siteOptions = computed(() => {
  const owner = scopeClient.value;
  const clients = owner
    ? nodes.value.filter((c) => c.raw === owner)
    : nodes.value;
  const sites = clients.flatMap((c) =>
    (c.children || []).map((s) => ({
      label: owner ? s.label : `${c.label} / ${s.label}`,
      value: s.raw,
    })),
  );
  return [{ label: "All sites", value: "" }, ...sites];
});

const scopePickers = computed(() => [
  {
    label: "Client",
    value: scopeClient.value,
    options: clientOptions.value,
    pick: (raw) => applyScope(raw || ""),
  },
  {
    label: "Site",
    value: scope.value?.startsWith("Site|") ? scope.value : "",
    options: siteOptions.value,
    disable: siteOptions.value.length < 2,
    pick: (raw) => applyScope(raw || scopeClient.value),
  },
]);

const activeAgent = computed(() =>
  activeId.value
    ? agents.value.find((a) => a.agent_id === activeId.value) || null
    : null,
);
// details only for a row the loaded list holds, so an id from the URL never
// opens an empty card
const detailOpen = computed(() => !!activeAgent.value);
// the open clients panel (up to 280px and its gap) would leave the table
// about 600px beside the details, so they go beside it only on wider screens
const detailBeside = computed(
  () => $q.screen.width >= (clientsOpen.value ? 1810 : 1500),
);
// the selected row while its details sit under the table, null beside it
const stackedRow = computed(() =>
  detailBeside.value || !detailOpen.value ? null : activeId.value,
);
// beside the table the details are a fixed 440px column, stacked they take
// a draggable share of the height
const detailLimits = computed(() => {
  if (!detailOpen.value) return [0, 0];
  return detailBeside.value ? [440, 440] : [30, 70];
});
const detailSize = computed({
  get() {
    if (!detailOpen.value) return 0;
    if (detailBeside.value) return 440;
    // until the separator is dragged a short window keeps more table rows
    let share = splitShare.value;
    if (!Number.isFinite(share)) share = $q.screen.height < 900 ? 0.4 : 0.5;
    return Math.min(Math.max(share * 100, 30), 70);
  },
  set(percent) {
    if (detailOpen.value && !detailBeside.value)
      splitShare.value = percent / 100;
  },
});

// rows left after search and filters
const countLabel = computed(() => {
  const total = typeRows.value.length;
  const shown = shownCount.value ?? total;
  return shown === total ? `${total} agents` : `${shown} of ${total} agents`;
});

// The column picker and export sit in this toolbar so the table spends no
// row of its own on them; the choice and its width default stay in
// AgentTable.
const pickerColumns = computed(
  () => agentTableRef.value?.columnPickerOptions || [],
);
const columnChoice = computed({
  get: () => agentTableRef.value?.effectiveVisibleColumns || [],
  set(names) {
    if (agentTableRef.value)
      agentTableRef.value.effectiveVisibleColumns = names;
  },
});

const urlState = computed(() =>
  [scope.value, activeId.value, tableSearch.value].join("\n"),
);

// ---- actions

function showAllClients() {
  if (store.state.clearSearchWhenSwitching) resetAll();
  store.dispatch("refreshDashboard", true);
}

// a node picked in the tree
function pickScope(raw) {
  scope.value = raw;
  store.dispatch("refreshDashboard");
}

// the client and site selects drive the same scope as the tree
function applyScope(raw) {
  if (raw === (scope.value || "")) return;
  if (raw) pickScope(raw);
  else showAllClients();
}

// the empty table's shortcut: all clients, same search
function searchAllClients() {
  keepSearch = true;
  store.dispatch("refreshDashboard", true);
  nextTick(() => (keepSearch = false));
}

// a tile filters the scope and type its number came from
function filterFromTile(what) {
  resetFilters();
  filters.text = "";
  if (what === "attention") filters.flags.needsAttention = true;
  else filters.availability = what;
}

// Overview numbers are fleet-wide, so the scope widens to match first and
// typed text is dropped. A changed scope needs a reload, the shown type is
// filtered locally. The word waits a tick so the scope watcher's own reset
// (clearSearchWhenSwitching) cannot wipe it.
function filterFromOverview(word) {
  resetFilters();
  filters.text = "";
  const reload = scope.value !== "";
  scope.value = "";
  shownType.value = "mixed";
  if (reload) store.dispatch("loadAgents");
  nextTick(() => applyWord(word));
  overviewOpen.value = false;
}

function installFromOverview() {
  overviewOpen.value = false;
  installer.open = true;
}

function installFor({ id }) {
  installer.site = id;
  installer.open = true;
}

// a site scope preselects its site in the installer
function openInstaller() {
  const raw = scope.value;
  if (raw?.startsWith("Site|")) installFor({ id: raw.split("|")[1] });
  else installer.open = true;
}

function closeInstaller() {
  installer.open = false;
  installer.site = null;
}

// The URL mirrors scope, device and search (/?client=&site=&agent=&search=
// reopens the view) and is always built from the store. A scope change gets
// a history entry so Back returns to the previous scope; picking rows or
// typing does not. `replace` keeps the scope out of the history too (mount).
function syncQuery(replace = false) {
  const [type, id] = (scope.value || "").split("|");
  const now = route.query;
  const next = {
    client: type === "Client" ? id : undefined,
    site: type === "Site" ? id : undefined,
    agent: activeId.value || undefined,
    search: tableSearch.value || undefined,
  };
  const differs = (key) => (now[key] || undefined) !== next[key];
  const scopeMoved = differs("client") || differs("site");
  if (!scopeMoved && !differs("agent") && !differs("search")) return;
  const method = scopeMoved && !replace ? "push" : "replace";
  router[method]({ query: { ...now, ...next } });
}

// ---- background refresh

function stopRefresh() {
  window.clearInterval(refreshTimer);
  refreshTimer = undefined;
}

function quietReload() {
  if (fleet.isOffline) return;
  // without a type preference (dashinfo failed or still running) a list
  // would ask for monitoring_type=null; ask for the preference, its arrival
  // loads the table
  if (!store.state.defaultAgentTblTab) {
    store.dispatch("getDashInfo");
    return;
  }
  if (store.state.agentTableLoading || agentTableRef.value?.rowMenuOpen) return;
  store.dispatch("loadAgents", { silent: true });
}

function startRefresh(now = false) {
  stopRefresh();
  if (document.visibilityState !== "visible") return;
  if (now) quietReload();
  refreshTimer = window.setInterval(quietReload, DASHBOARD_REFRESH_INTERVAL);
}

function onVisibility() {
  if (document.visibilityState === "visible") startRefresh(true);
  else stopRefresh();
}

// the page is the viewport under the header, offline banner included, and
// scrolls when its content is taller
const fillViewport = (offset, height) => ({ height: `${height - offset}px` });

// ---- watchers. They are created in this order on purpose: a scope change
// resets the search before the URL is written

watch(
  () => fleet.isOffline,
  (offline) => {
    if (!offline) startRefresh(true);
  },
);

// stacked details open below the table; bring them and the row into view
watch(stackedRow, (row) => {
  if (!row) return;
  nextTick(() => {
    const page = pageRef.value?.$el;
    if (!page) return;
    page.scrollTo({ top: page.scrollHeight });
    page
      .querySelector('.agent-table tbody tr[aria-selected="true"]')
      ?.scrollIntoView({ block: "nearest" });
  });
});

watch(scope, () => {
  if (!keepSearch && store.state.clearSearchWhenSwitching) resetAll();
});

// scope, device and search changing in one tick make one navigation
watch(urlState, () => syncQuery());

// Back/Forward, or a link that changes the query only (the summary's client
// and site links), moves the view with the URL
watch(
  () => route.query,
  (query) => {
    if (route.name !== "Dashboard") return;
    const linked = scopeOfQuery(query);
    if (linked !== (scope.value || "")) {
      // a link that brings its own search keeps it through the scope reset
      keepSearch = !!query.search;
      store.commit("setSelectedTree", linked);
      store.dispatch("loadAgents");
      nextTick(() => (keepSearch = false));
    }
    const agent = query.agent || null;
    if (agent !== (activeId.value || null)) store.commit("setActiveRow", agent);
    // the header search lands here as ?search=
    const search = query.search || "";
    if (search !== tableSearch.value) restore(search);
  },
);

// getDashInfo brings the type preference. It picks the shown type once (a
// device in the link stays on All), then the store is pinned to "mixed" so
// loadAgents fetches every type; that pin is what loads the table. A cold
// "/" waits for the preference instead of asking for monitoring_type=null.
// A later save arrives with the pin as `before` and switches the shown
// type; a saved "mixed" equals the pin and waits for the next session.
watch(
  () => store.state.defaultAgentTblTab,
  (pref, before) => {
    if (!pref) return;
    if (!shownType.value) shownType.value = activeId.value ? "mixed" : pref;
    else if (before && pref !== "mixed") shownType.value = pref;
    if (pref === "mixed") store.dispatch("loadAgents");
    else store.commit("SET_DEFAULT_AGENT_TBL_TAB", "mixed");
  },
  { immediate: true },
);

// another type filters the loaded rows and closes the details
watch(shownType, (type, before) => {
  if (!type) return;
  if (before) store.commit("destroySubTable");
  sessionType.value = type;
});

// an id the loaded list does not hold (a removed device, a foreign link) is
// dropped, which clears ?agent= as well
watch(agents, () => {
  if (activeId.value && !activeAgent.value) store.commit("destroySubTable");
});

onMounted(() => {
  store.dispatch("loadTree");
  document.addEventListener("visibilitychange", onVisibility);
  startRefresh();
  // back from the device page the store may hold a scope or device the URL
  // lacks; the URL follows so a reload keeps the view
  syncQuery(true);
});

onBeforeUnmount(() => {
  stopRefresh();
  document.removeEventListener("visibilitychange", onVisibility);
});
</script>

<template>
  <q-page ref="pageRef" class="dashboard-page" :style-fn="fillViewport">
    <header class="workspace-heading">
      <div>
        <h1>Devices</h1>
        <p>Monitor, manage and support your fleet.</p>
      </div>
      <div class="workspace-heading__actions">
        <q-btn
          outline
          no-caps
          aria-haspopup="dialog"
          icon="monitor_heart"
          label="Fleet health"
          @click="overviewOpen = true"
        >
          <q-tooltip
            >Fleet-wide overview of health, patches and alerts</q-tooltip
          >
        </q-btn>
        <q-btn
          unelevated
          no-caps
          icon="cloud_download"
          label="Install agent"
          color="primary"
          @click="openInstaller"
        />
      </div>
    </header>

    <div
      class="fleet-metrics"
      role="group"
      :aria-label="`Counts of ${deviceKind} for ${scopeLabel}`"
    >
      <component
        :is="tile.filter ? 'button' : 'div'"
        v-for="tile in tiles"
        :key="tile.key"
        class="fleet-metric"
        @click="tile.filter && filterFromTile(tile.filter)"
      >
        <span v-if="tile.icon" class="fleet-metric__icon"
          ><q-icon :name="tile.icon"
        /></span>
        <span
          v-else
          :class="['fleet-metric__dot', `fleet-metric__dot--${tile.dot}`]"
        />
        <span
          ><span>{{ tile.label }}</span
          ><strong>{{ tile.value }}</strong></span
        >
        <q-tooltip v-if="tile.tip">{{ tile.tip }}</q-tooltip>
      </component>
    </div>

    <div class="workspace-filters">
      <q-btn
        outline
        round
        icon="account_tree"
        class="workspace-filters__tree"
        aria-label="Browse clients, sites, groups and tags"
        :aria-expanded="clientsOpen"
        @click="clientsOpen = !clientsOpen"
      >
        <q-tooltip>{{
          clientsOpen
            ? "Hide the clients panel"
            : "Browse clients, sites, groups and tags"
        }}</q-tooltip>
      </q-btn>
      <q-select
        v-for="picker in scopePickers"
        :key="picker.label"
        :model-value="picker.value"
        :options="picker.options"
        :disable="picker.disable"
        :aria-label="picker.label"
        class="workspace-filters__select"
        outlined
        dense
        options-dense
        emit-value
        map-options
        @update:model-value="picker.pick"
      />
      <q-input
        v-model="filters.text"
        class="agent-search"
        placeholder="Find a device…"
        aria-label="Find a device"
        outlined
        dense
        clearable
        @clear="filters.text = ''"
      >
        <template #prepend><q-icon name="search" class="rmm-muted" /></template>
        <template #append>
          <q-btn
            flat
            round
            dense
            icon="help_outline"
            class="rmm-muted"
            aria-label="Show search tips and is: filters"
          >
            <q-tooltip v-if="!menus.help"
              >Show search tips and is: filters</q-tooltip
            >
            <q-menu v-model="menus.help" max-width="340px">
              <div class="search-help q-pa-md">
                <div class="rmm-label">Search</div>
                <p class="q-mb-sm">
                  Every word must match. Words match the shown columns plus IP,
                  serial, OS, agent version, hardware and custom fields.
                </p>
                <div class="rmm-label">Filters</div>
                <ul class="search-help__tokens">
                  <li v-for="word in SEARCH_WORDS" :key="word" class="rmm-mono">
                    {{ word }}
                  </li>
                </ul>
                <p class="rmm-muted q-mb-none q-mt-sm">
                  is:expired means not seen for 30+ days
                </p>
              </div>
            </q-menu>
          </q-btn>
        </template>
      </q-input>
      <q-btn
        outline
        no-caps
        icon="filter_alt"
        :label="chips.length ? `Filter (${chips.length})` : 'Filter'"
        :color="filtering ? 'primary' : undefined"
        :aria-expanded="menus.filter"
        aria-label="Filter agent table"
      >
        <q-tooltip v-if="!menus.filter"
          >Filter agents by health and availability</q-tooltip
        >
        <q-menu v-model="menus.filter" no-route-dismiss>
          <q-list dense>
            <template v-for="section in FILTER_MENU" :key="section.header">
              <q-item-label header>{{ section.header }}</q-item-label>
              <q-item v-for="row in section.rows" :key="row.label">
                <q-item-section side>
                  <q-radio
                    v-if="section.radio"
                    v-model="filters.availability"
                    :val="row.value"
                    :aria-label="row.label"
                  />
                  <q-checkbox
                    v-else
                    v-model="filters.flags[row.key]"
                    :aria-label="row.label"
                  />
                </q-item-section>
                <q-item-section>
                  <q-item-label>{{ row.label }}</q-item-label>
                  <q-item-label caption>{{ row.hint }}</q-item-label>
                </q-item-section>
              </q-item>
            </template>
          </q-list>
          <div class="row no-wrap justify-end q-pa-sm filter-menu__footer">
            <q-btn
              v-close-popup
              flat
              no-caps
              label="Clear filters"
              @click="resetFilters"
            />
            <q-btn
              v-close-popup
              unelevated
              no-caps
              class="q-ml-sm"
              label="Done"
              color="primary"
            />
          </div>
        </q-menu>
      </q-btn>
      <q-btn
        outline
        no-caps
        icon="view_column"
        label="Columns"
        aria-label="Choose columns"
        :aria-expanded="menus.columns"
      >
        <q-tooltip v-if="!menus.columns">Choose columns</q-tooltip>
        <q-menu v-model="menus.columns">
          <q-option-group
            :options="pickerColumns"
            type="checkbox"
            v-model="columnChoice"
            class="column-picker q-pa-sm"
          />
          <q-separator />
          <div class="q-pa-xs">
            <q-btn
              flat
              dense
              no-caps
              label="Reset to default"
              class="full-width"
              @click="agentTableRef?.resetColumns()"
            />
          </div>
        </q-menu>
      </q-btn>
      <q-btn
        outline
        round
        icon="archive"
        aria-label="Export table as CSV"
        @click="agentTableRef?.exportTable()"
      >
        <q-tooltip>Export table as CSV</q-tooltip>
      </q-btn>
    </div>

    <div
      class="dashboard-workspace"
      :class="{
        'dashboard-workspace--clients': clientsOpen,
        'dashboard-workspace--stacked': detailOpen && !detailBeside,
      }"
    >
      <DashboardClientsPanel
        v-if="clientsOpen"
        v-model:group="filters.group"
        v-model:tag="filters.tag"
        @select="pickScope"
        @all-clients="showAllClients"
        @install="installFor"
      />
      <q-splitter
        v-model="detailSize"
        reverse
        class="device-workspace"
        :class="{ 'device-workspace--detail': detailOpen }"
        :horizontal="!detailBeside"
        :unit="detailBeside ? 'px' : '%'"
        :limits="detailLimits"
        :disable="!detailOpen || detailBeside"
      >
        <template #before>
          <section class="agent-panel rmm-card">
            <div class="rmm-toolbar agent-toolbar">
              <q-tabs v-model="tabModel" v-bind="TAB_LOOK" class="agent-modes">
                <q-tab
                  v-for="tab in TYPE_TABS"
                  :key="tab.name"
                  :name="tab.name"
                >
                  <span class="agent-modes__label"
                    >{{ tab.label }}
                    <span class="agent-modes__count">{{
                      tabCounts[tab.name]
                    }}</span></span
                  >
                  <q-tooltip>{{ tab.tip }}</q-tooltip>
                </q-tab>
              </q-tabs>
              <q-space />
              <!-- one removable chip per filter, so dropping one does not take
                   the menu; the suffix says when the count is fleet-wide -->
              <div
                v-if="chips.length"
                class="row items-center active-filter-chips"
              >
                <q-chip
                  v-for="chip in chips"
                  :key="chip.key"
                  :aria-label="`Remove filter: ${chip.label}`"
                  color="primary"
                  text-color="white"
                  dense
                  removable
                  @remove="dropChip(chip.key)"
                  >{{ chip.label
                  }}<template v-if="scope === ''">
                    · all clients</template
                  ></q-chip
                >
                <q-btn
                  flat
                  dense
                  no-caps
                  class="clear-filters"
                  label="Clear filters"
                  color="primary"
                  @click="resetFilters"
                />
              </div>
              <span v-else class="rmm-muted agent-toolbar__count">{{
                countLabel
              }}</span>
            </div>
            <AgentTable
              ref="agentTableRef"
              :agents="tableRows"
              :mode="shownType"
              :columns="COLUMNS"
              :visible-columns="SHOWN_COLUMNS"
              :search="tableSearch"
              :search-display="summary"
              @filtered-count="shownCount = $event"
              @search-all-clients="searchAllClients"
              @clear-filters="resetAll"
              @filter-tag="filters.tag = $event"
              @install="openInstaller"
            />
          </section>
        </template>
        <template #separator>
          <q-avatar
            v-if="detailOpen && !detailBeside"
            color="primary"
            text-color="white"
            icon="drag_indicator"
            size="20px"
          />
        </template>
        <template #after>
          <section
            v-if="detailOpen"
            class="device-inspector rmm-card"
            aria-label="Device details"
          >
            <DeviceQuickPanel
              :agent="activeAgent"
              @close="store.commit('destroySubTable')"
            />
          </section>
        </template>
      </q-splitter>
    </div>

    <q-dialog v-model="overviewOpen" aria-labelledby="fleet-overview-title">
      <q-card class="fleet-overview-dialog rmm-card">
        <FleetOverview
          @filter="filterFromOverview"
          @install="installFromOverview"
        >
          <template #close>
            <q-btn
              v-close-popup
              flat
              round
              dense
              icon="close"
              aria-label="Close fleet overview"
            >
              <q-tooltip>Close fleet overview</q-tooltip>
            </q-btn>
          </template>
        </FleetOverview>
      </q-card>
    </q-dialog>

    <q-dialog
      v-model="installer.open"
      aria-labelledby="install-agent-title"
      @hide="closeInstaller"
    >
      <InstallAgent
        :sitepk="installer.site === null ? undefined : parseInt(installer.site)"
        @close="closeInstaller"
      />
    </q-dialog>
  </q-page>
</template>

<style scoped>
/* heading, tiles and filters keep their height; the workspace takes the
   rest down to a usable table, then the page scrolls */
.dashboard-page {
  display: flex;
  flex-direction: column;
  padding: 28px;
  overflow-y: auto;
  background: var(--rmm-bg);
}

.dashboard-page > * {
  flex-shrink: 0;
}

.workspace-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 24px;
}

.workspace-heading h1 {
  margin: 0 0 6px;
  font-size: 32px;
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: -0.02em;
}

.workspace-heading p {
  margin: 0;
  color: var(--rmm-text-muted);
}

.workspace-heading__actions {
  display: flex;
  flex-shrink: 0;
  gap: 10px;
}

.workspace-heading .q-btn {
  min-height: 42px;
}

.fleet-metrics {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.fleet-metric {
  display: flex;
  min-height: 90px;
  align-items: center;
  gap: 16px;
  padding: 18px 20px;
  border: 1px solid var(--rmm-border);
  border-radius: var(--rmm-radius-lg);
  background: var(--rmm-surface);
  color: var(--rmm-text);
  font: inherit;
  text-align: left;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease,
    transform 0.15s ease;
}

button.fleet-metric {
  cursor: pointer;
}

button.fleet-metric:hover {
  border-color: var(--rmm-border-strong);
  box-shadow: var(--rmm-shadow-lg);
  transform: translateY(-1px);
}

.fleet-metric:focus-visible {
  outline: 2px solid var(--rmm-focus);
  outline-offset: 3px;
}

.fleet-metric__icon {
  display: inline-flex;
  width: 48px;
  height: 48px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: var(--rmm-radius);
  color: var(--rmm-tile-icon-text);
  background: var(--rmm-tile-icon-bg);
  font-size: 24px;
}

.fleet-metric__dot {
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  margin: 0 12px;
  border-radius: 50%;
}

.fleet-metric__dot--positive {
  background: var(--rmm-status-positive);
}

.fleet-metric__dot--negative {
  background: var(--rmm-status-negative);
}

/* offline is often a device that is switched off, so a hollow ring */
.fleet-metric__dot--neutral {
  border: 3px solid var(--rmm-text-muted);
}

.fleet-metric__dot--warning {
  background: var(--rmm-dot-warning);
}

.fleet-metric > span:last-of-type {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.fleet-metric span span {
  color: var(--rmm-text-muted);
  font-size: 14px;
}

.fleet-metric strong {
  font-size: 28px;
  font-weight: 700;
  line-height: 1.2;
  font-variant-numeric: tabular-nums;
}

.workspace-filters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
}

.workspace-filters .q-btn:not(.q-btn--round) {
  min-height: 44px;
  padding: 0 14px;
  border-radius: 8px;
  color: var(--rmm-text);
  background: var(--rmm-surface);
}

.workspace-filters .q-btn--round {
  width: 44px;
  height: 44px;
  color: var(--rmm-text-muted);
  background: var(--rmm-surface);
}

.workspace-filters .q-btn.text-primary {
  color: var(--rmm-accent-text);
}

.workspace-filters__select {
  width: 190px;
}

.workspace-filters :deep(.q-field--outlined .q-field__control) {
  height: 44px;
  border-radius: 8px;
  background: var(--rmm-surface);
}

.workspace-filters :deep(.q-field--outlined .q-field__control::before) {
  border-color: var(--rmm-border-strong);
}

.workspace-filters :deep(.q-field__marginal) {
  height: 44px;
}

.workspace-filters :deep(.q-field__native) {
  color: var(--rmm-text);
}

.agent-search {
  flex: 1 1 240px;
  min-width: 200px;
}

.search-help {
  font-size: var(--rmm-fs-md);
  color: var(--rmm-text);
}

.search-help__tokens {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.search-help__tokens li {
  padding: 1px 6px;
  border: 1px solid var(--rmm-border);
  border-radius: var(--rmm-radius-sm);
  background: var(--rmm-surface-2);
  font-size: var(--rmm-fs-xs);
}

/* stays visible when the filter menu scrolls */
.filter-menu__footer {
  position: sticky;
  z-index: 1;
  bottom: 0;
  border-top: 1px solid var(--rmm-border);
  background: var(--rmm-surface);
}

/* two columns: one list of every column ran past a 900px screen and hid
   the reset */
.column-picker {
  display: grid;
  grid-template-columns: repeat(2, max-content);
  column-gap: 16px;
  padding-right: 16px;
}

.dashboard-workspace {
  display: grid;
  flex: 1 0 360px;
  min-height: 0;
  grid-template-rows: minmax(0, 1fr);
  gap: 16px;
  min-width: 0;
}

/* 230px cut most client and site names after a few letters; more than 18vw
   pushes the default columns under the sticky actions column at 1440px */
.dashboard-workspace--clients {
  grid-template-columns: clamp(240px, 18vw, 280px) minmax(0, 1fr);
}

/* table plus stacked details, capped at one screen */
.dashboard-workspace--stacked {
  flex-basis: min(100%, 720px);
}

.dashboard-workspace > aside {
  min-height: 0;
}

.device-workspace {
  min-width: 0;
  height: 100%;
}

.device-workspace > :deep(.q-splitter__panel) {
  overflow: hidden;
}

.device-workspace > :deep(.q-splitter__separator) {
  background: transparent;
}

.device-workspace.q-splitter--vertical > :deep(.q-splitter__separator) {
  width: 16px;
}

.device-workspace.q-splitter--horizontal > :deep(.q-splitter__separator) {
  height: 16px;
}

.device-workspace:not(.device-workspace--detail)
  > :deep(.q-splitter__separator) {
  display: none;
}

/* the table sizes itself from what the panel leaves, no pixel sums */
.agent-panel {
  display: flex;
  min-width: 0;
  height: 100%;
  flex-direction: column;
}

/* a row scrolled into view clears the sticky 34px header */
.agent-panel :deep(tbody tr) {
  scroll-margin-top: 34px;
}

.agent-toolbar {
  flex-wrap: wrap;
  min-height: 52px;
  padding: 0 20px;
}

.agent-toolbar__count {
  font-size: 13px;
}

/* no wider than the toolbar, so the tabs scroll instead of running past
   the card on a phone */
.agent-modes {
  max-width: 100%;
  min-height: 40px;
  background: transparent;
}

/* q-tabs adds up the tab boxes without their margins to decide on scroll
   arrows, so the space between tabs is padding; with margins the last tab
   clipped at 600px and no arrow showed */
.agent-modes :deep(.q-tab) {
  min-height: 40px;
  padding: 0 14px;
  font-size: 14px;
}

.agent-modes :deep(.q-tab:first-child) {
  padding-left: 4px;
}

.agent-modes :deep(.q-tab:last-child) {
  padding-right: 4px;
}

.agent-modes :deep(.q-tab--active) {
  color: var(--rmm-text);
}

.agent-modes__label {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.agent-modes__count {
  padding: 1px 8px;
  border-radius: 999px;
  color: var(--rmm-text-muted);
  background: var(--rmm-surface-3);
  font-size: var(--rmm-fs-xs);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.agent-modes :deep(.q-tab--active) .agent-modes__count {
  color: var(--rmm-accent-text);
  background: var(--rmm-accent-soft);
}

.active-filter-chips {
  gap: 4px;
}

.active-filter-chips :deep(.q-chip) {
  min-height: 24px;
  margin: 0;
}

.clear-filters {
  min-height: 26px;
}

.device-inspector {
  position: relative;
  min-width: 0;
  height: 100%;
  overflow: hidden;
  container-type: inline-size;
}

.fleet-overview-dialog {
  width: 1000px;
  max-width: 95vw;
}

/* five tiles in one row leave the labels little room */
@media (max-width: 1280px) {
  .fleet-metric {
    gap: 12px;
    padding: 16px;
  }

  .fleet-metric__dot {
    margin: 0;
  }

  .fleet-metric__icon {
    width: 40px;
    height: 40px;
    font-size: 20px;
  }
}

@media (max-width: 800px) {
  .dashboard-page {
    padding: 16px;
  }

  /* the two buttons ran 20px off a 390px screen */
  .workspace-heading {
    flex-wrap: wrap;
    align-items: flex-start;
  }

  .workspace-heading h1 {
    font-size: 26px;
  }

  .fleet-metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  /* five tiles: Total on its own row above a 2x2 grid */
  .fleet-metric:first-child {
    grid-column: 1 / -1;
  }

  .fleet-metric {
    min-height: 0;
    padding: 14px;
  }

  .workspace-filters__select {
    width: calc(50% - 27px);
  }

  /* the open clients panel sits above the table; with only the 360px
     basis the table took all of it and left the panel 0px at 600x900, so
     the workspace grows and the page scrolls instead */
  .dashboard-workspace--clients {
    flex-basis: auto;
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: minmax(200px, auto) minmax(360px, 1fr);
  }

  .dashboard-workspace--clients.dashboard-workspace--stacked {
    grid-template-rows: minmax(200px, auto) minmax(560px, 1fr);
  }
}
</style>
