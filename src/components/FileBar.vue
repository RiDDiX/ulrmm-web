<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <div class="file-bar" :class="{ 'file-bar--compact': !expanded }">
    <q-bar class="file-bar__surface">
      <q-btn-group flat class="file-bar__menus">
        <q-btn
          v-for="link in railLinks"
          :key="link.label"
          v-bind="link.attrs"
          flat
          no-caps
          :icon="link.icon"
          :label="expanded ? link.label : undefined"
          :aria-label="link.aria ?? link.label"
          @click="link.run"
        >
          <q-tooltip v-if="!expanded">{{ link.tip ?? link.label }}</q-tooltip>
          <q-badge
            v-if="link.badge > 0"
            class="nav-badge"
            :floating="!expanded"
            aria-hidden="true"
            >{{ link.badge > 99 ? "99+" : link.badge }}</q-badge
          >
        </q-btn>
        <q-btn
          v-for="menu in railMenus"
          :key="menu.key"
          v-bind="menu.attrs"
          no-caps
          flat
          :icon="menu.icon"
          :label="expanded ? menu.label : undefined"
          :aria-label="menu.label"
          :aria-expanded="menu.expanded"
          @click="menu.onClick?.()"
        >
          <q-tooltip v-if="!expanded">{{ menu.label }}</q-tooltip>

          <q-menu
            v-if="menu.key === 'clients'"
            anchor="top end"
            self="top start"
            :offset="menuOffset"
            @show="openMenu = 'clients'"
            @hide="openMenu = null"
          >
            <q-list dense class="file-menu">
              <q-item clickable>
                <q-menu anchor="top right" self="top left">
                  <q-list dense class="file-menu">
                    <q-item
                      v-for="add in addEntries"
                      :key="add.label"
                      v-close-popup
                      clickable
                      @click="add.run"
                    >
                      <q-item-section avatar>
                        <q-icon :name="add.icon" />
                      </q-item-section>
                      <q-item-section>{{ add.label }}</q-item-section>
                    </q-item>
                  </q-list>
                </q-menu>
                <q-item-section
                  v-for="part in addItemParts"
                  :key="part.icon ?? part.text"
                  v-bind="part.attrs"
                >
                  <q-icon v-if="part.icon" :name="part.icon" />
                  <template v-else>{{ part.text }}</template>
                </q-item-section>
              </q-item>
              <q-separator />
              <q-item v-close-popup clickable @click="openClientsManager">
                <q-item-section avatar>
                  <q-icon name="business" />
                </q-item-section>
                <q-item-section>Clients manager</q-item-section>
              </q-item>
            </q-list>
          </q-menu>

          <!-- integrations: a single one is its own rail button (see attrs),
               more than one keeps the dropdown -->
          <q-menu
            v-else-if="menu.key === 'reporting' && !singleIntegration"
            auto-close
            anchor="top end"
            self="top start"
            :offset="menuOffset"
            @show="openMenu = 'reporting'"
            @hide="openMenu = null"
          >
            <q-list dense class="file-menu">
              <q-item
                v-for="integration in integrations"
                :key="integration.name"
                v-close-popup
                clickable
                :to="integration.type === 'route' ? integration.uri : undefined"
                @click="activateIntegration(integration)"
              >
                <q-item-section>{{ integration.name }}</q-item-section>
              </q-item>
            </q-list>
          </q-menu>

          <q-menu
            v-else-if="menu.key === 'help'"
            auto-close
            anchor="top end"
            self="top start"
            :offset="menuOffset"
            @show="openMenu = 'help'"
            @hide="openMenu = null"
          >
            <q-list dense class="file-menu">
              <q-item clickable v-close-popup @click="showAbout = true">
                <q-item-section>About</q-item-section>
              </q-item>
              <q-item
                v-if="canManageServerUpdates"
                clickable
                v-close-popup
                :to="{ name: 'updates' }"
              >
                <q-item-section>Server update</q-item-section>
              </q-item>
              <q-separator v-if="supportUrl || issuesUrl" />
              <q-item
                v-if="supportUrl"
                clickable
                v-close-popup
                @click="openSupport"
              >
                <q-item-section>Support</q-item-section>
              </q-item>
              <template v-if="issuesUrl">
                <q-item clickable v-close-popup @click="openIssues('new')">
                  <q-item-section>Report a problem</q-item-section>
                </q-item>
                <q-item clickable v-close-popup @click="openIssues('')">
                  <q-item-section>Issue tracker</q-item-section>
                </q-item>
              </template>
            </q-list>
          </q-menu>

          <q-menu
            v-else-if="menu.entries"
            auto-close
            anchor="top end"
            self="top start"
            :offset="menuOffset"
            @show="openMenu = menu.key"
            @hide="openMenu = null"
          >
            <q-list dense class="file-menu">
              <template v-for="entry in menu.entries" :key="entry.label">
                <q-separator v-if="entry.divider" />
                <q-item v-close-popup clickable @click="entry.run">
                  <q-item-section avatar>
                    <q-icon :name="entry.icon" />
                  </q-item-section>
                  <q-item-section>
                    <q-item-label>{{ entry.label }}</q-item-label>
                    <q-item-label v-if="entry.caption" caption>{{
                      entry.caption
                    }}</q-item-label>
                  </q-item-section>
                </q-item>
              </template>
            </q-list>
          </q-menu>
        </q-btn>
      </q-btn-group>
      <q-dialog
        v-model="showUpdateAgentsModal"
        aria-labelledby="update-agents-title"
        maximized
        transition-show="slide-up"
        transition-hide="slide-down"
      >
        <UpdateAgents @close="showUpdateAgentsModal = false" />
      </q-dialog>
      <q-dialog
        :model-value="showEditCoreSettingsModal"
        :maximized="$q.screen.lt.sm"
        @update:model-value="closeEditCoreSettings"
      >
        <EditCoreSettings
          @close="showEditCoreSettingsModal = false"
          @dirty="coreSettingsDirty = $event"
        />
      </q-dialog>
      <q-dialog v-model="showAdminManager">
        <AdminManager @close="showAdminManager = false" />
      </q-dialog>
      <q-dialog v-model="showServerMaintenance">
        <ServerMaintenance @close="showServerMaintenance = false" />
      </q-dialog>
      <q-dialog v-model="showAbout">
        <AboutDialog />
      </q-dialog>
      <q-dialog v-model="showServerBackups">
        <ServerBackups />
      </q-dialog>
      <q-dialog
        v-model="showInstallAgent"
        aria-labelledby="install-agent-title"
      >
        <InstallAgent @close="showInstallAgent = false" />
      </q-dialog>
    </q-bar>
  </div>
</template>

<script setup>
import axios from "axios";
import { openURL, useQuasar } from "quasar";
import { computed, getCurrentInstance, onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import { useStore } from "vuex";
import { checkWebTermPerms, openWebTerminal } from "@/api/core";
import { fetchPackages } from "@/api/packages";
import DeploymentTable from "@/components/clients/DeploymentTable.vue";
import DeployBuilder from "@/components/deploy/DeployBuilder.vue";
import AdminManager from "./AdminManager.vue";
import AlertsManager from "./AlertsManager.vue";
import AlertsOverview from "./modals/alerts/AlertsOverview.vue";
import DebugLog from "@/components/logs/DebugLog.vue";
import InstallAgent from "./modals/agents/InstallAgent.vue";
import UpdateAgents from "@/components/modals/agents/UpdateAgents.vue";
import ClientsForm from "./clients/ClientsForm.vue";
import PendingActions from "@/components/logs/PendingActions.vue";
import EditCoreSettings from "./modals/coresettings/EditCoreSettings.vue";
import AutomationManager from "@/components/automation/AutomationManager.vue";
import BulkAction from "./modals/agents/BulkAction.vue";
import MaintenanceManager from "@/components/maintenance/MaintenanceManager.vue";
import AboutDialog from "./modals/AboutDialog.vue";
import VulnsManager from "@/components/vulns/VulnsManager.vue";
import GroupsManager from "./groups/GroupsManager.vue";
import ServerBackups from "@/components/modals/core/ServerBackups.vue";
import NetworkDevicesManager from "./netmon/NetworkDevicesManager.vue";
import SitesForm from "@/components/clients/SitesForm.vue";
import AuditManager from "./logs/AuditManager.vue";
import PermissionsManager from "@/components/accounts/PermissionsManager.vue";
import PackagesManager from "./packages/PackagesManager.vue";
import DialogWrapper from "@/components/ui/DialogWrapper.vue";
import ClientsManager from "./clients/ClientsManager.vue";
import ServerMaintenance from "@/components/modals/core/ServerMaintenance.vue";
import DiscoveryManager from "./discovery/DiscoveryManager.vue";
import ScriptManager from "@/components/scripts/ScriptManager.vue";
import { useBrandingStore } from "@/stores/branding";
import { dashboardScopeRoute, isWebUrl } from "@/utils/helpers";
import { notifyError, notifySuccess } from "@/utils/notify";

defineOptions({ name: "FileBar" });

const props = defineProps({
  expanded: {
    type: Boolean,
    default: true,
  },
  // active alerts, from AlertsIcon through MainLayout
  alertsCount: {
    type: Number,
    default: 0,
  },
  // pending actions from MainLayout; null hides the entry (no permission)
  actionsCount: {
    type: [Number, null],
    default: null,
  },
});

const $q = useQuasar();
const store = useStore();
const route = useRoute();
const branding = useBrandingStore();
const globals = getCurrentInstance().appContext.config.globalProperties;

const showServerMaintenance = ref(false);
const showUpdateAgentsModal = ref(false);
const showEditCoreSettingsModal = ref(false);
const coreSettingsDirty = ref(false);
const showAdminManager = ref(false);
const showInstallAgent = ref(false);
const showAbout = ref(false);
const showServerBackups = ref(false);
// 403: role has neither package flag
const packagesDenied = ref(false);
const openMenu = ref(null);
// the mini rail's menus open past its 8px padding and border, not over them
const menuOffset = computed(() => (props.expanded ? undefined : [9, 0]));

onMounted(() => {
  fetchPackages().catch((e) => {
    packagesDenied.value = e?.response?.status === 403;
  });
});

const hosted = computed(() => store.state.hosted);
const issuesUrl = computed(() => store.state.issuesUrl);
const supportUrl = computed(() => branding.support_url);
const canManageServerUpdates = computed(
  () => store.state.can_manage_server_updates && !hosted.value,
);
// the device page is part of the fleet view
const devicesActive = computed(() =>
  ["Dashboard", "Agent"].includes(route.name),
);

const integrations = computed(
  () => globals.$integrations?.fileBarIntegrations || [],
);
const singleIntegration = computed(() =>
  integrations.value.length === 1 ? integrations.value[0] : null,
);
const reportingLabel = computed(
  () => singleIntegration.value?.name || "Reporting",
);

const open = (component, componentProps) =>
  $q.dialog({ component, componentProps });
const opener = (component) => () => open(component);

function openWrapped(vuecomponent) {
  $q.dialog({
    component: DialogWrapper,
    componentProps: {
      vuecomponent,
      noCard: true,
      componentProps: { modal: true },
      dialogProps: {
        maximized: true,
        ["transition-show"]: "slide-up",
        ["transition-hide"]: "slide-down",
      },
    },
  });
}

const bulk = (mode) => () => open(BulkAction, { mode });
const flag = (target) => () => {
  target.value = true;
};

// tags may have changed on devices; a loaded table and the groups rail
// reload (no table yet: no list to refresh)
const openGroups = () =>
  open(GroupsManager).onDismiss(() => {
    if (store.state.defaultAgentTblTab)
      store.dispatch("loadAgents", { silent: true });
  });
const openClientsManager = () =>
  open(ClientsManager).onDismiss(() =>
    store.dispatch("refreshDashboard", true),
  );

const addItemParts = [
  { icon: "add", attrs: { avatar: true } },
  { text: "Add" },
  { icon: "keyboard_arrow_right", attrs: { side: true } },
];

const addEntries = [
  { icon: "business", label: "Client", component: ClientsForm },
  { icon: "domain", label: "Site", component: SitesForm },
].map((entry) => ({
  ...entry,
  run: () => open(entry.component).onOk(() => store.dispatch("loadTree")),
}));

// X, Esc and backdrop all arrive here; unsaved Global Settings edits are only
// dropped after a confirmation
function closeEditCoreSettings() {
  if (!coreSettingsDirty.value) {
    showEditCoreSettingsModal.value = false;
    return;
  }
  $q.dialog({
    title: "Discard unsaved changes?",
    message:
      "Global Settings has edits that have not been saved. Closing now loses them.",
    cancel: { label: "Cancel", flat: true },
    persistent: true,
    ok: { label: "Discard", color: "negative" },
  }).onOk(() => {
    coreSettingsDirty.value = false;
    showEditCoreSettingsModal.value = false;
  });
}

async function openWebTerm() {
  try {
    const { message, status } = await checkWebTermPerms();
    if (status === 412) notifyError(message);
    else openWebTerminal();
  } catch (e) {
    console.error(e);
  }
}

const clearCache = () =>
  axios.get("/core/clearcache/").then((r) => notifySuccess(r.data));

function confirmAndSend(title, message, send) {
  $q.dialog({ title, message, cancel: true }).onOk(() =>
    send().then((r) => notifySuccess(r.data)),
  );
}

const recoverAgents = () =>
  confirmAndSend(
    "Bulk recover all agents?",
    `This will attempt to reinstall or repair the ${branding.productName} and remote access agents on all endpoints.`,
    () => axios.get("/agents/bulkrecovery/"),
  );

const pushCurrentBuild = () =>
  confirmAndSend(
    "Push the current agent build to all agents?",
    "Every agent you have access to reinstalls the current build, also agents that already run this version.",
    () => axios.post("/agents/update/force/"),
  );

function openSupport() {
  if (isWebUrl(supportUrl.value)) openURL(supportUrl.value);
}

// same rule as openSupport: only plain web links leave the dashboard
function openIssues(path) {
  if (!isWebUrl(issuesUrl.value)) return;
  openURL(path ? `${issuesUrl.value}/${path}` : issuesUrl.value);
}

function activateIntegration(integration) {
  if (integration.type === "dialog") open(integration.component);
  // route-type integrations navigate through the item/button's own :to
}

const showNetwork = opener(NetworkDevicesManager);
const showScripts = opener(ScriptManager);
const showAutomation = opener(AutomationManager);

const railLinks = computed(() => [
  {
    icon: "space_dashboard",
    label: "Overview",
    attrs: {
      "aria-label": "Overview",
      to: { name: "Overview" },
      class: { "nav-device-active": route.name === "Overview" },
    },
  },
  {
    icon: "devices",
    label: "Devices",
    attrs: {
      "aria-label": "Devices",
      to: dashboardScopeRoute(store.state.selectedTree),
      class: { "nav-device-active": devicesActive.value },
    },
  },
  {
    icon: "security",
    label: "Security",
    attrs: {
      "aria-label": "Security",
      to: { name: "SecurityCenter" },
      class: { "nav-device-active": route.name === "SecurityCenter" },
    },
  },
  {
    icon: "album",
    label: "Images",
    attrs: {
      "aria-label": "Images",
      to: { name: "ImageLibrary" },
      class: { "nav-device-active": route.name === "ImageLibrary" },
    },
  },
  ...(canManageServerUpdates.value
    ? [
        {
          icon: "system_update_alt",
          label: "Updates",
          attrs: {
            "aria-label": "Updates",
            to: { name: "updates" },
            class: { "nav-device-active": route.name === "updates" },
          },
        },
      ]
    : []),
  {
    icon: "notifications_none",
    label: "Alerts",
    badge: props.alertsCount,
    aria: props.alertsCount ? `Alerts, ${props.alertsCount} active` : "Alerts",
    tip: props.alertsCount ? `Alerts (${props.alertsCount} active)` : "Alerts",
    run: opener(AlertsOverview),
  },
  ...(props.actionsCount === null
    ? []
    : [
        {
          icon: "pending_actions",
          label: "Actions",
          badge: props.actionsCount,
          aria: props.actionsCount
            ? `Actions, ${props.actionsCount} pending`
            : "Actions",
          tip: props.actionsCount
            ? `Pending actions (${props.actionsCount})`
            : "Pending and completed actions",
          run: opener(PendingActions),
        },
      ]),
  { icon: "bolt", label: "Automation", run: showAutomation },
  { icon: "code", label: "Scripts", run: showScripts },
  { icon: "system_update", label: "Patches", run: bulk("patch") },
  { icon: "lan", label: "Network", run: showNetwork },
]);

const menuEntries = {
  logs: [
    {
      icon: "history",
      label: "Audit log",
      caption: "Who changed what and when",
      run: () => openWrapped(AuditManager),
    },
    {
      icon: "bug_report",
      label: "Debug log",
      caption: "Agent, patching, script and system events for troubleshooting",
      run: () => openWrapped(DebugLog),
    },
    {
      icon: "pending_actions",
      label: "Pending actions",
      caption: "Scheduled reboots and queued agent jobs",
      run: opener(PendingActions),
    },
  ],
  agents: [
    { icon: "download", label: "Install agent", run: flag(showInstallAgent) },
    {
      icon: "construction",
      label: "Deployment builder",
      caption: "Signed agent installers and unattended OS images",
      run: opener(DeployBuilder),
    },
    {
      icon: "hub",
      label: "Manage deployments",
      caption: "Install links per client and site: copy, reopen, delete",
      run: opener(DeploymentTable),
    },
    {
      icon: "router",
      label: "Network devices",
      caption: "Switches, printers and other devices checked from the server",
      run: showNetwork,
    },
    {
      icon: "radar",
      label: "Network discovery",
      caption: "Scan networks, then install agents or add network devices",
      run: opener(DiscoveryManager),
    },
    {
      icon: "gpp_maybe",
      label: "Vulnerabilities",
      caption: "Known security issues in installed packages and updates",
      run: opener(VulnsManager),
    },
    {
      icon: "system_update",
      label: "Update agents",
      caption: "Choose agents to upgrade",
      run: flag(showUpdateAgentsModal),
    },
    {
      icon: "published_with_changes",
      label: "Push current build to all agents",
      caption: "Reinstall the current build on every agent you can access",
      run: pushCurrentBuild,
    },
    {
      icon: "healing",
      label: "Recover all agents",
      caption: "Repair agent and remote access services on every agent",
      run: recoverAgents,
      // the server refuses everyone else
      hidden: () => !store.state.is_superuser,
    },
  ],
  tools: [
    {
      icon: "terminal",
      label: "Bulk command",
      caption: "Run one command on many agents",
      run: bulk("command"),
    },
    {
      icon: "code",
      label: "Bulk script",
      caption: "Run one script on many agents",
      run: bulk("script"),
    },
    {
      icon: "system_update",
      label: "Bulk patch management",
      caption: "Scan for or install pending patches on many agents",
      run: bulk("patch"),
    },
    {
      icon: "install_desktop",
      label: "Bulk package install",
      caption: "Install a package on many agents",
      run: bulk("package"),
      hidden: () => packagesDenied.value,
    },
  ],
  settings: [
    {
      icon: "code",
      label: "Script manager",
      caption: "Create and organise reusable scripts",
      run: showScripts,
    },
    {
      icon: "inventory_2",
      label: "Software catalog",
      caption: "Packages, archives and software baselines for agents",
      run: opener(PackagesManager),
      hidden: () => packagesDenied.value,
    },
    {
      icon: "smart_toy",
      label: "Automation Manager",
      caption: "Policies that push checks and tasks to many agents",
      run: showAutomation,
    },
    {
      icon: "event_repeat",
      label: "Maintenance & power",
      caption: "Maintenance windows and power schedules",
      run: opener(MaintenanceManager),
    },
    {
      icon: "workspaces",
      label: "Device groups",
      caption: "Dynamic and static groups, device tags",
      run: openGroups,
    },
    {
      icon: "notifications",
      label: "Alerts Manager",
      caption: "Configure alert rules and delivery",
      run: opener(AlertsManager),
    },
    {
      icon: "admin_panel_settings",
      label: "Roles",
      caption: "Control user permissions",
      run: opener(PermissionsManager),
    },
    {
      icon: "manage_accounts",
      label: "User Administration",
      caption: "Manage dashboard user accounts",
      run: flag(showAdminManager),
    },
    {
      icon: "tune",
      label: "Global Settings",
      caption: "Configure server-wide defaults",
      run: flag(showEditCoreSettingsModal),
    },
    {
      icon: "engineering",
      label: "Server Maintenance",
      caption: "Reload NATS, remove orphaned tasks, prune old records",
      divider: true,
      run: flag(showServerMaintenance),
    },
    {
      icon: "backup",
      label: "Server Backups",
      caption: "List, create and download backups, nightly schedule",
      run: flag(showServerBackups),
      hidden: () => !canManageServerUpdates.value,
    },
    {
      icon: "terminal",
      label: "Server shell",
      caption: "Open a shell on the RMM server as the service user",
      run: openWebTerm,
      hidden: () => hosted.value,
    },
    {
      icon: "cleaning_services",
      label: "Clear cache",
      caption: "Clear server-side cached data",
      run: clearCache,
    },
  ],
};

const visible = (list) => list.filter((entry) => !entry.hidden?.());

const railMenus = computed(() => {
  const popup = { "aria-haspopup": "menu" };
  const menus = [
    { key: "clients", icon: "business", label: "Clients" },
    {
      key: "logs",
      icon: "history",
      label: "Logs",
      entries: visible(menuEntries.logs),
    },
    {
      key: "agents",
      icon: "devices",
      label: "Agents",
      entries: visible(menuEntries.agents),
    },
    {
      key: "tools",
      icon: "build",
      label: "Tools",
      entries: visible(menuEntries.tools),
    },
  ];
  if (integrations.value.length > 0) {
    const single = singleIntegration.value;
    menus.push({
      key: "reporting",
      icon: "assessment",
      label: reportingLabel.value,
      attrs: {
        "aria-haspopup": single ? undefined : "menu",
        to: single?.type === "route" ? single.uri : undefined,
      },
      expanded: single ? undefined : openMenu.value === "reporting",
      onClick: single ? () => activateIntegration(single) : undefined,
    });
  }
  if (!hosted.value) {
    menus.push({ key: "help", icon: "help_outline", label: "Help" });
  }
  menus.push({
    key: "settings",
    icon: "settings",
    label: "Settings",
    attrs: { ...popup, class: "file-bar__bottom" },
    entries: visible(menuEntries.settings),
  });
  return menus.map((menu) => ({
    attrs: popup,
    expanded: openMenu.value === menu.key,
    ...menu,
  }));
});
</script>

<style scoped>
/* brand 58px above, user row 60px below */
.file-bar {
  height: calc(100% - 118px);
  box-sizing: border-box;
  overflow-y: auto;
  padding: 10px 8px;
}

.file-bar--compact {
  height: calc(100% - 138px);
}

.file-bar__surface {
  height: 100%;
  align-items: stretch;
  padding: 0;
  color: var(--rmm-nav-text);
  background: transparent;
}

.file-bar__menus {
  display: flex;
  width: 100%;
  min-height: 100%;
  flex-direction: column;
  gap: 4px;
}

.file-bar__menus :deep(.q-btn) {
  width: 100%;
  min-height: 40px;
  justify-content: flex-start;
  padding: 0 12px;
  border-radius: 8px;
  color: var(--rmm-nav-text);
  font-size: 0.875rem;
  letter-spacing: 0.01em;
}

.file-bar__menus :deep(.file-bar__bottom) {
  margin-top: auto;
}

.file-bar__menus :deep(.q-btn:hover) {
  color: var(--rmm-nav-text);
  background: var(--rmm-nav-hover);
}

.file-bar__menus :deep(.q-btn[aria-expanded="true"]) {
  color: var(--rmm-nav-active-text);
  background: var(--rmm-nav-active-bg);
}

.file-bar__menus :deep(.q-btn__content) {
  width: 100%;
  justify-content: flex-start;
  gap: 12px;
}

.file-bar__menus :deep(.q-btn__content .q-icon) {
  font-size: 20px;
}

.file-bar__menus :deep(.nav-badge) {
  min-width: 22px;
  margin-left: auto;
  padding: 2px 7px;
  color: var(--rmm-nav-badge-text);
  background: var(--rmm-nav-badge-bg);
  font-weight: 600;
  justify-content: center;
}

/* mini rail: at the icon's top-right corner, into the rail padding */
.file-bar__menus :deep(.nav-badge.q-badge--floating) {
  top: 1px;
  right: -4px;
  min-width: 16px;
  margin: 0;
  padding: 1px 4px;
  font-size: 10px;
}

.file-menu {
  min-width: 280px;
  padding: 4px;
}

.file-menu :deep(.q-item) {
  min-height: 34px;
  border-radius: 5px;
}

.file-menu :deep(.q-item__section--avatar) {
  min-width: 30px;
  color: var(--rmm-text-muted);
}

.file-bar--compact .file-bar__menus :deep(.q-btn) {
  justify-content: center;
  padding: 0;
}

.file-bar--compact .file-bar__menus :deep(.q-btn__content) {
  justify-content: center;
}

/* a full rail is about 790px tall: tighter rows on shorter screens keep
   Help and Settings in view instead of below the fold */
@media (max-height: 960px) {
  .file-bar__menus {
    gap: 2px;
  }

  .file-bar__menus :deep(.q-btn) {
    min-height: 36px;
  }
}

@media (max-height: 820px) {
  .file-bar {
    padding: 6px 8px;
  }

  .file-bar__menus {
    gap: 1px;
  }

  .file-bar__menus :deep(.q-btn) {
    min-height: 30px;
  }
}
.file-bar__menus :deep(.nav-device-active) {
  color: var(--rmm-nav-active-text);
  background: var(--rmm-nav-active-bg);
  box-shadow: inset 3px 0 var(--rmm-nav-accent);
}
</style>
