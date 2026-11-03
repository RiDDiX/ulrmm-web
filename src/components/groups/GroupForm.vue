<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-dialog
    ref="dialogRef"
    aria-labelledby="group-form-title"
    @hide="onDialogHide"
  >
    <q-card class="q-dialog-plugin rmm-dialog--lg">
      <DialogHeader
        title-id="group-form-title"
        :title="group ? `Edit ${group.name}` : 'New device group'"
        subtitle="Dynamic groups follow their rules; static groups hold the devices you pick"
      />
      <div v-if="loading" class="q-pa-xl flex flex-center">
        <q-spinner size="32px" color="primary" />
      </div>
      <div v-else-if="loadError" class="q-pa-lg column flex-center q-gutter-sm">
        <q-icon name="error_outline" color="negative" size="24px" />
        <div>{{ loadError }}</div>
        <q-btn outline dense color="primary" label="Retry" @click="load" />
      </div>
      <q-form v-else @submit="submit">
        <q-card-section
          class="scroll group-form__body"
          style="max-height: 72vh"
        >
          <div class="row q-col-gutter-x-md">
            <q-input
              v-model="form.name"
              class="col-12 col-sm-5"
              label="Name"
              :maxlength="GROUP_NAME_MAX"
              dense
              outlined
              autofocus
              hide-bottom-space
              :rules="[(v) => !!v?.trim() || 'Required']"
            />
            <q-input
              v-model="form.description"
              class="col-12 col-sm-7"
              label="Description (optional)"
              :maxlength="GROUP_DESCRIPTION_MAX"
              dense
              outlined
            />
          </div>
          <div>
            <div class="row items-center q-gutter-xs q-mb-xs">
              <span id="group-kind-label" class="rmm-label">Kind</span>
              <HelpTip
                text="Dynamic: the members are the devices that match the rules, checked each time the group is used. Static: exactly the devices you pick."
              />
            </div>
            <q-btn-toggle
              v-model="form.kind"
              :options="KIND_OPTIONS"
              aria-labelledby="group-kind-label"
              no-caps
              unelevated
              toggle-color="primary"
              class="group-form__toggle"
            />
          </div>

          <template v-if="form.kind === 'dynamic'">
            <RuleBuilder
              v-model="form.rules"
              :lookups="lookups"
              :show-errors="showErrors"
            />
            <section class="group-preview" aria-live="polite">
              <div class="row items-center q-gutter-sm">
                <span class="text-subtitle2">Matching devices now</span>
                <q-spinner v-if="preview.loading" size="16px" />
              </div>
              <div v-if="preview.error" class="text-negative">
                {{ preview.error }}
              </div>
              <div v-else-if="preview.count === null" class="rmm-muted">
                Complete the conditions to see which devices match.
              </div>
              <template v-else>
                <div class="group-preview__count rmm-num">
                  {{ preview.count }}
                  {{ preview.count === 1 ? "device" : "devices" }}
                </div>
                <div v-if="preview.agents.length" class="rmm-mono">
                  {{ preview.agents.join(", ")
                  }}<span v-if="preview.count > preview.agents.length"
                    >, and
                    {{ preview.count - preview.agents.length }} more</span
                  >
                </div>
                <div class="rmm-muted text-caption">
                  Counted across every client; each user only sees the devices
                  their role allows.
                </div>
              </template>
            </section>
          </template>

          <div v-else>
            <rmm-select
              v-model="form.members"
              :options="agentOptions"
              label="Members"
              hint="The devices in this group; they stay until you remove them"
              multiple
              map-options
              filterable
            />
          </div>
        </q-card-section>
        <DialogActions :loading="saving" @cancel="onDialogCancel" />
      </q-form>
    </q-card>
  </q-dialog>
</template>

<script setup>
import DialogActions from "@/components/ui/DialogActions.vue";
import { onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
import { useDialogPluginComponent } from "quasar";
import DialogHeader from "@/components/ui/DialogHeader.vue";
import HelpTip from "@/components/ui/HelpTip.vue";
import RmmSelect from "@/components/ui/RmmSelect.vue";
import RuleBuilder from "@/components/groups/RuleBuilder.vue";
import { previewGroup, saveGroup } from "@/api/groups";
import { fetchAgents } from "@/api/agents";
import { SILENT_REQUEST_CONFIG } from "@/constants/constants";
import { formatAgentOptions } from "@/utils/format";
import {
  GROUP_DESCRIPTION_MAX,
  GROUP_NAME_MAX,
  cleanRules,
  newCondition,
  rulesValid,
} from "@/utils/groupRules";
import { notifySuccess } from "@/utils/notify";

const props = defineProps({
  // null => new
  group: { type: Object, default: null },
  // {clientOptions, siteOptions, tags, customFields} from the manager
  lookups: { type: Object, required: true },
});
defineEmits([...useDialogPluginComponent.emits]);
const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } =
  useDialogPluginComponent();

const KIND_OPTIONS = [
  { value: "dynamic", label: "Dynamic (rules)" },
  { value: "static", label: "Static (picked devices)" },
];

// snapshot copy once on open
function initialForm() {
  const g = props.group;
  return {
    name: g?.name ?? "",
    description: g?.description ?? "",
    kind: g?.kind ?? "dynamic",
    rules: g?.rules?.conditions?.length
      ? { match: g.rules.match || "all", conditions: g.rules.conditions }
      : { match: "all", conditions: [newCondition("plat")] },
    // agent_ids
    members: [...(g?.members ?? [])],
  };
}
const form = reactive(initialForm());
const loading = ref(true);
const loadError = ref("");
const saving = ref(false);
const showErrors = ref(false);
const agentOptions = ref([]);

const cfTypes = () =>
  Object.fromEntries(props.lookups.customFields.map((f) => [f.id, f.type]));

async function load() {
  loading.value = true;
  loadError.value = "";
  try {
    agentOptions.value = formatAgentOptions(
      await fetchAgents({ detail: false }),
    );
  } catch {
    loadError.value = "The devices could not be loaded.";
  }
  loading.value = false;
}

// first readable sentence of a DRF error body
function errorText(data) {
  if (typeof data === "string") return data;
  if (Array.isArray(data)) return errorText(data[0]);
  if (data && typeof data === "object")
    return errorText(data.detail ?? Object.values(data)[0]);
  return "";
}

const preview = reactive({
  loading: false,
  count: null,
  agents: [],
  error: "",
});
let previewTimer;
let previewGeneration = 0;

// asks only for complete rules, 400 ms after the last change
watch(
  () => [form.kind, form.rules],
  () => {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(loadPreview, 400);
  },
  { deep: true, immediate: true },
);

async function loadPreview() {
  const generation = ++previewGeneration;
  preview.error = "";
  if (form.kind !== "dynamic" || !rulesValid(form.rules, cfTypes())) {
    preview.count = null;
    preview.loading = false;
    return;
  }
  preview.loading = true;
  try {
    const data = await previewGroup(
      cleanRules(form.rules),
      SILENT_REQUEST_CONFIG,
    );
    if (generation !== previewGeneration) return;
    preview.count = data.count;
    preview.agents = data.agents || [];
  } catch (e) {
    if (generation !== previewGeneration) return;
    preview.count = null;
    preview.error =
      errorText(e.response?.data) || "The preview could not be loaded.";
  }
  preview.loading = false;
}

async function submit() {
  const dynamic = form.kind === "dynamic";
  if (dynamic && !rulesValid(form.rules, cfTypes())) {
    showErrors.value = true;
    return;
  }
  const payload = {
    name: form.name.trim(),
    description: form.description.trim(),
    kind: form.kind,
  };
  if (dynamic) payload.rules = cleanRules(form.rules);
  else payload.members = form.members;
  saving.value = true;
  try {
    await saveGroup(props.group?.id, payload);
    notifySuccess(`${payload.name} was saved`);
    onDialogOK();
  } catch {
    // the error toast comes from the axios boot
  }
  saving.value = false;
}

onMounted(load);
onBeforeUnmount(() => clearTimeout(previewTimer));
</script>

<style scoped>
.group-form__body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.group-form__toggle {
  border: 1px solid var(--rmm-border-strong);
  border-radius: var(--rmm-radius-sm);
}

.group-preview {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 12px;
  border: 1px solid var(--rmm-border);
  border-radius: var(--rmm-radius);
  background: var(--rmm-surface-2);
  overflow-wrap: anywhere;
}

.group-preview__count {
  font-size: var(--rmm-fs-xl);
  font-weight: 700;
}
</style>
