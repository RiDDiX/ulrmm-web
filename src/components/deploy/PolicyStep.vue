<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-form ref="form" class="deploy-step" @submit.prevent>
    <h2 id="deploy-step-3" tabindex="-1" class="deploy-step__title">
      Policies
    </h2>

    <EmptyState
      v-if="!target"
      icon="install_desktop"
      title="Nothing to set for agent installers"
      text="The installer takes client, site, agent type, automation policy and Windows options from the deployment. Next shows the links."
    />

    <template v-else>
      <p class="deploy-step__lead">
        Settings baked into the {{ target.label }} answer file. Next renders a
        preview; secrets stay in this browser and the generated file only.
      </p>

      <q-banner
        v-if="alerts.length"
        class="bg-negative q-mb-md"
        role="alert"
        rounded
        dense
      >
        <template #avatar><q-icon name="error_outline" /></template>
        <div v-for="line in alerts" :key="line">{{ line }}</div>
      </q-banner>

      <EmptyState
        v-if="!groups.length"
        icon="tune"
        title="No settings for this target"
        text="The server offers no profile fields for it. Next renders the answer file with its defaults."
      />

      <div class="deploy-groups">
        <section
          v-for="g in groups"
          :key="g.id"
          :class="[
            'rmm-card',
            'deploy-group',
            { 'deploy-group--wide': WIDE_GROUPS.has(g.id) },
          ]"
          :aria-labelledby="`deploy-group-${g.id}`"
        >
          <div class="rmm-card__header">
            <q-icon :name="g.icon" size="18px" aria-hidden="true" />
            <h3 :id="`deploy-group-${g.id}`" class="rmm-card__title">
              {{ g.label }}
            </h3>
          </div>
          <div class="rmm-card__body deploy-group__body">
            <div
              v-if="GROUP_NOTES[g.id]"
              class="deploy-field__note deploy-field--full"
            >
              {{ GROUP_NOTES[g.id] }}
            </div>

            <div
              v-for="f in g.fields"
              :key="f.path"
              :class="['deploy-field', { 'deploy-field--full': wide(f) }]"
            >
              <q-toggle
                v-if="f.kind === 'bool'"
                :model-value="value(f) === true"
                :label="f.label"
                class="deploy-switch"
                :aria-describedby="note(f) ? noteId(f) : undefined"
                @update:model-value="(v: boolean) => set(f, v)"
              >
                <span v-if="note(f)" :id="noteId(f)" class="deploy-field__note">
                  {{ note(f) }}
                </span>
              </q-toggle>
              <fieldset
                v-else-if="f.kind === 'checkgroup'"
                class="deploy-checkgroup"
                :aria-describedby="note(f) ? noteId(f) : undefined"
              >
                <legend class="rmm-label">{{ f.label }}</legend>
                <q-input
                  v-if="(f.choices?.length ?? 0) > 12"
                  v-model="needles[f.path]"
                  :aria-label="`Filter ${f.label}`"
                  placeholder="Filter"
                  class="deploy-checkgroup__filter"
                  outlined
                  dense
                  clearable
                >
                  <template #prepend>
                    <q-icon name="search" size="18px" />
                  </template>
                </q-input>
                <div
                  v-for="s in sections(f)"
                  :key="s.name"
                  class="deploy-checkgroup__section"
                  role="group"
                  :aria-label="s.name || f.label"
                >
                  <div
                    v-if="s.name"
                    class="deploy-checkgroup__title"
                    aria-hidden="true"
                  >
                    {{ s.name }}
                  </div>
                  <div class="deploy-checkgroup__items">
                    <span
                      v-for="c in s.choices"
                      :key="String(c.value)"
                      class="deploy-check"
                    >
                      <q-checkbox
                        :model-value="checked(f, c)"
                        :label="c.label"
                        dense
                        @update:model-value="(v: boolean) => check(f, c, v)"
                      />
                      <HelpTip v-if="c.help" :text="c.help" />
                    </span>
                  </div>
                </div>
                <div v-if="!sections(f).length" class="rmm-muted">
                  Nothing matches the filter.
                </div>
              </fieldset>
              <SecretInput
                v-else-if="f.kind === 'secret'"
                :model-value="text(f)"
                :label="f.label"
                :error="!!errors[f.path]"
                :error-message="errors[f.path]"
                hide-bottom-space
                :aria-describedby="note(f) ? noteId(f) : undefined"
                autocomplete="new-password"
                stack-label
                @update:model-value="(v: string) => set(f, v)"
              />
              <rmm-select
                v-else-if="f.kind === 'select'"
                :model-value="shown(f)"
                :options="f.choices"
                :label="f.label"
                :title="choiceLabel(f)"
                :error="!!errors[f.path]"
                :error-message="errors[f.path]"
                hide-bottom-space
                :aria-describedby="note(f) ? noteId(f) : undefined"
                :filterable="(f.choices?.length ?? 0) > 8"
                map-options
                stack-label
                @update:model-value="(v: unknown) => set(f, v)"
              />
              <q-input
                v-else-if="f.kind === 'multiline'"
                :model-value="text(f)"
                :label="f.label"
                :error="!!errors[f.path]"
                :error-message="errors[f.path]"
                hide-bottom-space
                :aria-describedby="note(f) ? noteId(f) : undefined"
                input-class="rmm-mono"
                type="textarea"
                spellcheck="false"
                autocomplete="off"
                autogrow
                outlined
                dense
                stack-label
                @update:model-value="
                  (v: string | number | null) => set(f, String(v ?? ''))
                "
              />
              <q-input
                v-else-if="f.kind === 'list'"
                :model-value="listText(f)"
                :label="f.label"
                :error="!!errors[f.path]"
                :error-message="errors[f.path]"
                hide-bottom-space
                :aria-describedby="noteId(f)"
                type="textarea"
                autogrow
                outlined
                dense
                stack-label
                @update:model-value="
                  (v: string | number | null) =>
                    set(f, listFromText(String(v ?? ''), f.numeric))
                "
              />
              <q-input
                v-else-if="f.kind === 'number'"
                :model-value="num(f)"
                :label="f.label"
                :error="!!errors[f.path]"
                :error-message="errors[f.path]"
                hide-bottom-space
                :aria-describedby="note(f) ? noteId(f) : undefined"
                type="number"
                outlined
                dense
                stack-label
                @update:model-value="
                  (v: string | number | null) =>
                    set(f, v === '' || v == null ? null : Number(v))
                "
              />
              <q-input
                v-else
                :model-value="text(f)"
                :label="required(f) ? `${f.label} *` : f.label"
                :rules="required(f) ? [needed] : []"
                :error="!!errors[f.path]"
                :error-message="errors[f.path]"
                hide-bottom-space
                :aria-describedby="note(f) ? noteId(f) : undefined"
                outlined
                dense
                stack-label
                @update:model-value="
                  (v: string | number | null) => set(f, String(v ?? ''))
                "
              />
              <div
                v-if="note(f) && f.kind !== 'bool'"
                :id="noteId(f)"
                class="deploy-field__note"
              >
                {{ note(f) }}
              </div>
              <div
                v-if="
                  (f.kind === 'bool' || f.kind === 'checkgroup') &&
                  errors[f.path]
                "
                class="deploy-field__error"
                role="alert"
              >
                {{ errors[f.path] }}
              </div>
            </div>

            <div
              v-if="g.missing.length"
              class="deploy-unavailable deploy-field--full"
            >
              <q-icon name="block" size="16px" aria-hidden="true" />
              <span>
                Not available:
                {{ g.missing.map((m) => m.label).join(", ") }}
              </span>
              <HelpTip :text="reasons(g.missing)" />
            </div>
          </div>
        </section>
      </div>
    </template>
  </q-form>
</template>

<script setup lang="ts">
import { computed, reactive, ref, toRef } from "vue";
import type { QForm } from "quasar";
import EmptyState from "@/components/ui/EmptyState.vue";
import HelpTip from "@/components/ui/HelpTip.vue";
import RmmSelect from "@/components/ui/RmmSelect.vue";
import SecretInput from "@/components/ui/SecretInput.vue";
import {
  applyPreset,
  choiceSections,
  getPath,
  listFromText,
  policyFields,
  policyGroups,
  presetShown,
  setPath,
  WIDE_GROUPS,
  type MissingFeature,
  type PolicyField,
} from "@/utils/deploy";
import type { FieldChoice, Target } from "@/api/deploy";

const props = defineProps<{
  // null for agent installers
  target: Target | null;
  profile: Record<string, unknown>;
  errors: Record<string, string>;
  other: string[];
}>();

// only what no field help says
const GROUP_NOTES: Record<string, string> = {
  accounts:
    "When LAPS is on for the site, it takes over the local admin password after enrollment.",
};

const form = ref<QForm | null>(null);
const errs = toRef(props, "errors");

const all = computed(() => (props.target ? policyFields(props.target) : []));
// show_if hides fields that do not apply to the current choice, the edition
// those it does not support
const groups = computed(() =>
  props.target ? policyGroups(props.target, props.profile) : [],
);
const fields = computed(() => groups.value.flatMap((g) => g.fields));

// a server error on a hidden field still has to be seen
const alerts = computed(() => {
  const visible = new Set(fields.value.map((f) => f.path));
  return [
    ...props.other,
    ...all.value
      .filter((f) => props.errors[f.path] && !visible.has(f.path))
      .map((f) => `${f.label}: ${props.errors[f.path]}`),
  ];
});

const value = (f: PolicyField) => getPath(props.profile, f.path);
const text = (f: PolicyField) => {
  const v = value(f);
  return v == null ? "" : String(v);
};
const num = (f: PolicyField) => {
  const v = value(f);
  return typeof v === "number" ? v : null;
};
const listText = (f: PolicyField) => {
  const v = value(f);
  return Array.isArray(v) ? v.join("\n") : "";
};

const shown = (f: PolicyField) =>
  f.preset && props.target
    ? presetShown(props.target, f.path, props.profile)
    : value(f);
// the full text of a long choice the field ellipsizes
const choiceLabel = (f: PolicyField) =>
  f.choices?.find((c) => c.value === shown(f))?.label;

const wide = (f: PolicyField) =>
  f.kind === "checkgroup" || f.kind === "list" || f.kind === "multiline";

const needles = reactive<Record<string, string | null>>({});
const sections = (f: PolicyField) =>
  choiceSections(f.choices ?? [], needles[f.path] ?? "");
const picked = (f: PolicyField) => {
  const v = value(f);
  return Array.isArray(v) ? v : [];
};
const checked = (f: PolicyField, c: FieldChoice) => picked(f).includes(c.value);
// kept in choice order so the profile does not depend on the click order
function check(f: PolicyField, c: FieldChoice, on: boolean) {
  const keep = new Set(picked(f).filter((v) => v !== c.value));
  if (on) keep.add(c.value);
  const known = (f.choices ?? []).map((x) => x.value);
  const listed = new Set<unknown>(known);
  set(f, [
    ...known.filter((v) => keep.has(v)),
    ...[...keep].filter((v) => !listed.has(v)),
  ]);
}

const reasons = (missing: MissingFeature[]) =>
  [...new Set(missing.map((m) => m.reason))].join(" ");

// targets that cannot pick the disk themselves need its device path
const required = (f: PolicyField) =>
  f.path === "disk.device" &&
  props.target?.capabilities?.device_required === true;
const needed = (v: string) => !!v || "This target needs the disk device path";

// server help first; the builder's own hints only where it says nothing
function note(f: PolicyField): string {
  if (f.help) {
    const hint =
      (f.kind === "list" || f.kind === "multiline") && !/per line/i.test(f.help)
        ? "One entry per line."
        : "";
    return [f.help, hint].filter(Boolean).join(" ");
  }
  if (f.generate)
    return "Left empty, a strong password is generated when you continue and shown once on the next step.";
  if (f.kind === "list" || f.kind === "multiline") return "One entry per line.";
  return "";
}
const noteId = (f: PolicyField) => `deploy-note-${f.path.replace(/\W/g, "-")}`;

// the display language follows the region formats until it is picked itself
const DISPLAY = "general.ui_language";
let displayPicked = false;

function set(f: PolicyField, v: unknown) {
  if (f.preset && props.target)
    applyPreset(props.target, f.path, v, props.profile);
  else setPath(props.profile, f.path, v);
  delete errs.value[f.path];
  if (f.path === DISPLAY) displayPicked = true;
  if (f.path === "general.locale" && !displayPicked) {
    const display = fields.value.find((x) => x.path === DISPLAY);
    if (display?.choices?.some((c) => c.value === v))
      setPath(props.profile, DISPLAY, v);
  }
}

defineExpose({
  validate: async () => (await form.value?.validate()) ?? true,
});
</script>
