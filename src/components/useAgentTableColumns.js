// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

import { computed } from "vue";
import { useStorage } from "@vueuse/core";

// off by default at any width: the Device cell already shows the OS icon,
// the Client cell the site. The column picker still offers them.
const OPTIONAL_COLUMNS = [
  ..."site_name plat mon-type user description boot_time".split(" "),
  ..."smsalert emailalert dashboardalert".split(" "),
];
// also left out of the default when the table is narrow
const NARROW_OPTIONAL_COLUMNS = [
  ...OPTIONAL_COLUMNS,
  "pendingactions",
  "needs_reboot",
  "last_seen",
];

// the whole set needs about 1380px of table (not window) width, measured
// with the current column order and headers
const FULL_SET_WIDTH = 1400;
// narrower than this, the Pending and Reboot headers show their icon;
// tooltip and sr-only text keep the name
const ICON_HEAD_WIDTH = 1080;

// Visible columns of the agent table. The default follows the width of
// the table container, so an open rail or tree counts too; the user's own
// choice is stored per layout (compact/full).
export function useAgentTableColumns(props, width) {
  // missing or [] (from older builds) means the default; nothing is
  // written until the user changes a column
  const chosen = useStorage("agentTable_columns", {}, undefined, {
    writeDefaults: false,
  });

  // 0 before the first resize event counts as narrow, so nothing
  // overflows while the layout settles
  const narrow = computed(() => !width.value || width.value < FULL_SET_WIDTH);
  const iconHeads = computed(
    () => !width.value || width.value < ICON_HEAD_WIDTH,
  );
  const layout = () => (narrow.value ? "compact" : "full");
  const offered = () => props.visibleColumns || [];

  // DashboardView names this column "Last Response", SummaryTab "Last
  // seen"; the table follows SummaryTab
  const tableColumns = computed(() =>
    (props.columns || []).map((col) =>
      col.name === "last_seen" ? { ...col, label: "Last seen" } : col,
    ),
  );

  const fallback = computed(() => {
    const skip = narrow.value ? NARROW_OPTIONAL_COLUMNS : OPTIONAL_COLUMNS;
    return offered().filter((name) => !skip.includes(name));
  });

  // the actions column is never a choice, it always comes last
  const shownColumns = computed({
    get() {
      const own = (chosen.value?.[layout()] || []).filter((name) =>
        offered().includes(name),
      );
      // an empty choice means "never customised", so the stored value
      // can never hide every column
      const names = own.length ? own : fallback.value;
      return [...names.filter((name) => name !== "actions"), "actions"];
    },
    set(names) {
      const own = names.filter((name) => name !== "actions");
      const next = { ...chosen.value };
      // unticking the last column resets the layout instead of storing []
      if (own.length) next[layout()] = own;
      else delete next[layout()];
      chosen.value = next;
    },
  });

  const pickerOptions = computed(() =>
    tableColumns.value
      .filter((col) => col.name !== "actions" && offered().includes(col.name))
      .map((col) => ({ label: col.label, value: col.name })),
  );

  // both layouts, so the reset also holds at the other width
  function resetColumns() {
    chosen.value = {};
  }

  return { tableColumns, iconHeads, shownColumns, pickerOptions, resetColumns };
}
