<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <div class="editor-toolbar row items-center no-wrap q-gutter-x-xs">
    <q-btn-dropdown
      flat
      dense
      no-caps
      size="sm"
      label="Formatting"
      @hide="editor.focus()"
    >
      <q-list dense>
        <q-item
          v-for="level in 6"
          :key="level"
          clickable
          v-close-popup
          @click="heading(level)"
        >
          <q-item-section>Heading {{ level }}</q-item-section>
        </q-item>
      </q-list>
    </q-btn-dropdown>
    <q-btn-dropdown
      flat
      dense
      no-caps
      size="sm"
      label="Section"
      @hide="editor.focus()"
    >
      <q-list dense>
        <q-item
          v-for="kind in SECTION_KINDS"
          :key="kind"
          clickable
          v-close-popup
          @click="section(kind)"
        >
          <q-item-section>{{ kind }}</q-item-section>
        </q-item>
      </q-list>
    </q-btn-dropdown>
    <q-separator vertical />
    <q-btn
      v-for="tool in formatTools"
      :key="tool.label"
      flat
      dense
      size="sm"
      :icon="tool.icon"
      :aria-label="tool.label"
      @click="tool.action"
    >
      <q-tooltip :delay="500">{{ tool.tooltip }}</q-tooltip>
    </q-btn>
    <q-btn flat dense size="sm" icon="link" aria-label="Link">
      <q-tooltip :delay="500">Insert a link</q-tooltip>
      <q-menu v-model="linkMenu">
        <q-form class="q-pa-sm q-gutter-y-sm" @submit="insertLink">
          <div class="rmm-label">Insert link</div>
          <q-input v-model="link.text" dense outlined autofocus label="Text" />
          <q-input v-model="link.url" dense outlined label="URL" />
          <q-btn
            unelevated
            dense
            no-caps
            color="primary"
            type="submit"
            label="Insert Link"
          />
        </q-form>
      </q-menu>
    </q-btn>
    <q-btn
      flat
      dense
      size="sm"
      icon="image"
      aria-label="Image"
      @click="insertImage"
    >
      <q-tooltip :delay="500"
        >Insert an image from a link or a report asset</q-tooltip
      >
    </q-btn>
    <q-btn
      flat
      dense
      size="sm"
      icon="horizontal_rule"
      aria-label="Horizontal rule"
      @click="insertBelow(markdown ? '---' : '<hr />')"
    >
      <q-tooltip :delay="500">Insert a horizontal line</q-tooltip>
    </q-btn>
    <q-separator vertical />
    <q-btn
      v-for="tool in jinjaTools"
      :key="tool.label"
      flat
      dense
      no-caps
      size="sm"
      class="rmm-mono"
      :label="tool.label"
      @click="tool.action"
    >
      <q-tooltip :delay="500">{{ tool.tooltip }}</q-tooltip>
    </q-btn>
    <q-separator vertical />
    <q-btn
      flat
      dense
      size="sm"
      icon="mdi-database-plus-outline"
      aria-label="Add data query"
      @click="addDataQuery"
    >
      <q-tooltip :delay="500"
        >Write a new data query and add it to this template's
        variables</q-tooltip
      >
    </q-btn>
    <q-btn
      flat
      dense
      size="sm"
      icon="mdi-database-arrow-down"
      aria-label="Insert saved data query"
      @click="insertSavedDataQuery"
    >
      <q-tooltip :delay="500"
        >Add a saved data query to this template's variables</q-tooltip
      >
    </q-btn>
    <q-btn
      flat
      dense
      size="sm"
      icon="mdi-database-edit"
      aria-label="Edit data query"
      @click="editDataQuery"
    >
      <q-tooltip :delay="500"
        >Edit a data query in this template's variables</q-tooltip
      >
    </q-btn>
    <q-btn
      flat
      dense
      size="sm"
      icon="mdi-table-large-plus"
      aria-label="Insert table"
      @click="insertTable"
    >
      <q-tooltip :delay="500"
        >Insert a table, blank or built from a list variable</q-tooltip
      >
    </q-btn>
    <slot />
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { useQuasar } from "quasar";
import * as monaco from "monaco-editor";
import { convertCamelCase } from "@/utils/format";
import { notifyError, notifySuccess, notifyWarning } from "@/utils/notify";
import {
  SECTION_KINDS,
  getDataSources,
  sectionMarkers,
  setDataSource,
  togglePrefixLines,
  type SectionKind,
} from "@/reporting/editing";
import ReportAssetSelect from "@/reporting/components/ReportAssetSelect.vue";
import ReportDataQueryForm from "@/reporting/components/ReportDataQueryForm.vue";
import DataQuerySelect from "@/reporting/components/DataQuerySelect.vue";
import ReportTableMaker from "@/reporting/components/ReportTableMaker.vue";

import type { ReportDataQuery, ReportTemplateType } from "@/reporting/types";

const props = defineProps<{
  editor: monaco.editor.IStandaloneCodeEditor;
  templateType: ReportTemplateType;
  variables: string;
}>();

const emit = defineEmits<{ "update:variables": [value: string] }>();

const $q = useQuasar();
const markdown = computed(() => props.templateType === "markdown");

// edits

interface Change {
  range: monaco.IRange;
  text: string;
}

// one change per cursor, in one undo step; each cursor ends up after its
// new text
function apply(
  change: (model: monaco.editor.ITextModel, sel: monaco.Selection) => Change,
) {
  const editor = props.editor;
  const model = editor.getModel();
  const selections = editor.getSelections();
  if (!model || !selections) return;
  const edits = selections.map((sel) => ({
    ...change(model, sel),
    forceMoveMarkers: true,
  }));
  editor.pushUndoStop();
  editor.executeEdits("toolbar", edits, (inverse) =>
    inverse.map(
      ({ range }) =>
        new monaco.Selection(
          range.endLineNumber,
          range.endColumn,
          range.endLineNumber,
          range.endColumn,
        ),
    ),
  );
  editor.pushUndoStop();
  editor.focus();
}

// the full lines of a selection, including the line it ends on
function lineRange(model: monaco.editor.ITextModel, sel: monaco.Selection) {
  const end = sel.endLineNumber;
  return new monaco.Range(
    sel.startLineNumber,
    1,
    end,
    model.getLineMaxColumn(end),
  );
}

function wrap(prefix: string, suffix: string, wholeLines = false) {
  apply((model, sel) => {
    const range = wholeLines ? lineRange(model, sel) : sel;
    return { range, text: prefix + model.getValueInRange(range) + suffix };
  });
}

function prefixLines(unit: string, count = 1) {
  apply((model, sel) => {
    const range = lineRange(model, sel);
    return {
      range,
      text: togglePrefixLines(model.getValueInRange(range), unit, count),
    };
  });
}

function insertBelow(text: string) {
  apply((model, sel) => {
    const line = lineRange(model, sel).endLineNumber;
    const column = model.getLineMaxColumn(line);
    return {
      range: new monaco.Range(line, column, line, column),
      text: `\n${text}\n`,
    };
  });
}

function replaceSelection(text: string) {
  apply((_, sel) => ({ range: sel, text }));
}

function heading(level: number) {
  if (markdown.value) prefixLines("#", level);
  else wrap(`<h${level}>`, `</h${level}>`);
}

function section(kind: SectionKind) {
  const [open, close] = sectionMarkers(kind, props.templateType);
  wrap(open, close, true);
}

function code() {
  if (!markdown.value) return wrap("<code>", "</code>");
  apply((model, sel) => {
    if (sel.startLineNumber === sel.endLineNumber)
      return { range: sel, text: `\`${model.getValueInRange(sel)}\`` };
    const range = lineRange(model, sel);
    return {
      range,
      text: "```\n" + model.getValueInRange(range) + "\n```",
    };
  });
}

const formatTools = computed(() => [
  {
    label: "Bold",
    icon: "format_bold",
    tooltip: "Make the selection bold",
    action: () => (markdown.value ? wrap("**", "**") : wrap("<b>", "</b>")),
  },
  {
    label: "Italic",
    icon: "format_italic",
    tooltip: "Make the selection italic",
    action: () => (markdown.value ? wrap("*", "*") : wrap("<i>", "</i>")),
  },
  {
    label: "Numbered list",
    icon: "format_list_numbered",
    tooltip: markdown.value
      ? "Turn the selected lines into a numbered list"
      : "Insert an empty numbered list below the cursor",
    action: () =>
      markdown.value
        ? prefixLines("1.")
        : insertBelow("<ol>\n\t<li></li>\n\t<li></li>\n</ol>"),
  },
  {
    label: "Bullet list",
    icon: "format_list_bulleted",
    tooltip: markdown.value
      ? "Turn the selected lines into a bullet list"
      : "Insert an empty bullet list below the cursor",
    action: () =>
      markdown.value
        ? prefixLines("*")
        : insertBelow("<ul>\n\t<li></li>\n\t<li></li>\n</ul>"),
  },
  {
    label: "Block quote",
    icon: "format_quote",
    tooltip: "Quote the selected lines",
    action: () =>
      markdown.value
        ? prefixLines(">")
        : wrap("<blockquote>", "</blockquote>", true),
  },
  {
    label: "Undo",
    icon: "undo",
    tooltip: "Undo the last edit",
    action: () => {
      props.editor.trigger("toolbar", "undo", null);
      props.editor.focus();
    },
  },
  {
    label: "Redo",
    icon: "redo",
    tooltip: "Redo the last undone edit",
    action: () => {
      props.editor.trigger("toolbar", "redo", null);
      props.editor.focus();
    },
  },
  {
    label: "Code block",
    icon: "code",
    tooltip: "Mark the selection as code",
    action: code,
  },
]);

const jinjaTools = [
  {
    label: "{% %}",
    tooltip: "Wrap the selection in a Jinja block",
    action: () => wrap("{% block [name] %}", "{% endblock %}", true),
  },
  {
    label: "{{ }}",
    tooltip: "Wrap the selection in Jinja output tags to print a variable",
    action: () => wrap("{{", "}}"),
  },
  {
    label: "{% for %}",
    tooltip: "Wrap the selection in a Jinja for loop",
    action: () => wrap("{% for item in items %}", "{% endfor %}", true),
  },
  {
    label: "{% if %}",
    tooltip: "Wrap the selection in a Jinja if condition",
    action: () => wrap("{% if [condition] %}", "{% endif %}", true),
  },
];

// link and image

const linkMenu = ref(false);
const link = reactive({ text: "", url: "" });

function insertLink() {
  replaceSelection(
    markdown.value
      ? `[${link.text}](${link.url})`
      : `<a href="${link.url}">${link.text}</a>`,
  );
  linkMenu.value = false;
}

function insertImage() {
  $q.dialog({
    component: ReportAssetSelect,
    componentProps: { templateType: props.templateType },
  })
    .onOk((text: string) => replaceSelection(text))
    .onDismiss(() => props.editor.focus());
}

// data queries go into the variables under data_sources

function writeDataSource(key: string, query: ReportDataQuery) {
  try {
    emit(
      "update:variables",
      setDataSource(props.variables, key, query.json_query),
    );
    return true;
  } catch (e) {
    notifyError(`Error in variables: ${(e as Error).message}`, 5000);
    return false;
  }
}

function addDataQuery() {
  $q.dialog({ component: ReportDataQueryForm }).onOk(
    (query: ReportDataQuery) => {
      writeDataSource(convertCamelCase(query.name), query);
    },
  );
}

function insertSavedDataQuery() {
  $q.dialog({ component: DataQuerySelect }).onOk((query: ReportDataQuery) => {
    if (writeDataSource(convertCamelCase(query.name), query))
      notifySuccess(`${query.name} was saved successfully in template`);
  });
}

function editDataQuery() {
  const dataSources = getDataSources(props.variables);
  if (!dataSources) {
    notifyWarning("No data sources exist in template variables");
    return;
  }
  $q.dialog({
    component: DataQuerySelect,
    componentProps: { dataSources },
  }).onOk((picked: ReportDataQuery) => {
    $q.dialog({
      component: ReportDataQueryForm,
      componentProps: { dataQuery: picked, editInTemplate: true },
    }).onOk((query: ReportDataQuery) => {
      // the key stays as it is, even when the name was changed
      if (writeDataSource(picked.name, query))
        notifySuccess(`${query.name} was saved successfully in template`);
    });
  });
}

function insertTable() {
  $q.dialog({ component: ReportTableMaker }).onOk((text: string) =>
    insertBelow(text.replace(/\n$/, "")),
  );
}
</script>

<style scoped>
.editor-toolbar {
  min-height: 36px;
  padding: 2px 6px;
  overflow-x: auto;
  border-bottom: 1px solid var(--rmm-border);
  background: var(--rmm-surface);
}
</style>
