// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

const naturalCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

const sizeUnits = {
  b: 1,
  kb: 1000,
  mb: 1000 ** 2,
  gb: 1000 ** 3,
  tb: 1000 ** 4,
  kib: 1024,
  mib: 1024 ** 2,
  gib: 1024 ** 3,
  tib: 1024 ** 4,
};

export function parseSoftwareSize(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;

  const match = value.match(/^\s*(\d+(?:\.\d+)?)\s*((?:[kmgt]i?b)|b)?\s*$/i);
  if (!match) return null;

  const unit = match[2]?.toLowerCase();
  return Number(match[1]) * (unit ? sizeUnits[unit] : 1);
}

export function parseSoftwareDate(value) {
  if (typeof value !== "string") return null;

  const match = value.match(
    /^(\d{1,4})[-/](\d{1,2})[-/](\d{1,2})(?:\s+\d{2}:\d{2}:\d{2}\s+[+-]\d{4}\s+UTC)?$/,
  );
  if (!match) return null;

  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const monthDays = [
    31,
    leapYear ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];

  if (
    year < 2 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > monthDays[month - 1]
  ) {
    return null;
  }

  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// year 1 sentinels from the windows agent mean "install date unknown"
const unknownDate = /^0*1[-/]0*1[-/]0*1$/;

export function formatSoftwareDate(value) {
  const parsed = parseSoftwareDate(value);
  if (parsed) return parsed;
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  return unknownDate.test(trimmed) ? "" : trimmed;
}

function sortValue(row, column) {
  const value = row[column];
  if (column === "size") return parseSoftwareSize(value);
  if (column === "install_date") return parseSoftwareDate(value);
  return value === null || value === undefined || value === ""
    ? null
    : String(value);
}

export function sortSoftware(rows, sortBy, descending) {
  return [...rows].sort((left, right) => {
    const leftValue = sortValue(left, sortBy);
    const rightValue = sortValue(right, sortBy);

    if (leftValue === null) return rightValue === null ? 0 : 1;
    if (rightValue === null) return -1;

    const result =
      typeof leftValue === "number"
        ? leftValue - rightValue
        : naturalCollator.compare(leftValue, rightValue);
    return descending ? -result : result;
  });
}
