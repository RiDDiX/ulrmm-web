<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-list dense class="agent-action-menu">
    <div v-if="isOffline">
      <q-item class="rmm-muted">
        <q-item-section>
          <q-item-label>{{ lastContact() }}</q-item-label>
          <q-item-label caption>
            Actions that need the agent are disabled until it reconnects
          </q-item-label>
        </q-item-section>
      </q-item>
      <q-separator />
    </div>

    <template v-for="group in groups" :key="group.heading || 'device'">
      <template v-if="group.heading">
        <q-separator />
        <q-item-label header class="agent-action-menu__header">
          {{ group.heading }}
        </q-item-label>
      </template>
      <component
        :is="entry.gate ? GatedEntry : Unwrapped"
        v-for="entry in present(group.entries)"
        :key="entry.row.icon"
        v-bind="entry.gate"
      >
        <MenuItemRow v-bind="entry.row" @click="entry.pick">
          <AgentSubmenu v-if="entry.submenu" v-bind="entry.submenu" />
          <IntegrationsContextMenu
            v-else-if="entry.reporting"
            type="agent"
            :id="agent.agent_id"
          />
        </MenuItemRow>
      </component>
    </template>

    <q-separator />
    <q-item v-close-popup clickable
      ><q-item-section>Close</q-item-section></q-item
    >
  </q-list>
</template>

<script setup>
import { computed, getCurrentInstance, onMounted } from "vue";
import { useRoute } from "vue-router";
import { useStore } from "vuex";
import { runURLAction } from "@/api/core";
import { runRemoteBackground, runTakeControl } from "@/api/agents";
import { deviceName } from "@/utils/deviceName";
import { PLAT_LABELS } from "@/utils/packages";
import {
  MESH_OFFLINE_WARNING,
  agentStatusLabel,
  applianceOf,
  relativeTime,
} from "@/utils/format";
import { useAgentMenuActions } from "@/components/agents/useAgentMenuActions";
import { useAgentMenuLists } from "@/components/agents/useAgentMenuLists";
import { useRustDeskMenu } from "@/components/agents/useRustDeskMenu";
import AgentSubmenu from "@/components/agents/AgentSubmenu.vue";
import GatedEntry from "@/components/agents/GatedEntry.vue";
import MenuItemRow from "@/components/agents/MenuItemRow.vue";
import IntegrationsContextMenu from "@/components/ui/IntegrationsContextMenu.vue";
import CertPanelDialog from "@/components/security/AgentCertPanel.vue";
import RecoveryDialog from "@/components/modals/agents/AgentRecovery.vue";
import EditAgentDialog from "@/components/modals/agents/EditAgent.vue";
import InstallPackageDialog from "@/components/packages/InstallPackage.vue";
import KeepAwakeDialog from "@/components/modals/agents/KeepAwake.vue";
import PendingActionsDialog from "@/components/logs/PendingActions.vue";
import PolicyAddDialog from "@/components/automation/modals/PolicyAdd.vue";
import RebootLaterDialog from "@/components/modals/agents/RebootLater.vue";
import RenameDialog from "@/components/modals/agents/RenameAgent.vue";
import SendCommandDialog from "@/components/modals/agents/SendCommand.vue";
import TagEditorDialog from "@/components/groups/TagEditor.vue";
import UninstallCodeDialog from "@/components/agents/UninstallCodeDialog.vue";

defineOptions({ name: "AgentActionMenu" });

const props = defineProps({
  agent: { type: Object, required: true },
});

// submenu placement beside the row
const BESIDE = { anchor: "top end", self: "top start" };
const BESIDE_LTR = { anchor: "top right", self: "top left" };

const store = useStore();
const route = useRoute();
const globals = getCurrentInstance().appContext.config.globalProperties;

const title = computed(() => deviceName(props.agent));
// the menu only gates on the agent being online; permissions are the
// server's call
const isOffline = computed(() => props.agent.status !== "online");
const onlineTip = computed(
  () =>
    `Needs the agent online, last seen ${relativeTime(props.agent.last_seen)}`,
);
const lastContact = () =>
  `${agentStatusLabel(props.agent)} · last seen ${relativeTime(props.agent.last_seen)}`;

// wmi_detail comes with the device page agent only, table rows lack it
const updatesOwner = computed(
  () => applianceOf(props.agent.wmi_detail)?.name ?? "",
);
const onDevicePage = computed(
  () =>
    route.name === "Agent" && route.params.agent_id === props.agent.agent_id,
);
// table rows carry the tags, the device page agent does not; the editor
// has to see them or saving would drop them
const tagList = computed(
  () =>
    props.agent.tags ??
    store.state.agents.find((row) => row.agent_id === props.agent.agent_id)
      ?.tags,
);
const awakeLabel = computed(() => {
  const until = props.agent?.keep_awake_until;
  const ahead = until && new Date(until) > Date.now();
  return ahead ? store.getters.formatDate(until) : "";
});

const {
  open,
  runScript,
  askVncPort,
  activateKms,
  toggleMaintenance,
  runChecks,
  wakeUp,
  scanPatches,
  installPatches,
  rebootNow,
  shutdown,
  suspend,
  startRemoval,
} = useAgentMenuActions(props, title);
const rustdesk = useRustDeskMenu(props, { title, isOffline, onlineTip });

const { catalog, catalogDenied, catalogFailed, webLinks, starred, load } =
  useAgentMenuLists();

const installBlocker = computed(() => {
  const plat = props.agent.plat;
  // the server has no FreeBSD packages
  if (plat === "freebsd")
    return "Software packages are not available on FreeBSD";
  if (isOffline.value) return onlineTip.value;
  if (catalogFailed.value) return "Packages could not be loaded";
  if (!catalog.value) return "Loading packages...";
  if (catalog.value.some((p) => p.plat === plat)) return null;
  return `No ${PLAT_LABELS[plat] ?? plat} package uploaded yet (Settings, Software catalog)`;
});

// Every menu entry: row holds the MenuItemRow props, gate the GatedEntry
// props (no gate, no wrapper), pick the click handler, submenu the
// AgentSubmenu props. Falsy entries are left out.
const groups = computed(() => {
  const agent = props.agent;
  const down = isOffline.value;
  const owner = updatesOwner.value;
  const windows = agent.plat === "windows";
  const freebsd = agent.plat === "freebsd";
  const noStarred = starred.value.length === 0;
  const noLinks = webLinks.value.length === 0;
  const needsAgent = { offline: down, offlineTip: onlineTip.value };
  // MeshCentral works without the RMM agent, the entry stays enabled
  const viaMesh = (hint) => ({
    offline: down,
    offlineTip: MESH_OFFLINE_WARNING,
    hint,
  });

  const device = [
    // a real link, so Ctrl/Cmd/middle click opens a new tab
    !onDevicePage.value && {
      row: {
        icon: "open_in_new",
        label: "Open device page",
        caption: "Overview, checks, patches, software and history on one page",
        to: { name: "Agent", params: { agent_id: agent.agent_id } },
      },
    },
    {
      row: { icon: "edit", label: `Edit ${title.value}`, lines: "1" },
      pick: () =>
        open(EditAgentDialog, { agent_id: props.agent.agent_id }, true),
    },
    {
      row: {
        icon: "drive_file_rename_outline",
        label: "Rename…",
        caption: "Name in the dashboard and MeshCentral; the hostname stays",
      },
      pick: () => open(RenameDialog, { agent: props.agent }, true),
    },
    tagList.value && {
      row: {
        icon: "sell",
        label: "Edit tags…",
        caption: "For filters, dynamic groups and bulk actions",
      },
      pick: () =>
        open(
          TagEditorDialog,
          { agent: { ...props.agent, tags: tagList.value } },
          true,
        ),
    },
    {
      row: {
        icon: "schedule",
        label: "Pending agent actions",
        hint: "Queued reboots, agent updates and installs",
      },
      pick: () => open(PendingActionsDialog, { agent: props.agent }),
    },
  ];

  const remote = [
    {
      row: { icon: "computer", label: "Take control", ripple: true },
      gate: viaMesh("Remote desktop through MeshCentral in a new window"),
      pick: () => runTakeControl(props.agent.agent_id),
    },
    {
      row: { icon: "screen_share", label: "VNC", ripple: true },
      gate: viaMesh("View a VNC server on the device through MeshCentral"),
      pick: askVncPort,
    },
    // connecting goes through the RustDesk client and works while the RMM
    // agent is offline; installing needs the agent
    {
      row: {
        icon: "cast_connected",
        label: "RustDesk",
        arrow: true,
        ripple: true,
        close: false,
      },
      submenu: {
        items: rustdesk.entries.value,
        place: BESIDE,
        framed: true,
        ripple: true,
        closes: true,
      },
    },
    {
      row: { icon: "terminal", label: "Remote background", disable: down },
      gate: {
        ...needsAgent,
        hint: "Terminal, files, services and processes without a desktop session",
      },
      pick: () => runRemoteBackground(props.agent.agent_id, props.agent.plat),
    },
  ];

  const run = [
    {
      row: {
        icon: "keyboard_command_key",
        label: "Send command",
        disable: down,
        ripple: true,
      },
      gate: needsAgent,
      pick: () => open(SendCommandDialog, { agent: props.agent }),
    },
    {
      row: { icon: "code", label: "Run script", disable: down, ripple: true },
      gate: needsAgent,
      pick: () => runScript(),
    },
    {
      row: {
        icon: "star",
        label: "Run favorited script",
        caption: noStarred
          ? "Star scripts in the Script Manager to list them here"
          : undefined,
        disable: noStarred || down,
        close: false,
        arrow: true,
        ripple: true,
      },
      gate: needsAgent,
      // a disabled q-item still opens its q-menu on click, so offline or
      // without starred scripts there is none
      submenu: !down &&
        !noStarred && {
          items: starred.value.map((script) => ({
            id: script.id,
            label: script.name,
            run: () => runScript(script.id),
          })),
          place: BESIDE,
          dense: true,
          closes: true,
        },
    },
    !catalogDenied.value && {
      row: {
        icon: "install_desktop",
        label: "Install package…",
        caption:
          down || !installBlocker.value
            ? "Install a package from the Software catalog"
            : installBlocker.value,
        disable: !!installBlocker.value,
      },
      gate: needsAgent,
      pick: () =>
        open(InstallPackageDialog, {
          agent: props.agent,
          packages: catalog.value,
        }),
    },
    windows && {
      row: {
        icon: "key",
        label: "Activate via KMS…",
        caption: "Activate Windows and Office through your KMS host",
        disable: down,
        ripple: true,
      },
      gate: needsAgent,
      pick: activateKms,
    },
    {
      row: {
        icon: "open_in_new",
        label: "Run URL action",
        caption: noLinks
          ? "No URL actions set up in Global Settings"
          : "Open a web link filled in with this agent's details",
        disable: noLinks,
        close: false,
        arrow: true,
        ripple: true,
      },
      submenu: !noLinks && {
        items: webLinks.value.map((link) => ({
          id: link.id,
          label: link.name,
          run: () =>
            runURLAction({ agent_id: props.agent.agent_id, action: link.id }),
        })),
        place: BESIDE,
        dense: true,
        closes: true,
      },
    },
    {
      row: { icon: "checklist", label: "Run checks", disable: down },
      gate: needsAgent,
      pick: runChecks,
    },
    {
      row: {
        icon: "system_update",
        label: "Patch management",
        disable: !!owner || down,
        close: false,
        arrow: true,
      },
      gate: {
        offline: !!owner || down,
        offlineTip: owner
          ? `Package updates are managed by ${owner}`
          : onlineTip.value,
      },
      submenu: !owner &&
        !down && {
          items: [
            {
              id: "scan",
              label: "Run patch status scan",
              caption: "Ask the agent which updates are available",
              run: scanPatches,
            },
            {
              id: "install",
              label: "Install patches now",
              caption: "Lists the approved updates before installing",
              run: () => installPatches(),
            },
          ],
          place: BESIDE_LTR,
          framed: true,
          ripple: true,
        },
    },
  ];

  const power = [
    {
      row: {
        icon: "offline_bolt",
        label: "Wake-Up (WoL)",
        hint: "Send a Wake-on-LAN packet to start the device",
      },
      pick: wakeUp,
    },
    {
      row: {
        icon: "restart_alt",
        label: "Reboot",
        disable: down,
        close: false,
        arrow: true,
      },
      gate: needsAgent,
      // both reboots need the agent; a disabled row would still open it
      submenu: !down && {
        items: [
          {
            id: "now",
            label: "Now",
            caption: "Unsaved work on it is lost",
            disable: down,
            gate: needsAgent,
            run: rebootNow,
          },
          // live only: the server gives the agent 10 seconds to take the
          // scheduled task
          {
            id: "later",
            label: "Later",
            caption: "Pick a date and time",
            disable: !windows || down,
            gate: {
              offline: !windows || down,
              offlineTip: windows
                ? onlineTip.value
                : "Scheduled reboot is available for Windows agents only",
            },
            run: () => open(RebootLaterDialog, { agent: props.agent }, true),
          },
        ],
        place: BESIDE_LTR,
        framed: true,
        ripple: true,
      },
    },
    {
      row: { icon: "bedtime", label: "Sleep", disable: down },
      gate: {
        ...needsAgent,
        hint: "Suspend the device; wake it later with Wake-on-LAN",
      },
      pick: suspend,
    },
    {
      row: {
        icon: "coffee",
        label: "Keep awake…",
        caption: awakeLabel.value
          ? `Awake until ${awakeLabel.value}`
          : undefined,
        disable: freebsd || down,
      },
      gate: {
        offline: freebsd || down,
        offlineTip: freebsd
          ? "Keep awake is not available on FreeBSD"
          : onlineTip.value,
        hint: "No sleep from idle time or a closed lid for up to six hours, for example during a remote session",
      },
      pick: () => open(KeepAwakeDialog, { agent: props.agent }, true),
    },
  ];

  const maintenance = agent.maintenance_mode;
  const upkeep = [
    {
      row: {
        icon: "construction",
        label: maintenance
          ? "Disable maintenance mode"
          : "Enable maintenance mode",
        hint: maintenance
          ? "Alerts from this agent are suppressed right now"
          : "Suppress alerts while you work on the device",
      },
      pick: toggleMaintenance,
    },
    {
      row: { icon: "policy", label: "Assign automation policy" },
      pick: () =>
        open(PolicyAddDialog, { type: "agent", object: props.agent }, true),
    },
    {
      row: { icon: "analytics", label: "Reporting", close: false, arrow: true },
      reporting: true,
    },
    {
      row: {
        icon: "medical_services",
        label: "Agent recovery",
        hint: "Restart or reinstall the RMM or Mesh agent to restore contact",
      },
      pick: () => open(RecoveryDialog, { agent: props.agent }),
    },
    {
      row: {
        icon: "verified_user",
        label: "Agent certificate…",
        hint: "Client certificate status, and a reset for an agent that lost it",
      },
      pick: () =>
        open(CertPanelDialog, {
          agentId: props.agent.agent_id,
          name: title.value,
        }),
    },
  ];

  const danger = [
    {
      row: {
        icon: "power_settings_new",
        label: "Shutdown",
        disable: down,
        danger: true,
      },
      gate: {
        ...needsAgent,
        hint: "Power it off; only the console or Wake-on-LAN starts it again",
      },
      pick: shutdown,
    },
    {
      row: {
        icon: "delete",
        label: "Remove agent",
        caption:
          "Delete it from this server; uninstalls it too if it is online",
        danger: true,
      },
      pick: startRemoval,
    },
    {
      row: {
        icon: "key",
        label: "Uninstall code",
        caption: "Needed to uninstall the agent by hand on the device",
        plain: true,
      },
      pick: () =>
        open(UninstallCodeDialog, {
          agentId: props.agent.agent_id,
          name: title.value,
        }),
    },
  ];

  return [
    { entries: device },
    { heading: "Remote access", entries: remote },
    { heading: "Run", entries: run },
    { heading: "Power", entries: power },
    { heading: "Agent", entries: upkeep },
    { heading: "Danger zone", entries: danger },
  ];
});

// read on every render like the global it comes from, not cached
const present = (entries) =>
  entries.filter(
    (entry) =>
      entry &&
      (!entry.reporting ||
        globals.$integrations?.agentMenuIntegrations?.length > 0),
  );

const Unwrapped = (_, { slots }) => slots.default?.();

onMounted(() => {
  rustdesk.refresh();
  load();
});
</script>

<style scoped>
.agent-action-menu {
  min-width: 280px;
  max-width: 340px;
}

/* the list can outgrow Quasar's 65vh menu cap; the fade says there is more
   and ends on the empty space below the last row */
.agent-action-menu::after {
  content: "";
  position: sticky;
  bottom: 0;
  z-index: 1;
  display: block;
  height: 20px;
  background: linear-gradient(to bottom, transparent, var(--rmm-surface));
  pointer-events: none;
}

.agent-action-menu__header {
  padding: 8px 16px 2px;
  color: var(--rmm-text-muted);
  font-size: var(--rmm-fs-xs);
  font-weight: 600;
  line-height: 1.4;
}

/* rows inside the gate wrapper div miss q-list's dense spacing */
.agent-action-menu > div > .q-item {
  min-height: 36px;
  padding: 2px 16px;
}

/* the icon sits in MenuItemRow, outside this component's scope */
.agent-action-menu :deep(.agent-action-menu__icon) {
  color: var(--rmm-text-subtle);
}

.agent-action-menu .text-negative .q-item__label--caption {
  color: var(--rmm-status-negative);
  opacity: 0.85;
}
</style>
