// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

// row menus list the decisions in this order
export const DECISION_ORDER = ["inherit", "approve", "ignore", "nothing"];

// a null colour means the dashboard's negative colour
const LOOK = new Map([
  ["approve", { icon: "fas fa-check", color: "primary" }],
  ["ignore", { icon: "block", color: null }],
  ["inherit", { icon: "subdirectory_arrow_right", color: "accent" }],
]);
const UNDECIDED = { icon: "fiber_manual_record", color: "grey" };

export const decisionIcon = (action) => (LOOK.get(action) ?? UNDECIDED).icon;

export function decisionColor(action, negative) {
  const { color } = LOOK.get(action) ?? UNDECIDED;
  return color ?? negative;
}
