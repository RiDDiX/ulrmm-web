<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <div class="column q-gutter-y-sm">
    <q-select
      :model-value="type"
      :options="typeOptions"
      emit-value
      map-options
      dense
      outlined
      options-dense
      label="Detection"
      :hint="typeHint"
      :error="!!error"
      :error-message="error"
      :disable="disable"
      @update:model-value="setType"
    />
    <q-input
      v-if="modelValue?.type === 'inventory'"
      :model-value="modelValue.name"
      label="Name in the installed software list"
      hint="Regular expression, e.g. ^Adobe Photoshop"
      input-class="rmm-mono"
      maxlength="255"
      dense
      outlined
      :disable="disable"
      :rules="[required]"
      @update:model-value="(v) => patch({ name: String(v ?? '') })"
    />
    <q-input
      v-else-if="modelValue?.type === 'file'"
      :model-value="modelValue.path"
      label="File path on the device"
      :hint="
        plat === 'windows'
          ? 'e.g. C:\\Program Files\\Vendor\\App\\app.exe'
          : 'e.g. /opt/vendor/app/bin/app'
      "
      input-class="rmm-mono"
      maxlength="1024"
      dense
      outlined
      :disable="disable"
      :rules="[required]"
      @update:model-value="(v) => patch({ path: String(v ?? '') })"
    />
    <template v-else-if="modelValue?.type === 'registry'">
      <q-input
        :model-value="modelValue.key"
        label="Registry key"
        hint="e.g. HKLM\SOFTWARE\Vendor\App"
        input-class="rmm-mono"
        maxlength="1024"
        dense
        outlined
        :disable="disable"
        :rules="[required]"
        @update:model-value="(v) => patch({ key: String(v ?? '') })"
      />
      <q-input
        :model-value="modelValue.value ?? ''"
        label="Value name (optional)"
        input-class="rmm-mono"
        maxlength="255"
        dense
        outlined
        :disable="disable"
        @update:model-value="(v) => patch({ value: String(v ?? '') })"
      />
    </template>
    <q-input
      v-if="modelValue && modelValue.type !== 'none'"
      :model-value="modelValue.version_min ?? ''"
      label="Minimum version (optional)"
      hint="e.g. 24.1; an older version counts as not installed"
      maxlength="64"
      dense
      outlined
      :disable="disable"
      @update:model-value="(v) => patch({ version_min: String(v ?? '') })"
    />
  </div>
</template>

<script setup lang="ts">
// How the server checks that a package or baseline item really is installed.
import { computed } from "vue";
import {
  DETECTION_LABELS,
  type Detection,
  type DetectionType,
} from "@/utils/baselines";

const props = withDefaults(
  defineProps<{
    modelValue: Detection | null;
    plat: string;
    // null stands for the default rule; defaultText describes it
    allowDefault?: boolean;
    defaultText?: string;
    error?: string;
    disable?: boolean;
  }>(),
  { allowDefault: false, defaultText: "", error: "", disable: false },
);
const emit = defineEmits<{ "update:modelValue": [Detection | null] }>();

type Choice = DetectionType | "default";

const type = computed<Choice>(() =>
  props.modelValue ? props.modelValue.type : "default",
);

const typeOptions = computed(() => {
  const types: DetectionType[] = ["inventory", "file", "registry", "none"];
  return [
    ...(props.allowDefault ? [{ value: "default", label: "Default" }] : []),
    ...types
      .filter((t) => t !== "registry" || props.plat === "windows")
      .map((t) => ({ value: t, label: DETECTION_LABELS[t] })),
  ];
});

const typeHint = computed(() => {
  switch (type.value) {
    case "default":
      return props.defaultText ? `Default: ${props.defaultText}` : "";
    case "inventory":
      return "Checked against the software list the agent reports";
    case "none":
      return "Only the exit code counts; the result shows as unverified";
    default:
      return "Checked on the device after the install";
  }
});

const required = (v: string) => !!v?.trim() || "Required";

function setType(choice: Choice) {
  const next: Record<Choice, Detection | null> = {
    default: null,
    inventory: { type: "inventory", name: "" },
    file: { type: "file", path: "" },
    registry: { type: "registry", key: "" },
    none: { type: "none" },
  };
  emit("update:modelValue", next[choice]);
}

function patch(fields: Record<string, string>) {
  if (!props.modelValue) return;
  emit("update:modelValue", { ...props.modelValue, ...fields } as Detection);
}
</script>
