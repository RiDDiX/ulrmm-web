// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

import { ref } from "vue";
import { fetchCustomFields } from "@/api/core";
import { formatCustomFields } from "@/utils/format";

const emptyValue = (type) =>
  type === "multiple" ? [] : type === "checkbox" ? false : "";

export function useCustomFieldForm(model) {
  const definitions = ref([]);
  const values = ref({});
  const loadFailed = ref(false);

  async function loadDefinitions() {
    const all = await fetchCustomFields({ model });
    definitions.value = all.filter((f) => !f.hide_in_ui);
  }

  // fetchEntity resolves to the saved entity with its custom_fields list;
  // returns false (and sets loadFailed) when it cannot be loaded
  async function loadValues(fetchEntity) {
    let entity;
    try {
      entity = await fetchEntity();
    } catch (e) {
      console.error(e);
      loadFailed.value = true;
      return false;
    }
    for (const field of definitions.value) {
      const saved = entity.custom_fields.find((v) => v.field === field.id);
      values.value[field.name] = saved ? saved.value : emptyValue(field.type);
    }
    return true;
  }

  const payload = () => formatCustomFields(definitions.value, values.value);

  return {
    definitions,
    values,
    loadFailed,
    loadDefinitions,
    loadValues,
    payload,
  };
}
