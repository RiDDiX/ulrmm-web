// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

import { fetchTaskAssignments } from "@/api/tasks";

// a delete from one tab removes the shared definition everywhere, so name the other sources;
// own = false when the tab's device reaches the task only through a policy
export function deleteTaskMessage({ devices, policies }, own = true) {
  const sources = [
    ...devices.filter((d) => d.direct).map((d) => d.hostname),
    ...policies.filter((p) => p.assigned).map((p) => p.name),
  ];
  return sources.length > (own ? 1 : 0)
    ? `This deletes the task definition and removes it from all of its sources: ${sources.join(", ")}.`
    : "";
}

export const deleteTaskConfirmText = (id, own = true) =>
  fetchTaskAssignments(id).then(
    (assignments) => deleteTaskMessage(assignments, own),
    () =>
      "This deletes the task definition and removes it from every device and policy it is assigned to.",
  );
