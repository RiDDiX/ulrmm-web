<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide">
    <q-card class="q-dialog-plugin rmm-dialog--md">
      <DialogHeader
        title="Preferences"
        subtitle="These settings only change the dashboard for your own account"
      />
      <q-form @submit.prevent="save">
        <!-- the fields scroll, Save and Cancel stay in view -->
        <div class="scroll" style="max-height: 70vh">
          <q-tab-panels
            v-model="tab"
            class="prefs-panels"
            animated
            transition-prev="jump-up"
            transition-next="jump-up"
          >
            <q-tab-panel name="ui">
              <div class="prefs-group-title">Agent Table and Client List</div>
              <SchemaForm v-model="prefs" :fields="tableFields" />

              <div class="prefs-group-title">Colors</div>
              <div class="prefs-hint">
                Used for the loading bar and the status counters on the
                dashboard.
              </div>
              <SchemaForm v-model="prefs" :fields="colorFields" />

              <div class="prefs-group-title">Dates</div>
              <SchemaForm v-model="prefs" :fields="dateFields">
                <template v-slot:field-date_format="{ field, model, set }">
                  <ReferenceInput
                    v-bind="DATE_BUTTON"
                    :label="field.label"
                    :hint="field.hint"
                    :model-value="model.date_format"
                    @update:model-value="set"
                  />
                </template>
              </SchemaForm>
            </q-tab-panel>
          </q-tab-panels>
        </div>

        <q-card-actions align="right">
          <q-btn flat label="Cancel" v-close-popup />
          <q-btn unelevated label="Save" color="primary" type="submit" />
        </q-card-actions>
      </q-form>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { computed, onMounted, ref, watch } from "vue";
import axios from "axios";
import { useDialogPluginComponent } from "quasar";
import { loadingBarColors } from "@/mixins/data";
import { notifyError, notifySuccess, notifyWarning } from "@/utils/notify";
import DialogHeader from "@/components/ui/DialogHeader.vue";
import SchemaForm from "@/components/ui/SchemaForm.vue";
import ReferenceInput from "@/components/modals/coresettings/ReferenceInput.vue";

defineEmits([...useDialogPluginComponent.emits]);

const { dialogRef, onDialogHide, onDialogOK } = useDialogPluginComponent();

const COLOR_KEYS = [
  "dash_info_color",
  "dash_positive_color",
  "dash_negative_color",
  "dash_warning_color",
];
// Quasar's brand colors and palette hues, the names the dashboard paints
const DASH_COLORS = [
  "primary",
  "secondary",
  "accent",
  "positive",
  "negative",
  "info",
  "warning",
  ...loadingBarColors,
];
const DATE_BUTTON = {
  icon: "open_in_new",
  url: "https://quasar.dev/quasar-utils/date-utils#format-for-display",
  ariaLabel: "Open the date format reference",
  tip: "Opens the list of date format tokens in a new tab",
};

const tab = ref("ui");
const urlActions = ref([]);
// a stored shade such as red-6 stays on offer
const stored = ref({});
const TEXT_PREFS = [
  "agent_dblclick_action",
  "default_agent_tbl_tab",
  "client_tree_sort",
  "loading_bar_color",
  ...COLOR_KEYS,
  "date_format",
];
const prefs = ref({
  ...Object.fromEntries(TEXT_PREFS.map((key) => [key, ""])),
  url_action: null,
  clear_search_when_switching: true,
});

const choices = (pairs) => pairs.map(([value, label]) => ({ value, label }));
const dense = { "options-dense": true };

const tableFields = computed(() => [
  {
    key: "agent_dblclick_action",
    type: "select",
    label: "Agent double-click action",
    hint: "What opens when you double-click an agent in the agent table",
    options: choices([
      ["devicepage", "Device page"],
      ["editagent", "Edit Agent"],
      ["takecontrol", "Take Control"],
      ["remotebg", "Remote Background"],
      ["urlaction", "Run URL Action"],
    ]),
    // picking another action forgets the chosen URL action
    props: {
      ...dense,
      "onUpdate:modelValue": () => {
        prefs.value.url_action = null;
      },
    },
  },
  {
    key: "url_action",
    type: "select",
    label: "URL Action",
    hint: "Set up URL actions under Global Settings > URL Actions",
    options: urlActions.value,
    props: dense,
    show: (m) => m.agent_dblclick_action === "urlaction",
  },
  {
    key: "default_agent_tbl_tab",
    type: "select",
    label: "Agent table default tab",
    hint: "The agent type the table shows when the dashboard opens",
    options: choices([
      ["server", "Servers"],
      ["workstation", "Workstations"],
      ["mixed", "Mixed"],
    ]),
    props: dense,
  },
  {
    key: "client_tree_sort",
    type: "select",
    label: "Client Sort",
    options: choices([
      ["alphafail", "Sort alphabetically, moving failing clients to the top"],
      ["alpha", "Sort alphabetically only"],
    ]),
    props: dense,
  },
  {
    key: "clear_search_when_switching",
    type: "checkbox",
    label: "Clear search field when switching client/site",
  },
]);

const colorFields = computed(() => [
  {
    key: "loading_bar_color",
    type: "select",
    label: "Loading Bar Color",
    hint: "Progress bar at the top of the page while data loads",
    options: loadingBarColors,
    props: dense,
  },
  ...[
    ["dash_info_color", "Info", "Informational status on the dashboard"],
    ["dash_positive_color", "Positive", "Healthy status on the dashboard"],
    [
      "dash_negative_color",
      "Negative",
      "Failures and errors on the dashboard and in the header",
    ],
    [
      "dash_warning_color",
      "Warning",
      "Warnings and notices on the dashboard and in the header",
    ],
  ].map(([key, name, hint]) => ({
    key,
    type: "select",
    label: `Dashboard ${name} Color`,
    hint,
    options:
      !stored.value[key] || DASH_COLORS.includes(stored.value[key])
        ? DASH_COLORS
        : [stored.value[key], ...DASH_COLORS],
    props: dense,
  })),
]);

const dateFields = [
  {
    key: "date_format",
    type: "text",
    label: "Date Format",
    hint: "Quasar date tokens, e.g. YYYY-MM-DD HH:mm; leave empty to use the Global Settings default",
  },
];

// the URL action list is only needed once that double-click action is picked
watch(
  () => prefs.value.agent_dblclick_action,
  (action) => {
    if (action === "urlaction") loadUrlActions();
  },
);

async function loadUrlActions() {
  const { data } = await axios.get("/core/urlaction/");
  urlActions.value = data
    .filter((a) => a.action_type === "web")
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((a) => ({ label: a.name, value: a.id }));

  if (urlActions.value.length === 0) {
    notifyWarning(
      "No URL Actions configured. Go to Settings > Global Settings > URL Actions",
    );
  }
}

async function loadPrefs() {
  const { data } = await axios.get("/core/dashinfo/");
  const { dbl_click_action, ...same } = data;
  stored.value = same;
  prefs.value = {
    ...prefs.value,
    agent_dblclick_action: dbl_click_action,
    ...Object.fromEntries(
      Object.keys(prefs.value)
        .filter((k) => k in same)
        .map((k) => [k, same[k]]),
    ),
  };
}

async function save() {
  if (
    prefs.value.agent_dblclick_action === "urlaction" &&
    prefs.value.url_action === null
  ) {
    notifyError("Select a URL Action");
    return;
  }
  await axios.patch("/accounts/users/ui/", prefs.value);
  notifySuccess("Preferences were saved!");
  onDialogOK();
}

onMounted(loadPrefs);
</script>

<style scoped>
.q-tab-panel > :deep(.q-card__section) {
  padding: 6px 0;
}

.prefs-group-title {
  margin: 16px 0 6px;
  padding-bottom: 4px;
  border-bottom: 1px solid var(--rmm-border);
  color: var(--rmm-text);
  font-size: var(--rmm-fs-md);
  font-weight: 600;
}

.prefs-group-title:first-child {
  margin-top: 0;
}

.prefs-hint {
  color: var(--rmm-text-muted);
  font-size: var(--rmm-fs-xs);
  line-height: 1.4;
}
</style>
