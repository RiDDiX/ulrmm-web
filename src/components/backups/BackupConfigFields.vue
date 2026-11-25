<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<script setup>
import { computed, ref } from "vue";
import ImagingVolumes from "@/components/agents/ImagingVolumes.vue";
import { validSelector } from "@/components/agents/imagingVolumes";
import { wholeNumberIn } from "@/utils/validation";
import BackupHooksEditor from "./BackupHooksEditor.vue";
import BackupRanges from "./BackupRanges.vue";
import BackupScheduleFields from "./BackupScheduleFields.vue";
import OriginChip from "./OriginChip.vue";
import RetentionPreview from "./RetentionPreview.vue";
import {
  CHOICES,
  DEFAULTS,
  GROUPS,
  HINTS,
  NUMBERS,
  SWITCHES,
  copy,
  fieldLabel,
  fieldMark,
  originLabel,
  returnFocus,
} from "./backups";

const props = defineProps({
  modelValue: { type: Object, required: true },
  // device mode: the effective view {fields, conflicts}
  effective: { type: Object, default: null },
  mode: { type: String, default: "device" },
  disabled: Boolean,
  targets: { type: Array, default: () => [] },
  internal: Boolean,
  // device mode: the volumes the device reports, for the volume table
  volumes: { type: Array, default: null },
  // hooks_suspended of the device or policy answer
  suspended: { type: Array, default: () => [] },
  canRunScripts: { type: Boolean, default: true },
  // device mode: the retention preview runs for this device
  agentId: { type: String, default: "" },
  // device mode: the unsaved {set, reset} of the device save
  pending: { type: Object, default: null },
});
const emit = defineEmits([
  "update:modelValue",
  "reset",
  "undo-reset",
  "confirm-hook",
]);

const GB = 1024 ** 3;
const WIDE = [
  "volumes",
  "schedule",
  "windows_allowed",
  "windows_blackout",
  "gfs",
  "hooks",
  "throttle",
];
const TIERS = ["hourly", "daily", "weekly", "monthly", "yearly"];
const EVENTS = [
  { value: "agent_start", label: "When the agent starts" },
  { value: "ac_connected", label: "When AC power is connected" },
];

const policy = computed(() => props.mode === "policy");
const fields = computed(() => props.effective?.fields ?? {});
const shownIn = (keys) =>
  keys.filter((key) =>
    policy.value
      ? true
      : key in fields.value && (key !== "volumes" || props.volumes),
  );
const groups = computed(() =>
  GROUPS.map((group) => ({ ...group, keys: shownIn(group.keys) })).filter(
    (group) => group.keys.length,
  ),
);
const set = (key) => key in props.modelValue;
const off = (key) =>
  props.disabled ||
  (policy.value ? !set(key) : !!fields.value[key]?.locked) ||
  (key === "compression_level" && props.modelValue.compression === "none") ||
  (key === "hooks" && !props.canRunScripts);
const conflict = (key) =>
  props.effective?.conflicts?.some((item) => item.field === key);

const targetOptions = computed(() =>
  props.targets.map((t) => ({
    value: t.id,
    label: t.is_default ? `${t.name} (default)` : t.name,
  })),
);
const modeOptions = computed(() => [
  {
    label: "ULRMM internal network only",
    value: "internal",
    disable: !props.internal,
  },
  { label: "Internet upload allowed", value: "internet" },
]);

const update = (key, value) =>
  emit("update:modelValue", { ...props.modelValue, [key]: value });
// hooks with hidden arguments cannot be edited or taken off by this role
const hooksHidden = computed(() =>
  (props.modelValue.hooks ?? []).some((hook) => hook.args_count !== undefined),
);
const patch = (key, part) => update(key, { ...props.modelValue[key], ...part });

// a policy sets a field or leaves it to the level below
function toggle(key, on) {
  const next = { ...props.modelValue };
  if (!on) delete next[key];
  else if (key === "target")
    next.target = props.targets.find((t) => t.is_default)?.id ?? null;
  else next[key] = copy(DEFAULTS[key]);
  emit("update:modelValue", next);
}

const preview = ref(null);
let restorePreview = null;
function openPreview() {
  restorePreview = returnFocus();
  preview.value = {
    keep_last: props.modelValue.keep_last,
    gfs: props.modelValue.gfs,
    timezone: props.modelValue.timezone,
  };
}
function closePreview() {
  preview.value = null;
  restorePreview?.();
}
</script>

<template>
  <section v-for="group in groups" :key="group.label" class="q-mb-md">
    <h4 class="rmm-label q-mt-sm q-mb-xs">{{ group.label }}</h4>
    <div class="backup-fields">
      <div
        v-for="key in group.keys"
        :key="key"
        :class="{ 'backup-field--wide': WIDE.includes(key) }"
      >
        <div class="row items-center q-gutter-xs q-mb-xs">
          <q-toggle
            v-if="policy"
            :model-value="set(key)"
            dense
            :label="`Set ${fieldLabel(key)} at this level`"
            :disable="
              disabled || (key === 'hooks' && (hooksHidden || !canRunScripts))
            "
            @update:model-value="toggle(key, $event)"
          />
          <template v-else>
            <span class="text-caption">{{ fieldLabel(key) }}</span>
            <OriginChip
              :origin="fields[key]?.origin"
              :locked="fields[key]?.locked"
            />
            <span aria-live="polite">
              <span
                v-if="fieldMark(key, pending) === 'reset'"
                class="rmm-pill rmm-pill--warning"
                >Resets on save</span
              >
              <span
                v-else-if="fieldMark(key, pending) === 'changed'"
                class="rmm-pill rmm-pill--warning"
                >Changed, not saved</span
              >
            </span>
            <q-btn
              v-if="fieldMark(key, pending) === 'reset'"
              flat
              dense
              no-caps
              size="sm"
              label="Undo"
              :aria-label="`Keep ${fieldLabel(key)} on this device`"
              :disable="disabled"
              @click="emit('undo-reset', key)"
            />
            <q-btn
              v-else-if="fields[key]?.origin?.level === 'device'"
              flat
              dense
              no-caps
              size="sm"
              label="Reset to inherited"
              :aria-label="`Reset ${fieldLabel(key)} to inherited`"
              :disable="disabled"
              @click="emit('reset', key)"
            />
          </template>
        </div>
        <p v-if="policy && !set(key)" class="rmm-muted q-mb-none">
          Inherits from the level below.
        </p>
        <template v-else>
          <q-input
            v-if="NUMBERS[key]"
            :model-value="modelValue[key]"
            type="number"
            :min="NUMBERS[key][0]"
            :max="NUMBERS[key][1]"
            :suffix="NUMBERS[key][2]"
            :rules="[wholeNumberIn(NUMBERS[key][0], NUMBERS[key][1])]"
            outlined
            dense
            :label="fieldLabel(key)"
            :hint="HINTS[key]"
            :disable="off(key)"
            @update:model-value="update(key, Number($event))"
          />
          <q-select
            v-else-if="CHOICES[key]"
            :model-value="modelValue[key]"
            :options="CHOICES[key]"
            emit-value
            map-options
            outlined
            dense
            :label="fieldLabel(key)"
            :hint="
              key === 'compression' && modelValue.compression === 'none'
                ? 'Uncompressed Linux live backups also store their alignment padding.'
                : HINTS[key]
            "
            :disable="off(key)"
            @update:model-value="update(key, $event)"
          />
          <q-toggle
            v-else-if="SWITCHES.includes(key)"
            :model-value="modelValue[key]"
            :label="HINTS[key]"
            :disable="off(key)"
            @update:model-value="update(key, $event)"
          />
          <q-select
            v-else-if="key === 'target'"
            :model-value="modelValue.target"
            :options="targetOptions"
            emit-value
            map-options
            outlined
            dense
            :label="fieldLabel(key)"
            :disable="off(key)"
            @update:model-value="update(key, $event)"
          />
          <q-select
            v-else-if="key === 'network_mode'"
            :model-value="modelValue.network_mode"
            :options="modeOptions"
            emit-value
            map-options
            outlined
            dense
            :label="fieldLabel(key)"
            :hint="
              internal
                ? ''
                : 'Internal network only needs the internal imaging listener on the server'
            "
            :disable="off(key)"
            @update:model-value="update(key, $event)"
          />
          <BackupScheduleFields
            v-else-if="key === 'schedule'"
            :model-value="modelValue.schedule"
            :disabled="off(key)"
            @update:model-value="update(key, $event)"
          />
          <q-option-group
            v-else-if="key === 'schedule_events'"
            :model-value="modelValue.schedule_events"
            :options="EVENTS"
            type="checkbox"
            dense
            :aria-label="fieldLabel(key)"
            :disable="off(key)"
            @update:model-value="update(key, $event)"
          />
          <q-input
            v-else-if="key === 'timezone'"
            :model-value="modelValue.timezone"
            outlined
            dense
            label="Time zone (IANA)"
            placeholder="Europe/Berlin"
            hint="Empty uses the device's time zone"
            :disable="off(key)"
            @update:model-value="update(key, ($event ?? '').trim())"
          />
          <BackupRanges
            v-else-if="key === 'windows_allowed' || key === 'windows_blackout'"
            :model-value="modelValue[key]"
            :label="key === 'windows_allowed' ? 'window' : 'blackout'"
            :disabled="off(key)"
            @update:model-value="update(key, $event)"
          />
          <div v-else-if="key === 'gfs'" class="row items-start q-gutter-xs">
            <q-input
              v-for="tier in TIERS"
              :key="tier"
              :model-value="modelValue.gfs?.[tier]"
              type="number"
              min="0"
              max="1000"
              :rules="[wholeNumberIn(0, 1000)]"
              outlined
              dense
              style="width: 110px"
              :label="`${tier.charAt(0).toUpperCase()}${tier.slice(1)}`"
              :disable="off(key)"
              @update:model-value="patch('gfs', { [tier]: Number($event) })"
            />
            <q-btn
              v-if="!policy && agentId"
              flat
              dense
              no-caps
              icon="preview"
              label="Preview retention"
              :disable="disabled"
              @click="openPreview"
            />
            <div class="text-caption rmm-muted full-width">
              Keeps the newest point of each of the last N hours, days, weeks,
              months and years; all 0 with keep last 0 keeps every point.
            </div>
          </div>
          <q-input
            v-else-if="key === 'quota_bytes'"
            :model-value="modelValue.quota_bytes / GB"
            type="number"
            min="0"
            step="any"
            outlined
            dense
            label="Device quota in GB, 0 = none"
            hint="A full quota defers new backups; it never deletes a point"
            :disable="off(key)"
            @update:model-value="
              update(key, Math.round((Number($event) || 0) * GB))
            "
          />
          <template v-else-if="key === 'volumes'">
            <ImagingVolumes
              v-if="!policy"
              :model-value="modelValue.volumes"
              :volumes="volumes"
              :saved="fields.volumes?.value ?? []"
              :disabled="off(key)"
              @update:model-value="update(key, $event)"
            />
            <q-select
              v-else
              :model-value="modelValue.volumes"
              multiple
              use-input
              use-chips
              hide-dropdown-icon
              input-debounce="0"
              new-value-mode="add-unique"
              max-values="32"
              outlined
              dense
              label="Extra volumes (mount paths)"
              hint="System volumes are always included. A device without a volume at a path skips it."
              :rules="[
                (list) =>
                  (list ?? []).every(validSelector) ||
                  'Use absolute mount paths such as /media/data or drive letters such as D:.',
              ]"
              :disable="off(key)"
              @update:model-value="update(key, $event ?? [])"
            />
          </template>
          <template v-else-if="key === 'hooks'">
            <p v-if="!canRunScripts" class="text-caption rmm-muted q-mb-xs">
              Your role cannot run scripts on
              {{ policy ? "every device this policy reaches" : "this device" }},
              so it cannot change these hooks.
            </p>
            <BackupHooksEditor
              :model-value="modelValue.hooks"
              :suspended="suspended"
              :disabled="off(key)"
              @update:model-value="update(key, $event)"
              @confirm="emit('confirm-hook', $event)"
            />
          </template>
          <div v-else-if="key === 'throttle'">
            <q-input
              :model-value="modelValue.throttle?.default_kbps"
              type="number"
              min="0"
              max="10000000"
              outlined
              dense
              style="max-width: 280px"
              label="Default limit in kbps, 0 = unlimited"
              :disable="off(key)"
              @update:model-value="
                patch('throttle', { default_kbps: Number($event) })
              "
            />
            <div class="text-caption rmm-muted q-my-xs">
              Rules use the device's clock; the first matching rule wins.
            </div>
            <BackupRanges
              :model-value="modelValue.throttle?.rules ?? []"
              label="bandwidth rule"
              kbps
              :max="16"
              :disabled="off(key)"
              @update:model-value="patch('throttle', { rules: $event })"
            />
          </div>
        </template>
        <p v-if="conflict(key)" class="text-caption rmm-muted q-mb-none">
          Two policies at equal priority set this;
          {{ originLabel(fields[key]?.origin) }} applies.
        </p>
      </div>
    </div>
  </section>
  <RetentionPreview
    v-if="preview"
    :agent-id="agentId"
    :config="preview"
    @close="closePreview"
  />
</template>

<style scoped>
.backup-fields {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 12px 16px;
  align-items: start;
}

.backup-field--wide {
  grid-column: 1 / -1;
}
</style>
