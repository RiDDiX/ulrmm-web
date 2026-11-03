// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

export function confirmDelete($q, title) {
  return $q.dialog({
    title,
    ok: { color: "negative", label: "Delete" },
    cancel: true,
  });
}
