<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-dialog
    ref="dialogRef"
    maximized
    @show="openEditor"
    @before-hide="closeEditor"
    @hide="dialog.onDialogHide"
  >
    <q-card class="q-dialog-plugin column no-wrap">
      <DialogHeader :title="title">
        <template #actions>
          <q-btn
            v-if="canDraft"
            v-bind="DRAFT_BUTTON"
            :disable="saving"
            @click="askForDraft"
          >
            <q-tooltip
              >Describe what the code should do and insert the generated
              result</q-tooltip
            >
          </q-btn>
        </template>
      </DialogHeader>

      <div class="row">
        <component
          :is="field.is"
          v-for="field in fields"
          :key="field.key"
          v-model="draft[field.key]"
          :class="`q-pa-sm col-${field.span}`"
          outlined
          dense
          v-bind="field.attrs"
        >
          <template v-if="field.tip" #after>
            <HelpTip :text="field.tip" />
          </template>
        </component>
      </div>

      <!-- takes the height the fields and the actions leave over -->
      <div ref="editorHost" class="col snippet-editor"></div>

      <q-card-actions align="right">
        <q-btn v-close-popup flat label="Cancel" />
        <q-btn
          unelevated
          color="primary"
          label="Save"
          :loading="saving"
          @click="saveSnippet"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch, type WatchStopHandle } from "vue";
import { useStore } from "vuex";
import { QInput, QSelect, useDialogPluginComponent, useQuasar } from "quasar";
import * as monaco from "monaco-editor";
import { draftScript } from "@/api/core";
import { editScriptSnippet, saveScriptSnippet } from "@/api/scripts";
import { editorLanguage } from "@/components/scripts/monacoSetup";
import DialogHeader from "@/components/ui/DialogHeader.vue";
import HelpTip from "@/components/ui/HelpTip.vue";
import { shellOptions } from "@/composables/scripts";
import type { ScriptSnippet } from "@/types/scripts";
import { notifySuccess } from "@/utils/notify";

const props = defineProps<{ snippet?: ScriptSnippet }>();
defineEmits(useDialogPluginComponent.emits);

const DRAFT_BUTTON = {
  label: "Generate Script",
  dense: true,
  noCaps: true,
  size: "xs",
  color: "primary",
  class: "q-mr-sm",
};
const REQUIRED = [(v: string) => !!v || "*Required"];
const ASK_TITLE = "Describe the script you need";

const $q = useQuasar();
const { state } = useStore();
const dialog = useDialogPluginComponent();
const { dialogRef } = dialog;

// a new snippet starts as PowerShell; an edit works on a copy
const draft = reactive<ScriptSnippet>(
  props.snippet
    ? { ...props.snippet }
    : { name: "", code: "", shell: "powershell" },
);
const saving = ref(false);

// AI drafts only for new snippets, and only with a key stored on the server
const canDraft = computed(() => !props.snippet && state.aiScriptsEnabled);
const title = computed(() =>
  props.snippet ? `Editing ${draft.name}` : "Adding New Script Snippet",
);
const language = computed(() => editorLanguage(draft.shell));

const fields = computed(() => [
  {
    key: "name",
    is: QInput,
    span: 4,
    tip: `Insert it into any script as {{${draft.name || "name"}}}; the code is swapped in when the script runs`,
    attrs: { label: "Name", rules: REQUIRED },
  },
  {
    key: "shell",
    is: QSelect,
    span: 2,
    tip: "Sets syntax highlighting in the editor below; the snippet is inserted as plain text",
    attrs: {
      label: "Shell Type",
      options: shellOptions,
      mapOptions: true,
      emitValue: true,
      optionsDense: true,
    },
  },
  { key: "desc", is: QInput, span: 6, attrs: { label: "Description" } },
]);

async function saveSnippet() {
  saving.value = true;
  const send = props.snippet ? editScriptSnippet : saveScriptSnippet;
  try {
    const message = await send(draft);
    dialog.onDialogOK();
    notifySuccess(message);
  } catch (err) {
    console.error(err);
  }
  saving.value = false;
}

// monaco lives only while the dialog is open
const editorHost = ref<HTMLElement>();
let editor: monaco.editor.IStandaloneCodeEditor | undefined;
let stopLanguageSync: WatchStopHandle | undefined;

function openEditor() {
  const el = editorHost.value as HTMLElement;
  const model = monaco.editor.createModel(draft.code, language.value);
  const theme = $q.dark.isActive ? "vs-dark" : "vs-light";
  const view = monaco.editor.create(el, {
    model,
    theme,
    automaticLayout: true,
  });
  view.onDidChangeModelContent(() => (draft.code = view.getValue()));
  stopLanguageSync = watch(language, (lang) =>
    monaco.editor.setModelLanguage(model, lang),
  );
  editor = view;
}

function closeEditor() {
  stopLanguageSync?.();
  editor?.getModel()?.dispose();
  editor?.dispose();
  dialog.onDialogHide();
}

function askForDraft() {
  const prompt = {
    type: "text" as const,
    model: `${language.value} code that `,
  };
  $q.dialog({ title: ASK_TITLE, prompt, persistent: true, cancel: true }).onOk(
    async (text: string) => {
      const code = await draftScript({ prompt: text });
      // through the editor, whose change listener updates draft.code
      if (editor) editor.setValue(code);
      else draft.code = code;
    },
  );
}
</script>

<style scoped>
.snippet-editor {
  min-height: 0;
}
</style>
