// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

// Attributes shared by the plain list tables of the settings panels.
export const listTableAttrs = {
  dense: true,
  flat: true,
  class: "rmm-table",
  "row-key": "id",
  "binary-state-sort": true,
  "hide-pagination": true,
  "virtual-scroll": true,
  "rows-per-page-options": [0],
};

// Sorted by name, all rows on one page.
export const nameSortedPagination = () => ({
  rowsPerPage: 0,
  sortBy: "name",
  descending: false,
});

export const textColumn = (name, label, extra = {}) => ({
  name,
  label,
  field: name,
  align: /** @type {const} */ ("left"),
  sortable: true,
  ...extra,
});

// Trailing column that holds the row actions button.
export const actionsColumn = {
  name: "actions",
  label: "Actions",
  align: /** @type {const} */ ("right"),
  field: () => "",
};
