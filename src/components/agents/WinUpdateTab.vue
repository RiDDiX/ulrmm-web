<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <div v-if="!agentId" class="q-pa-sm rmm-muted">No agent selected</div>
  <!-- column capped at the tab height: the banner takes what it needs, the
       table with its toolbar, strip and selection bar scrolls in the rest -->
  <div v-else class="column no-wrap" :style="{ 'max-height': tabHeight }">
    <StaleBanner
      v-if="failure && rows.length > 0"
      :message="failureText"
      :loaded-at="loadedAt"
      :format-date="formatDate"
      @retry="load"
    />

    <q-table
      v-model:pagination="paging"
      v-model:selected="picked"
      v-sortable-headers
      v-bind="TABLE_PROPS"
      :rows="rows"
      :columns="shownColumns"
      :filter="filterTerms"
      :filter-method="narrowRows"
      :loading="busy"
      class="tabs-tbl-sticky rmm-table"
      style="flex: 1 1 auto; min-height: 0"
    >
      <template #top>
        <TabToolbar title="Patches" :count="rows.length">
          <PatchSourceToggle v-if="platform === 'windows'" />
          <span v-if="managedBy" class="rmm-pill rmm-pill--neutral">
            Package updates are managed by {{ managedBy }}
            <q-tooltip
              >Scan and install are turned off; update the system from the
              {{ managedBy }} web interface</q-tooltip
            >
          </span>
          <template v-else>
            <div v-for="act in liveActions" :key="act.key">
              <q-btn dense no-caps v-bind="act.attrs" @click="act.run" />
              <q-tooltip>{{ online ? act.tip : offlineReason }}</q-tooltip>
            </div>
          </template>
          <!-- sits in the toolbar so the strip stays one line at 1366 px -->
          <template v-if="detail?.needs_reboot">
            <span class="rmm-pill rmm-pill--warning">
              Reboot required
              <q-tooltip
                >The device reports that a restart is needed to finish
                updates</q-tooltip
              >
            </span>
            <div>
              <q-btn
                dense
                flat
                no-caps
                color="primary"
                label="Reboot now"
                :disable="!online"
                @click="askReboot"
              />
              <q-tooltip>{{
                online
                  ? "Restart the device now; you confirm first"
                  : offlineReason
              }}</q-tooltip>
            </div>
          </template>
          <q-space />

          <q-input
            v-model="search"
            class="patch-search"
            placeholder="Search updates"
            aria-label="Search updates by name, description or severity"
            outlined
            dense
            clearable
          >
            <template #prepend
              ><q-icon name="search" class="rmm-muted"
            /></template>
          </q-input>
          <export-table-btn :data="shownRows" :columns="shownColumns" />
          <q-btn
            dense
            flat
            round
            icon="refresh"
            aria-label="Refresh updates"
            @click="load"
          >
            <q-tooltip>Refresh updates</q-tooltip>
          </q-btn>
        </TabToolbar>

        <div class="patch-strip full-width row items-center text-caption">
          <template v-if="detail">
            <span
              >{{
                platform === "windows" ? "Last scheduled run" : "Last install"
              }}: <span>{{ lastInstall }}</span></span
            >
            <span v-if="platform === 'windows'"
              >Next install:
              <span>{{ nextInstall || "Not scheduled" }}</span>
              <q-tooltip v-if="nextInstall"
                >Next scheduled install, {{ detail.timezone }} time. The device
                must be online then.</q-tooltip
              ></span
            >
          </template>
          <q-space />
          <div
            class="q-gutter-xs items-center"
            style="display: flex; flex-wrap: wrap"
          >
            <q-chip
              v-for="chip in stateChips"
              :key="chip.value ?? 'all'"
              clickable
              dense
              size="12px"
              role="button"
              :aria-pressed="chip.active"
              :outline="!chip.active"
              :color="chip.color"
              :text-color="chip.textColor"
              @click="stateFilter = chip.active ? null : chip.value"
              >{{ chip.label }}<q-tooltip>{{ chip.tip }}</q-tooltip></q-chip
            >
          </div>
        </div>

        <div
          v-if="decidable.length > 0"
          class="rmm-toolbar full-width patch-selection"
          style="flex-wrap: wrap"
        >
          <span class="rmm-num text-weight-medium"
            >{{ decidable.length }} selected</span
          >
          <q-btn
            v-for="choice in BULK_ORDER"
            :key="choice"
            dense
            flat
            no-caps
            :label="decisionLabel(choice)"
            @click="decideSelected(choice)"
          >
            <q-tooltip>{{ DECISION_HELP[choice] }}</q-tooltip>
          </q-btn>
          <q-space />
          <q-btn
            dense
            flat
            no-caps
            label="Clear selection"
            @click="picked = []"
          />
        </div>
      </template>

      <template #loading>
        <q-inner-loading color="primary" showing />
      </template>

      <template #no-data>
        <div v-if="!busy" class="full-width">
          <EmptyState
            :icon="empty.icon"
            :title="empty.title"
            :text="empty.text"
          >
            <template v-if="empty.button" #default>
              <q-btn
                outline
                dense
                no-caps
                color="primary"
                :label="empty.button"
                @click="empty.run"
              />
            </template>
            <template v-else-if="empty.offerScan" #default>
              <div>
                <q-btn
                  unelevated
                  dense
                  no-caps
                  color="primary"
                  icon="manage_search"
                  label="Run update scan"
                  :disable="!online"
                  @click="scan"
                />
                <q-tooltip v-if="!online">{{ offlineReason }}</q-tooltip>
              </div>
            </template>
          </EmptyState>
        </div>
      </template>

      <template #header-selection="head">
        <q-checkbox
          v-model="head.selected"
          dense
          aria-label="Select all shown updates"
        />
      </template>

      <template #header-cell="head">
        <q-th :props="head" :auto-width="head.col.name === 'actions'">
          {{ head.col.label }}
          <q-tooltip v-if="HEADER_TIPS[head.col.name]">{{
            HEADER_TIPS[head.col.name]
          }}</q-tooltip>
        </q-th>
      </template>

      <template #body="line">
        <q-tr :props="line">
          <q-menu v-if="!line.row.installed" context-menu>
            <PatchDecisionMenu
              :current="line.row.action"
              @pick="(choice) => decideOne(line.row.id, choice)"
            />
          </q-menu>
          <q-td auto-width @click.stop>
            <q-checkbox
              v-if="!line.row.installed"
              v-model="line.selected"
              dense
              :aria-label="`Select ${line.row.title}`"
            />
          </q-td>
          <q-td>
            <q-icon
              :name="decisionIcon(line.row.action)"
              :color="decisionColor(line.row.action, negativeColor)"
              size="xs"
              class="q-mr-xs"
            />
            {{ decisionLabel(line.row.action) }}
            <q-tooltip>{{ decisionTip(line.row) }}</q-tooltip>
          </q-td>
          <q-td>
            <span
              class="rmm-pill"
              :class="`rmm-pill--${patchStatePillColor(rowState(line.row))}`"
            >
              <span aria-hidden="true">{{ statusWord(line.row) }}</span>
              <span class="sr-only">{{ statusText(line.row) }}</span>
            </span>
            <q-tooltip>
              <div class="text-weight-medium">{{ statusText(line.row) }}</div>
              <div>{{ PATCH_STATE_HELP[rowState(line.row)] }}</div>
            </q-tooltip>
          </q-td>
          <q-td>{{ severityText(line.row.severity) }}</q-td>
          <!-- name and description split the width the other columns leave -->
          <q-td
            class="ellipsis"
            style="max-width: 0; width: 50%"
            :title="line.row.title"
            ><span
              v-if="line.row.is_driver"
              class="rmm-pill rmm-pill--neutral q-mr-xs"
              >Driver</span
            >{{ line.row.title }}</q-td
          >
          <q-td
            class="ellipsis"
            style="max-width: 0; width: 50%"
            @click="openDetails(line.row)"
          >
            <a
              href="#"
              role="button"
              class="rmm-link"
              @click.stop.prevent="openDetails(line.row)"
              @keydown.space.prevent="openDetails(line.row)"
              >{{ line.row.description }}</a
            >
          </q-td>
          <q-td>{{ formatDate(line.row.date_installed) }}</q-td>
          <!-- same choices as the context menu -->
          <q-td @click.stop>
            <RowActions
              v-if="!line.row.installed"
              :label="`Actions for ${line.row.title}`"
            >
              <PatchDecisionMenu
                :current="line.row.action"
                @pick="(choice) => decideOne(line.row.id, choice)"
              />
            </RowActions>
          </q-td>
        </q-tr>
      </template>
    </q-table>
  </div>
</template>

<script setup>
import { computed, ref, watch } from "vue";
import { useStore } from "vuex";
import { useQuasar } from "quasar";
import { agentRebootNow } from "@/api/agents";
import { notifySuccess } from "@/utils/notify";
import { deviceName } from "@/utils/deviceName";
import {
  DECISION_HELP,
  PATCH_STATE_FILTERS,
  PATCH_STATE_HELP,
  countWillInstall,
  decisionLabel,
  installPrompt,
  patchStateLabel,
  patchStatePillColor,
  patchStatePillLabel,
  patchStateRank,
  rebootPrompt,
  severityRank,
  willInstall,
} from "@/utils/patchStatus";
import { nextScheduledInstallLabel } from "@/utils/patchSchedule";
import { sortableHeaders as vSortableHeaders } from "@/utils/sortableHeaders";
import { denseTable } from "@/components/agents/tableProps";
import { decisionColor, decisionIcon } from "@/components/agents/patchDecision";
import { usePatchFeed } from "@/components/agents/usePatchFeed";
import ExportTableBtn from "@/components/ui/ExportTableBtn.vue";
import RowActions from "@/components/ui/RowActions.vue";
import EmptyState from "@/components/ui/EmptyState.vue";
import WinUpdateDialog from "@/components/ui/WinUpdateDialog.vue";
import TabToolbar from "@/components/agents/TabToolbar.vue";
import StaleBanner from "@/components/agents/StaleBanner.vue";
import PatchSourceToggle from "@/components/agents/PatchSourceToggle.vue";
import PatchDecisionMenu from "@/components/agents/PatchDecisionMenu.vue";

defineOptions({ name: "WindowsUpdates" });

// no footer: the "All" chip carries the total, which leaves room for one
// more row in the short dashboard pane
const TABLE_PROPS = {
  ...denseTable,
  rowKey: "id",
  selection: "multiple",
  hidePagination: true,
  hideSelectedBanner: true,
};

// order of the buttons on the selection bar
const BULK_ORDER = ["approve", "ignore", "inherit", "nothing"];

const HEADER_TIPS = {
  action: "Your choice for this update; Inherit lets the patch policy decide",
  status: "Where the update stands; hover a pill for what it means",
};

// Linux and macOS list packages, not updates
const POSIX_LABELS = { title: "Package", description: "Update" };

const vuex = useStore();
const $q = useQuasar();
const tabHeight = computed(() => vuex.state.tabHeight);
const platform = computed(() => vuex.state.agentPlatform);
const negativeColor = computed(() => vuex.state.dash_negative_color);
const formatDate = (value) => vuex.getters.formatDate(value);

const search = ref("");
const stateFilter = ref(null);
const picked = ref([]);
const paging = ref({ rowsPerPage: 0, sortBy: "status", descending: false });

const {
  agentId,
  rows,
  detail,
  busy,
  failure,
  failureText,
  loadedAt,
  installing,
  policy,
  rowState,
  hasInstalling,
  online,
  offlineReason,
  managedBy,
  trackDialog,
  load,
  decide,
  scan,
  install,
} = usePatchFeed({
  // keep only the picked rows that still exist and are still shown
  afterLoad(list) {
    const keep = new Set(picked.value.map((row) => row.id));
    picked.value = narrowRows(list, filterTerms.value).filter((row) =>
      keep.has(row.id),
    );
  },
  onAgentChange() {
    picked.value = [];
    search.value = "";
    stateFilter.value = null;
  },
});

const statusText = (row) => patchStateLabel(rowState(row), row);
const statusWord = (row) => patchStatePillLabel(rowState(row), row);
const severityText = (severity) => severity || "Other";

function decisionTip(row) {
  if (row.installed) return "Already installed; the decision no longer applies";
  return DECISION_HELP[row.action] || DECISION_HELP.nothing;
}

// "Approved" picks rows the way the install button and its confirmation
// do, so chip, count and install never disagree; it also keeps a row in
// view while it installs, so an active chip does not empty the table
function inState(row, state) {
  if (state === "approved") return willInstall(row, policy.value);
  return rowState(row) === state;
}

const filterTerms = computed(() => [search.value, stateFilter.value]);

function narrowRows(list, [text, state]) {
  const needle = (text || "").toLowerCase().trim();
  return list.filter((row) => {
    if (state && !inState(row, state)) return false;
    if (!needle) return true;
    const fields = [row.title, row.description, row.severity];
    return (
      fields.some((field) => (field || "").toLowerCase().includes(needle)) ||
      (row.is_driver && "driver".includes(needle))
    );
  });
}

const shownRows = computed(() => narrowRows(rows.value, filterTerms.value));
const filtering = computed(
  () => search.value.trim() !== "" || stateFilter.value !== null,
);

function clearFilters() {
  search.value = "";
  stateFilter.value = null;
}

const stateChips = computed(() =>
  [{ label: "All", value: null }, ...PATCH_STATE_FILTERS].map(
    ({ label, value }) => {
      const active = stateFilter.value === value;
      const count =
        value === null
          ? rows.value.length
          : rows.value.filter((row) => inState(row, value)).length;
      const alarm =
        value === "failed" && count > 0 ? negativeColor.value : undefined;
      return {
        value,
        active,
        label: `${label} (${count})`,
        tip: value ? PATCH_STATE_HELP[value] : "Show every update",
        color: active ? "primary" : alarm,
        textColor: active ? "white" : alarm,
      };
    },
  ),
);

const column = (name, label, field, extra) =>
  Object.assign({ name, label, field, align: "left", sortable: true }, extra);

const COLUMNS = [
  column("action", "Decision", "action", {
    sortable: false,
    format: (value) => decisionLabel(value),
  }),
  column("status", "Status", (row) => statusText(row), {
    sort: (a, b, rowA, rowB) =>
      patchStateRank(rowState(rowA)) - patchStateRank(rowState(rowB)),
  }),
  column("severity", "Severity", "severity", {
    sort: (a, b) => severityRank(a) - severityRank(b),
    format: severityText,
  }),
  column("title", "Name", "title"),
  column("description", "More info", "description"),
  column("date_installed", "Installed on", "date_installed"),
  { name: "actions", label: "Actions", align: "right", field: () => "" },
];

const shownColumns = computed(() =>
  platform.value === "windows"
    ? COLUMNS
    : COLUMNS.map((col) => ({
        ...col,
        label: POSIX_LABELS[col.name] || col.label,
      })),
);

// select-all also takes installed rows, which have no decision left
const decidable = computed(() => picked.value.filter((row) => !row.installed));

const approvedCount = computed(() =>
  countWillInstall(rows.value, policy.value),
);
const plural = (count) => (count === 1 ? "" : "s");

const lastInstall = computed(() => {
  const at = detail.value?.patches_last_installed;
  return at ? formatDate(at) : "Never";
});

const nextInstall = computed(() =>
  detail.value
    ? nextScheduledInstallLabel(
        detail.value.effective_patch_policy,
        detail.value.timezone,
      )
    : null,
);

const liveActions = computed(() => {
  const count = approvedCount.value;
  return [
    {
      key: "install",
      attrs: {
        label:
          count > 0
            ? `Install ${count} approved update${plural(count)}`
            : "Install approved updates",
        unelevated: true,
        color: "primary",
        icon: "system_update_alt",
        class: "tab-toolbar__primary",
        disable: !online.value || installing.size > 0,
      },
      tip: hasInstalling.value
        ? "Install running on the device - this updates automatically."
        : "Install every approved update now; you confirm the list first",
      run: askInstall,
    },
    {
      key: "scan",
      attrs: {
        label: "Run update scan",
        icon: "manage_search",
        flat: true,
        disable: !online.value,
      },
      tip: "Ask the agent to look for available updates now",
      run: scan,
    },
  ];
});

const empty = computed(() => {
  if (failure.value) {
    return {
      icon: "error_outline",
      title: "Unable to load updates",
      text: failureText.value,
      button: "Retry",
      run: load,
    };
  }
  if (filtering.value && rows.value.length > 0) {
    return {
      icon: "filter_alt_off",
      title: "No updates match this filter",
      text: "Clear the search and the state filter to see every update.",
      button: "Clear",
      run: clearFilters,
    };
  }
  if (managedBy.value) {
    return {
      icon: "system_update",
      title: `Package updates are managed by ${managedBy.value}`,
      text: `Update the system from the ${managedBy.value} web interface.`,
    };
  }
  return {
    icon: "system_update",
    title: "No updates reported yet",
    text: "Run an update scan to ask the agent which updates are available.",
    offerScan: true,
  };
});

const decideOne = (id, choice) => decide([id], choice);

async function decideSelected(choice) {
  const ids = decidable.value.map((row) => row.id);
  if (ids.length === 0) return;
  await decide(ids, choice);
  picked.value = [];
}

function askInstall() {
  const prompt = installPrompt(rows.value, policy.value, platform.value);
  trackDialog(
    $q.dialog({
      title: prompt.title,
      message: prompt.message,
      html: true,
      cancel: true,
      persistent: true,
      ok: prompt.ok,
    }),
  ).onOk(install);
}

function askReboot() {
  const agent = detail.value;
  if (!agent) return;
  trackDialog(
    $q.dialog({
      ...rebootPrompt(agent, deviceName(agent)),
      cancel: true,
      persistent: true,
    }),
  ).onOk(async () => {
    try {
      await agentRebootNow(agent.agent_id);
      notifySuccess(`${deviceName(agent)} will now be restarted`);
      detail.value = { ...agent, needs_reboot: false };
    } catch (err) {
      console.error(err);
    }
  });
}

function openDetails(row) {
  const { title, categories, description, result } = row;
  trackDialog(
    $q.dialog({
      component: WinUpdateDialog,
      componentProps: {
        title,
        categories,
        description,
        result,
        supportUrls: row.more_info_urls,
        dialogStyle: { width: "80vw", maxWidth: "85vw" },
      },
    }),
  );
}

// a selection of rows the chip or search no longer shows would act on rows
// off screen; dropping it is the safer choice
watch([stateFilter, search], () => {
  picked.value = [];
});
</script>

<style scoped>
.patch-strip {
  min-height: 36px;
  flex-wrap: wrap;
  gap: 4px 16px;
  padding: 4px 10px;
  color: var(--rmm-text-muted);
  border-bottom: 1px solid var(--rmm-border);
  background: var(--rmm-surface);
}

/* unselected chips are muted; a coloured outline (failed, with a count)
   keeps its colour */
.patch-strip .q-chip--outline:not(.q-chip--colored) {
  color: var(--rmm-text-muted);
  border-color: var(--rmm-border-strong);
}

.patch-strip .q-chip.bg-primary {
  border: 1px solid var(--rmm-accent);
}

.patch-selection {
  background: var(--rmm-accent-soft);
}

.patch-search {
  width: min(220px, 40vw);
}

.tab-toolbar__primary {
  padding: 2px 10px;
}
</style>
