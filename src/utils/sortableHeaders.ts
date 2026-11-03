// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

// Makes q-table sortable headers keyboard-operable. Quasar marks the current
// sort column on the <th> itself (classes "sortable", "sorted", "sort-desc"),
// so this directive reads that instead of tracking pagination separately.
function onKeydown(event: KeyboardEvent) {
  if (event.key === "Enter" || event.key === " " || event.key === "Spacebar") {
    event.preventDefault();
    (event.currentTarget as HTMLElement).click();
  }
}

interface SortableHeaderEl extends HTMLElement {
  _sortableHeadersBound?: boolean;
}

function apply(el: HTMLElement) {
  el.querySelectorAll<SortableHeaderEl>("thead th").forEach((th) => {
    if (!th.classList.contains("sortable")) {
      th.removeAttribute("tabindex");
      th.removeAttribute("aria-sort");
      return;
    }
    th.setAttribute("tabindex", "0");
    if (!th._sortableHeadersBound) {
      th.addEventListener("keydown", onKeydown);
      th._sortableHeadersBound = true;
    }
    const sorted = th.classList.contains("sorted");
    th.setAttribute(
      "aria-sort",
      sorted
        ? th.classList.contains("sort-desc")
          ? "descending"
          : "ascending"
        : "none",
    );
  });
}

export const sortableHeaders = {
  mounted: apply,
  updated: apply,
};
