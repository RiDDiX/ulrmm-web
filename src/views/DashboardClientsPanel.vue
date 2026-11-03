<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<script setup>
import { computed, getCurrentInstance, ref } from "vue";
import { useStore } from "vuex";
import { openURL, useQuasar } from "quasar";
import axios from "axios";
import { notifySuccess, notifyWarning } from "@/utils/notify";
import { removeClient, removeSite } from "@/api/clients";
import { confirmDeleteClientOrSite } from "@/composables/clients";
import ClientsForm from "@/components/clients/ClientsForm.vue";
import SitesForm from "@/components/clients/SitesForm.vue";
import PolicyAdd from "@/components/automation/modals/PolicyAdd.vue";
import AlertTemplateAdd from "@/components/modals/alerts/AlertTemplateAdd.vue";
import VaultDialog from "@/components/vault/VaultDialog.vue";
import RowActions from "@/components/ui/RowActions.vue";
import EmptyState from "@/components/ui/EmptyState.vue";
import GroupsRail from "@/components/groups/GroupsRail.vue";
import ClientNodeMenu from "./ClientNodeMenu.vue";

// the rail filters belong to the dashboard, the panel only hosts the rail
defineProps({
  group: { type: Object, default: null },
  tag: { type: Object, default: null },
});
const emit = defineEmits([
  "update:group",
  "update:tag",
  // a tree node was picked (raw key, null when the picked one is clicked again)
  "select",
  // back to the whole fleet: the "All Clients" row and after a delete
  "all-clients",
  // install on a site node
  "install",
]);

const store = useStore();
const $q = useQuasar();
const app = getCurrentInstance().appContext.config.globalProperties;

const nodes = computed(() => store.state.tree);
const scope = computed(() => store.state.selectedTree);
const urlActions = ref([]);

// the agent list is scoped to the selection, the tree knows the fleet total
const fleetTotal = computed(() =>
  nodes.value.reduce((sum, node) => sum + (node.client?.agent_count || 0), 0),
);

const isClient = (node) => !!node.children;
const kindOf = (node) => (isClient(node) ? "client" : "site");
const recordOf = (node) => (isClient(node) ? node.client : node.site);
const agentsIn = (node) => recordOf(node).agent_count;

// colour stands for failing checks; maintenance has its own icon
function checksNote(node) {
  if (node.color === "negative")
    return `Failing checks in this ${kindOf(node)}`;
  if (node.color === "warning")
    return `Checks with warnings in this ${kindOf(node)}`;
  return "";
}

// a site knows its client's id; how many sites that client has comes from
// the loaded tree, not from the client's agent_count
function soleSite(node) {
  if (isClient(node)) return false;
  const owner = nodes.value.find((c) => c.id === node.site.client);
  return !!owner && owner.children.length === 1;
}

const reloadTree = () => store.dispatch("loadTree");

function addClient() {
  $q.dialog({ component: ClientsForm }).onOk(reloadTree);
}

function addSite(node) {
  $q.dialog({
    component: SitesForm,
    componentProps: { client: node.id },
  }).onOk(reloadTree);
}

// a rename or a moved site changes the Client / Site cells too
function editNode(node) {
  $q.dialog(
    isClient(node)
      ? { component: ClientsForm, componentProps: { client: node.client } }
      : {
          component: SitesForm,
          componentProps: { site: node.site, lastSite: soleSite(node) },
        },
  ).onOk(() => store.dispatch("refreshDashboard"));
}

// policy and alert template pickers get the bare client or site record
function assignTo(node, component, reloadWith) {
  $q.dialog({
    component,
    componentProps: { type: kindOf(node), object: recordOf(node) },
  }).onOk(() => store.dispatch(reloadWith));
}

function openVault(node) {
  const name = isClient(node)
    ? node.label
    : `${node.site.client_name} / ${node.label}`;
  $q.dialog({
    component: VaultDialog,
    componentProps: { scope: kindOf(node), scopeKey: node.id, name },
  });
}

function deleteNode(node) {
  const drop = isClient(node) ? removeClient : removeSite;
  confirmDeleteClientOrSite({
    $q,
    object: recordOf(node),
    type: kindOf(node),
    onDeleteWithAgents: () => emit("all-clients"),
    onDelete: async (code) => {
      $q.loading.show();
      try {
        notifySuccess(await drop(node.id, {}, code));
        emit("all-clients");
      } catch (err) {
        console.error("delete failed", err);
      }
      $q.loading.hide();
    },
  });
}

function toggleMaintenance(node) {
  const record = recordOf(node);
  const turnOn = !record.maintenance_mode;
  const verb = turnOn ? "Enable" : "Disable";
  // the sites' counts are filtered by role, the client's own is not
  const agents = isClient(node)
    ? node.client.sites.reduce((sum, site) => sum + site.agent_count, 0)
    : node.site.agent_count;
  const where = `${agents} agents in ${kindOf(node)} ${record.name}`;
  const body = { id: node.id, type: node.raw.split("|")[0], action: turnOn };
  $q.dialog({
    title: `${verb} maintenance mode for ${record.name}?`,
    message: turnOn
      ? `Enables maintenance mode for ${where}. Alerts for these agents are suppressed until it is disabled.`
      : `Disables maintenance mode for ${where}. Alerts for these agents resume.`,
    ok: { label: `${verb} maintenance mode`, color: "negative" },
    cancel: true,
    persistent: true,
  }).onOk(async () => {
    try {
      const reply = await axios.post("/agents/maintenance/bulk/", body);
      notifySuccess(reply.data);
      store.dispatch("refreshDashboard");
      store.commit("setRefreshSummaryTab", true);
    } catch (err) {
      console.error(err);
    }
  });
}

async function runChecks(node) {
  try {
    const url = `/checks/${kindOf(node)}/${node.id}/csbulkrun/`;
    notifySuccess((await axios.post(url)).data);
  } catch (err) {
    console.error(err);
  }
}

async function loadUrlActions() {
  const reply = await axios.get("/core/urlaction/");
  urlActions.value = reply.data
    .filter((act) => act.action_type === "web")
    .sort((a, b) => a.name.localeCompare(b.name));
  if (urlActions.value.length) return;
  notifyWarning(
    "No URL Actions configured. Go to Settings > Global Settings > URL Actions",
  );
}

async function runUrlAction(node, act) {
  const reply = await axios.patch("/core/urlaction/run/", {
    [kindOf(node)]: node.id,
    action: act.id,
  });
  openURL(reply.data);
}

// one list for both the row button and the right-click menu
function menuFor(node) {
  const client = isClient(node);
  const paused = recordOf(node).maintenance_mode;
  const menus = app.$integrations;
  const reports = client
    ? menus?.clientMenuIntegrations?.length > 0
    : menus?.siteMenuIntegrations?.length > 0;
  const divider = (key) => ({ key, separator: true });
  const action = (key, icon, label, run, more) => ({
    key,
    icon,
    label,
    run,
    ...more,
  });
  const entries = [
    action("edit", "edit", "Edit", () => editNode(node)),
    divider("line-1"),
  ];
  if (client)
    entries.push(action("site", "add", "Add site", () => addSite(node)));
  entries.push(
    action("vault", "lock", "Vault…", () => openVault(node)),
    action(
      "maintenance",
      "construction",
      paused ? "Disable maintenance mode" : "Enable maintenance mode",
      () => toggleMaintenance(node),
      {
        boxed: true,
        caption: paused
          ? "Alerts for these agents resume"
          : "Suppresses alerts for all agents here",
      },
    ),
  );
  if (node.children === undefined)
    entries.push(
      action("install", "cloud_download", "Install agent", () =>
        emit("install", node),
      ),
    );
  entries.push(
    action("policy", "policy", "Assign automation policy", () =>
      assignTo(node, PolicyAdd, "loadTree"),
    ),
    action("template", "error", "Assign alert template", () =>
      assignTo(node, AlertTemplateAdd, "refreshDashboard"),
    ),
    {
      key: "url",
      submenu: true,
      icon: "open_in_new",
      label: "Run URL action",
      load: loadUrlActions,
      pick: (act) => runUrlAction(node, act),
    },
    action(
      "checks",
      "fas fa-check-double",
      "Run checks",
      () => runChecks(node),
      {
        boxed: true,
        caption: `Runs every check now on all agents in this ${kindOf(node)}`,
      },
    ),
  );
  if (reports)
    entries.push({
      key: "reports",
      submenu: true,
      icon: "analytics",
      label: "Reporting",
      kind: kindOf(node),
      id: node.id,
    });
  entries.push(
    divider("line-2"),
    action("delete", "delete", "Delete", () => deleteNode(node), {
      class: "text-negative",
      caption: soleSite(node)
        ? "Only site shown for this client. The server refuses to delete a client's last site."
        : "",
    }),
    divider("line-3"),
    // with an icon, so its label lines up with the others
    action("close", "close", "Close", () => {}),
  );
  return entries;
}
</script>

<template>
  <aside aria-label="Clients and sites">
    <div
      v-if="!store.state.treeReady"
      class="organizations-panel rmm-card q-pa-sm text-center"
    >
      <q-spinner size="40px" color="primary" />
    </div>
    <div v-else class="organizations-panel rmm-card">
      <div class="rmm-card__header">
        <q-icon name="account_tree" class="rmm-muted" size="18px" />
        <span class="rmm-card__title">Clients</span>
      </div>
      <q-list dense class="organization-tree">
        <q-item
          v-ripple
          clickable
          :active="scope === ''"
          active-class="organization-active"
          @click="emit('all-clients')"
        >
          <q-item-section avatar
            ><q-icon name="fas fa-home" size="16px"
          /></q-item-section>
          <q-item-section no-wrap>All Clients</q-item-section>
          <q-item-section side
            ><q-badge
              color="transparent"
              class="rmm-num rmm-muted"
              :label="fleetTotal"
          /></q-item-section>
        </q-item>
        <div
          v-if="store.state.treeError"
          class="column flex-center q-gutter-sm q-py-md"
        >
          <q-icon name="error_outline" color="negative" size="24px" />
          <div>
            {{
              store.state.treeError === 403
                ? "Your role cannot view clients."
                : "Clients could not be loaded."
            }}
          </div>
          <q-btn
            outline
            dense
            color="primary"
            label="Retry"
            @click="reloadTree"
          />
        </div>
        <EmptyState
          v-else-if="!nodes.length"
          icon="domain_disabled"
          title="No clients yet"
          text="Add a client here or from Clients › Add › Client. No access? Ask an admin."
        >
          <q-btn
            unelevated
            dense
            no-caps
            color="primary"
            icon="add"
            label="Add client"
            @click="addClient"
          />
        </EmptyState>
        <q-tree
          v-else
          :nodes="nodes"
          node-key="raw"
          no-nodes-label="No Clients"
          selected-color="primary"
          :selected="scope"
          @update:selected="emit('select', $event)"
        >
          <template #default-header="{ node }">
            <div class="organization-node">
              <q-icon
                :name="node.icon"
                :class="
                  checksNote(node)
                    ? `text-${node.color}`
                    : 'organization-node__icon'
                "
                size="16px"
              >
                <q-tooltip v-if="checksNote(node)">{{
                  checksNote(node)
                }}</q-tooltip>
              </q-icon>
              <div class="organization-node__label">
                {{ node.label }}
                <span v-if="checksNote(node)" class="sr-only">{{
                  checksNote(node)
                }}</span>
                <q-tooltip :delay="600"
                  >ID: {{ node.id }}<br />Agent Count:
                  {{ agentsIn(node) }}</q-tooltip
                >
              </div>
              <q-icon
                v-if="node.color === 'green'"
                name="construction"
                size="13px"
                :color="store.state.dash_warning_color"
              >
                <q-tooltip>Maintenance mode enabled</q-tooltip>
              </q-icon>
              <q-badge
                color="transparent"
                class="organization-node__count rmm-num rmm-muted"
                :label="agentsIn(node)"
              />
              <RowActions :label="`Actions for ${node.label}`">
                <ClientNodeMenu
                  :entries="menuFor(node)"
                  :url-actions="urlActions"
                />
              </RowActions>
              <!-- right click opens the same menu at the pointer, as on the agent rows -->
              <q-menu context-menu anchor="center left" self="center left">
                <ClientNodeMenu
                  :entries="menuFor(node)"
                  :url-actions="urlActions"
                />
              </q-menu>
            </div>
          </template>
        </q-tree>
      </q-list>
      <GroupsRail
        :group="group"
        :tag="tag"
        @update:group="emit('update:group', $event)"
        @update:tag="emit('update:tag', $event)"
      />
    </div>
  </aside>
</template>

<style scoped>
.organizations-panel {
  height: 100%;
  overflow: auto;
}

.organization-tree {
  padding: 6px;
}

.organization-tree :deep(.q-item),
.organization-tree :deep(.q-tree__node-header) {
  min-height: 32px;
  border-radius: var(--rmm-radius-sm);
}

/* "All Clients" in line with the tree rows: 24px is the header padding plus
   the expand arrow, 35px the padding plus row menu and gap */
.organization-tree > :deep(.q-item) {
  padding: 2px 35px 2px 24px;
}

.organization-tree :deep(.q-item__section--avatar) {
  min-width: 0;
  padding-right: 7px;
}

.organization-active,
.organization-tree :deep(.q-tree__node-header:hover) {
  color: var(--rmm-accent);
  background: var(--rmm-accent-soft);
}

.organization-tree :deep(.q-tree__node-header.q-tree__node--selected) {
  color: var(--rmm-accent-text);
  background: var(--rmm-accent-soft);
}

.organization-node {
  display: flex;
  width: 100%;
  min-width: 0;
  align-items: center;
  gap: 7px;
}

.organization-node__label {
  overflow: hidden;
  flex: 1;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.organization-node__count {
  margin-left: auto;
  font-weight: 500;
}

.organization-node__icon {
  color: var(--rmm-text-subtle);
}

@media (max-width: 800px) {
  .organizations-panel {
    max-height: 240px;
  }
}
</style>
