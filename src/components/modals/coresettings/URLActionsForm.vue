<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-dialog
    ref="dialogRef"
    @hide="onDialogHide"
    @show="mountEditor"
    @before-hide="disposeEditor"
  >
    <q-card
      class="q-dialog-plugin"
      :class="isWeb ? 'rmm-dialog--md' : 'rmm-dialog--lg'"
    >
      <DialogHeader :title="title" :subtitle="subtitle" />

      <div style="max-height: 80vh" class="scroll">
        <SchemaForm v-model="action" :fields="fields" />

        <q-card-section v-show="!isWeb">
          <q-toolbar>
            <q-tabs v-model="tab" dense shrink>
              <q-tab
                name="body"
                label="Request Body"
                :ripple="false"
                :disable="noBody"
              />
              <q-tab name="headers" label="Request Headers" :ripple="false" />
            </q-tabs>
          </q-toolbar>
          <div ref="editorEl" :style="{ height: '30vh' }"></div>
          <div class="text-caption rmm-muted q-mt-xs">
            JSON. Variables such as <span v-pre>{{ alert.message }}</span> or
            <span v-pre>{{ agent.hostname }}</span> are filled in before
            sending; GET and DELETE requests send no body.
          </div>
        </q-card-section>
      </div>

      <q-card-actions align="right">
        <q-btn
          v-if="!isWeb"
          flat
          no-caps
          icon="science"
          label="Test"
          color="primary"
          @click="openTest"
        >
          <q-tooltip
            >Opens a test run: pick an agent, site or client, then Run sends it
            without saving</q-tooltip
          >
        </q-btn>
        <q-space />
        <q-btn flat label="Cancel" v-close-popup />
        <q-btn unelevated label="Save" color="primary" @click="save" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import * as monaco from "monaco-editor";
import { useDialogPluginComponent, useQuasar } from "quasar";
import type { URLAction, URLActionType } from "@/types/core/urlactions";
import { computed, ref, watch } from "vue";
import { editURLAction, saveURLAction } from "@/api/core";
import { notifySuccess } from "@/utils/notify";
import SchemaForm from "@/components/ui/SchemaForm.vue";
import DialogHeader from "@/components/ui/DialogHeader.vue";
import TestURLAction from "@/components/modals/coresettings/TestURLAction.vue";

defineEmits([...useDialogPluginComponent.emits]);
const props = defineProps<{ type: URLActionType; action?: URLAction }>();
const isWeb = props.type === "web";

const { dialogRef, onDialogHide, onDialogOK } = useDialogPluginComponent();
const $q = useQuasar();

const title = `${props.action ? "Edit" : "Add"} ${isWeb ? "URL Action" : "Web Hook"}`;
const subtitle = isWeb
  ? "A link opened from the agent, site or client menu"
  : "An HTTP request sent by the server as an alert failure or resolved action";

const action = ref<URLAction>(
  props.action
    ? { ...props.action }
    : ({
        name: "",
        desc: "",
        pattern: "",
        action_type: props.type,
        rest_method: "post",
        rest_body: "{\n    \n}",
        rest_headers: '{\n  "Content-Type": "application/json"\n}',
      } as URLAction),
);

const required = [(val: string) => !!val || "*Required"];
const fields = [
  { key: "name", type: "text", label: "Name", rules: required },
  {
    key: "desc",
    type: "textarea",
    label: "Description",
    props: { rows: 2 },
  },
  {
    key: "pattern",
    type: "text",
    label: "URL Pattern",
    hint: isWeb
      ? "Variables such as {{agent.hostname}}, {{client.name}} or {{global.Name}} are filled in when it opens"
      : "Endpoint the request goes to; variables such as {{agent.hostname}} are filled in before sending",
    rules: required,
    props: { "input-class": "rmm-mono" },
  },
  {
    key: "rest_method",
    type: "select",
    label: "Method",
    show: () => !isWeb,
    options: ["GET", "POST", "PUT", "DELETE", "PATCH"].map((label) => ({
      label,
      value: label.toLowerCase(),
    })),
  },
];

// GET and DELETE carry no body, so only the headers tab is usable
const noBody = computed(() =>
  ["get", "delete"].includes(action.value.rest_method),
);
type Tab = "body" | "headers";
const tab = ref<Tab>(noBody.value ? "headers" : "body");
watch(noBody, (none) => {
  if (none) tab.value = "headers";
});

async function save() {
  $q.loading.show();
  try {
    if (props.action) await editURLAction(action.value.id, action.value);
    else await saveURLAction(action.value);
    onDialogOK();
    notifySuccess("Url Action was edited!");
  } catch {
    // the axios interceptor already shows the error
  }
  $q.loading.hide();
}

function openTest() {
  $q.dialog({
    component: TestURLAction,
    componentProps: { urlAction: action.value },
  });
}

// one json model per tab, kept in sync with rest_body / rest_headers
const fieldOf = { body: "rest_body", headers: "rest_headers" } as const;
const models = {
  body: monaco.editor.createModel(
    action.value.rest_body,
    "json",
    monaco.Uri.parse("model://body"),
  ),
  headers: monaco.editor.createModel(
    action.value.rest_headers,
    "json",
    monaco.Uri.parse("model://headers"),
  ),
};
const editorEl = ref<HTMLElement | null>(null);
let editor: monaco.editor.IStandaloneCodeEditor;

watch(tab, (next, prev) => {
  action.value[fieldOf[prev]] = editor.getValue();
  editor.setModel(models[next]);
  editor.setValue(action.value[fieldOf[next]]);
});

function mountEditor() {
  if (!editorEl.value) return;
  editor = monaco.editor.create(editorEl.value, {
    model: models[tab.value],
    theme: $q.dark.isActive ? "vs-dark" : "vs-light",
    automaticLayout: true,
    minimap: { enabled: false },
    quickSuggestions: false,
  });
  editor.onDidChangeModelContent(() => {
    action.value[fieldOf[tab.value]] = editor.getValue();
  });
}

function disposeEditor() {
  models.body.dispose();
  models.headers.dispose();
  editor.dispose();
}
</script>
