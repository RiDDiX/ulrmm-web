// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

import { exportFile, Notify } from "quasar";

// one quoted csv field; inner quotes are doubled. Newlines stay as they are
// (Excel reads them, some stricter parsers do not)
export function csvField(value, format) {
  const shown = format === undefined ? value : format(value);
  let text = shown === undefined || shown === null ? "" : String(shown);
  // Excel runs a cell starting with = + - @ tab or CR as a formula, even
  // quoted; a number or a lone "-" is not one
  if (/^([=@\t\r]|[+-].)/.test(text) && !Number.isFinite(Number(text)))
    text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

// the q-table value of a column: field function, field key, or the name
function cellValue(row, col) {
  if (typeof col.field === "function") return col.field(row);
  return row[col.field === undefined ? col.name : col.field];
}

export function exportTableToCSV(rows, columns) {
  const header = columns.map((col) => csvField(col.label)).join(",");
  const body = rows.map((row) =>
    columns.map((col) => csvField(cellValue(row, col), col.format)).join(","),
  );
  const content = [header, ...body].join("\r\n");

  if (
    exportFile("export.csv", content, {
      mimeType: "text/csv",
      byteOrderMark: "\uFEFF",
    }) !== true
  ) {
    Notify({
      message: "Browser denied file download...",
      color: "negative",
      icon: "warning",
    });
  }
}
