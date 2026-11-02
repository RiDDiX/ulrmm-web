<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-dialog
    ref="dialogRef"
    v-bind="DIALOG_PROPS"
    @show="editors.mount(dark.isActive)"
    @before-hide="stopEditing"
    @hide="onDialogHide"
    @keydown.esc="escPressed"
    @keyup.esc="escReleased"
  >
    <q-card ref="cardRef" class="column no-wrap">
      <q-bar class="dialog-bar">
        <div class="text-weight-bold">{{ heading }}</div>
        <q-space />
        <q-btn dense flat icon="close" aria-label="Close" @click="close">
          <q-tooltip>Close</q-tooltip>
        </q-btn>
      </q-bar>

      <div class="rmm-toolbar wrap">
        <q-input v-model="form.name" v-bind="NAME_FIELD" :error="nameMissing" />
        <RmmSelect
          v-model="form.template_html"
          :options="baseChoices"
          label="Base Template"
          map-options
          clearable
          style="min-width: 200px"
        />
        <HelpTip
          text="Optional shared HTML this report extends; fill its blocks, listed in the side panel"
        />
        <TemplateDependencyPicker v-model="form.depends_on" />
        <HelpTip
          text="Values asked for at run time (client, site, agent); type a name + Enter to add one"
        />
        <div>
          <q-option-group
            v-model="chosenFormat"
            :options="formatChoices"
            :disable="debugMode"
            aria-label="Preview format"
            inline
            dense
          />
          <q-tooltip>Format the Preview tab renders</q-tooltip>
        </div>
        <q-toggle v-model="debugMode" dense label="Debug">
          <q-tooltip>
            Preview also shows the rendered source and the resolved variables
          </q-tooltip>
        </q-toggle>
        <q-space />
        <q-tabs v-model="tab" dense no-caps inline-label>
          <q-tab
            v-for="t in TABS"
            :key="t.name"
            :name="t.name"
            :label="t.label"
          />
        </q-tabs>
      </div>

      <div v-show="tab !== 'preview'" class="col row no-wrap editing-area">
        <TemplateBlocksDrawer
          :body="form.template_md"
          :variables="form.template_variables"
          :base-template="form.template_html"
          :dependencies="answers"
          :depends-on="form.depends_on"
        />

        <q-splitter v-model="split" reverse :limits="SPLIT_LIMITS" class="col">
          <template #before>
            <div class="column no-wrap full-height">
              <EditorToolbar
                v-if="tab === 'body' && editorsReady && mainEditor"
                :editor="mainEditor"
                :template-type="form.type"
                :variables="form.template_variables"
                @update:variables="editors.replaceVariables"
              >
                <q-separator vertical />
                <q-btn
                  v-for="extra in toolbarExtras"
                  :key="extra.label"
                  flat
                  dense
                  no-caps
                  size="sm"
                  :label="extra.label"
                  @click="extra.run"
                >
                  <q-tooltip :delay="500">{{ extra.tip }}</q-tooltip>
                </q-btn>
              </EditorToolbar>
              <div ref="mainEl" class="col" />
            </div>
          </template>
          <template #after>
            <div class="column no-wrap full-height">
              <div class="variables-bar row items-center no-wrap">
                <!-- keyed, so the button is replaced and its tooltip closes -->
                <q-btn
                  :key="String(sideOpen)"
                  flat
                  dense
                  size="sm"
                  :icon="sideOpen ? 'chevron_right' : 'chevron_left'"
                  :aria-label="`${sideOpen ? 'Collapse' : 'Expand'} variables editor`"
                  @click="split = sideOpen ? 3 : 35"
                >
                  <q-tooltip
                    >{{ sideOpen ? "Collapse" : "Expand" }} the variables
                    editor</q-tooltip
                  >
                </q-btn>
                <template v-if="split > 8">
                  <span class="rmm-label q-mx-sm">Variables</span>
                  <HelpTip
                    text="YAML values the template can use as {{ name }}; data queries go under data_sources"
                  />
                </template>
              </div>
              <div v-show="split > 8" ref="variablesEl" class="col" />
            </div>
          </template>
        </q-splitter>
      </div>

      <div v-if="tab === 'preview'" class="col preview-area">
        <ReportTemplatePreview
          v-if="!previewBusy"
          :key="String(debugMode)"
          :output="previewOutput"
          :format="shownFormat"
          :debug="debugMode"
          :debug-variables="previewVariables"
        />
        <q-inner-loading :showing="previewBusy" label="Generating report..." />
      </div>

      <div v-if="tab !== 'preview'" class="rmm-toolbar form-footer">
        <q-toggle v-if="isEdit" v-model="autoSave" dense label="Auto-save">
          <q-tooltip>Saves changes 2 seconds after you stop typing</q-tooltip>
        </q-toggle>
        <span v-if="savedShown" class="text-positive row items-center">
          <q-icon name="check" class="q-mr-xs" />
          Template saved
        </span>
        <q-space />
        <q-btn
          v-for="btn in footerButtons"
          :key="btn.key"
          v-bind="btn.attrs"
          @click="btn.run"
        >
          <q-tooltip v-if="btn.tip">{{ btn.tip }}</q-tooltip>
        </q-btn>
      </div>
    </q-card>
  </q-dialog>
</template>

<script lang="ts" setup>
import {
  computed,
  onBeforeMount,
  onBeforeUnmount,
  reactive,
  ref,
  watch,
} from "vue";
import { QCard, useDialogPluginComponent, useQuasar } from "quasar";
import { useDebounceFn } from "@vueuse/core";
import HelpTip from "@/components/ui/HelpTip.vue";
import RmmSelect from "@/components/ui/RmmSelect.vue";
import { notifyError } from "@/utils/notify";
import EditorToolbar from "@/reporting/components/EditorToolbar.vue";
import TemplateBlocksDrawer from "@/reporting/components/TemplateBlocksDrawer.vue";
import ReportTemplatePreview from "@/reporting/components/ReportTemplatePreview.vue";
import ReportHTMLTemplateForm from "@/reporting/components/ReportHTMLTemplateForm.vue";
import TemplateDependencyPicker from "@/reporting/components/TemplateDependencyPicker.vue";
import { useTemplateEditors } from "@/reporting/components/useTemplateEditors";
import { previewReport } from "@/reporting/api";
import { promptDependencies } from "@/reporting/actions";
import { yamlError } from "@/reporting/editing";
import {
  useReportHTMLTemplatesShared,
  useReportTemplatesShared,
  useRequestState,
} from "@/reporting/stores";
import { missingDependencies } from "@/reporting/utils";
import type {
  ReportDependencies,
  ReportFormat,
  ReportOutput,
  ReportTemplate,
  ReportTemplateBody,
  ReportTemplateType,
} from "@/reporting/types";

// a template to edit, or one to start a copy from, or neither for a new one
type Props = {
  cloneTemplate?: ReportTemplate;
  reportTemplate?: ReportTemplate;
  templateType: ReportTemplateType;
};
const props = defineProps<Props>();
defineEmits([...useDialogPluginComponent.emits]);

const DIALOG_PROPS = {
  maximized: true,
  persistent: true,
  noEscDismiss: true,
  transitionShow: "slide-up",
  transitionHide: "slide-down",
};
const NAME_FIELD = {
  dense: true,
  outlined: true,
  label: "Report Name",
  style: "min-width: 220px",
  hideBottomSpace: true,
};
const PRIMARY = { unelevated: true, noCaps: true, color: "primary" };
const BODY_LABELS: Record<string, string> = {
  markdown: "Markdown",
  html: "Html",
  plaintext: "Plain Text",
};
const SPLIT_LIMITS = [3, 45];

const { dialog, dark } = useQuasar();
const { dialogRef, onDialogOK, onDialogHide } = useDialogPluginComponent();
const { addReportTemplate, editReportTemplate } = useReportTemplatesShared;
const { htmlTemplates, getReportHTMLTemplates } = useReportHTMLTemplatesShared;

type Draft = ReportTemplateBody & { id: number };

// the editor works on a copy; the shared list changes only on save
function draftOf(): Draft {
  const { reportTemplate: editing, cloneTemplate: clone, templateType } = props;
  const from = editing ?? clone;
  let name = "";
  if (editing) name = editing.name;
  else if (clone) name = `Copy of ${clone.name}`;
  return {
    id: editing?.id ?? 0,
    name,
    template_md: from?.template_md ?? "",
    template_css: from?.template_css ?? "",
    template_html: from?.template_html ?? null,
    template_variables: from?.template_variables ?? "",
    depends_on: [...(from?.depends_on ?? [])],
    type: templateType,
  };
}

const form = reactive<Draft>(draftOf());
const isEdit = !!props.reportTemplate;
let heading = "New Report Template";
if (isEdit) heading = "Edit Report Template";
else if (props.cloneTemplate) heading = "Clone Report Template";

const plain = form.type === "plaintext";
const TABS = [
  { name: "body", label: BODY_LABELS[form.type] ?? form.type },
  ...(plain ? [] : [{ name: "css", label: "CSS" }]),
  { name: "preview", label: "Preview" },
];

const baseChoices = computed(() =>
  htmlTemplates.value.map(({ id, name }) => ({ label: name, value: id })),
);

onBeforeMount(() => getReportHTMLTemplates());

// values typed into the preview prompt, kept while the editor is open
// and only for names the template still depends on
const answers = ref<ReportDependencies>({});
const onlyNamed = (values: ReportDependencies, names: string[]) =>
  Object.fromEntries(
    Object.entries(values).filter(([name]) => names.includes(name)),
  );

watch(
  () => [...form.depends_on],
  (names) => {
    answers.value = onlyNamed(answers.value, names);
  },
);

// debug always previews in the template's own format
const nativeFormat: ReportFormat = plain ? "plaintext" : "html";
const formatChoices = [
  { value: nativeFormat, label: plain ? "Text" : "HTML" },
  { value: "pdf", label: "PDF" },
];
const chosenFormat = ref<ReportFormat>(nativeFormat);
const debugMode = ref(false);
const shownFormat = computed(() =>
  debugMode.value ? nativeFormat : chosenFormat.value,
);

const tab = ref<"body" | "css" | "preview">("body");
const split = ref(35);
const sideOpen = computed(() => split.value > 6);

const toolbarExtras = computed(() => [
  {
    label: "vars",
    tip: `${split.value > 3 ? "Hide" : "Show"} the variables editor`,
    run: () => (split.value = split.value > 3 ? 3 : 35),
  },
  {
    label: "base",
    tip: "Create a new base template",
    run: () => dialog({ component: ReportHTMLTemplateForm }),
  },
]);

const autoSave = ref(isEdit);
const editors = useTemplateEditors(form, () => {
  if (autoSave.value) applyLater();
});
const { mainEl, variablesEl, mainEditor, ready: editorsReady } = editors;

watch(debugMode, () => {
  chosenFormat.value = nativeFormat;
  if (tab.value === "preview") runPreview();
});

watch(tab, (next) => {
  if (next === "preview") return runPreview();
  if (editors.show(next) && next === "css") split.value = 3;
});

watch(chosenFormat, () => {
  if (tab.value !== "preview" || debugMode.value) return;
  runPreview();
});

// unsaved changes: revision tells a save which edits it carried
const dirty = ref(false);
let revision = 0;

watch(
  form,
  () => {
    dirty.value = true;
    revision += 1;
  },
  // sync, so a change made while a save is in flight is never missed
  { deep: true, flush: "sync" },
);

// set while the discard prompt is open and once the dialog closes, so a
// pending auto-save never keeps what the user threw away
let holdSaves = false;

function stopEditing() {
  holdSaves = true;
  editors.unmount();
}

const hide = () => dialogRef.value?.hide();
const DISCARD_PROMPT = {
  title: "You have unsaved changes",
  message: "Would you like to close?",
};

function close() {
  if (!dirty.value) return hide();
  holdSaves = true;
  dialog({ ...DISCARD_PROMPT, persistent: true, cancel: true })
    .onOk(hide)
    .onCancel(() => {
      holdSaves = false;
      if (autoSave.value) applyLater();
    });
}

// Escape behaves like on a plain dialog. monaco swallows the keydown while
// one of its widgets is open and an open select menu swallows the keyup,
// so both halves are checked. They reach us from the card or, when nothing
// in it has focus, from the dialog itself; menus next to the card handle
// their own Escape
const cardRef = ref<QCard | null>(null);
let escStarted = false;

function inForm(evt: KeyboardEvent) {
  const card = cardRef.value?.$el as HTMLElement | undefined;
  const target = evt.target as Node;
  return !!card && (card.contains(target) || target.contains(card));
}

function escPressed(evt: KeyboardEvent) {
  escStarted = inForm(evt);
}

function escReleased(evt: KeyboardEvent) {
  // stopped here: once this form leaves the escape stack the keyup would
  // close the dialog underneath too
  if (escStarted && inForm(evt)) {
    evt.stopPropagation();
    close();
  }
  escStarted = false;
}

const nameTried = ref(false);
const nameMissing = computed(() => nameTried.value && !form.name.trim());

function validate(announce: boolean) {
  const missing: string[] = [];
  if (!form.template_md.trim()) missing.push("Template Text is required");
  if (!form.name.trim()) missing.push("Template Name is required");
  const yamlProblem = yamlError(form.template_variables);
  if (announce) {
    nameTried.value = true;
    missing.forEach((text) => notifyError(text));
    if (yamlProblem) notifyError(`Error in variables: ${yamlProblem}`, 5000);
  }
  return missing.length === 0 && yamlProblem === null;
}

function body(): ReportTemplateBody {
  const { name, template_md, template_css, template_html } = form;
  const { template_variables, depends_on, type } = form;
  return {
    name,
    template_md,
    template_css,
    template_html,
    template_variables,
    depends_on: [...depends_on],
    type,
  };
}

const savedShown = ref(false);
let savedTimer: ReturnType<typeof setTimeout> | undefined;

function flashSaved() {
  savedShown.value = true;
  clearTimeout(savedTimer);
  savedTimer = setTimeout(() => (savedShown.value = false), 5000);
}

// auto-save and Apply: quiet, keeps the editor open
async function apply() {
  if (holdSaves || !isEdit || !validate(false)) return;
  editors.quoteVariables();
  const sent = revision;
  if (!(await editReportTemplate(form.id, body(), { silent: true }))) return;
  if (revision === sent) dirty.value = false;
  flashSaved();
}

const applyLater = useDebounceFn(apply, 2000);

const saving = ref(false);

async function save() {
  if (!validate(true)) return;
  editors.quoteVariables();
  saving.value = true;
  const stored = isEdit
    ? await editReportTemplate(form.id, body())
    : await addReportTemplate(body());
  saving.value = false;
  if (!stored) return;
  dirty.value = false;
  onDialogOK();
}

type FooterButton = {
  key: string;
  attrs: Record<string, unknown>;
  tip?: string;
  run: () => unknown;
};

const footerButtons = computed<FooterButton[]>(() => [
  {
    key: "cancel",
    attrs: { flat: true, noCaps: true, label: "Cancel" },
    run: close,
  },
  ...(isEdit
    ? [
        {
          key: "apply",
          attrs: {
            outline: true,
            noCaps: true,
            color: "primary",
            label: "Apply",
          },
          tip: "Save without closing the editor",
          // right away, and say what is missing instead of doing nothing
          run: () => validate(true) && apply(),
        },
      ]
    : []),
  {
    key: "save",
    attrs: { ...PRIMARY, label: "Save", loading: saving.value },
    run: save,
  },
]);

const { isLoading: previewBusy, track: trackPreview } = useRequestState();
const previewOutput = ref<ReportOutput | null>(null);
const previewVariables = ref<Record<string, unknown> | null>(null);

async function runPreview() {
  editors.quoteVariables();
  previewOutput.value = null;
  previewVariables.value = null;

  const missing = missingDependencies(form.depends_on, answers.value);
  if (missing.length > 0) {
    const given = await promptDependencies(missing, answers.value);
    // a closed prompt sends nothing; the empty preview stays
    if (!given) return;
    answers.value = onlyNamed(given, form.depends_on);
  }

  const format = shownFormat.value;
  const debug = debugMode.value;
  await trackPreview(async () => {
    const result = await previewReport({
      ...body(),
      format,
      dependencies: answers.value,
      debug,
    });
    if (typeof result !== "object" || result instanceof Blob) {
      previewOutput.value = result;
      return;
    }
    previewOutput.value = result.template;
    previewVariables.value = result.variables;
  });
}

onBeforeUnmount(() => clearTimeout(savedTimer));
</script>

<style scoped>
.dialog-bar {
  height: auto;
  min-height: 40px;
}

.editing-area,
.preview-area {
  position: relative;
  min-height: 0;
}

.variables-bar {
  min-height: 32px;
  padding: 0 4px;
  border-bottom: 1px solid var(--rmm-border);
  background: var(--rmm-surface-2);
}

.form-footer {
  border-top: 1px solid var(--rmm-border);
  border-bottom: 0;
}
</style>
