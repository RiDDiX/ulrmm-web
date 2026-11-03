<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <div class="policy-fields">
    <q-input
      v-for="f in NUMBER_FIELDS"
      :key="f.key"
      :model-value="modelValue[f.key]"
      type="number"
      dense
      outlined
      :label="f.label"
      :suffix="f.suffix"
      :min="limits[f.key]?.[0]"
      :max="limits[f.key]?.[1]"
      :placeholder="inherit ? 'Inherits' : undefined"
      :hint="hint(f.key)"
      :clearable="inherit"
      :error="!!errors[f.key]"
      :error-message="errors[f.key]"
      @update:model-value="set(f.key, $event)"
    />
    <div>
      <q-toggle
        v-if="!inherit"
        :model-value="modelValue.auto_quarantine === true"
        dense
        label="Quarantine on a clone alert"
        @update:model-value="set('auto_quarantine', $event)"
      />
      <q-select
        v-else
        :model-value="modelValue.auto_quarantine"
        dense
        outlined
        options-dense
        map-options
        emit-value
        label="Quarantine on a clone alert"
        :options="INHERIT_OPTIONS"
        @update:model-value="set('auto_quarantine', $event)"
      />
      <div class="text-caption rmm-muted q-mt-xs">
        An agent whose key shows up from a second place is cut off at once.
      </div>
      <div
        v-if="errors.auto_quarantine"
        class="text-caption text-negative"
        role="alert"
      >
        {{ errors.auto_quarantine }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { RotationPolicy } from "@/api/security";

type NumberKey = Exclude<keyof RotationPolicy, "auto_quarantine">;

const NUMBER_FIELDS: { key: NumberKey; label: string; suffix: string }[] = [
  { key: "rekey_minutes", label: "Session rekey", suffix: "min" },
  { key: "rekey_mb", label: "Session rekey after", suffix: "MB" },
  { key: "cert_ttl_hours", label: "Certificate lifetime", suffix: "h" },
  { key: "renew_pct", label: "Renew at", suffix: "% of lifetime" },
  { key: "offline_grace_days", label: "Offline grace", suffix: "days" },
];
const INHERIT_OPTIONS = [
  { value: null, label: "Inherits" },
  { value: true, label: "On" },
  { value: false, label: "Off" },
];

const props = defineProps<{
  modelValue: RotationPolicy;
  limits: Partial<Record<keyof RotationPolicy, [number, number]>>;
  errors: Partial<Record<keyof RotationPolicy, string>>;
  // overrides may leave a field null to inherit it
  inherit?: boolean;
}>();
const emit = defineEmits<{ "update:modelValue": [RotationPolicy] }>();

function hint(key: NumberKey) {
  const range = props.limits[key];
  if (!range) return "";
  // the global value defaults to the lifetime in days under Agent security
  if (key === "cert_ttl_hours" && !props.inherit)
    return `${range[0]} to ${range[1]}, or the Agent security lifetime`;
  return `${range[0]} to ${range[1]}`;
}

function set(key: keyof RotationPolicy, value: unknown) {
  const next =
    value === "" || value === null || value === undefined
      ? null
      : key === "auto_quarantine"
        ? Boolean(value)
        : Number(value);
  emit("update:modelValue", { ...props.modelValue, [key]: next });
}
</script>

<style scoped>
.policy-fields {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px 16px;
  align-items: start;
}
</style>
