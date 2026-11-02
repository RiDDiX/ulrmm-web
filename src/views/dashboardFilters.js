// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

import { computed, reactive } from "vue";

export const ATTENTION_HINT =
  "Failing or warning checks, a failed patch, a pending reboot or an overdue agent";

// checkbox filters. Listed in the order their is: words join the table
// search, which is also the order they appear in the URL
const FLAG_FILTERS = [
  {
    key: "needsAttention",
    word: "is:needsattention",
    label: "Needs attention",
    hint: ATTENTION_HINT,
  },
  {
    key: "patchesPending",
    word: "is:patchespending",
    label: "Patches pending",
    hint: "Agents with approved updates waiting to install",
  },
  {
    key: "patchesFailed",
    word: "is:patchesfailed",
    label: "Patch install failed",
    hint: "Agents where an approved update failed",
  },
  {
    key: "actionsPending",
    word: "is:actionspending",
    label: "Actions pending",
    hint: "Agents with queued actions not yet completed",
  },
  {
    key: "checksFailing",
    word: "is:checksfailing",
    label: "Failing checks",
    hint: "Agents with at least one failing check, any severity",
  },
  {
    key: "rebootNeeded",
    word: "is:rebootneeded",
    label: "Reboot needed",
    hint: "Devices that report a pending OS restart",
  },
];

// one radio choice on the connection state; "all" adds no word
const AVAILABILITY = [
  {
    value: "all",
    label: "All agents",
    hint: "Do not filter by connection status",
  },
  {
    value: "online",
    word: "is:online",
    chip: "Online",
    label: "Online only",
    hint: "Agents checking in normally",
  },
  {
    value: "offline",
    word: "is:offline",
    chip: "Offline",
    label: "Offline only",
    hint: "Missed check-in, often just shut down, and not overdue",
  },
  {
    value: "overdue",
    word: "is:overdue",
    chip: "Overdue",
    label: "Overdue only",
    hint: "Monitored for outages and silent past its overdue time",
  },
  {
    value: "offline_30days",
    word: "is:expired",
    chip: "Offline 30+ days",
    label: "Offline 30+ days",
    hint: "Agents not seen for at least 30 days",
  },
];

const flagByKey = Object.fromEntries(FLAG_FILTERS.map((f) => [f.key, f]));
const flagKeys = new Set(FLAG_FILTERS.map((f) => f.key));
const flagOfWord = new Map(FLAG_FILTERS.map((f) => [f.word, f.key]));
const stateOfWord = new Map(
  AVAILABILITY.filter((a) => a.word).map((a) => [a.word, a.value]),
);

// the filter menu lists the flags in its own order
export const FILTER_MENU = [
  {
    header: "Filter agents",
    rows: [
      "needsAttention",
      "checksFailing",
      "patchesPending",
      "patchesFailed",
      "actionsPending",
      "rebootNeeded",
    ].map((key) => flagByKey[key]),
  },
  { header: "Availability", radio: true, rows: AVAILABILITY },
];

// and the chips in theirs
const CHIP_ORDER = [
  "needsAttention",
  "checksFailing",
  "actionsPending",
  "patchesPending",
  "patchesFailed",
  "rebootNeeded",
];

// the search tips: connection words first, then the flags
export const SEARCH_WORDS = [
  "is:online",
  "is:offline",
  "is:expired",
  "is:overdue",
  ...FLAG_FILTERS.map((f) => f.word),
];

// free text, flags and connection state out of one search string. Known
// words only, so a typed "constructor" stays search text
export function readSearch(raw) {
  const found = { flags: {}, availability: "all" };
  const text = [];
  for (const word of String(raw || "").split(/\s+/)) {
    if (!word) continue;
    if (flagOfWord.has(word)) found.flags[flagOfWord.get(word)] = true;
    else if (stateOfWord.has(word)) found.availability = stateOfWord.get(word);
    else text.push(word);
  }
  return { ...found, text: text.join(" ") };
}

// The table parses is: words itself, so the ticked filters travel to it as
// words appended to the typed text. Typing never drops a filter and ticking
// one never drops text.
export function useDashboardFilters(initialSearch) {
  const start = readSearch(initialSearch);
  const filters = reactive({
    text: start.text,
    availability: start.availability,
    flags: Object.fromEntries(
      FLAG_FILTERS.map(({ key }) => [key, !!start.flags[key]]),
    ),
    // set by the groups rail: {id, name, members: Set of agent_id}
    group: null,
    tag: null,
  });

  const words = computed(() => {
    const list = FLAG_FILTERS.filter((f) => filters.flags[f.key]).map(
      (f) => f.word,
    );
    const state = AVAILABILITY.find((a) => a.value === filters.availability);
    if (state?.word) list.push(state.word);
    return list;
  });

  const tableSearch = computed(() =>
    [(filters.text || "").trim(), ...words.value].filter(Boolean).join(" "),
  );

  const filtering = computed(
    () =>
      !!filters.group ||
      !!filters.tag ||
      FLAG_FILTERS.some((f) => filters.flags[f.key]) ||
      filters.availability !== "all",
  );

  // plain labels; the chip adds the "all clients" suffix itself
  const chips = computed(() => {
    const list = CHIP_ORDER.filter((key) => filters.flags[key]).map((key) => ({
      key,
      label: flagByKey[key].label,
    }));
    if (filters.availability !== "all") {
      const state = AVAILABILITY.find((a) => a.value === filters.availability);
      list.push({ key: "availability", label: state?.chip });
    }
    if (filters.group)
      list.push({ key: "group", label: `Group: ${filters.group.name}` });
    if (filters.tag)
      list.push({ key: "tag", label: `Tag: ${filters.tag.name}` });
    return list;
  });

  // the empty table names the search in the chips' wording, not as is: words
  const summary = computed(() => {
    const text = (filters.text || "").trim();
    const parts = chips.value.map((c) => c.label);
    return (text ? [`"${text}"`, ...parts] : parts).join(", ");
  });

  // the checkbox, radio and rail filters; typed text stays
  function resetFilters() {
    for (const key of Object.keys(filters.flags)) filters.flags[key] = false;
    filters.availability = "all";
    filters.group = null;
    filters.tag = null;
  }

  function resetAll() {
    resetFilters();
    filters.text = "";
  }

  function dropChip(key) {
    if (flagKeys.has(key)) filters.flags[key] = false;
    else if (key === "availability") filters.availability = "all";
    else if (key === "group") filters.group = null;
    else if (key === "tag") filters.tag = null;
  }

  // text and is: words from a URL; the rail filters are left alone
  function restore(raw) {
    const next = readSearch(raw);
    filters.text = next.text;
    filters.availability = next.availability;
    for (const key of Object.keys(filters.flags))
      filters.flags[key] = !!next.flags[key];
  }

  function applyWord(word) {
    if (flagOfWord.has(word)) filters.flags[flagOfWord.get(word)] = true;
    else if (stateOfWord.has(word))
      filters.availability = stateOfWord.get(word);
  }

  return {
    filters,
    tableSearch,
    filtering,
    chips,
    summary,
    resetFilters,
    resetAll,
    dropChip,
    restore,
    applyWord,
  };
}
