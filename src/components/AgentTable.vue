<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <div class="agent-table">
    <!-- measures the table's own width rather than the window, so the
         default columns also react to the rail and tree; needs the
         position:relative set on .agent-table -->
    <q-resize-observer @resize="tableWidth = $event.width" />
    <q-table
      ref="tableRef"
      dense
      virtual-scroll
      binary-state-sort
      table-class="table-bgcolor"
      class="agents-tbl-sticky rmm-table"
      selection="multiple"
      row-key="agent_id"
      v-sortable-headers
      v-model:selected="picked"
      v-model:pagination="pagination"
      :rows-per-page-options="[PAGE_SIZE]"
      :loading="loading"
      :filter-method="filterAgentRows"
      :filter="search"
      :visible-columns="shownColumns"
      :columns="tableColumns"
      :rows="agents"
    >
      <template #body="scope">
        <q-tr
          :props="scope"
          :class="{ highlight: scope.row.agent_id === activeId }"
          :aria-selected="scope.row.agent_id === activeId"
          role="row"
          tabindex="0"
          @click="selectRow(scope.row)"
          @contextmenu="selectRow(scope.row)"
          @dblclick="openRow(scope.row)"
          @keydown.enter.self="activateRow(scope.row)"
          @keydown.space.prevent="selectRow(scope.row)"
          @keydown.shift.f10.prevent="menuByKey(scope.row, $event)"
          @keydown.context-menu.prevent="menuByKey(scope.row, $event)"
        >
          <!-- centred on the pointer: aligned to its top, a tall menu flips
               above the row and loses its top edge off screen -->
          <q-menu
            :ref="(menu) => trackMenu(scope.row.agent_id, menu)"
            context-menu
            anchor="center left"
            self="center left"
            @before-show="menuOpenFor = scope.row.agent_id"
            @before-hide="menuClosed(scope.row.agent_id)"
            @vue:unmounted="menuClosed(scope.row.agent_id)"
          >
            <AgentActionMenu :agent="scope.row" />
          </q-menu>

          <q-td auto-width class="agent-sticky-left" @click.stop>
            <q-checkbox
              dense
              :model-value="scope.selected"
              :aria-label="`Select ${deviceName(scope.row)}`"
              @update:model-value="(on, evt) => tick(scope, on, evt)"
            />
          </q-td>

          <q-td
            key="hostname"
            :props="scope"
            class="agent-sticky-left agent-device-cell"
          >
            <div class="agent-device">
              <q-icon
                class="agent-category-icon"
                size="20px"
                role="img"
                :name="platformMeta(scope.row.plat).icon"
                :aria-label="platformMeta(scope.row.plat).label"
              />
              <div class="agent-device__copy">
                <span class="agent-hostname" :title="deviceName(scope.row)">
                  {{ deviceName(scope.row) }}
                </span>
                <span class="agent-device__os rmm-muted">
                  <template v-if="deviceName(scope.row) !== scope.row.hostname">
                    <span class="rmm-mono">{{ scope.row.hostname }}</span> ·
                  </template>
                  {{ osName(scope.row) }}
                </span>
              </div>
            </div>
          </q-td>

          <q-td key="client_name" :props="scope">
            <div class="agent-scope">
              <span>{{ scope.row.client_name }}</span>
              <span class="rmm-muted">{{ scope.row.site_name }}</span>
            </div>
          </q-td>
          <q-td key="site_name" :props="scope">{{ scope.row.site_name }}</q-td>

          <q-td key="tags" :props="scope">
            <div v-if="scope.row.tags?.length" class="agent-tags" @click.stop>
              <TagChip
                v-for="tag in scope.row.tags.slice(0, 2)"
                :key="tag.id"
                :tag="tag"
                :hint="`Show only devices tagged ${tag.name}`"
                clickable
                @click="emit('filter-tag', $event)"
              />
              <span v-if="scope.row.tags.length > 2" class="rmm-muted">
                +{{ scope.row.tags.length - 2 }}
                <CellTip :text="moreTags(scope.row)" />
              </span>
            </div>
          </q-td>

          <q-td key="agentstatus" :props="scope">
            <span
              class="agent-status"
              :class="`agent-status--${agentStatusMeta(scope.row.status).state}`"
            >
              <span class="agent-status__dot" aria-hidden="true" />
              {{ agentStatusLabel(scope.row) }}
            </span>
            <CellTip :text="statusTooltip(scope.row)" />
          </q-td>

          <q-td key="checks-status" :props="scope">
            <span
              class="agent-status"
              :class="`agent-status--${checksMeta(scope.row).state}`"
            >
              <q-icon :name="checksMeta(scope.row).icon" size="18px" />
              {{ checksMeta(scope.row).label }}
            </span>
            <CellTip :text="checksTooltip(scope.row)" />
          </q-td>

          <q-td key="plat" :props="scope">
            <q-icon
              v-if="scope.row.plat"
              class="agent-category-icon"
              size="sm"
              role="img"
              :name="platformMeta(scope.row.plat).icon"
              :aria-label="platformMeta(scope.row.plat).label"
            >
              <CellTip :text="platformMeta(scope.row.plat).label" />
            </q-icon>
          </q-td>

          <q-td key="mon-type" :props="scope">
            <q-icon
              class="agent-category-icon"
              size="sm"
              role="img"
              :name="monitorKind(scope.row).icon"
              :aria-label="monitorKind(scope.row).label"
            >
              <CellTip :text="monitorKind(scope.row).label" />
            </q-icon>
          </q-td>

          <q-td key="patchespending" :props="scope">
            <component
              :is="patchState(scope.row).to ? RouterLink : 'span'"
              :to="patchState(scope.row).to"
              class="agent-status"
              :class="patchState(scope.row).tone"
              @click="patchState(scope.row).to && $event.stopPropagation()"
            >
              <q-icon :name="patchState(scope.row).icon" size="18px" />
              {{ patchState(scope.row).text }}
              <CellTip :text="patchState(scope.row).tip" />
            </component>
          </q-td>

          <q-td key="pendingactions" :props="scope">
            <q-btn
              v-if="scope.row.pending_actions_count > 0"
              icon="far fa-clock"
              size="sm"
              :color="warnColor"
              :aria-label="`Pending actions for ${deviceName(scope.row)}: ${scope.row.pending_actions_count}`"
              flat
              round
              dense
              @click="showPending(scope.row)"
            >
              <CellTip
                :text="pendingTooltip(scope.row.pending_actions_count)"
              />
            </q-btn>
          </q-td>

          <q-td key="needs_reboot" :props="scope">
            <template v-if="scope.row.needs_reboot">
              <q-icon :color="warnColor" name="fas fa-power-off">
                <CellTip
                  text="Reboot required — restart the device when safe"
                />
              </q-icon>
              <span class="sr-only">Reboot required</span>
            </template>
          </q-td>

          <q-td key="last_seen" :props="scope">
            {{ store.getters.formatDate(scope.row.last_seen) }}
          </q-td>

          <q-td v-for="cell in TEXT_CELLS" :key="cell.name" :props="scope">
            <span class="cell-truncate" :class="cell.extra(scope.row)">
              {{ scope.row[cell.field] }}
              <CellTip
                v-if="scope.row[cell.field]"
                :text="scope.row[cell.field]"
              />
            </span>
          </q-td>

          <q-td key="boot_time" :props="scope">
            {{ uptimeText(scope.row.boot_time) }}
          </q-td>

          <!-- a checkbox the alert template forces is shown disabled -->
          <q-td
            v-for="channel in ALERT_CHANNELS"
            :key="channel.key"
            :props="scope"
          >
            <q-checkbox
              :model-value="alertValue(scope.row, channel)"
              :disable="forcedByTemplate(scope.row, channel)"
              :aria-label="`${channel.label} alert for ${deviceName(scope.row)}`"
              dense
              @update:model-value="(on) => flipAlert(channel, scope.row, on)"
            >
              <CellTip :text="alertTip(scope.row, channel)" />
            </q-checkbox>
            <q-icon
              v-if="overrideBadge(scope.row, channel)"
              class="rmm-muted q-ml-xs"
              size="14px"
              role="img"
              :name="overrideBadge(scope.row, channel).icon"
              :aria-label="overrideBadge(scope.row, channel).tooltip"
            >
              <CellTip :text="overrideBadge(scope.row, channel).tooltip" />
            </q-icon>
          </q-td>

          <q-td
            key="actions"
            :props="scope"
            class="agent-actions-cell"
            @click.stop
          >
            <RowActions :label="`Actions for ${deviceName(scope.row)}`">
              <AgentActionMenu :agent="scope.row" />
            </RowActions>
          </q-td>
        </q-tr>
      </template>

      <!-- headers that are not quasar's plain label or need a class (the
           sticky ones); under ICON_HEAD_WIDTH
           some of them shrink to an icon so the compact set still fits
           beside the quick panel -->
      <template v-for="head in HEAD_CELLS" :key="head.slot" #[head.slot]="th">
        <q-th :auto-width="head.auto" :props="th" :class="head.cls">
          <template v-if="head.icon && (head.iconOnly || iconHeads)">
            <q-icon :name="head.icon" :size="head.iconSize">
              <q-tooltip v-if="head.iconTip">{{ head.iconTip }}</q-tooltip>
            </q-icon>
            <span class="sr-only">{{ head.srText || th.col.label }}</span>
            <q-tooltip v-if="head.compactTip">{{ head.compactTip }}</q-tooltip>
          </template>
          <span v-else-if="head.srOnly" class="sr-only">{{
            th.col.label
          }}</span>
          <template v-else
            >{{ head.text || th.col.label }}{{ head.pad }}</template
          >
          <q-tooltip v-if="head.tip">{{ head.tip }}</q-tooltip>
        </q-th>
      </template>

      <template #header-selection="all">
        <q-checkbox
          v-model="all.selected"
          aria-label="Select all agents on this page"
          dense
        />
      </template>

      <!-- the bulk bar takes a row only while something is ticked; column
           picker and export sit in the toolbar above the table -->
      <template v-if="picked.length" #top>
        <div
          class="agent-table-toolbar full-width row items-center q-gutter-sm"
        >
          <span class="rmm-num">{{ picked.length }} selected</span>
          <q-btn
            v-for="bulk in bulkButtons"
            :key="bulk.label"
            :label="bulk.label"
            flat
            dense
            no-caps
            @click="bulk.run"
          />
        </div>
      </template>

      <template #bottom="foot">
        <div class="agent-table-footer full-width row items-center no-wrap">
          <span class="rmm-muted rmm-num">
            Showing {{ pageSpan(foot.pagination, filteredCount) }} of
            {{ filteredCount }}
          </span>
          <q-space />
          <q-pagination
            v-if="foot.pagesNumber > 1"
            v-model="pagination.page"
            v-bind="PAGER"
            :max="foot.pagesNumber"
          />
        </div>
      </template>

      <template #no-data>
        <div
          v-if="!loading"
          class="full-width column flex-center q-gutter-sm q-py-md"
        >
          <template v-if="loadError">
            <q-icon name="error_outline" color="negative" size="24px" />
            <div>
              {{
                loadError === 403
                  ? "Your role cannot view agents."
                  : "Agents could not be loaded."
              }}
            </div>
            <q-btn
              label="Retry"
              color="primary"
              outline
              dense
              @click="reload"
            />
          </template>
          <EmptyState
            v-else
            :icon="emptyView.icon"
            :title="emptyView.title"
            :text="emptyView.text"
          >
            <q-btn
              v-for="action in emptyView.actions"
              :key="action.label"
              v-bind="action.look"
              :icon="action.icon"
              :label="action.label"
              @click="action.run"
            />
          </EmptyState>
        </div>
      </template>
    </q-table>

    <q-dialog
      v-model="updateDialog"
      aria-labelledby="update-agents-title"
      transition-show="slide-up"
      transition-hide="slide-down"
      maximized
    >
      <UpdateAgents
        :initial-agent-ids="pickedIds"
        @close="updateDialog = false"
      />
    </q-dialog>
  </div>
</template>

<script setup>
import { computed, h, inject, onMounted, ref, watch } from "vue";
import { RouterLink, useRouter } from "vue-router";
import { useStore } from "vuex";
import { QTooltip, useQuasar } from "quasar";
import axios from "axios";
import { runURLAction } from "@/api/core";
import { runRemoteBackground, runTakeControl } from "@/api/agents";
import { exportTableToCSV } from "@/utils/csv";
import { deviceName } from "@/utils/deviceName";
import { notifySuccess, notifyWarning } from "@/utils/notify";
import { sortableHeaders as vSortableHeaders } from "@/utils/sortableHeaders";
import {
  agentStatusLabel,
  agentStatusMeta,
  alertOverrideMeta,
  checksMeta,
  platformMeta,
  uptimeText,
} from "@/utils/format";
import {
  checksTooltip,
  csvColumns,
  filterAgentRows,
  pageSpan,
  patchState,
  pendingTooltip,
  statusTooltip,
} from "@/components/agentTableRows";
import { useAgentTableColumns } from "@/components/useAgentTableColumns";
import AgentActionMenu from "@/components/agents/AgentActionMenu.vue";
import EmptyState from "@/components/ui/EmptyState.vue";
import RowActions from "@/components/ui/RowActions.vue";
import TagChip from "@/components/groups/TagChip.vue";
import UpdateAgents from "@/components/modals/agents/UpdateAgents.vue";
import BulkActionDialog from "@/components/modals/agents/BulkAction.vue";
import EditAgentDialog from "@/components/modals/agents/EditAgent.vue";
import PendingActionsDialog from "@/components/logs/PendingActions.vue";

defineOptions({ name: "AgentTable" });

const props = defineProps({
  agents: { type: Array, default: () => [] },
  columns: { type: Array, default: () => [] },
  search: { type: String, default: "" },
  // the search as the parent shows it (chip labels, not raw "is:" tokens)
  // for the empty state; the raw search is used without it
  searchDisplay: { type: String, default: "" },
  visibleColumns: { type: Array, default: () => [] },
  // mixed, server or workstation; the empty state names it
  mode: { type: String, default: "mixed" },
});

const emit = defineEmits([
  "filtered-count",
  "search-all-clients",
  "clear-filters",
  "install",
  "filter-tag",
]);

const PAGE_SIZE = 25;
const FIRST_PAGE = { page: 1, rowsPerPage: PAGE_SIZE };
const PAGER = {
  maxPages: 7,
  boundaryNumbers: true,
  directionLinks: true,
  ellipses: true,
  flat: true,
  dense: true,
  color: "primary",
  activeDesign: "unelevated",
  "aria-label": "Table pages",
};
const ACTION_LOOK = { color: "primary", dense: true, noCaps: true };

// overdue alert channels: the row flag (also the PUT field), the alert
// template field that can force it, and the header icon
const ALERT_CHANNELS = [
  {
    key: "smsalert",
    label: "SMS",
    noun: "Text",
    icon: "phone_android",
    rowField: "overdue_text_alert",
    templateField: "always_text",
    hint: "Send a SMS alert when agent is overdue",
  },
  {
    key: "emailalert",
    label: "Email",
    noun: "Email",
    icon: "email",
    rowField: "overdue_email_alert",
    templateField: "always_email",
    hint: "Send an email alert when agent is overdue",
  },
  {
    key: "dashboardalert",
    label: "Dashboard",
    noun: "Dashboard",
    icon: "notifications",
    rowField: "overdue_dashboard_alert",
    templateField: "always_alert",
    hint: "Show a dashboard alert when agent is overdue",
  },
];

// header cells: iconOnly heads always show their icon, the others with an
// icon only below ICON_HEAD_WIDTH; pad keeps the space before the sort arrow
const HEAD_CELLS = [
  { name: "hostname", cls: "agent-sticky-left agent-device-cell" },
  ...ALERT_CHANNELS.map((channel) => ({
    name: channel.key,
    auto: true,
    icon: channel.icon,
    iconSize: "1.5em",
    iconOnly: true,
    iconTip: channel.hint,
  })),
  { name: "plat", auto: true },
  { name: "mon-type", auto: true },
  { name: "checks-status" },
  {
    name: "patchespending",
    auto: true,
    text: "Patches",
    pad: " ",
    tip: "Approved updates pending or failed to install",
  },
  {
    name: "pendingactions",
    auto: true,
    icon: "far fa-clock",
    iconSize: "1.5em",
    srText: "Pending actions",
    text: "Pending",
    tip: "Queued actions not yet completed",
  },
  {
    name: "agentstatus",
    auto: true,
    pad: " ",
    tip: "Agent status: online, offline or overdue",
  },
  {
    name: "needs_reboot",
    auto: true,
    icon: "fas fa-power-off",
    iconSize: "1.2em",
    compactTip: "Reboot required: the device reports a pending restart",
  },
  { name: "actions", auto: true, srOnly: true, cls: "agent-actions-cell" },
].map((head) => ({ ...head, slot: `header-cell-${head.name}` }));

// truncated text cells with the full text in a tooltip
const TEXT_CELLS = [
  {
    name: "user",
    field: "logged_username",
    extra: (row) => ({ "text-italic": row.italic }),
  },
  { name: "description", field: "description", extra: () => "rmm-muted" },
];

const store = useStore();
const router = useRouter();
const quasar = useQuasar();
const refreshDashboard = inject("refreshDashboard");

const tableRef = ref(null);
const tableWidth = ref(0);
const pagination = ref({
  ...FIRST_PAGE,
  sortBy: "hostname",
  descending: false,
});
const filteredCount = ref(0);
const picked = ref([]);
const updateDialog = ref(false);
// agent_id whose context menu is open, else false
const menuOpenFor = ref(false);
// context menus by agent_id, for opening one from the keyboard
const contextMenus = new Map();
// anchor of a shift-click range
let rangeStart = null;

const { tableColumns, iconHeads, shownColumns, pickerOptions, resetColumns } =
  useAgentTableColumns(props, tableWidth);

const activeId = computed(() => store.state.selectedRow);
const loading = computed(() => store.state.agentTableLoading);
const loadError = computed(() => store.state.agentsError);
const warnColor = computed(() => store.state.dash_warning_color);
const pickedIds = computed(() => picked.value.map((row) => row.agent_id));

// cell tooltips stay off while a context menu is open, they would cover
// its top
const CellTip = (tip) =>
  menuOpenFor.value ? null : h(QTooltip, null, () => tip.text);
CellTip.props = { text: String };

// rows after search, filters and sort
const shownRows = () => tableRef.value?.filteredSortedRows || [];

const osName = (row) => row.operating_system || platformMeta(row.plat).label;
const moreTags = (row) =>
  row.tags
    .slice(2)
    .map((tag) => tag.name)
    .join(", ");
const monitorKind = (row) =>
  row.monitoring_type === "server"
    ? { icon: "dns", label: "Server" }
    : { icon: "computer", label: "Workstation" };
const reload = () => store.dispatch("loadAgents");

const forcedByTemplate = (row, channel) =>
  !!row.alert_template && row.alert_template[channel.templateField] !== null;
const alertValue = (row, channel) =>
  forcedByTemplate(row, channel)
    ? row.alert_template[channel.templateField]
    : row[channel.rowField];
const alertTip = (row, channel) =>
  forcedByTemplate(row, channel)
    ? `Setting is overridden by alert template: ${row.alert_template.name}`
    : channel.hint;
const overrideBadge = (row, channel) =>
  alertOverrideMeta(
    row.alert_template?.[channel.templateField],
    row.alert_template?.name,
    false,
  );

// the tree scope by name, empty for "All Clients"
const scopeLabel = computed(() => {
  const chosen = store.state.selectedTree;
  if (!chosen) return "";
  const names = store.state.tree.flatMap((client) => [
    [client.raw, client.label],
    ...(client.children || []).map((site) => [
      site.raw,
      `${client.label} / ${site.label}`,
    ]),
  ]);
  const hit = names.find(([raw]) => raw === chosen);
  return hit ? hit[1] : "the selected scope";
});

const emptyView = computed(() => {
  const scope = scopeLabel.value;
  const filtered = props.search || props.searchDisplay;
  if (filtered) {
    const actions = [
      {
        label: "Clear search and filters",
        icon: "filter_alt_off",
        look: { ...ACTION_LOOK, outline: true },
        run: () => emit("clear-filters"),
      },
    ];
    if (scope)
      actions.push({
        label: "Search all clients",
        look: { ...ACTION_LOOK, flat: true },
        run: () => emit("search-all-clients"),
      });
    return {
      icon: "filter_alt_off",
      title: "No agents match your filter",
      text: `Nothing matches ${props.searchDisplay || props.search} in ${scope || "all clients"}.`,
      actions,
    };
  }
  const where = scope ? ` in ${scope}` : "";
  // the All tab has nothing to switch to
  const typed = props.mode === "server" || props.mode === "workstation";
  return {
    icon: "devices_other",
    title: "No agents in this view",
    text: typed
      ? `No ${props.mode}s${where}. Switch to All, or install an agent.`
      : `No agents${where} yet. Install one to start monitoring.`,
    actions: [
      {
        label: "Install agent",
        icon: "cloud_download",
        look: { ...ACTION_LOOK, outline: true },
        run: () => emit("install"),
      },
    ],
  };
});

function selectRow(row) {
  store.commit("setActiveRow", row.agent_id);
  store.commit("setAgentPlatform", row.plat);
}

function afterEdit() {
  refreshDashboard();
  store.commit("setRefreshSummaryTab", true);
}

function editDevice(agent_id) {
  const componentProps = { agent_id };
  quasar.dialog({ component: EditAgentDialog, componentProps }).onOk(afterEdit);
}

// the double-click preference; devicepage, or one this build does not
// know, opens the device page
function openRow(row) {
  store.commit("setActiveRow", row.agent_id);
  const choice = store.state.agentDblClickAction;
  // takecontrol goes through MeshCentral and works without the agent;
  // remotebg (processes, services, registry) needs it online
  if (choice === "remotebg" && row.status !== "online") {
    notifyWarning(`${deviceName(row)} is not online.`);
    return;
  }
  const actions = new Map([
    ["editagent", () => editDevice(row.agent_id)],
    ["takecontrol", () => runTakeControl(row.agent_id)],
    ["remotebg", () => runRemoteBackground(row.agent_id, row.plat)],
    [
      "urlaction",
      () =>
        runURLAction({
          agent_id: row.agent_id,
          action: store.state.agentUrlAction,
        }),
    ],
  ]);
  const devicePage = () =>
    router.push({ name: "Agent", params: { agent_id: row.agent_id } });
  (actions.get(choice) || devicePage)();
}

// Enter on the highlighted row acts like a double click
function activateRow(row) {
  if (row.agent_id === store.state.selectedRow) openRow(row);
  else selectRow(row);
}

function trackMenu(agentId, menu) {
  if (menu) contextMenus.set(agentId, menu);
  else contextMenus.delete(agentId);
}

function menuByKey(row, evt) {
  selectRow(row);
  contextMenus.get(row.agent_id)?.show(evt);
}

function menuClosed(agentId) {
  if (menuOpenFor.value === agentId) menuOpenFor.value = false;
}

function showPending(agent) {
  const componentProps = { agent };
  quasar.dialog({ component: PendingActionsDialog, componentProps });
}

// a shift-click ticks or unticks everything since the last ticked row
function tick(scope, on, evt) {
  const rows = shownRows();
  const start = rows.findIndex((row) => row.agent_id === rangeStart);
  if (!evt?.shiftKey || start === -1) {
    scope.selected = on;
  } else {
    const from = Math.min(start, scope.rowIndex);
    const span = rows.slice(from, Math.max(start, scope.rowIndex) + 1);
    if (on) {
      const have = new Set(picked.value.map((row) => row.agent_id));
      picked.value = picked.value.concat(
        span.filter((row) => !have.has(row.agent_id)),
      );
    } else {
      const drop = new Set(span.map((row) => row.agent_id));
      picked.value = picked.value.filter((row) => !drop.has(row.agent_id));
    }
  }
  rangeStart = scope.row.agent_id;
}

function clearPicked() {
  picked.value = [];
  rangeStart = null;
}

function openBulk(mode) {
  const initialAgents = picked.value.map(({ agent_id, hostname, plat }) => ({
    agent_id,
    hostname,
    plat,
  }));
  const componentProps = { mode, initialAgents };
  quasar.dialog({ component: BulkActionDialog, componentProps });
}

const bulkButtons = [
  ["Run script", "script"],
  ["Send command", "command"],
  ["Patch scan/install", "patch"],
  ["Sleep", "suspend"],
  ["Wake", "wake"],
  ["Install package", "package"],
]
  .map(([label, mode]) => ({ label, run: () => openBulk(mode) }))
  .concat(
    { label: "Update agents", run: () => (updateDialog.value = true) },
    { label: "Clear", run: clearPicked },
  );

// no v-model: the PUT needs the value from before the click, and a failed
// PUT puts the checkbox back
function flipAlert(channel, row, on) {
  const field = channel.rowField;
  const before = row[field];
  store.dispatch("invalidateAgentsRequest");
  axios
    .put(`/agents/${row.agent_id}/`, { [field]: !before })
    .then(() =>
      notifySuccess(
        `${channel.noun} alerts will now be ${before ? "disabled" : "enabled"} when ${deviceName(row)} is overdue.`,
      ),
    )
    .catch(() => {
      row[field] = before;
    })
    .finally(() => store.dispatch("invalidateAgentsRequest"));
  row[field] = on;
}

// rows as shown, with search, filters and sort applied
function exportTable() {
  exportTableToCSV(
    tableRef.value?.filteredSortedRows || props.agents,
    csvColumns(store.getters.formatDate),
  );
}

// a selection must never hold an agent the view no longer shows: tree,
// tab and scope switches, refreshes and a narrower search all drop rows
function pruneSelection(rows) {
  if (!rows) return;
  if (rangeStart && !rows.some((row) => row.agent_id === rangeStart))
    rangeStart = null;
  if (!picked.value.length) return;
  const ids = new Set(picked.value.map((row) => row.agent_id));
  const kept = rows.filter((row) => ids.has(row.agent_id));
  const unchanged =
    kept.length === picked.value.length &&
    kept.every((row, i) => row === picked.value[i]);
  if (!unchanged) picked.value = kept;
}

// watched from mount on, when the q-table ref exists
onMounted(() => {
  // a device restored from the URL never saw a row click, so its
  // platform comes from the list; without it a posix device would get
  // the windows tabs, patch columns and check types
  watch(
    () =>
      props.agents.find((row) => row.agent_id === store.state.selectedRow)
        ?.plat,
    (plat) => plat && store.commit("setAgentPlatform", plat),
    { immediate: true },
  );
  // the count after search and filters, for the toolbar
  watch(
    () => tableRef.value?.filteredSortedRows.length ?? 0,
    (count) => {
      filteredCount.value = count;
      emit("filtered-count", count);
    },
    { immediate: true },
  );
  // keep the highlighted row on the shown page: a link, coming back from
  // the device page and a re-sort can all move it
  watch(
    () => {
      const at = shownRows().findIndex(
        (row) => row.agent_id === store.state.selectedRow,
      );
      return at < 0 ? 0 : Math.floor(at / PAGE_SIZE) + 1;
    },
    (page) => {
      if (page && page !== pagination.value.page) pagination.value.page = page;
    },
    { immediate: true },
  );
  watch(() => tableRef.value?.filteredSortedRows, pruneSelection);
});

// DashboardView reaches these through its ref (column picker, export,
// the polling refresh that waits for a closed context menu)
defineExpose({
  rowMenuOpen: menuOpenFor,
  columnPickerOptions: pickerOptions,
  effectiveVisibleColumns: shownColumns,
  resetColumns,
  exportTable,
});
</script>

<style scoped>
.agent-table {
  position: relative;
  display: flex;
  flex: 1 1 0%;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.agent-table :deep(.q-table__container) {
  flex: 1;
  min-height: 0;
  border: 0;
  border-radius: 0;
  box-shadow: none;
}

.agent-table :deep(.q-table__middle) {
  flex: 1 1 0;
  min-height: 0;
}

.agent-table :deep(.q-table tbody td) {
  height: 56px;
  font-size: 13px;
}

.agent-table :deep(.q-table__bottom) {
  min-height: 0;
  padding: 0 16px;
  border-top: 1px solid var(--rmm-border);
}

.agent-table :deep(.cell-truncate) {
  display: inline-block;
  max-width: 220px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  vertical-align: bottom;
}

/* "n selected" starts on the checkbox column */
.agent-table-toolbar {
  padding: 4px 8px;
}

.agent-table-footer {
  min-height: 48px;
  padding: 4px 0;
  font-size: 13px;
}

.agent-device {
  display: flex;
  gap: 10px;
  align-items: center;
  min-width: 0;
}

.agent-device__copy,
.agent-scope {
  display: flex;
  flex-direction: column;
  min-width: 0;
  line-height: 1.3;
}

.agent-hostname {
  max-width: 260px;
  overflow: hidden;
  font-size: var(--rmm-fs-md);
  font-weight: 700;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.agent-device__os,
.agent-scope span:last-child {
  max-width: 260px;
  overflow: hidden;
  font-size: var(--rmm-fs-xs);
  white-space: nowrap;
  text-overflow: ellipsis;
}

.agent-scope span:first-child {
  font-size: var(--rmm-fs-md);
}

.agent-category-icon {
  color: var(--rmm-text-subtle);
}

.agent-tags {
  display: flex;
  gap: 4px;
  align-items: center;
  max-width: 240px;
  font-size: var(--rmm-fs-xs);
}

.agent-tags .tag-chip {
  max-width: 110px;
}

/* dot or icon plus text; only those take the status colour */
.agent-status {
  --agent-status-base: var(--rmm-text-muted);
  --agent-status-color: var(--agent-status-base);
  display: inline-flex;
  gap: 7px;
  align-items: center;
  color: var(--agent-status-color);
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  /* an icon cell sat 3px higher than a dot cell on the baseline */
  vertical-align: middle;
}

.agent-status__dot {
  flex-shrink: 0;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--agent-status-color);
}

.agent-status--positive {
  --agent-status-base: var(--rmm-status-positive);
}

.agent-status--warning {
  --agent-status-base: var(--rmm-status-warning);
}

.agent-status--negative {
  --agent-status-base: var(--rmm-status-negative);
}

.agent-status--info {
  --agent-status-base: var(--rmm-status-info);
}

.agent-status--neutral {
  --agent-status-base: var(--rmm-text-muted);
}

.agent-status--link {
  --agent-status-base: var(--rmm-accent-text);
}

/* the selection tint and quasar's selected/hover overlays cost contrast;
   there the status colour moves toward the text colour (>= 4.9:1 measured
   on a hovered highlighted row, both themes) */
.agent-table :deep(tr.selected .agent-status),
.agent-table :deep(tr.highlight .agent-status) {
  --agent-status-color: color-mix(
    in srgb,
    var(--agent-status-base) 60%,
    var(--rmm-text)
  );
}

/* sticky, so the row menu button stays in view when columns overflow;
   the tints are translucent and go on top of the opaque surface */
.agent-table :deep(.agent-actions-cell) {
  position: sticky;
  right: 0;
  background: var(--rmm-surface);
}

/* the checkbox and Device cells stay at the left edge the same way, above
   the cells scrolling under them; 44px is the checkbox column (16px
   padding, 20px box, 8px padding). Not on a phone: up to 350px wide, the
   two would cover every column scrolling under them */
@media (min-width: 600px) {
  .agent-table :deep(.agent-sticky-left),
  .agent-table :deep(thead tr:first-child > th:first-child) {
    position: sticky;
    left: 0;
    z-index: 1;
    background: var(--rmm-surface);
  }

  .agent-table :deep(.agent-device-cell) {
    left: 44px;
  }
}

/* headers above the sticky body cells, the left two above the others. The
   global .rmm-table rule makes the header row sticky at z-index 1, a tie
   the later body cells win, so the row goes above them too */
.agent-table :deep(.q-table thead tr:not(.q-table__progress)),
.agent-table :deep(.q-table thead th) {
  z-index: 2;
}

.agent-table :deep(.q-table thead tr:first-child > th:first-child),
.agent-table :deep(.q-table thead th.agent-device-cell) {
  z-index: 3;
}

/* hovered, the global hover surface wins on the other cells too;
   highlighted, the rule below */
.agent-table :deep(tr.selected:not(:hover):not(.highlight) .agent-actions-cell),
.agent-table :deep(tr.selected:not(:hover):not(.highlight) .agent-sticky-left) {
  background: linear-gradient(var(--rmm-accent-soft), var(--rmm-accent-soft)),
    var(--rmm-surface) !important;
}

/* the global .highlight tints the row too, so the other cells show it
   twice */
.agent-table :deep(tr.highlight .agent-actions-cell),
.agent-table :deep(tr.highlight .agent-sticky-left) {
  background: linear-gradient(var(--rmm-accent-soft), var(--rmm-accent-soft)),
    linear-gradient(var(--rmm-accent-soft), var(--rmm-accent-soft)),
    var(--rmm-surface) !important;
}
</style>
