<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-dialog
    ref="dialogRef"
    full-width
    full-height
    persistent
    no-shake
    @show="onOpened"
    @hide="onDialogHide"
    @before-hide="unmountEditor"
    @keydown.esc.stop="requestClose"
  >
    <q-card
      class="q-dialog-plugin script-builder"
      aria-labelledby="script-builder-title"
    >
      <q-bar class="script-builder__bar">
        <div class="script-builder__heading">
          <div id="script-builder-title" class="script-builder__title">
            {{ heading }}
          </div>
          <div class="script-builder__subtitle">{{ tagline }}</div>
        </div>
        <q-space />
        <q-btn
          v-if="canDraft"
          dense
          flat
          no-caps
          icon="auto_awesome"
          label="Generate"
          :disable="saving || !codeReady"
          @click="askForDraft"
        >
          <q-tooltip
            >Describe what the script should do; the editor content is replaced
            with the result</q-tooltip
          >
        </q-btn>
        <q-btn
          v-if="viewOnly && props.script"
          dense
          unelevated
          no-caps
          color="primary"
          icon="content_copy"
          label="Clone to edit"
          class="q-px-sm"
          :disable="!codeReady"
          @click="copyForEditing"
        >
          <q-tooltip
            >Opens an editable copy of this script; save it to keep
            it</q-tooltip
          >
        </q-btn>
        <q-btn
          dense
          flat
          round
          icon="close"
          aria-label="Close"
          @click="requestClose"
        >
          <q-tooltip>Close</q-tooltip>
        </q-btn>
      </q-bar>

      <ScriptTemplateChooser
        v-if="pickingTemplate"
        @choose="startFromTemplate"
      />

      <div v-else class="script-builder__body">
        <aside class="script-builder__side" aria-label="Script settings">
          <q-tabs
            v-model="pane"
            dense
            no-caps
            align="justify"
            class="script-builder__tabs"
            active-color="primary"
            indicator-color="primary"
            data-testid="sections-nav"
          >
            <q-tab
              v-for="tab in PANES"
              :key="tab.name"
              :name="tab.name"
              :icon="tab.icon"
              :label="tab.counted ? undefined : tab.label"
            >
              <div
                v-if="tab.counted"
                class="q-tab__label row items-center no-wrap"
              >
                {{ tab.label }}
                <q-badge
                  v-if="varProblems.length"
                  color="negative"
                  rounded
                  class="q-ml-xs"
                  :label="varRows.length"
                />
                <span v-else class="script-builder__count">{{
                  varRows.length
                }}</span>
                <span v-if="varProblems.length" class="sr-only"
                  >, {{ varProblems.length }} problems</span
                >
              </div>
            </q-tab>
          </q-tabs>

          <div class="script-builder__panes">
            <div
              v-show="pane === 'details'"
              class="script-builder__fields"
              role="tabpanel"
              data-section="details"
            >
              <q-input
                v-model="draft.name"
                v-bind="look"
                label="Name *"
                :error="!viewOnly && triedSave && !draft.name.trim()"
                error-message="Required"
              />
              <q-input
                v-model="draft.description"
                v-bind="{ ...look, ...DESCRIPTION_FIELD }"
              />
              <rmm-select
                v-model="draft.category"
                v-bind="{ ...look, ...CATEGORY_PICKER }"
                :options="props.categories"
              />
              <rmm-select
                v-model="draft.supported_platforms"
                v-bind="{ ...look, ...PLATFORM_PICKER }"
              />
              <q-select
                v-model="draft.shell"
                v-bind="{ ...look, ...SHELL_PICKER }"
              />
              <q-input
                v-model.number="draft.default_timeout"
                v-bind="{ ...look, ...TIMEOUT_FIELD }"
              />
              <div class="row items-center no-wrap">
                <q-checkbox
                  v-model="draft.run_as_user"
                  label="Run as user (Windows only)"
                  :disable="viewOnly"
                />
                <HelpTip
                  text="Always runs this script as the logged-in Windows user, overriding the Run As User option in run dialogs. Runs as SYSTEM when nobody is logged in."
                />
              </div>
            </div>

            <div
              v-show="pane === 'variables'"
              class="script-builder__fields"
              role="tabpanel"
              data-section="variables"
            >
              <ScriptVariablesEditor
                ref="varEditor"
                v-model="varRows"
                :issues="varProblems"
                :readonly="viewOnly"
              />
            </div>

            <div
              v-show="pane === 'defaults'"
              class="script-builder__fields"
              role="tabpanel"
              data-section="defaults"
            >
              <rmm-select
                v-model="draft.env_vars"
                v-bind="chipLook"
                label="Extra environment variables"
                :option-label="envChipLabel"
                placeholder="Type KEY=value and press Enter"
                :hint="`One KEY=value per entry, sent on every run; values may use ${PLACEHOLDER_SAMPLE}`"
              />
              <q-input
                v-model="draft.syntax"
                v-bind="look"
                label="Syntax note"
                autogrow
                hint="Usage help shown next to the script in the Run Script dialog"
              />
              <rmm-select
                v-if="legacyArgs"
                v-model="draft.args"
                v-bind="chipLook"
                label="Script arguments (legacy)"
                placeholder="Type an argument and press Enter"
                hint="Variables replace arguments; move each input to a variable and clear this list"
              />
              <div class="text-caption rmm-muted">
                Write <code class="rmm-mono">{{ SNIPPET_SAMPLE }}</code> in the
                editor to insert a saved snippet; its code is swapped in when
                the script runs.
              </div>
            </div>
          </div>
        </aside>

        <section class="script-builder__main" aria-label="Script code">
          <q-banner
            v-if="shebangWarning"
            dense
            class="rmm-banner-warning script-builder__banner"
          >
            <template #avatar><q-icon name="warning" /></template>
            Shell and Python scripts on Linux, macOS and FreeBSD need a shebang
            on the first line, e.g. <code>#!/bin/sh</code> or
            <code>#!/usr/bin/env python3</code>. Ignore this for scripts that
            only run on Windows.
          </q-banner>
          <div class="script-builder__toolbar">
            <ScriptInsertMenu
              v-if="!viewOnly"
              :shell="draft.shell"
              :variables="varNames"
              :disable="!codeReady"
              @insert="insertAtCursor"
            />
            <ShellChip :shell="draft.shell" />
            <q-space />
            <span class="text-caption rmm-muted">{{
              viewOnly ? "Read-only" : "Inserts go to the cursor, or to the end"
            }}</span>
          </div>
          <div class="script-builder__editor">
            <div ref="codeHost" class="script-builder__monaco"></div>
            <q-inner-loading
              :showing="!codeReady && !codeFailed"
              label="Loading script body"
            />
            <q-inner-loading :showing="codeFailed" class="text-negative">
              The script body could not be loaded. Close and reopen the editor.
            </q-inner-loading>
          </div>
          <div
            v-if="showHints"
            class="script-builder__hints"
            role="status"
            data-testid="variable-hints"
          >
            <div
              v-if="codeHints.undeclared.length"
              class="script-builder__hint"
            >
              <q-icon name="lightbulb" size="16px" />
              <span>Read in the code but not declared:</span>
              <q-btn
                v-for="name in codeHints.undeclared"
                :key="'u' + name"
                outline
                dense
                no-caps
                size="sm"
                icon="add"
                :label="name"
                :aria-label="`Add ${name} as variable`"
                class="script-builder__hint-btn"
                @click="declareVariable(name)"
              >
                <q-tooltip>Add {{ name }} as variable</q-tooltip>
              </q-btn>
            </div>
            <div v-if="codeHints.unused.length" class="script-builder__hint">
              <q-icon name="info" size="16px" />
              <span
                >Declared but never read:
                <code class="rmm-mono">{{
                  codeHints.unused.join(", ")
                }}</code></span
              >
            </div>
          </div>
        </section>
      </div>

      <q-card-actions v-if="!pickingTemplate" class="script-builder__actions">
        <rmm-select
          v-model="testAgent"
          class="script-builder__agent"
          :loading="agentsLoading"
          :options="agentChoices"
          label="Agent to test on"
          map-options
          filterable
        />
        <q-btn
          v-for="target in testTargets"
          :key="target.ctx"
          flat
          no-caps
          :icon="target.icon"
          :label="target.label"
          :disable="target.blocked"
          @click="testOn(target.ctx)"
        >
          <q-tooltip>{{ target.tip }}</q-tooltip>
        </q-btn>
        <q-space />
        <q-btn
          flat
          :label="viewOnly ? 'Close' : 'Cancel'"
          @click="requestClose"
        />
        <q-btn
          v-if="!viewOnly"
          unelevated
          color="primary"
          label="Save"
          :loading="saving"
          :disable="!codeReady"
          data-testid="save-script"
          @click="onSave"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import {
  computed,
  nextTick,
  onMounted,
  reactive,
  ref,
  type PropType,
} from "vue";
import { useStore } from "vuex";
import { useDialogPluginComponent, useQuasar } from "quasar";
import type { QDialogOptions } from "quasar";
import { watchDebounced } from "@vueuse/core";
import { downloadScript, editScript, saveScript } from "@/api/scripts";
import { draftScript } from "@/api/core";
import { agentPlatformOptions, useAgentDropdown } from "@/composables/agents";
import { shellOptions } from "@/composables/scripts";
import { notifyError, notifySuccess } from "@/utils/notify";
import {
  cleanDefinitions,
  envMasker,
  validateDefinitions,
  variableHints,
} from "@/utils/scriptVariables";
import {
  toBuilderVariable,
  type BuilderVariable,
  type ScriptTemplate,
} from "@/utils/scriptBlocks";
import { editorLanguage } from "./monacoSetup";
import { useScriptEditor } from "./useScriptEditor";
import TestScriptModal from "./TestScriptModal.vue";
import ScriptVariablesEditor from "./ScriptVariablesEditor.vue";
import ScriptInsertMenu from "./ScriptInsertMenu.vue";
import ScriptTemplateChooser from "./ScriptTemplateChooser.vue";
import ShellChip from "./ShellChip.vue";
import RmmSelect from "@/components/ui/RmmSelect.vue";
import HelpTip from "@/components/ui/HelpTip.vue";
import type { Script } from "@/types/scripts";

const props = defineProps({
  script: { type: Object as PropType<Script>, default: undefined },
  categories: { type: Array as PropType<string[]>, default: undefined },
  readonly: { type: Boolean, default: false },
  clone: { type: Boolean, default: false },
});
defineEmits([...useDialogPluginComponent.emits]);

const { dialogRef, onDialogOK, onDialogHide } = useDialogPluginComponent();
const $q = useQuasar();
const vuex = useStore();
const fromStore = (key: string) => computed<boolean>(() => vuex.state[key]);
const aiDrafts = fromStore("aiScriptsEnabled");
const hostedServer = fromStore("hosted");
const serverScripts = fromStore("server_scripts_enabled");
// every question here has a Cancel button; persistent ones ignore a click outside
const ask = (opts: QDialogOptions, persistent = false) =>
  $q.dialog({ ...opts, cancel: true, persistent });
const {
  agent: testAgent,
  agentOptions: agentChoices,
  getAgentOptions,
} = useAgentDropdown();

// literal braces would be read as template interpolation
const SNIPPET_SAMPLE = "{{snippet name}}";
const PLACEHOLDER_SAMPLE = "{{client.name}}";
const SERVER_NEEDS_SHEBANG =
  "A shebang is required at the top of the script to specify the interpreter's path. Please ensure your script begins with a shebang line.";

// fixed field setups of the side panel
const DESCRIPTION_FIELD = {
  label: "Description",
  type: "textarea",
  autogrow: true,
};
const CATEGORY_PICKER = {
  label: "Category",
  hint: "Folder the script is listed under; type a new name and press Enter to create one",
  "use-input": true,
  "new-value-mode": "add-unique",
  clearable: true,
  filterable: true,
};
const PLATFORM_PICKER = {
  label: "Platforms",
  hint: "Offered and used as a policy check only on these; empty means all",
  options: agentPlatformOptions,
  clearable: true,
  "map-options": true,
  multiple: true,
};
const SHELL_PICKER = {
  label: "Language",
  hint: "Interpreter the agent runs the script with",
  options: shellOptions,
  "options-dense": true,
  "emit-value": true,
  "map-options": true,
};
const TIMEOUT_FIELD = {
  label: "Default timeout (seconds)",
  hint: "Run dialogs start with this limit; minimum 5",
  type: "number",
  rules: [(sec: number) => sec >= 5 || "Minimum is 5"],
};

type Pane = "details" | "variables" | "defaults";
const PANES: { name: Pane; icon: string; label: string; counted?: boolean }[] =
  [
    { name: "details", icon: "tune", label: "Details" },
    { name: "variables", icon: "input", label: "Variables", counted: true },
    { name: "defaults", icon: "settings_suggest", label: "Defaults" },
  ];

// "start blank": an empty PowerShell script with a 90 second limit
const emptyDraft = (): Script =>
  Object.assign(
    { name: "", script_body: "", run_as_user: false },
    { shell: "powershell", default_timeout: 90, args: [], env_vars: [] },
  );
// the code of an existing script is fetched once the editor is up
const draft: Script = reactive(
  props.script ? { ...props.script, script_body: "" } : emptyDraft(),
);

// view mode can turn into an editable copy without closing the dialog
const viewOnly = ref(props.readonly);
const asCopy = ref(props.clone);
function turnIntoCopy() {
  // a copy belongs to the user: visible, not starred, no library file
  draft.name = `(Copy) ${draft.name}`;
  draft.hidden = false;
  draft.favorite = false;
  delete draft.filename;
}
if (asCopy.value) turnIntoCopy();
const legacyArgs = !!props.script?.args?.length;

const varRows = ref<BuilderVariable[]>(
  (props.script?.variables ?? []).map((v) => toBuilderVariable(v)),
);
const varEditor = ref<InstanceType<typeof ScriptVariablesEditor> | null>(null);
const varProblems = computed(() => validateDefinitions(varRows.value));
const varNames = computed(() =>
  varRows.value.map((v) => v.name.trim()).filter(Boolean),
);
// password values stay hidden on the env chips
const envChipLabel = computed(() => envMasker(varRows.value));

const pane = ref<Pane>("details");
const pickingTemplate = ref(!props.script && !props.readonly);
const saving = ref(false);
const agentsLoading = ref(false);
// no saving before the code of an existing script has arrived
const codeReady = ref(!props.script);
const codeFailed = ref(false);

const look = computed(() => ({
  outlined: true,
  dense: true,
  "hide-bottom-space": true,
  readonly: viewOnly.value,
}));
// type a value, Enter turns it into a chip
const chipLook = computed(() => ({
  ...look.value,
  "use-input": true,
  multiple: true,
  "hide-dropdown-icon": true,
  "input-debounce": "0",
  "new-value-mode": "add",
}));

const language = computed(() => editorLanguage(draft.shell));
const shebangWarning = computed(
  () =>
    !!draft.script_body &&
    ["shell", "python"].includes(draft.shell) &&
    !draft.script_body.startsWith("#!"),
);
const canDraft = computed(
  () =>
    aiDrafts.value &&
    !props.script &&
    !viewOnly.value &&
    !pickingTemplate.value,
);

const heading = computed(() => {
  if (!props.script) return "New script";
  if (viewOnly.value) return `Viewing ${draft.name}`;
  return `${asCopy.value ? "Copying" : "Editing"} ${draft.name}`;
});
const tagline = computed(() => {
  if (pickingTemplate.value) return "Pick a template or start blank";
  return viewOnly.value
    ? "Library scripts are read-only; clone one to change it"
    : "Inputs are typed variables; the script reads them from the environment";
});

const {
  host: codeHost,
  mount,
  unmount: unmountEditor,
  show: showCode,
  unlock,
  insert,
} = useScriptEditor(language, (code) => {
  draft.script_body = code;
});

const toPayload = () => ({
  ...draft,
  variables: cleanDefinitions(varRows.value),
});

// JSON of the form as opened, plus the code once it has arrived
let cleanJson = "";
function markClean() {
  cleanJson = JSON.stringify(toPayload());
}
function unsaved() {
  if (viewOnly.value || !cleanJson) return false;
  return cleanJson !== JSON.stringify(toPayload());
}

function fetchCode(expanded: boolean) {
  codeReady.value = false;
  // typing during the load, or after a failed one, still counts as a change
  markClean();
  const opened = JSON.parse(cleanJson);
  downloadScript(draft.id, { with_snippets: expanded })
    .then(({ code }) => {
      draft.script_body = code;
      showCode(code);
      codeReady.value = true;
      cleanJson = JSON.stringify({ ...opened, script_body: draft.script_body });
    })
    .catch(() => {
      codeFailed.value = true;
    });
}

function startEditor() {
  if (!mount(draft.script_body, viewOnly.value)) return;
  // view mode shows snippets expanded, editing keeps the references
  if (props.script) fetchCode(viewOnly.value);
  else markClean();
}

function onOpened() {
  if (!pickingTemplate.value) startEditor();
}

function startFromTemplate(t: ScriptTemplate) {
  Object.assign(draft, {
    shell: t.shell,
    script_body: t.body,
    default_timeout: t.timeout,
    supported_platforms: [...t.platforms],
  });
  varRows.value = t.variables.map((v) => toBuilderVariable(v));
  pickingTemplate.value = false;
  nextTick(startEditor);
}

function copyForEditing() {
  viewOnly.value = false;
  asCopy.value = true;
  turnIntoCopy();
  unlock();
  fetchCode(false);
}

function insertAtCursor(text: string) {
  if (!viewOnly.value) insert(text);
}

function declareVariable(name: string) {
  // DISK_PATH gets the label "Disk path"
  const words = name.toLowerCase().replace(/_+/g, " ").trim();
  const label = words.charAt(0).toUpperCase() + words.slice(1);
  varRows.value = [...varRows.value, toBuilderVariable({ name, label })];
  pane.value = "variables";
}

const codeHints = ref<{ unused: string[]; undeclared: string[] }>({
  unused: [],
  undeclared: [],
});
const showHints = computed(
  () =>
    !viewOnly.value &&
    (codeHints.value.unused.length > 0 ||
      codeHints.value.undeclared.length > 0),
);
watchDebounced(
  () => [draft.shell, draft.script_body, varNames.value.join(",")],
  () => {
    codeHints.value = variableHints(
      draft.shell,
      draft.script_body,
      varRows.value,
    );
  },
  { debounce: 400, immediate: true },
);

// the first problem that blocks a save, worded for the notification;
// the pane that holds it is opened
const DETAIL_CHECKS: [(s: Script) => boolean, string][] = [
  [(s) => !s.name.trim(), "the name is required (Details)"],
  [
    (s) => !(s.default_timeout >= 5),
    "the default timeout must be at least 5 seconds (Details)",
  ],
];

function saveBlocker(): string {
  const failed = DETAIL_CHECKS.find(([broken]) => broken(draft));
  if (!failed) return variableBlocker();
  pane.value = "details";
  return failed[1];
}

function variableBlocker(): string {
  const [first, ...others] = varProblems.value;
  if (!first) return "";
  pane.value = "variables";
  varEditor.value?.revealErrors();
  const row = varRows.value[first.index];
  const name = row.label || row.name || "unnamed";
  const tail = others.length
    ? `, and ${others.length} more problem${others.length === 1 ? "" : "s"}`
    : "";
  return `variable ${first.index + 1} (${name}): ${first.message}${tail}`;
}

// a new script shows Required on its name only after a save attempt
const triedSave = ref(false);

async function onSave() {
  triedSave.value = true;
  const blocker = saveBlocker();
  if (blocker) {
    notifyError(`Cannot save yet: ${blocker}`, 7000);
    return;
  }
  if (props.script && !asCopy.value && !draft.script_body.trim()) {
    const title = `Save ${draft.name} with an empty body?`;
    const message = "The script currently has no content.";
    const ok = { label: "Save empty script", color: "negative" };
    ask({ title, message, ok }, true).onOk(persist);
    return;
  }
  await persist();
}

async function persist() {
  saving.value = true;
  const send = props.script && !asCopy.value ? editScript : saveScript;
  await send(toPayload())
    .then((message: string) => {
      onDialogOK();
      notifySuccess(message);
    })
    .catch((err) => console.error("script save failed", err?.response?.status));
  saving.value = false;
}

type TestCtx = "agent" | "server";

function agentTestBlocker() {
  if (!testAgent.value) return "Pick an agent to test on first";
  if (!draft.script_body) return "Write some code first";
  if (!draft.default_timeout) return "Set a default timeout first";
  return "";
}

const testTargets = computed(() => {
  const blocker = agentTestBlocker();
  const targets = [
    {
      ctx: "agent" as TestCtx,
      icon: "play_arrow",
      label: "Test on agent",
      blocked: !!blocker,
      tip:
        blocker ||
        "Runs the current editor content on the agent without saving",
    },
  ];
  if (!hostedServer.value)
    targets.push({
      ctx: "server",
      icon: "dns",
      label: "Test on server",
      blocked:
        !draft.script_body || !draft.default_timeout || !serverScripts.value,
      tip: serverScripts.value
        ? "Runs on the UniversalLocal RMM Linux server; only interpreters installed there work and the script needs a shebang line"
        : "Server side scripts are turned off in Global Settings",
    });
  return targets;
});

function testOn(ctx: TestCtx) {
  if (ctx === "server" && !draft.script_body.startsWith("#!")) {
    notifyError(SERVER_NEEDS_SHEBANG, 7000);
    return;
  }
  // broken variable definitions would run the test with empty inputs
  const blocker = variableBlocker();
  if (blocker) {
    notifyError(`Cannot test yet: ${blocker}`, 7000);
    return;
  }
  const testProps = { script: toPayload(), agent: testAgent.value, ctx };
  $q.dialog({ component: TestScriptModal, componentProps: testProps });
}

function askForDraft() {
  const prompt = {
    model: `${language.value} code that `,
    type: "text" as const,
  };
  ask({ title: "Describe the script", prompt }, true).onOk(async (text) => {
    const code = await draftScript({ prompt: text });
    draft.script_body = code;
    showCode(code);
  });
}

function requestClose() {
  const hide = () => dialogRef.value?.hide();
  if (!unsaved()) return hide();
  ask({
    title: "Discard unsaved changes?",
    message: "The script has changes that are not saved.",
    ok: { label: "Discard", color: "negative", flat: true },
  }).onOk(hide);
}

onMounted(() => {
  agentsLoading.value = true;
  const done = () => (agentsLoading.value = false);
  Promise.resolve(getAgentOptions()).finally(done);
});
</script>

<style scoped>
.script-builder {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.script-builder__bar {
  height: auto;
  min-height: 48px;
  gap: 6px;
}

.script-builder__heading {
  min-width: 0;
  padding: 4px 0;
}

.script-builder__title {
  overflow: hidden;
  font-size: var(--rmm-fs-lg);
  font-weight: 600;
  line-height: 1.3;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.script-builder__subtitle {
  color: var(--rmm-text-muted);
  font-size: var(--rmm-fs-xs);
  line-height: 1.4;
}

.script-builder__body {
  display: grid;
  flex: 1;
  min-height: 0;
  grid-template-columns: 360px minmax(0, 1fr);
}

.script-builder__side {
  display: flex;
  overflow: hidden;
  min-height: 0;
  flex-direction: column;
  border-right: 1px solid var(--rmm-border);
  background: var(--rmm-surface-2);
}

.script-builder__tabs {
  flex-shrink: 0;
  border-bottom: 1px solid var(--rmm-border);
}

.script-builder__count {
  margin-left: 6px;
  padding: 1px 7px;
  border-radius: 999px;
  color: var(--rmm-text-muted);
  background: var(--rmm-surface-3);
  font-size: var(--rmm-fs-xs);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.script-builder__tabs :deep(.q-tab--active) .script-builder__count {
  color: var(--rmm-accent-text);
  background: var(--rmm-accent-soft);
}

.script-builder__panes {
  overflow-y: auto;
  flex: 1;
  min-height: 0;
}

.script-builder__fields {
  display: grid;
  gap: 10px;
  padding: 14px 14px 18px;
}

.script-builder__main {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}

.script-builder__toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--rmm-border);
}

.script-builder__editor {
  position: relative;
  flex: 1;
  min-height: 200px;
}

.script-builder__monaco {
  position: absolute;
  inset: 0;
}

.script-builder__hints {
  display: grid;
  gap: 6px;
  padding: 8px 12px;
  border-top: 1px solid var(--rmm-border);
  background: var(--rmm-surface-2);
  font-size: var(--rmm-fs-sm);
}

.script-builder__hint {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  color: var(--rmm-text-muted);
}

.script-builder__hint-btn {
  font-family: var(--rmm-mono);
}

.script-builder__actions {
  flex-wrap: wrap;
  gap: 4px;
  border-top: 1px solid var(--rmm-border);
}

.script-builder__agent {
  width: 360px;
  max-width: 100%;
}

@media (max-width: 899px) {
  .script-builder__body {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: minmax(0, 40%) minmax(0, 1fr);
  }

  .script-builder__side {
    border-right: 0;
    border-bottom: 1px solid var(--rmm-border);
  }
}
</style>
