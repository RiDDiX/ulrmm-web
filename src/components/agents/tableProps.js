// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

// settings the device tabs share on their q-table
export const flatTable = {
  rowsPerPageOptions: [0],
  virtualScroll: true,
};

export const denseTable = {
  ...flatTable,
  dense: true,
  binaryStateSort: true,
};
