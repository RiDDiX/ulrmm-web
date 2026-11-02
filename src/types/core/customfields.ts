// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

type CustomFieldData = string | boolean | number | string[];

export interface CustomField {
  id: number;
  name: string;
  model: "agent" | "client" | "site";
  default_value: CustomFieldData;
  type: string;
  required: boolean;
}

// form values keyed by field name
export type CustomFieldValue = Record<string, CustomFieldData>;
