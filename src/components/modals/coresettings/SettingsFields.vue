<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <template v-for="f in shown" :key="f.key">
    <template v-if="f.kind === 'group'">
      <div class="settings-group-title">{{ f.label }}</div>
      <div v-if="f.hint" class="settings-hint q-mb-sm">{{ f.hint }}</div>
    </template>

    <RecipientList
      v-else-if="f.kind === 'recipients'"
      :items="settings[f.key]"
      :ready="ready"
      :mono="!!f.mono"
      :add-label="f.addLabel"
      :noun="f.noun"
      :empty-text="f.emptyText"
      @add="emit('add', f)"
      @remove="emit('remove', f.key, $event)"
    />

    <q-card-section
      v-else
      v-show="!f.showIf || f.showIf()"
      :class="f.section ?? SECTION_CLASS[f.kind] ?? 'row'"
    >
      <template v-if="f.kind === 'check'">
        <q-checkbox
          :label="f.label"
          :model-value="settings[f.key]"
          v-bind="f.props"
          @update:model-value="
            (v) => (f.onChange ? f.onChange(v) : put(f.key, v))
          "
        />
        <div v-if="f.hint" class="settings-hint settings-hint--indent">
          {{ f.hint }}
        </div>
      </template>

      <template v-else-if="f.kind === 'checks'">
        <div class="col-12 rmm-label q-mb-xs">{{ f.label }}</div>
        <q-checkbox
          v-for="c in f.items"
          :key="c.key"
          dense
          :class="c.class"
          :label="c.label"
          :model-value="settings[c.key]"
          @update:model-value="put(c.key, $event)"
        />
        <div class="col-12 settings-hint q-mt-xs">{{ f.hint }}</div>
      </template>

      <template v-else-if="f.kind === 'radio'">
        <div class="col-6 settings-row-label">
          {{ f.label }}
          <HelpTip v-if="f.tip" :text="f.tip" />
        </div>
        <div class="col-6">
          <q-option-group
            type="radio"
            inline
            dense
            class="q-gutter-lg"
            :options="f.options"
            :model-value="settings[f.key]"
            @update:model-value="put(f.key, $event)"
          />
          <q-input
            v-if="f.customPath && settings[f.key] === 'custom'"
            class="q-mt-md"
            dense
            outlined
            label="Custom shell path"
            :hint="f.customPath"
            :model-value="settings[`${f.key}_custom`]"
            @update:model-value="put(`${f.key}_custom`, $event)"
          />
        </div>
      </template>

      <template v-else-if="f.kind === 'action'">
        <div class="col-12 col-sm-8">
          {{ f.label }}
          <div class="settings-hint">{{ f.hint }}</div>
        </div>
        <div class="col-12 col-sm-4 text-right">
          <q-btn
            outline
            no-caps
            color="negative"
            :label="f.button"
            @click="f.run()"
          />
        </div>
      </template>

      <div v-else-if="f.kind === 'note'" class="settings-hint">
        {{ f.hint }}
      </div>

      <template v-else-if="f.kind === 'secret' || f.kind === 'secrets'">
        <div v-if="f.kind === 'secrets'" class="col-12 settings-hint">
          {{ f.hint }}
        </div>
        <SecretInput
          v-for="s in f.items || [f]"
          :key="s.key"
          class="col-12"
          :label="s.label"
          :model-value="settings[s.key]"
          :stored="settings[`${s.key}_set`]"
          :clear="!!settings[`${s.key}_clear`]"
          @update:model-value="put(s.key, $event)"
          @update:clear="emit('clear', s.key, $event)"
        />
      </template>

      <component
        :is="f.kind === 'tz' ? RmmSelect : QSelect"
        v-else-if="f.kind === 'select' || f.kind === 'tz'"
        class="col-12"
        outlined
        dense
        options-dense
        :map-options="f.kind === 'select'"
        :emit-value="f.kind === 'select'"
        :label="f.label"
        :hint="f.hint"
        :options="resolve(f.options)"
        :model-value="settings[f.key]"
        v-bind="f.props"
        @update:model-value="put(f.key, $event)"
      />

      <q-input
        v-else
        class="col-12"
        outlined
        dense
        :label="f.label"
        :hint="f.hint"
        :rules="f.rules"
        :model-value="settings[f.key]"
        v-bind="resolve(f.props)"
        @update:model-value="put(f.key, f.number ? toNumber($event) : $event)"
      >
        <template v-if="f.link" #after>
          <q-btn
            round
            dense
            flat
            size="sm"
            icon="open_in_new"
            :aria-label="f.link.aria"
            @click="openURL(f.link.url)"
          >
            <q-tooltip>{{ f.link.tip }}</q-tooltip>
          </q-btn>
        </template>
      </q-input>
    </q-card-section>
  </template>
</template>

<script setup>
import { computed } from "vue";
import { openURL, QSelect } from "quasar";
import HelpTip from "@/components/ui/HelpTip.vue";
import RmmSelect from "@/components/ui/RmmSelect.vue";
import SecretInput from "@/components/ui/SecretInput.vue";
import RecipientList from "@/components/modals/coresettings/RecipientList.vue";

// Draws the blocks of one Global Settings form tab (coreSettingsSchema.js).
// Values go back through `update`, a secret's remove flag through `clear`,
// recipient list buttons through `add` and `remove`.
const props = defineProps({
  fields: { type: Array, required: true },
  settings: { type: Object, required: true },
  ready: Boolean,
});
const emit = defineEmits(["update", "clear", "add", "remove"]);

// q-card-section classes per block kind; plain inputs get "row"
const SECTION_CLASS = {
  check: "",
  note: "",
  checks: "row items-center",
  radio: "row items-start content-between",
  action: "row items-center",
  secrets: "row q-col-gutter-sm",
};

const shown = computed(() => props.fields.filter((f) => !f.when || f.when()));
const resolve = (value) => (typeof value === "function" ? value() : value);
const put = (key, value) => emit("update", key, value);

// same coercion as v-model.number
function toNumber(v) {
  const n = parseFloat(v);
  return isNaN(n) ? v : n;
}
</script>

<style scoped>
.settings-row-label {
  display: flex;
  align-items: center;
  gap: 4px;
  font-weight: 500;
}
</style>
