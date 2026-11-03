// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

// one entry of a row menu; shared by context menus and row action buttons
export interface MenuItem {
  label?: string;
  caption?: string;
  icon?: string;
  negative?: boolean;
  disabled?: boolean;
  separator?: boolean;
  header?: boolean;
  action?: () => void;
}
