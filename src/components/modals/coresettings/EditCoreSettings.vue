<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-card class="rmm-dialog--lg settings-card">
    <DialogHeader
      title="Global Settings"
      subtitle="Server-wide settings that apply to every client, site and agent"
    />
    <!-- phones swap the rail for a section picker above the panel -->
    <q-splitter
      :model-value="narrow ? 0 : railWidth"
      :limits="narrow ? [0, 0] : [10, 90]"
      :disable="narrow"
      :separator-class="{ hidden: narrow }"
      @update:model-value="(v) => narrow || (railWidth = v)"
    >
      <template #before>
        <q-tabs
          v-if="!narrow"
          v-model="activeTab"
          v-bind="RAIL"
          class="text-primary rmm-settings-tabs"
        >
          <q-tab
            v-for="t in SETTINGS_TABS"
            :key="t.name"
            :name="t.name"
            :label="t.label"
          />
        </q-tabs>
      </template>

      <template #after>
        <q-form
          class="settings-form"
          @submit.prevent="submit"
          @validation-error="pendingTest = null"
        >
          <q-select
            v-if="narrow"
            v-model="activeTab"
            :options="SETTINGS_TABS"
            option-value="name"
            option-label="label"
            emit-value
            map-options
            outlined
            label="Section"
            class="settings-tab-select"
            popup-content-class="settings-tab-menu"
          />
          <q-scroll-area class="settings-scroll" :thumb-style="THUMB">
            <q-tab-panels
              v-model="activeTab"
              v-bind="SLIDE"
              class="settings-panels"
            >
              <q-tab-panel
                v-for="form in forms"
                :key="form.name"
                :name="form.name"
              >
                <SettingsPanelHeader :title="form.title" :text="form.text" />
                <SettingsFields
                  :fields="form.blocks"
                  :settings="draft"
                  :ready="ready"
                  @update="setField"
                  @clear="markClear"
                  @add="addRecipient"
                  @remove="dropRecipient"
                />
              </q-tab-panel>

              <!-- panes with their own Save keep Enter from submitting this form -->
              <q-tab-panel
                v-for="pane in SETTINGS_PANES"
                :key="pane.name"
                :name="pane.name"
                @keydown.enter="(e) => pane.ownSave && e.preventDefault()"
              >
                <component :is="pane.pane" v-bind="pane.props" />
              </q-tab-panel>
            </q-tab-panels>
          </q-scroll-area>

          <q-card-section class="row items-center settings-footer">
            <span v-if="footerNote" class="text-caption rmm-muted q-mr-md">
              {{ footerNote }}
            </span>
            <span v-if="dirty" class="rmm-pill rmm-pill--warning" role="status">
              Unsaved changes
            </span>
            <q-space />
            <q-btn
              v-if="saveLabel"
              :label="saveLabel"
              v-bind="SUBMIT"
              unelevated
            />
            <q-btn
              v-for="t in TESTS"
              v-show="activeTab === t.tab"
              :key="t.tab"
              :label="t.label"
              v-bind="SUBMIT"
              outline
              class="q-ml-sm"
              @click="pendingTest = t.tab"
            >
              <q-tooltip>{{ t.tip }}</q-tooltip>
            </q-btn>
          </q-card-section>
        </q-form>
      </template>
    </q-splitter>
  </q-card>
</template>

<script setup>
import { computed, onMounted, ref, watch } from "vue";
import axios from "axios";
import { useStore } from "vuex";
import { useQuasar } from "quasar";
import { notifySuccess } from "@/utils/notify";
import DialogHeader from "@/components/ui/DialogHeader.vue";
import ResetPatchPolicy from "./ResetPatchPolicy.vue";
import SettingsFields from "./SettingsFields.vue";
import SettingsPanelHeader from "./SettingsPanelHeader.vue";
import { coreSettingsForms } from "./coreSettingsSchema";
import { PANE_NOTE, SETTINGS_PANES, SETTINGS_TABS } from "./coreSettingsTabs";

const emit = defineEmits(["close", "dirty"]);

const $q = useQuasar();
const store = useStore();

const RAIL = { dense: true, noCaps: true, vertical: true };
const SLIDE = {
  animated: true,
  transitionNext: "jump-up",
  transitionPrev: "jump-up",
};
const SUBMIT = { type: "submit", color: "primary", noCaps: true };
const THUMB = {
  width: "5px",
  right: "2px",
  opacity: 0.75,
  borderRadius: "5px",
  backgroundColor: "var(--rmm-accent)",
};

// the Save and Test buttons submit the form; `submit` then runs the test
const TESTS = [
  {
    tab: "emailalerts",
    label: "Save and Test Email",
    tip: "Saves, then sends a test email to the recipients above",
    url: "/core/emailtest/",
    busy: "Sending test email...",
  },
  {
    tab: "smsalerts",
    label: "Save and Test SMS",
    tip: "Saves, then sends a test message to the recipients above",
    url: "/core/smstest/",
    busy: "Sending test SMS...",
  },
];

const MESH_SYNC_WARNING =
  "This operation may take several minutes to complete in the background and can be very CPU/disk intensive, depending on your hardware and number of agents. Please allow time for the sync to fully complete.";

// written by the SSO tab itself, see refreshSsoFlags
const SSO_FLAGS = ["sso_enabled", "block_local_user_logon"];

const draft = ref({});
const ready = ref(false);
const activeTab = ref("general");
const railWidth = ref(20);
// matches the maximized dialog in FileBar
const narrow = computed(() => $q.screen.lt.sm);
const timezones = ref([]);
const policyOptions = ref([]);
const templateOptions = ref([]);
// the last loaded or saved settings as JSON, see `pack`
const baseline = ref("");
const pendingTest = ref(null);
let ssoRefresh = null;

// all_timezones is large and never edited, so it stays out of the comparison
const pack = (values) =>
  JSON.stringify({ ...values, all_timezones: undefined });

const forms = coreSettingsForms({
  draft,
  selfHosted: () => !store.state.hosted,
  timezones: () => timezones.value,
  policies: () => policyOptions.value,
  templates: () => templateOptions.value,
  confirmMeshSync,
  resetPatchPolicy: () => $q.dialog({ component: ResetPatchPolicy }),
});

const current = computed(() =>
  SETTINGS_TABS.find((t) => t.name === activeTab.value),
);
const dirty = computed(
  () => ready.value && pack(draft.value) !== baseline.value,
);
const footerNote = computed(() =>
  current.value?.form ? "" : current.value?.note || PANE_NOTE,
);
const saveLabel = computed(() => {
  if (current.value?.form) return "Save";
  if (dirty.value && activeTab.value !== "sso") {
    return "Save changes from other tabs";
  }
  return "";
});

watch(dirty, (value) => emit("dirty", value));
watch(activeTab, (_, left) => {
  if (left === "sso") ssoRefresh = refreshSsoFlags();
});

function setField(key, value) {
  draft.value[key] = value;
}

// the *_clear flag lives on the draft so the PUT sends it and `dirty` sees it;
// Undo takes the key off again
function markClear(key, on) {
  if (on) draft.value[`${key}_clear`] = true;
  else delete draft.value[`${key}_clear`];
}

function addRecipient(block) {
  $q.dialog({
    ...block.ask(),
    cancel: true,
    persistent: false,
    ok: { color: "primary", label: "Add" },
  }).onOk((value) => draft.value[block.key].push(value));
}

function dropRecipient(key, value) {
  draft.value[key] = draft.value[key].filter((item) => item !== value);
}

function confirmMeshSync(value) {
  $q.dialog({
    title: "Are you sure?",
    message: MESH_SYNC_WARNING,
    ok: { color: "primary", label: "Yes" },
    cancel: { color: "negative", label: "No" },
  }).onOk(() => {
    draft.value.sync_mesh_with_rmm = value;
  });
}

async function fetchSettings() {
  const { data } = await axios.get("/core/settings/");
  draft.value = data;
  timezones.value = Object.freeze(data.all_timezones);
  baseline.value = pack(data);
  ready.value = true;
}

// The SSO tab saves sso_enabled and block_local_user_logon on its own. After
// leaving it only those two are taken from the server, so a later Save cannot
// write back a stale copy and edits on other tabs stay.
async function refreshSsoFlags() {
  try {
    const { data } = await axios.get("/core/settings/");
    const saved = JSON.parse(baseline.value);
    SSO_FLAGS.forEach((key) => {
      draft.value[key] = data[key];
      saved[key] = data[key];
    });
    baseline.value = JSON.stringify(saved);
  } catch {
    // keep the local copy
  }
}

const asOptions = (rows) =>
  rows.map(({ id, name }) => ({ label: name, value: id }));

async function fetchPolicies() {
  $q.loading.show();
  try {
    const { data } = await axios.get("/automation/policies/");
    policyOptions.value = asOptions(data);
  } catch {
    // the response interceptor reports it
  }
  $q.loading.hide();
}

async function fetchTemplates() {
  const { data } = await axios.get("alerts/templates/");
  templateOptions.value = asOptions(data);
}

function testDone() {
  pendingTest.value = null;
  $q.loading.hide();
}

async function runTest({ url, busy }) {
  $q.loading.show({ message: busy });
  try {
    const { data } = await axios.post(url);
    testDone();
    fetchSettings();
    notifySuccess(data, 3000);
  } catch {
    testDone();
  }
}

async function submit() {
  $q.loading.show();
  // a Save right after leaving the SSO tab waits for refreshSsoFlags
  await ssoRefresh;
  delete draft.value.all_timezones;
  try {
    await axios.put("/core/settings/", draft.value);
  } catch {
    testDone();
    return;
  }
  $q.loading.hide();
  const test = TESTS.find((t) => t.tab === pendingTest.value);
  if (test) {
    runTest(test);
    return;
  }
  // stays open and reloads: clears `dirty` and empties the secret inputs
  fetchSettings();
  store.dispatch("getDashInfo", false);
  notifySuccess("Settings were edited!");
}

onMounted(() => {
  fetchSettings();
  fetchPolicies();
  fetchTemplates();
});
</script>

<style scoped>
/* text wraps at the visible width; wide tables scroll inside their own box */
.settings-scroll :deep(.q-scrollarea__content) {
  width: 100%;
}

/* one height for every tab: the header stays, the tab rail and the panel
   scroll on their own and the footer sits at the bottom. Wide enough for
   the Notifications and Licenses tables. */
.q-dialog__inner--minimized > .settings-card {
  width: min(1180px, calc(100vw - 48px));
  height: min(880px, calc(100vh - 48px));
}

.settings-card {
  display: flex;
  flex-direction: column;
}

.settings-card > .q-splitter {
  flex: 1;
  min-height: 0;
}

.settings-form {
  display: flex;
  height: 100%;
  flex-direction: column;
}

.settings-scroll {
  flex: 1;
  min-height: 0;
}

/* all 23 tabs in view at 900px */
.q-dialog__inner--minimized .rmm-settings-tabs .q-tab {
  min-height: 32px;
}

.rmm-settings-tabs .q-tab {
  margin: 1px 6px;
  padding: 0 10px;
  border-radius: var(--rmm-radius-sm);
  justify-content: flex-start;
  text-align: left;
}

.rmm-settings-tabs .q-tab--active {
  background: var(--rmm-accent-soft);
}

.q-tab-panel > :deep(.q-card__section),
.q-tab-panel > div > :deep(.q-card__section) {
  padding: 6px 0;
}

:deep(.settings-group-title) {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 32px;
  margin: 16px 0 6px;
  padding-bottom: 4px;
  border-bottom: 1px solid var(--rmm-border);
  color: var(--rmm-text);
  font-size: var(--rmm-fs-md);
  font-weight: 600;
}

.settings-panel-header + :deep(.settings-group-title) {
  margin-top: 0;
}

:deep(.settings-hint) {
  color: var(--rmm-text-muted);
  font-size: var(--rmm-fs-xs);
  line-height: 1.4;
}

:deep(.settings-hint--indent) {
  padding-left: 40px;
}

:deep(.settings-recipients) {
  border-radius: var(--rmm-radius-sm);
}

:deep(.settings-empty) {
  padding: 10px 12px;
  border: 1px dashed var(--rmm-border-strong);
  border-radius: var(--rmm-radius-sm);
  color: var(--rmm-text-muted);
}

.settings-tab-select {
  margin: 8px 16px 0;
}

.settings-footer {
  min-height: 69px;
  border-top: 1px solid var(--rmm-border);
}
</style>
