<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <div class="tpl-chooser script-templates" data-testid="template-chooser">
    <div class="tpl-chooser__inner">
      <h2 class="tpl-chooser__title">Choose a starting point</h2>
      <p class="rmm-muted tpl-chooser__lead">
        A template fills in the code, its variables and a sensible timeout and
        platform. Everything stays editable.
      </p>
      <div class="rmm-label q-mb-xs">Language</div>
      <q-btn-toggle
        v-model="shell"
        :options="languageOptions"
        no-caps
        unelevated
        toggle-color="primary"
        class="tpl-chooser__langs"
        aria-label="Script language"
      />
      <div class="tpl-chooser__grid">
        <button
          v-for="t in templates"
          :key="t.id"
          type="button"
          class="tpl-chooser__card"
          :data-template="t.id"
          @click="emit('choose', t)"
        >
          <q-icon :name="KIND_ICONS[t.kind]" size="22px" class="tpl-icon" />
          <span class="tpl-chooser__name">{{ t.label }}</span>
          <span class="tpl-chooser__caption">{{ t.caption }}</span>
          <span class="tpl-chooser__meta">{{
            t.variables.length
              ? `${t.variables.length} variable${t.variables.length === 1 ? "" : "s"}`
              : "No variables"
          }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import {
  TEMPLATE_LANGUAGES,
  templatesFor,
  type ScriptTemplate,
  type TemplateKind,
} from "@/utils/scriptBlocks";
import type { ScriptShellType } from "@/types/scripts";

const emit = defineEmits<{ (e: "choose", template: ScriptTemplate): void }>();

const KIND_ICONS: Record<TemplateKind, string> = {
  blank: "description",
  check: "fact_check",
  maintenance: "build",
  install: "install_desktop",
  collector: "input",
};

const shell = ref<ScriptShellType>("powershell");
const languageOptions = TEMPLATE_LANGUAGES.map((l) => ({
  label: l.label,
  value: l.shell,
}));
const templates = computed(() => templatesFor(shell.value));
</script>

<style scoped>
.tpl-chooser {
  overflow-y: auto;
  flex: 1;
  min-height: 0;
  padding: 24px;
  background: var(--rmm-bg);
}

.tpl-chooser__inner {
  max-width: 960px;
  margin: 0 auto;
}

.tpl-chooser__title {
  margin: 0 0 4px;
  font-size: var(--rmm-fs-xl);
  font-weight: 700;
  line-height: 1.3;
}

.tpl-chooser__lead {
  margin: 0 0 16px;
}

.tpl-chooser__langs {
  border: 1px solid var(--rmm-border);
}

.tpl-chooser__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;
  margin-top: 16px;
}

.tpl-chooser__card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  padding: 16px;
  border: 1px solid var(--rmm-border);
  border-radius: var(--rmm-radius-lg);
  background: var(--rmm-surface);
  box-shadow: var(--rmm-shadow);
  color: var(--rmm-text);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition:
    border-color 0.15s,
    transform 0.15s;
}

.tpl-chooser__card:hover {
  border-color: var(--rmm-accent);
  transform: translateY(-1px);
}

.tpl-chooser__card:focus-visible {
  outline: 2px solid var(--rmm-focus);
  outline-offset: 2px;
}

.tpl-icon {
  padding: 8px;
  border-radius: var(--rmm-radius);
  background: var(--rmm-tile-icon-bg);
  color: var(--rmm-tile-icon-text);
}

.tpl-chooser__name {
  font-weight: 600;
}

.tpl-chooser__caption {
  color: var(--rmm-text-muted);
  font-size: var(--rmm-fs-sm);
}

.tpl-chooser__meta {
  margin-top: auto;
  color: var(--rmm-text-subtle);
  font-size: var(--rmm-fs-xs);
}
</style>
