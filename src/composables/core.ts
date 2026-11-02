// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

import { computed, onMounted, ref } from "vue";
import { fetchCustomFields, fetchURLActions } from "@/api/core";
import type { CustomField } from "@/types/core/customfields";
import type { URLAction } from "@/types/core/urlactions";
import * as format from "@/utils/format";

type Selectable = { value: number; label: string };

export interface URLActionOption extends URLAction, Selectable {}

export interface CustomFieldOption extends CustomField, Selectable {}

export type UseCustomFieldDropdownParams = { onMount?: boolean };
export type UseURLActionDropdownParams = { onMount?: boolean };

export function useCustomFieldDropdown(opts: UseCustomFieldDropdownParams) {
  const customFieldOptions = ref([] as CustomFieldOption[]);

  // model: "client", "site" or "agent"; sent as { [model]: model }
  async function getCustomFieldOptions(
    model: string | null = null,
    flat = false,
  ) {
    const params = model ? { [model]: model } : {};
    const fields = await fetchCustomFields(params);
    customFieldOptions.value = format.formatCustomFieldOptions(
      fields,
      flat,
    ) as CustomFieldOption[];
  }

  const restActionOptions = computed(() =>
    customFieldOptions.value.filter(({ type }) => type === "rest"),
  );

  if (opts.onMount) onMounted(getCustomFieldOptions);

  return { customFieldOptions, restActionOptions, getCustomFieldOptions };
}

export function useURLActionDropdown(opts: UseURLActionDropdownParams) {
  const urlActionOptions = ref([] as URLActionOption[]);

  async function getURLActionOptions(flat = false) {
    const actions = await fetchURLActions({});
    urlActionOptions.value = format.formatURLActionOptions(
      actions,
      flat,
    ) as URLActionOption[];
  }

  const ofType = (kind: URLAction["action_type"]) =>
    computed(() =>
      urlActionOptions.value.filter((a) => a.action_type === kind),
    );
  if (opts?.onMount) onMounted(getURLActionOptions);

  return {
    urlActionOptions,
    restActionOptions: ofType("rest"),
    webActionOptions: ofType("web"),
    getURLActionOptions,
  };
}
