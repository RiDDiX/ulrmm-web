<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-btn
    outline
    no-caps
    dense
    icon="add_circle_outline"
    icon-right="arrow_drop_down"
    label="Insert"
    class="insert-menu__btn q-px-sm"
    data-testid="insert-menu-button"
    :disable="disable"
  >
    <q-tooltip v-if="!open"
      >Insert a variable, placeholder, snippet or building block at the
      cursor</q-tooltip
    >
    <q-menu
      v-model="open"
      class="insert-menu"
      max-height="70vh"
      @before-show="loadSnippets"
    >
      <q-list dense style="min-width: 320px; max-width: 420px">
        <q-item-label header>Variables of this script</q-item-label>
        <q-item v-if="!variables.length">
          <q-item-section class="rmm-muted text-caption"
            >Declare variables in the Variables section first</q-item-section
          >
        </q-item>
        <q-item
          v-for="name in variables"
          :key="'v' + name"
          v-close-popup
          clickable
          @click="emit('insert', envReference(shell, name))"
        >
          <q-item-section>
            <q-item-label class="rmm-mono">{{ name }}</q-item-label>
            <q-item-label caption class="rmm-mono">{{
              envReference(shell, name)
            }}</q-item-label>
          </q-item-section>
        </q-item>

        <q-separator spaced />
        <q-item-label header>Server placeholders</q-item-label>
        <q-item
          v-for="p in PLACEHOLDERS"
          :key="p.text"
          v-close-popup
          clickable
          @click="emit('insert', p.text)"
        >
          <q-item-section>
            <q-item-label class="rmm-mono">{{ p.text }}</q-item-label>
            <q-item-label caption>{{ p.caption }}</q-item-label>
          </q-item-section>
        </q-item>

        <q-separator spaced />
        <q-item-label header>Snippets</q-item-label>
        <q-item v-if="snippetsState !== 'ready' || !shellSnippets.length">
          <q-item-section class="rmm-muted text-caption">{{
            snippetsState === "loading"
              ? "Loading snippets"
              : snippetsState === "error"
                ? "Snippets could not be loaded"
                : "No snippets for this shell; manage them from the Script Manager toolbar"
          }}</q-item-section>
        </q-item>
        <q-item
          v-for="s in shellSnippets"
          :key="'s' + s.id"
          v-close-popup
          clickable
          @click="emit('insert', `{{${s.name}}}`)"
        >
          <q-item-section>
            <q-item-label>{{ s.name }}</q-item-label>
            <q-item-label caption>{{
              s.desc || "Swapped in for its code when the script runs"
            }}</q-item-label>
          </q-item-section>
        </q-item>

        <template v-if="blocks.length">
          <q-separator spaced />
          <q-item-label header>Building blocks</q-item-label>
          <q-item
            v-for="b in blocks"
            :key="b.id"
            v-close-popup
            clickable
            :data-block="b.id"
            @click="emit('insert', b.code)"
          >
            <q-item-section>
              <q-item-label>{{ b.label }}</q-item-label>
              <q-item-label caption>{{ b.caption }}</q-item-label>
            </q-item-section>
          </q-item>
        </template>
      </q-list>
    </q-menu>
  </q-btn>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { fetchScriptSnippets } from "@/api/scripts";
import { envReference } from "@/utils/scriptVariables";
import { blocksFor } from "@/utils/scriptBlocks";
import type { ScriptShellType, ScriptSnippet } from "@/types/scripts";

const props = withDefaults(
  defineProps<{
    shell: ScriptShellType;
    variables?: string[];
    disable?: boolean;
  }>(),
  { variables: () => [], disable: false },
);

const emit = defineEmits<{ (e: "insert", text: string): void }>();

const PLACEHOLDERS = [
  {
    text: "{{agent.hostname}}",
    caption: "Host name of the agent the script runs on",
  },
  { text: "{{client.name}}", caption: "Name of the agent's client" },
  { text: "{{site.name}}", caption: "Name of the agent's site" },
  {
    text: "{{global.KeyName}}",
    caption: "Global key store value; replace KeyName with the key",
  },
];

const open = ref(false);
const snippets = ref<ScriptSnippet[]>([]);
const snippetsState = ref<"idle" | "loading" | "ready" | "error">("idle");

const blocks = computed(() => blocksFor(props.shell));
const shellSnippets = computed(() =>
  snippets.value.filter((s) => !s.shell || s.shell === props.shell),
);

async function loadSnippets() {
  if (snippetsState.value === "loading" || snippetsState.value === "ready")
    return;
  snippetsState.value = "loading";
  try {
    snippets.value = await fetchScriptSnippets();
    snippetsState.value = "ready";
  } catch {
    snippetsState.value = "error";
  }
}
</script>
