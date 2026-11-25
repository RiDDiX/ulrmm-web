<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<script setup>
import { computed, ref } from "vue";
import { endpoint } from "@/api/http";
import { wholeNumberIn } from "@/utils/validation";
import {
  PHASES,
  envText,
  hookName,
  hookState,
  lastEnvPerName,
} from "./backups";

const props = defineProps({
  modelValue: { type: Array, default: () => [] },
  // hooks_suspended of the device or policy answer
  suspended: { type: Array, default: () => [] },
  disabled: Boolean,
});
const emit = defineEmits(["update:modelValue", "confirm"]);
const scripts = ref([]);
const loadError = ref("");

const options = computed(() =>
  scripts.value.map((s) => ({ value: s.id, label: s.name })),
);
// a caller without script rights sees only how many arguments a hook has
const hidden = (hook) => hook.args_count !== undefined;
const anyHidden = computed(() => props.modelValue.some(hidden));
const rowOff = (hook) =>
  props.disabled ||
  hidden(hook) ||
  hookState(hook, props.suspended) === "deleted";
const suspendedEntry = (hook) =>
  props.suspended.find((item) => item.script_id === hook.script_id);

const change = (index, patch) =>
  emit(
    "update:modelValue",
    props.modelValue.map((hook, i) =>
      i === index ? { ...hook, ...patch } : hook,
    ),
  );
function pick(index, id) {
  const script = scripts.value.find((s) => s.id === id);
  change(index, {
    script_id: id,
    script_name: script?.name ?? "",
    timeout: script?.default_timeout || 300,
  });
}
// the script list is read when the user picks a script, so a locked editor
// or a role without script rights never asks for it; names come with hooks
let requested = false;
async function ensureScripts() {
  if (requested || props.disabled) return;
  requested = true;
  try {
    scripts.value = await endpoint("/scripts").get("/", { silent: true });
  } catch {
    loadError.value = "The script list could not be loaded.";
  }
}
const add = () => {
  ensureScripts();
  emit("update:modelValue", [
    ...props.modelValue,
    {
      script_id: null,
      phase: "pre-backup",
      args: [],
      env_vars: [],
      timeout: 300,
      on_fail: "abort",
    },
  ]);
};
const remove = (index) =>
  emit(
    "update:modelValue",
    props.modelValue.filter((_, i) => i !== index),
  );
</script>

<template>
  <div role="group" aria-label="Hooks">
    <p class="text-caption rmm-muted q-mb-xs">
      Scripts run on the device around each backup. Saving hooks needs the right
      to run scripts on every device the setting reaches and a two-factor code.
      A Linux live backup has no snapshot, so its after-snapshot hooks run
      before the read.
    </p>
    <p v-if="loadError" class="text-negative" role="alert">{{ loadError }}</p>
    <div
      v-for="(hook, index) in modelValue"
      :key="index"
      class="backup-hook q-mb-sm"
    >
      <div class="row items-start q-gutter-xs">
        <q-select
          :model-value="hook.phase"
          :options="PHASES"
          emit-value
          map-options
          outlined
          dense
          label="When"
          :disable="rowOff(hook)"
          @update:model-value="change(index, { phase: $event })"
        />
        <q-select
          :model-value="hook.script_id"
          :options="options"
          emit-value
          map-options
          outlined
          dense
          label="Script"
          :rules="[(v) => v !== null || 'Pick a script.']"
          style="min-width: 200px"
          :display-value="hookName(hook, scripts)"
          :disable="rowOff(hook)"
          @focus="ensureScripts"
          @update:model-value="pick(index, $event)"
        />
        <q-input
          :model-value="hook.timeout"
          type="number"
          min="1"
          max="3600"
          :rules="[wholeNumberIn(1, 3600)]"
          outlined
          dense
          label="Timeout"
          suffix="s"
          style="width: 110px"
          :disable="rowOff(hook)"
          @update:model-value="change(index, { timeout: Number($event) })"
        />
        <q-select
          :model-value="hook.on_fail"
          :options="[
            { value: 'abort', label: 'Abort on failure' },
            { value: 'warn', label: 'Warn on failure' },
          ]"
          emit-value
          map-options
          outlined
          dense
          label="On failure"
          :hint="
            hook.phase === 'post-backup' ? 'After the backup only warns' : ''
          "
          :disable="rowOff(hook)"
          @update:model-value="change(index, { on_fail: $event })"
        />
        <q-btn
          flat
          dense
          round
          size="sm"
          icon="delete_outline"
          :aria-label="`Remove hook ${index + 1}`"
          :disable="disabled || hidden(hook)"
          @click="remove(index)"
        />
      </div>
      <div class="backup-hook__lists">
        <p v-if="hidden(hook)" class="q-my-sm rmm-muted">
          {{ hook.args_count }}
          {{ hook.args_count === 1 ? "argument" : "arguments" }} hidden
        </p>
        <q-select
          v-else
          :model-value="hook.args"
          multiple
          use-input
          use-chips
          hide-dropdown-icon
          input-debounce="0"
          new-value-mode="add"
          max-values="16"
          outlined
          dense
          label="Arguments, passed literally"
          :disable="rowOff(hook)"
          @update:model-value="change(index, { args: $event ?? [] })"
        />
        <q-select
          :model-value="hook.env_vars"
          multiple
          use-input
          use-chips
          hide-dropdown-icon
          input-debounce="0"
          new-value-mode="add-unique"
          max-values="16"
          outlined
          dense
          label="Environment, NAME=value"
          :option-label="envText"
          :disable="rowOff(hook)"
          @update:model-value="
            change(index, { env_vars: lastEnvPerName($event ?? []) })
          "
        />
      </div>
      <div
        v-if="hookState(hook, suspended)"
        class="row items-center q-gutter-xs text-warning"
        role="status"
      >
        <q-icon name="warning_amber" aria-hidden="true" />
        <template v-if="hookState(hook, suspended) === 'deleted'">
          Script deleted. Remove this hook; it does not run.
        </template>
        <template v-else>
          Script changed since it was approved; the hook is suspended until you
          confirm the new version.
          <q-btn
            flat
            dense
            no-caps
            color="primary"
            label="Confirm"
            :aria-label="`Confirm the changed script of hook ${index + 1}`"
            :disable="disabled"
            @click="emit('confirm', suspendedEntry(hook))"
          />
        </template>
      </div>
    </div>
    <q-btn
      flat
      dense
      no-caps
      icon="add"
      label="Add hook"
      :disable="disabled || anyHidden || modelValue.length >= 8"
      @click="add"
    />
  </div>
</template>

<style scoped>
/* one column on a phone, so chips and labels keep their full text */
.backup-hook__lists {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 4px;
}

.backup-hook {
  padding: 8px;
  border: 1px solid var(--rmm-border);
  border-radius: 6px;
}
</style>
