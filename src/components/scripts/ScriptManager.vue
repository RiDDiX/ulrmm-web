<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-dialog ref="dialogRef" no-esc-dismiss no-shake @hide="onDialogHide">
    <q-card
      :id="CARD_ID"
      class="q-dialog-plugin script-manager"
      tabindex="-1"
      :style="cardSize"
      @keydown.esc="onEscape"
    >
      <DialogHeader
        title="Script manager"
        subtitle="Reusable scripts for run dialogs, tasks, script checks and alert actions"
      >
        <template #actions>
          <q-btn
            v-bind="RELOAD_BTN"
            aria-label="Reload scripts"
            :loading="fetching"
            @click="reload"
          >
            <q-tooltip>Reload the script list</q-tooltip>
          </q-btn>
        </template>
      </DialogHeader>

      <div class="rmm-toolbar script-toolbar">
        <q-btn
          flat
          dense
          round
          :icon="railOpen ? 'menu_open' : 'filter_list'"
          :aria-label="railToggleText"
          :aria-expanded="railOpen"
          data-test="toggle-rail"
          @click="railOpen = !railOpen"
        >
          <q-tooltip>{{ railToggleText }}</q-tooltip>
        </q-btn>
        <q-input
          v-model="searchText"
          dense
          outlined
          clearable
          debounce="150"
          class="script-toolbar__search"
          placeholder="Search name, description, category, file or input"
          aria-label="Search scripts"
          data-test="script-search"
        >
          <template #prepend>
            <q-icon name="search" class="rmm-muted" />
          </template>
        </q-input>
        <span class="rmm-muted rmm-num script-toolbar__count">
          {{ rows.length }} of {{ scripts.length }} scripts
        </span>
        <q-space />
        <q-btn
          v-bind="TOOL_BTN"
          :disable="syncing"
          data-test="sync-library"
          @click="syncCommunity"
        >
          <q-spinner v-if="syncing" size="1.2em" class="on-left" />
          <q-icon v-else name="sync" class="on-left" />
          {{ syncing ? "Syncing library…" : "Sync library" }}
          <q-tooltip
            >Fetch the latest community scripts from the library
            repository</q-tooltip
          >
        </q-btn>
        <q-btn
          v-bind="TOOL_BTN"
          label="Script snippets"
          icon="mdi-script"
          @click="openSnippets"
        >
          <q-tooltip
            >Manage reusable code blocks that scripts can include</q-tooltip
          >
        </q-btn>
        <q-btn-dropdown v-bind="NEW_BTN" icon="add" label="New">
          <q-list dense>
            <q-item
              v-for="entry in CREATE_MENU"
              :key="entry.title"
              v-close-popup
              clickable
              @click="entry.run"
            >
              <q-item-section avatar>
                <q-icon size="xs" :name="entry.icon" />
              </q-item-section>
              <q-item-section>
                <q-item-label>{{ entry.title }}</q-item-label>
                <q-item-label caption>{{ entry.caption }}</q-item-label>
              </q-item-section>
            </q-item>
          </q-list>
        </q-btn-dropdown>
      </div>

      <div
        class="script-library"
        :class="{
          'script-library--narrow': narrow,
          'script-library--compact': compact,
        }"
      >
        <ScriptLibraryRail
          v-if="railOpen"
          v-model:filters="filters"
          v-model:open-groups="openGroups"
          class="script-library__rail"
          :counts="counts"
          :shells="shells"
          :categories="categoryKeys"
          :show-community-scripts="communityShown"
          @toggle-community="setCommunityShown"
        />

        <div class="script-library__main">
          <div
            v-if="chips.length"
            class="script-library__chips"
            role="group"
            aria-label="Active filters"
          >
            <q-chip
              v-for="chip in chips"
              :key="chip.key"
              v-bind="CHIP_LOOK"
              :aria-label="`Remove filter: ${chip.label}`"
              :remove-aria-label="`Remove filter: ${chip.label}`"
              @remove="dropChip(chip)"
            >
              {{ chip.label }}
            </q-chip>
            <q-btn
              v-bind="CLEAR_BTN"
              label="Clear filters"
              class="script-library__clear"
              @click="clearFilters"
            />
          </div>

          <div
            v-if="fetchFailed && scripts.length"
            class="rmm-banner-warning script-library__banner"
            role="alert"
          >
            <q-icon name="warning" size="18px" />
            <span>Could not reload the scripts; the list may be outdated.</span>
            <q-btn flat dense no-caps label="Retry" @click="reload" />
          </div>

          <div
            v-if="fetching && !scripts.length"
            class="script-library__skeleton"
            aria-busy="true"
            aria-label="Loading scripts"
          >
            <div v-for="n in 8" :key="n" class="script-skeleton-row">
              <q-skeleton type="circle" size="20px" />
              <div class="col">
                <q-skeleton type="text" width="35%" />
                <q-skeleton type="text" width="65%" />
              </div>
              <q-skeleton type="QChip" width="70px" />
            </div>
          </div>
          <EmptyState
            v-else-if="emptyView"
            :icon="emptyView.icon"
            :title="emptyView.title"
            :text="emptyView.text"
          >
            <q-btn
              v-for="action in emptyView.actions"
              :key="action.label"
              no-caps
              :outline="action.main"
              :flat="!action.main"
              :color="action.main ? 'primary' : undefined"
              :icon="action.icon"
              :label="action.label"
              @click="action.run"
            />
          </EmptyState>
          <div v-else class="script-library__table">
            <q-resize-observer @resize="(size) => (tableWidth = size.width)" />
            <rmm-data-table
              v-model:pagination="pagination"
              v-bind="TABLE_SETUP"
              :rows="rows"
              :columns="visibleColumns"
            >
              <template
                v-for="slot in ICON_HEADERS"
                :key="slot"
                #[`header-cell-${slot}`]="head"
              >
                <q-th :props="head" auto-width>
                  <q-icon
                    v-if="slot === 'favorite'"
                    name="star"
                    size="18px"
                    class="script-star--on"
                  >
                    <q-tooltip>Sort by favorites</q-tooltip>
                  </q-icon>
                  <span class="sr-only">{{ head.col.label }}</span>
                </q-th>
              </template>

              <template #body="scope">
                <q-tr
                  :props="scope"
                  class="script-row cursor-pointer"
                  :class="{
                    selected: scope.row.id === selectedId,
                    'script-row--hidden': scope.row.hidden,
                  }"
                  :tabindex="tabIndexOf(scope.row)"
                  :aria-current="
                    scope.row.id === selectedId ? 'true' : undefined
                  "
                  :data-script-id="scope.row.id"
                  @click="select(scope.row)"
                  @dblclick="openDefault(scope.row)"
                  @focusin="focusedId = scope.row.id"
                  @keydown.enter.self="select(scope.row)"
                  @keydown.space.self.prevent="select(scope.row)"
                  @keydown.down.self.prevent="stepFocus($event, 1)"
                  @keydown.up.self.prevent="stepFocus($event, -1)"
                >
                  <!-- opens at the pointer, like the menu of the agent rows -->
                  <q-menu context-menu anchor="center left" self="center left">
                    <ScriptActionsMenu
                      :script="scope.row"
                      with-close
                      v-on="actionsFor(scope.row)"
                    />
                  </q-menu>
                  <q-td key="favorite" :props="scope" @click.stop>
                    <q-btn
                      v-bind="STAR_BTN"
                      :icon="scope.row.favorite ? 'star' : 'star_outline'"
                      :class="
                        scope.row.favorite ? 'script-star--on' : 'script-star'
                      "
                      :aria-label="starLabel(scope.row)"
                      :aria-pressed="!!scope.row.favorite"
                      :tabindex="tabIndexOf(scope.row)"
                      @click="toggleFlag(scope.row, 'favorite')"
                    >
                      <q-tooltip>{{
                        scope.row.favorite
                          ? "Remove from favorites"
                          : "Add to favorites"
                      }}</q-tooltip>
                    </q-btn>
                  </q-td>
                  <q-td key="name" :props="scope" class="script-row__main">
                    <div class="script-row__name">
                      <span class="script-row__ellipsis">{{
                        scope.row.name
                      }}</span>
                      <span v-if="scope.row.hidden" class="script-pill"
                        >Hidden</span
                      >
                    </div>
                    <div class="script-row__desc">
                      {{ scope.row.description || "No description" }}
                    </div>
                  </q-td>
                  <q-td key="platforms" :props="scope">
                    <span class="script-row__plats">
                      <q-icon
                        v-for="p in scriptPlatforms(scope.row)"
                        :key="p"
                        :name="platformIcon(p)"
                        size="18px"
                      >
                        <q-tooltip>{{ platformLabel(p) }}</q-tooltip>
                      </q-icon>
                      <span class="sr-only">{{ platformText(scope.row) }}</span>
                    </span>
                  </q-td>
                  <q-td key="shell" :props="scope">
                    <ShellChip :shell="scope.row.shell" />
                  </q-td>
                  <q-td key="category" :props="scope" class="script-row__cat">
                    {{ scope.row.category || "Uncategorized" }}
                  </q-td>
                  <q-td key="source" :props="scope">
                    <span class="script-pill">{{ sourceOf(scope.row) }}</span>
                  </q-td>
                  <q-td key="variables" :props="scope" class="rmm-num">
                    {{ scope.row.variables?.length || "" }}
                  </q-td>
                  <q-td key="default_timeout" :props="scope" class="rmm-num">
                    {{ scope.row.default_timeout }} s
                  </q-td>
                  <q-td key="actions" :props="scope" @click.stop>
                    <RowActions
                      :label="`Actions for ${scope.row.name}`"
                      :tabindex="tabIndexOf(scope.row)"
                    >
                      <ScriptActionsMenu
                        :script="scope.row"
                        v-on="actionsFor(scope.row)"
                      />
                    </RowActions>
                  </q-td>
                  <!-- cell of the column picker -->
                  <q-td />
                </q-tr>
              </template>
            </rmm-data-table>
          </div>
        </div>

        <ScriptDetailPanel
          v-if="selected"
          class="script-library__detail"
          :script="selected"
          :load-code="loadCode"
          :load-agents="loadAgents"
          @close="closeDetail"
          @run="runOnAgent"
          v-on="actionsFor(selected)"
        />
      </div>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from "vue";
import { useStore } from "vuex";
import { exportFile, useDialogPluginComponent, useQuasar } from "quasar";
import type { QTableColumn } from "quasar";
import { useStorage } from "@vueuse/core";
import { editScript, downloadScript, removeScript } from "@/api/scripts";
import { notifySuccess } from "@/utils/notify";
import {
  QUICK_FILTERS,
  PLATFORM_FACETS,
  categoryKey,
  emptyFilters,
  facetCounts,
  filterScripts,
  hasFacetFilters,
  isCommunity,
  platformLabel,
  scriptPlatforms,
  shellLabel,
  type FacetKey,
  type LibraryFilters,
  type RunTarget,
} from "@/utils/scriptLibrary";
import { byName, useScriptLibrary, type LibraryRow } from "./useScriptLibrary";

import RunScript from "@/components/modals/agents/RunScript.vue";
import RmmDataTable from "@/core/dashboard/ui/RmmDataTable.vue";
import RowActions from "@/components/ui/RowActions.vue";
import DialogHeader from "@/components/ui/DialogHeader.vue";
import EmptyState from "@/components/ui/EmptyState.vue";
import ScriptSnippets from "./ScriptSnippets.vue";
import ScriptFormModal from "./ScriptFormModal.vue";
import ScriptUploadModal from "./ScriptUploadModal.vue";
import ShellChip from "./ShellChip.vue";
import ScriptActionsMenu from "./ScriptActionsMenu.vue";
import ScriptLibraryRail from "./ScriptLibraryRail.vue";
import ScriptDetailPanel from "./ScriptDetailPanel.vue";

type Column = QTableColumn<LibraryRow>;
type RowFlag = "favorite" | "hidden";

interface FilterChip {
  key: string;
  label: string;
  facet: FacetKey | "quick";
  value: string;
}

defineEmits([...useDialogPluginComponent.emits]);
const { dialogRef, onDialogHide } = useDialogPluginComponent();
const $q = useQuasar();
const vuex = useStore();

const CARD_ID = "script-manager-card";

// fixed button and table setups
const RELOAD_BTN = {
  dense: true,
  flat: true,
  icon: "refresh",
  class: "q-mr-sm",
};
const TOOL_BTN = { noCaps: true, dense: true, flat: true, class: "q-px-sm" };
const NEW_BTN = {
  noCaps: true,
  dense: true,
  unelevated: true,
  color: "primary",
  class: "q-px-sm",
};
const STAR_BTN = { flat: true, round: true, dense: true, size: "sm" };
const CLEAR_BTN = { flat: true, dense: true, noCaps: true, color: "primary" };
const CHIP_LOOK = {
  dense: true,
  removable: true,
  color: "primary",
  textColor: "white",
  class: "script-filter-chip",
};
const TABLE_SETUP = {
  flat: true,
  class: "script-table",
  rowKey: "id",
  binaryStateSort: true,
  virtualScroll: true,
  virtualScrollItemSize: 56,
  rowsPerPageOptions: [0],
  hideBottom: true,
  columnSelect: true,
  storageKey: "scriptmanager_library_",
};
// header cells that show an icon or nothing, the label only for screen readers
const ICON_HEADERS = ["favorite", "actions"];

const sourceOf = (row: LibraryRow) =>
  isCommunity(row) ? "Community" : "Yours";
const platformText = (row: LibraryRow) =>
  scriptPlatforms(row).map(platformLabel).join(", ");
const platformIcon = (p: string) =>
  PLATFORM_FACETS.find((f) => f.value === p)?.icon ?? "devices";

function col(
  name: string,
  label: string,
  field: Column["field"],
  more: Partial<Column> = {},
): Column {
  return { name, label, field, align: "left", sortable: true, ...more };
}
const RIGHT: Partial<Column> = { align: "right" };
const COLUMNS: Column[] = [
  col("favorite", "Favorite", "favorite"),
  col("name", "Name", "name", { sort: byName }),
  col("platforms", "Platforms", platformText),
  col("shell", "Language", (row) => shellLabel(row.shell)),
  col("category", "Category", (row) => categoryKey(row), { sort: byName }),
  col("source", "Source", sourceOf),
  col("variables", "Inputs", (row) => row.variables?.length ?? 0, RIGHT),
  col("default_timeout", "Timeout", "default_timeout", RIGHT),
  col("actions", "Actions", () => "", { ...RIGHT, sortable: false }),
];

// with the detail panel open or on a small screen the table drops the
// columns the panel shows anyway
const PANEL_COLUMNS = ["source", "variables", "default_timeout"];
// narrower still, the language goes too so the row actions stay in view
const NARROW_COLUMNS = [...PANEL_COLUMNS, "shell"];
const tableWidth = ref(0);
const visibleColumns = computed(() => {
  const w = tableWidth.value;
  if (w > 0 && w < 820)
    return COLUMNS.filter((c) => !NARROW_COLUMNS.includes(c.name));
  if (w > 0 && w < 1080)
    return COLUMNS.filter((c) => !PANEL_COLUMNS.includes(c.name));
  return COLUMNS;
});

const cardSize = computed(() => {
  const width = `${$q.screen.width - 100}px`;
  const height = `${$q.screen.height - 100}px`;
  return { width, maxWidth: width, height, maxHeight: height };
});
const narrow = computed(() => $q.screen.width < 1400);
const compact = computed(() => $q.screen.width < 1000);

// layout, filters and sort order are remembered in this browser
const viewKey = (name: string) => `scriptmanager_${name}`;
const merged = { mergeDefaults: true };
const filters = useStorage<LibraryFilters>(
  viewKey("filters"),
  emptyFilters(),
  undefined,
  merged,
);
const openGroups = useStorage<string[]>(viewKey("openGroups"), []);
const railOpen = useStorage(viewKey("railOpen"), true);
const sortOrder = useStorage(
  viewKey("sort"),
  { sortBy: "name", descending: false },
  undefined,
  merged,
);
const pagination = computed({
  get: () => ({ rowsPerPage: 0, ...sortOrder.value }),
  set: (next: { sortBy?: string | null; descending?: boolean }) => {
    sortOrder.value = {
      sortBy: next.sortBy || "name",
      descending: !!next.descending,
    };
  },
});
const railToggleText = computed(() =>
  railOpen.value ? "Hide filters" : "Show filters",
);

// the manager always lists all scripts; this user setting only filters the
// pickers of run dialogs, checks, tasks and alert actions
const communityShown = computed<boolean>(() => vuex.state.showCommunityScripts);
const setCommunityShown = (show: boolean) =>
  vuex.dispatch("setShowCommunityScripts", show);

const {
  scripts,
  fetching,
  fetchFailed,
  syncing,
  reload,
  syncCommunity,
  loadCode,
  loadAgents,
} = useScriptLibrary();

const searchText = ref("");
// clearing the search field sets null
const query = computed(() => searchText.value ?? "");
const rows = computed(() =>
  filterScripts(scripts.value, filters.value, query.value),
);
const counts = computed(() =>
  facetCounts(scripts.value, filters.value, query.value),
);
const distinct = <T,>(list: T[]) => [...new Set(list)];
const shells = computed(() =>
  distinct(scripts.value.map((s) => s.shell)).sort((a, b) =>
    byName(shellLabel(a), shellLabel(b)),
  ),
);
const categoryKeys = computed(() =>
  distinct(scripts.value.map((s) => categoryKey(s))),
);
// the script form offers only categories that are really set
const categories = computed(() =>
  distinct(scripts.value.map((s) => s.category).filter(Boolean) as string[]),
);

interface FacetChipSpec {
  facet: FacetKey;
  tag: string;
  label: (v: string) => string;
}
const FACET_CHIPS: FacetChipSpec[] = [
  { facet: "platforms", tag: "p", label: platformLabel },
  { facet: "shells", tag: "s", label: shellLabel },
  { facet: "categories", tag: "c", label: (v) => v },
];

const chips = computed<FilterChip[]>(() => {
  const f = filters.value;
  const facetChips = FACET_CHIPS.flatMap(({ facet, tag, label }) =>
    f[facet].map((value) => ({
      key: `${tag}:${value}`,
      label: label(value),
      facet,
      value,
    })),
  );
  if (f.quick === "all") return facetChips;
  const quickLabel = QUICK_FILTERS.find((q) => q.value === f.quick)?.label;
  const quick = { key: "quick", facet: "quick" as const, value: f.quick };
  return [{ ...quick, label: quickLabel ?? f.quick }, ...facetChips];
});

function dropChip({ facet, value }: FilterChip) {
  const f = filters.value;
  filters.value =
    facet === "quick"
      ? { ...f, quick: "all" }
      : { ...f, [facet]: f[facet].filter((v) => v !== value) };
}

function clearFilters() {
  filters.value = emptyFilters();
}

const CREATE_MENU = [
  {
    title: "New script",
    caption: "Write it in the built-in editor",
    icon: "add",
    run: () => openBuilder({}),
  },
  {
    title: "Upload script",
    caption: "Create it from a file",
    icon: "cloud_upload",
    run: openUpload,
  },
];

interface EmptyAction {
  label: string;
  icon?: string;
  main: boolean;
  run: () => void;
}

const emptyView = computed(() => {
  if (fetchFailed.value && !scripts.value.length)
    return {
      icon: "error_outline",
      title: "Could not load scripts",
      text: "The server did not answer. Check the connection and try again.",
      actions: [{ label: "Retry", icon: "refresh", main: true, run: reload }],
    };
  if (!scripts.value.length)
    return {
      icon: "code",
      title: "No scripts yet",
      text: "Write a script in the built-in editor or create one from a file.",
      actions: CREATE_MENU.map((entry, i) => ({
        label: entry.title,
        icon: entry.icon,
        main: i === 0,
        run: entry.run,
      })),
    };
  if (rows.value.length) return null;
  const actions: EmptyAction[] = [];
  if (hasFacetFilters(filters.value))
    actions.push({ label: "Clear filters", main: true, run: clearFilters });
  if (searchText.value)
    actions.push({ label: "Clear search", main: false, run: clearSearch });
  return {
    icon: "search_off",
    title: "No scripts match",
    text: searchText.value
      ? "Nothing matches this search with the current filters."
      : "Nothing matches the current filters.",
    actions,
  };
});

function clearSearch() {
  searchText.value = "";
}

// selection, detail panel and keyboard moves
const selectedId = ref<number | null>(null);
const selected = computed(
  () => scripts.value.find((s) => s.id === selectedId.value) ?? null,
);
const focusedId = ref<number | null>(null);
// the list is a single tab stop (focused row, else the selected one, else the
// first); the arrow keys move between rows and Tab goes on to the panel
const tabRowId = computed(
  () =>
    [focusedId.value, selectedId.value].find(
      (id) => id !== null && rows.value.some((r) => r.id === id),
    ) ?? rows.value[0]?.id,
);
const tabIndexOf = (row: LibraryRow) => (row.id === tabRowId.value ? 0 : -1);

function select(row: LibraryRow) {
  selectedId.value = row.id;
}

async function closeDetail() {
  const shown = selectedId.value;
  selectedId.value = null;
  await nextTick();
  // focus returns to the row the panel showed, else to the dialog
  const row =
    shown === null
      ? null
      : document.querySelector<HTMLElement>(
          `#${CARD_ID} tr.script-row[data-script-id="${shown}"]`,
        );
  (row ?? document.getElementById(CARD_ID))?.focus();
}

function onEscape(e: KeyboardEvent) {
  if (e.defaultPrevented) return;
  if (selectedId.value === null) dialogRef.value?.hide();
  else closeDetail();
}

function stepFocus(e: KeyboardEvent, step: 1 | -1) {
  const current = e.currentTarget as HTMLElement;
  const target = (
    step === 1 ? current.nextElementSibling : current.previousElementSibling
  ) as HTMLElement | null;
  if (target?.matches("tr.script-row")) target.focus();
}

const starLabel = (row: LibraryRow) =>
  row.favorite
    ? `Remove ${row.name} from favorites`
    : `Add ${row.name} to favorites`;

function runOnAgent(agent: RunTarget) {
  const script = selected.value?.id;
  if (script === undefined) return;
  $q.dialog({ component: RunScript, componentProps: { agent, script } });
}

// row actions
const FLAG_NOTES: Record<RowFlag, [string, string]> = {
  favorite: ["Added to favorites", "Removed from favorites"],
  hidden: ["Hidden from script pickers", "Shown in script pickers"],
};

async function toggleFlag(row: LibraryRow, flag: RowFlag) {
  const value = !row[flag];
  const [turnedOn, turnedOff] = FLAG_NOTES[flag];
  try {
    await editScript({ id: row.id, [flag]: value });
    row[flag] = value;
    notifySuccess(value ? turnedOn : turnedOff);
  } catch {
    // the http interceptor shows the error
  }
}

function removeRow(row: LibraryRow) {
  const title = `Delete script: ${row.name}?`;
  const ok = { label: "Delete", color: "negative" };
  $q.dialog({ title, cancel: true, ok }).onOk(async () => {
    try {
      notifySuccess(await removeScript(row.id));
      if (selectedId.value === row.id) selectedId.value = null;
      reload();
    } catch {
      // the http interceptor shows the error
    }
  });
}

const PLAIN_TEXT = "text/plain;charset=utf-8";
async function downloadRow(row: LibraryRow) {
  try {
    const { code, filename } = await downloadScript(row.id);
    exportFile(filename, new Blob([code]), { mimeType: PLAIN_TEXT });
  } catch (err) {
    console.error(err);
  }
}

// the form dialog, for viewing as well; every OK reloads the list
function openBuilder(extra: {
  script?: LibraryRow;
  readonly?: boolean;
  clone?: boolean;
}) {
  const componentProps = {
    categories: categories.value,
    readonly: false,
    ...extra,
  };
  $q.dialog({ component: ScriptFormModal, componentProps }).onOk(reload);
}

function openUpload() {
  const componentProps = { categories: categories.value };
  $q.dialog({ component: ScriptUploadModal, componentProps }).onOk(reload);
}

const openSnippets = () => $q.dialog({ component: ScriptSnippets });

const openDefault = (row: LibraryRow) =>
  openBuilder(
    isCommunity(row) ? { script: row, readonly: true } : { script: row },
  );

// the events of ScriptActionsMenu and of the detail panel
const actionsFor = (row: LibraryRow) => ({
  view: () => openBuilder({ script: row, readonly: true }),
  clone: () => openBuilder({ script: row, clone: true }),
  edit: () => openBuilder({ script: row }),
  delete: () => removeRow(row),
  favorite: () => toggleFlag(row, "favorite"),
  download: () => downloadRow(row),
  hide: () => toggleFlag(row, "hidden"),
});

onMounted(reload);
</script>

<style scoped>
.script-manager {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.script-toolbar {
  flex-wrap: wrap;
}

.script-toolbar__search {
  width: min(380px, 40vw);
}

.script-toolbar__count {
  font-size: 13px;
  white-space: nowrap;
}

.script-library {
  position: relative;
  display: flex;
  min-height: 0;
  flex: 1;
}

.script-library__rail {
  width: 240px;
  flex: 0 0 240px;
}

.script-library__main {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex: 1;
  flex-direction: column;
}

.script-library__detail {
  width: 420px;
  flex: 0 0 420px;
}

/* below ~1400 px the panel floats over the list, the list keeps its width */
.script-library--narrow .script-library__detail {
  position: absolute;
  z-index: 3;
  top: 0;
  right: 0;
  bottom: 0;
  max-width: 100%;
  box-shadow: var(--rmm-shadow-lg);
}

.script-library--compact .script-library__rail {
  position: absolute;
  z-index: 4;
  top: 0;
  bottom: 0;
  left: 0;
  box-shadow: var(--rmm-shadow-lg);
}

.script-library__chips {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  border-bottom: 1px solid var(--rmm-border);
}

.script-library__clear {
  min-height: 26px;
}

.script-library__banner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-bottom: 1px solid var(--rmm-border);
  font-size: 13px;
}

.script-library__skeleton {
  display: grid;
  gap: 4px;
  padding: 8px 16px;
}

.script-skeleton-row {
  display: flex;
  height: 52px;
  align-items: center;
  gap: 12px;
}

.script-library__table {
  min-height: 0;
  flex: 1;
}

.script-library__table > :deep(.q-table__container) {
  height: 100%;
}

.script-library__table :deep(tr.script-row td) {
  height: 56px;
  white-space: nowrap;
}

.script-library__table :deep(tr.script-row:focus-visible) {
  outline: 2px solid var(--rmm-focus);
  outline-offset: -2px;
}

.script-library__table :deep(td.script-row__main) {
  width: 100%;
  min-width: 200px;
  max-width: 0;
}

.script-row__name {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 6px;
  font-weight: 600;
}

.script-row__ellipsis,
.script-row__desc {
  overflow: hidden;
  min-width: 0;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.script-row__desc {
  margin-top: 2px;
  color: var(--rmm-text-muted);
  font-size: 12px;
}

.script-library__table :deep(tr.script-row--hidden .script-row__ellipsis) {
  color: var(--rmm-text-muted);
}

.script-row__plats {
  display: inline-flex;
  gap: 6px;
  color: var(--rmm-text-muted);
}

.script-library__table :deep(td.script-row__cat) {
  color: var(--rmm-text-muted);
  white-space: normal;
}

.script-star {
  color: var(--rmm-text-subtle);
}

.script-star--on {
  color: var(--rmm-status-warning);
}

.script-pill {
  display: inline-flex;
  min-height: 20px;
  align-items: center;
  padding: 0 8px;
  border: 1px solid var(--rmm-border-strong);
  border-radius: 999px;
  color: var(--rmm-text-muted);
  background: var(--rmm-surface-2);
  font-size: var(--rmm-fs-xs);
  font-weight: 500;
  white-space: nowrap;
}
</style>
