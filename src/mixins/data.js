// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

// 0..23 as "12 AM" .. "11 PM"
const scheduledTimes = Array.from({ length: 24 }, (_, hour) => ({
  label: `${hour % 12 || 12} ${hour < 12 ? "AM" : "PM"}`,
  value: hour,
}));

const monthDays = Array.from({ length: 31 }, (_, i) => String(i + 1));

// quasar palette names offered for the loading bar
const loadingBarColors = `red pink purple deep-purple indigo blue light-blue
  cyan teal green light-green lime yellow amber orange deep-orange brown grey
  blue-grey`
  .split(/\s+/)
  .filter(Boolean);

export { loadingBarColors, monthDays, scheduledTimes };
