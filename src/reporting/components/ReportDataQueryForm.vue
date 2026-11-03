<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-dialog
    ref="dialogRef"
    maximized
    @show="createEditor"
    @before-hide="disposeEditor"
    @hide="onDialogHide"
  >
    <q-card class="column no-wrap">
      <DialogHeader :title="title" />
      <q-form class="col column no-wrap" @submit="submit">
        <q-card-section class="row items-center q-gutter-sm q-pb-sm">
          <q-input
            v-model="name"
            dense
            outlined
            label="Data Query Name"
            maxlength="50"
            hide-bottom-space
            :rules="[(value) => !!value?.trim() || '*Required']"
            style="min-width: 320px"
          />
          <HelpTip
            text="Inserted into a template, the query becomes data_sources.<name in camelCase>"
          />
          <q-space />
          <span class="editor-form__hint">
            JSON query. It only reads data and never changes it. Press
            Ctrl+Space for field suggestions.
          </span>
        </q-card-section>
        <div ref="editorEl" class="col query-editor" />
        <q-card-actions align="right">
          <q-btn flat no-caps label="Cancel" @click="onDialogCancel" />
          <q-btn
            :loading="isLoading"
            v-bind="saveBtn"
            label="Save"
            type="submit"
          />
        </q-card-actions>
      </q-form>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import DialogHeader from "@/components/ui/DialogHeader.vue";
import HelpTip from "@/components/ui/HelpTip.vue";
import { useQuasar, useDialogPluginComponent } from "quasar";
import * as monaco from "monaco-editor";
import { fetchQuerySchema } from "@/reporting/api";
import { notifyError } from "@/utils/notify";
import { useReportDataQueriesShared } from "@/reporting/stores";

import type { ReportDataQuery } from "@/reporting/types";

const props = defineProps<{
  // only hand the query back, the template keeps it in its variables
  editInTemplate?: boolean;
  // with a query: save it as a new copy
  clone?: boolean;
  dataQuery?: ReportDataQuery;
}>();

defineEmits([...useDialogPluginComponent.emits]);

const saveBtn = { unelevated: true, "no-caps": true, color: "primary" };
const { isLoading, addReportDataQuery, editReportDataQuery } =
  useReportDataQueriesShared;
const $q = useQuasar();
const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } =
  useDialogPluginComponent();

const editing = computed(() => !!props.dataQuery && !props.clone);
const title = computed(() =>
  editing.value ? "Edit Data Query" : "New Data Query",
);

const name = ref(
  props.dataQuery
    ? props.clone
      ? `Copy of ${props.dataQuery.name}`
      : props.dataQuery.name
    : "",
);

const editorEl = ref<HTMLElement | null>(null);
let editor: monaco.editor.IStandaloneCodeEditor | null = null;
let model: monaco.editor.ITextModel | null = null;
let schemaUri = "";

// The schema applies to this editor's model only. Other open query forms
// keep theirs, so entries are added and removed instead of replaced.
type SchemaList = NonNullable<
  monaco.languages.json.DiagnosticsOptions["schemas"]
>;

function setSchemas(update: (schemas: SchemaList) => SchemaList) {
  const defaults = monaco.languages.json.jsonDefaults;
  defaults.setDiagnosticsOptions({
    ...defaults.diagnosticsOptions,
    validate: true,
    schemas: update(defaults.diagnosticsOptions.schemas ?? []),
  });
}

async function registerSchema(target: monaco.editor.ITextModel) {
  try {
    const schema = await fetchQuerySchema();
    if (model !== target) return;
    schemaUri = `${target.uri.toString()}.schema.json`;
    setSchemas((schemas) => [
      ...schemas,
      { uri: schemaUri, fileMatch: [target.uri.toString()], schema },
    ]);
  } catch (e) {
    console.error(e);
  }
}

function createEditor() {
  if (!editorEl.value) return;
  model = monaco.editor.createModel(
    JSON.stringify(props.dataQuery?.json_query ?? {}, null, 4),
    "json",
  );
  editor = monaco.editor.create(editorEl.value, {
    model,
    theme: $q.dark.isActive ? "vs-dark" : "vs-light",
    automaticLayout: true,
    minimap: { enabled: false },
  });
  registerSchema(model);
}

function disposeEditor() {
  if (schemaUri) {
    const uri = schemaUri;
    setSchemas((schemas) => schemas.filter((entry) => entry.uri !== uri));
    schemaUri = "";
  }
  editor?.dispose();
  model?.dispose();
  editor = null;
  model = null;
}

async function submit() {
  let jsonQuery: Record<string, unknown>;
  try {
    jsonQuery = JSON.parse(editor?.getValue() ?? "");
  } catch (e) {
    notifyError(`There was an error parsing the json: ${e}`);
    return;
  }

  const query = {
    id: editing.value ? props.dataQuery!.id : 0,
    name: name.value,
    json_query: jsonQuery,
  };

  if (!props.editInTemplate) {
    const ok = editing.value
      ? await editReportDataQuery(query.id, query)
      : await addReportDataQuery(query);
    if (!ok) return;
  }
  onDialogOK(query);
}
</script>

<style scoped>
.editor-form__hint {
  color: var(--rmm-text-muted);
  font-size: var(--rmm-fs-xs);
}

.query-editor {
  min-height: 0;
  border-top: 1px solid var(--rmm-border);
  border-bottom: 1px solid var(--rmm-border);
}
</style>
