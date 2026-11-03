<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-dialog
    ref="dialogRef"
    maximized
    persistent
    transition-show="slide-up"
    transition-hide="slide-down"
    aria-labelledby="deploy-builder-title"
    @hide="onDialogHide"
  >
    <q-card class="q-dialog-plugin deploy-builder column no-wrap">
      <DialogHeader
        title-id="deploy-builder-title"
        title="Deployment builder"
        subtitle="Signed agent installers and unattended OS images for one client and site"
      />
      <q-stepper
        ref="stepper"
        v-model="step"
        class="deploy-stepper"
        color="primary"
        flat
        animated
      >
        <q-step
          :name="1"
          prefix="1"
          title="Scope"
          caption="Client, site, policy, validity"
          :done="step > 1"
        >
          <div v-if="listsLoading" class="deploy-step" aria-busy="true">
            <q-skeleton type="text" width="30%" />
            <q-skeleton v-for="n in 4" :key="n" height="40px" class="q-mt-md" />
          </div>
          <NoDataPanel
            v-else-if="listsError"
            :error="listsError"
            icon="error_outline"
            title=""
            text=""
            @retry="loadLists"
          />
          <ScopeStep
            v-else
            ref="scopeStep"
            :state="scope"
            :clients="clients"
            :deployments="deployments"
            :policies="policies"
            :baselines="baselines"
            :baseline-error="baselineError"
          />
        </q-step>

        <q-step
          :name="2"
          prefix="2"
          title="Target"
          caption="Installer or OS image"
          :done="step > 2"
        >
          <TargetStep
            :state="choice"
            :matrix="matrix"
            :loading="matrixLoading"
            :error="matrixError"
            @retry="loadMatrix"
          />
        </q-step>

        <q-step
          :name="3"
          prefix="3"
          title="Policies"
          caption="Answer file settings"
          :done="step > 3"
        >
          <PolicyStep
            ref="policyStep"
            :target="osTarget ?? null"
            :profile="profile"
            :errors="fieldErrors"
            :other="otherErrors"
          />
        </q-step>

        <q-step
          :name="4"
          prefix="4"
          title="Preview & export"
          caption="Links, files, bundle"
        >
          <ExportStep
            v-if="savedDeployment && matrix"
            :deployment="savedDeployment"
            :matrix="matrix"
            :installer="installer ?? null"
            :arch="choice.arch"
            :target="osTarget ?? null"
            :profile="profile"
            :result="result"
            :generated="generated"
          />
        </q-step>
      </q-stepper>

      <q-card-actions align="right" class="deploy-actions">
        <q-btn v-close-popup flat no-caps label="Cancel" />
        <q-btn
          v-if="step > 1"
          flat
          no-caps
          label="Back"
          :disable="busy"
          @click="back"
        />
        <q-btn
          v-if="step < 4"
          unelevated
          no-caps
          color="primary"
          :label="nextLabel"
          :loading="busy"
          :disable="step === 1 && (listsLoading || !!listsError)"
          @click="next"
        />
        <q-btn
          v-else
          unelevated
          no-caps
          color="primary"
          label="Done"
          @click="onDialogOK"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref, watch } from "vue";
import { useDialogPluginComponent, useQuasar } from "quasar";
import { fetchClients, fetchDeployments, saveDeployment } from "@/api/clients";
import {
  fetchBaselines,
  fetchDeploymentBaselines,
  saveDeploymentBaselines,
} from "@/api/baselines";
import {
  fetchMatrix,
  fetchPolicies,
  renderTarget,
  type Deployment,
  type Matrix,
  type PolicyChoice,
  type RenderResult,
} from "@/api/deploy";
import { ensureConsoleStepUp } from "@/composables/accounts";
import DialogHeader from "@/components/ui/DialogHeader.vue";
import NoDataPanel from "@/core/ui/NoDataPanel.vue";
import ScopeStep from "@/components/deploy/ScopeStep.vue";
import TargetStep from "@/components/deploy/TargetStep.vue";
import PolicyStep from "@/components/deploy/PolicyStep.vue";
import ExportStep from "@/components/deploy/ExportStep.vue";
import { notifyError, notifyWarning } from "@/utils/notify";
import {
  copyDefaults,
  expiryFromHours,
  expiryParam,
  failedResponse,
  failureText,
  generatePassword,
  getPath,
  maxEnrollmentsParam,
  passwordToGenerate,
  policyFields,
  retryAfterStepUp,
  serverErrors,
  setPath,
  type ScopeState,
  type TargetState,
} from "@/utils/deploy";
import type { ClientWithSites } from "@/types/clients";
import type { Baseline } from "@/utils/baselines";

const props = defineProps<{
  // opens on this deployment instead of a new one
  deployment?: Deployment;
}>();
defineEmits([...useDialogPluginComponent.emits]);

const $q = useQuasar();
const { dialogRef, onDialogHide, onDialogOK } = useDialogPluginComponent();

const step = ref(1);
const busy = ref(false);
const scopeStep = ref<{ validate: () => Promise<boolean> } | null>(null);
const policyStep = ref<{ validate: () => Promise<boolean> } | null>(null);

// step 1
const scope = reactive<ScopeState>({
  mode: props.deployment ? "existing" : "new",
  existing: props.deployment?.id ?? null,
  client: null,
  site: null,
  name: "",
  agenttype: "server",
  policy: null,
  maxEnrollments: "",
  ttl: 24,
  custom: "",
  rdp: false,
  ping: false,
  power: false,
  baselines: [],
});
const clients = ref<ClientWithSites[]>([]);
const deployments = ref<Deployment[]>([]);
// null: not available to this role
const policies = ref<PolicyChoice[] | null>(null);
const baselines = ref<Baseline[] | null>(null);
const listsLoading = ref(true);
const listsError = ref("");
const baselineError = ref("");
// what the server holds for the chosen deployment
let savedBaselines: number[] = [];
const savedDeployment = ref<Deployment | null>(null);

// step 2
const matrix = ref<Matrix | null>(null);
const matrixLoading = ref(true);
const matrixError = ref("");
const choice = reactive<TargetState>({ choice: "", arch: "", target: "" });

const installer = computed(() =>
  matrix.value?.installers.find((i) => choice.choice === `inst:${i.fmt}`),
);
const osTarget = computed(() =>
  choice.choice.startsWith("os:")
    ? matrix.value?.targets.find((t) => t.id === choice.target)
    : undefined,
);

// step 3 and 4
const profile = ref<Record<string, unknown>>({});
const fieldErrors = ref<Record<string, string>>({});
const otherErrors = ref<string[]>([]);
const result = ref<RenderResult | null>(null);
const generated = ref("");
let generatedPath = "";

const nextLabel = computed(() => {
  if (step.value === 1 && scope.mode === "new") return "Save and continue";
  if (step.value === 3 && osTarget.value) return "Render preview";
  return "Next";
});

async function loadLists() {
  listsLoading.value = true;
  listsError.value = "";
  const [c, d, p, b] = await Promise.allSettled([
    fetchClients(),
    fetchDeployments(),
    fetchPolicies(),
    fetchBaselines(),
  ]);
  if (c.status === "fulfilled" && d.status === "fulfilled") {
    clients.value = c.value;
    deployments.value = d.value;
  } else {
    const failed =
      c.status === "rejected" ? c.reason : (d as PromiseRejectedResult).reason;
    listsError.value =
      failed?.response?.status === 403
        ? "Your role cannot manage deployments."
        : "Clients and deployments could not be loaded.";
  }
  policies.value = p.status === "fulfilled" ? p.value : null;
  baselines.value = b.status === "fulfilled" ? b.value : null;
  if (scope.client == null && clients.value.length) {
    scope.client = clients.value[0].id;
    scope.site = clients.value[0].sites[0]?.id ?? null;
  }
  listsLoading.value = false;
  if (scope.mode === "existing") loadSavedBaselines();
}

async function loadMatrix() {
  matrixLoading.value = true;
  matrixError.value = "";
  try {
    matrix.value = await fetchMatrix();
  } catch (e) {
    matrixError.value =
      (e as { response?: { status: number } })?.response?.status === 403
        ? "Your role cannot build deployments."
        : "The build matrix could not be loaded.";
  }
  matrixLoading.value = false;
}

async function loadSavedBaselines() {
  const id = scope.existing;
  baselineError.value = "";
  if (id == null || baselines.value === null) return;
  try {
    const saved = await fetchDeploymentBaselines(id);
    if (scope.existing !== id) return;
    savedBaselines = saved.baselines;
    scope.baselines = [...saved.baselines];
  } catch {
    savedBaselines = [];
  }
}

// a deployment saved by this wizard already holds the picked baselines
watch(
  () => [scope.mode, scope.existing],
  () => {
    if (
      scope.mode === "existing" &&
      scope.existing !== savedDeployment.value?.id
    )
      loadSavedBaselines();
  },
);

// a new target starts from its defaults
watch(
  () => osTarget.value?.id,
  () => {
    profile.value = osTarget.value ? copyDefaults(osTarget.value) : {};
    fieldErrors.value = {};
    otherErrors.value = [];
    result.value = null;
    generated.value = "";
  },
);

const sameSet = (a: number[], b: number[]) =>
  a.length === b.length && a.every((id) => b.includes(id));

async function saveScope(): Promise<boolean> {
  if (!(await scopeStep.value?.validate())) return false;
  let saved: Deployment | undefined;
  if (scope.mode === "new") {
    const expires = scope.ttl
      ? expiryFromHours(scope.ttl)
      : new Date(scope.custom);
    try {
      // errors are the server's sentences, shown as a toast
      saved = (await saveDeployment({
        site: scope.site,
        name: scope.name.trim(),
        expires: expiryParam(expires),
        agenttype: scope.agenttype,
        // the link takes the architecture per download
        goarch: "amd64",
        power: scope.agenttype === "workstation" && scope.power,
        ping: scope.ping,
        rdp: scope.rdp,
        policy: scope.policy,
        max_enrollments: maxEnrollmentsParam(scope.maxEnrollments),
      })) as Deployment;
    } catch {
      return false;
    }
    deployments.value = [...deployments.value, saved];
    savedBaselines = [];
  } else {
    saved = deployments.value.find((d) => d.id === scope.existing);
    if (!saved) {
      notifyError("This deployment is not in your list any more.");
      return false;
    }
  }
  savedDeployment.value = saved;
  // Back and Next again keeps this deployment instead of adding another
  scope.mode = "existing";
  scope.existing = saved.id;

  baselineError.value = "";
  if (baselines.value !== null && !sameSet(scope.baselines, savedBaselines)) {
    try {
      const kept = await saveDeploymentBaselines(saved.id, scope.baselines, {
        silent: true,
      });
      savedBaselines = kept.baselines;
    } catch (e) {
      const failed = await failedResponse(e);
      baselineError.value =
        serverErrors(failed?.data, ["baselines"]).fields.baselines ??
        (await failureText(e));
      return false;
    }
  }
  return true;
}

function checkTarget(): boolean {
  if (!matrix.value) return false;
  if (!choice.choice) {
    notifyWarning("Pick an agent installer or an OS image.");
    return false;
  }
  if (installer.value && !matrix.value.dist_ok) {
    notifyError(
      "The agent build does not carry the current enrollment key. Run update.sh on the server first.",
      8000,
    );
    return false;
  }
  if (choice.choice.startsWith("os:") && !osTarget.value) {
    notifyWarning("Pick an edition.");
    return false;
  }
  return true;
}

async function renderPreview(): Promise<boolean> {
  const target = osTarget.value;
  const saved = savedDeployment.value;
  if (!target || !saved) return true;
  if (!(await policyStep.value?.validate())) return false;

  // the server only sees a password given here, so preview and download
  // carry the same one; one the user changed since is not news any more
  if (getPath(profile.value, generatedPath) !== generated.value)
    generated.value = "";
  const missing = passwordToGenerate(target, profile.value);
  if (missing) {
    generated.value = generatePassword();
    generatedPath = missing.path;
    setPath(profile.value, missing.path, generated.value);
  }

  fieldErrors.value = {};
  otherErrors.value = [];
  try {
    result.value = await retryAfterStepUp(
      () =>
        renderTarget({
          deployment: saved.id,
          target: target.id,
          profile: profile.value,
        }),
      () => ensureConsoleStepUp($q),
    );
    return true;
  } catch (e) {
    const failed = await failedResponse(e);
    if (failed?.status === 400) {
      const paths = policyFields(target).map((f) => f.path);
      const { fields, other } = serverErrors(failed.data, paths);
      fieldErrors.value = fields;
      otherErrors.value = other;
    } else otherErrors.value = [await failureText(e)];
    return false;
  }
}

async function next() {
  busy.value = true;
  try {
    const ok =
      step.value === 1
        ? await saveScope()
        : step.value === 2
          ? checkTarget()
          : await renderPreview();
    if (ok) step.value += 1;
  } finally {
    busy.value = false;
  }
}

function back() {
  // the generated password is shown once, after the render that made it
  if (step.value === 4) generated.value = "";
  step.value -= 1;
}

// the new step's heading takes the focus
watch(step, async (n) => {
  await nextTick();
  document.getElementById(`deploy-step-${n}`)?.focus();
});

onMounted(() => {
  loadLists();
  loadMatrix();
});
</script>

<style>
.deploy-builder {
  height: 100%;
}

.deploy-stepper {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0;
  background: var(--rmm-bg);
}

/* the panel parent scrolls the active step and clips the slide sideways;
   inactive steps stay empty wrappers */
.deploy-stepper .q-stepper__content {
  flex: 1 1 auto;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
}

.deploy-actions {
  border-top: 1px solid var(--rmm-border);
  background: var(--rmm-surface);
}

.deploy-step {
  max-width: 1120px;
  margin: 0 auto;
}

.deploy-step__title {
  margin: 0 0 4px;
  font-size: var(--rmm-fs-xl);
  font-weight: 600;
  letter-spacing: normal;
  line-height: 1.3;
}

.deploy-step__title:focus {
  outline: none;
}

.deploy-step__title:focus-visible {
  outline: 2px solid var(--rmm-focus);
  outline-offset: 2px;
}

.deploy-step__lead {
  max-width: 76ch;
  margin: 0 0 16px;
  color: var(--rmm-text-muted);
}

.deploy-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 12px 16px;
}

.deploy-field--wide {
  max-width: 640px;
}

.deploy-field--date {
  max-width: 280px;
}

.deploy-summary {
  max-width: 640px;
  margin: 12px 0 0;
}

.deploy-summary dd {
  margin: 0;
}

.deploy-choices {
  min-width: 0;
  margin: 0 0 16px;
  padding: 0;
  border: 0;
}

.deploy-legend {
  margin-bottom: 8px;
  padding: 0;
  color: var(--rmm-text-muted);
  font-size: var(--rmm-fs-xs);
  font-weight: 600;
}

.deploy-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 8px;
}

.deploy-option {
  position: relative;
  display: flex;
  min-height: 64px;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid var(--rmm-border);
  border-radius: var(--rmm-radius);
  background: var(--rmm-surface);
  color: var(--rmm-text);
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    background-color 0.15s ease;
}

.deploy-option:hover {
  border-color: var(--rmm-border-strong);
}

.deploy-option:has(input:checked) {
  border-color: var(--rmm-accent);
  background: var(--rmm-accent-soft);
  box-shadow: inset 0 0 0 1px var(--rmm-accent);
}

.deploy-option:has(input:focus-visible),
.deploy-chip:has(input:focus-visible) {
  outline: 2px solid var(--rmm-focus);
  outline-offset: 2px;
}

.deploy-option__text {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
}

.deploy-option__title {
  font-weight: 600;
}

.deploy-option__meta {
  color: var(--rmm-text-muted);
  font-size: var(--rmm-fs-xs);
}

.deploy-option__mark {
  color: var(--rmm-text-subtle);
}

.deploy-option:has(input:checked) .deploy-option__mark {
  color: var(--rmm-accent-text);
}

.deploy-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.deploy-chip {
  display: inline-flex;
  min-height: 44px;
  align-items: center;
  gap: 6px;
  padding: 4px 14px;
  border: 1px solid var(--rmm-border-strong);
  border-radius: 999px;
  background: var(--rmm-surface);
  color: var(--rmm-text);
  cursor: pointer;
}

.deploy-chip:has(input:checked) {
  border-color: var(--rmm-accent);
  background: var(--rmm-accent-soft);
  color: var(--rmm-accent-text);
  font-weight: 600;
}

.deploy-detail {
  padding: 12px 16px;
  border: 1px solid var(--rmm-border);
  border-radius: var(--rmm-radius);
  background: var(--rmm-surface);
}

.deploy-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.deploy-notes {
  margin: 8px 0 0;
  padding-left: 18px;
  color: var(--rmm-text-muted);
}

.deploy-downloads {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
}

.deploy-stack {
  display: grid;
  gap: 12px;
}

.deploy-step .rmm-card__title {
  margin: 0;
  line-height: 1.4;
}

/* General spans the top; the other cards flow into two balanced columns
   where both have room, so cards of unequal height leave no holes */
.deploy-groups {
  column-gap: 12px;
}

.deploy-group {
  margin-bottom: 12px;
  break-inside: avoid;
}

.deploy-group--wide {
  column-span: all;
}

@media (min-width: 1100px) {
  .deploy-groups {
    columns: 2;
  }
}

.deploy-group__body {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 12px;
}

@media (min-width: 760px) {
  .deploy-group--wide .deploy-group__body {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    column-gap: 16px;
  }
}

.deploy-field {
  min-width: 0;
}

.deploy-field--full {
  grid-column: 1 / -1;
}

/* a long choice ellipsizes in the field; the dropdown shows it in full */
.deploy-builder .rmm-select .q-field__control-container,
.deploy-builder .rmm-select .q-field__native > span {
  min-width: 0;
}

.deploy-builder .rmm-select .q-field__native > span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* label and help form one block; the whole row toggles */
.deploy-switch.q-toggle {
  display: flex;
  min-height: 44px;
  align-items: center;
}

.deploy-switch .q-toggle__label {
  display: flex;
  min-width: 0;
  flex: 1 1 auto;
  flex-direction: column;
  padding-block: 4px;
}

.deploy-checkgroup {
  display: grid;
  min-width: 0;
  gap: 8px;
  margin: 0;
  padding: 0;
  border: 0;
}

.deploy-checkgroup > legend {
  margin-bottom: 4px;
  padding: 0;
}

.deploy-checkgroup__filter {
  max-width: 320px;
}

.deploy-checkgroup__title {
  color: var(--rmm-text-muted);
  font-size: var(--rmm-fs-xs);
  font-weight: 600;
}

.deploy-checkgroup__items {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  column-gap: 12px;
}

.deploy-check {
  display: flex;
  min-width: 0;
  min-height: 44px;
  align-items: center;
  gap: 4px;
}

.deploy-unavailable {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--rmm-text-muted);
  font-size: var(--rmm-fs-xs);
}

.deploy-unavailable:not(:first-child) {
  padding-top: 10px;
  border-top: 1px solid var(--rmm-border);
}

.deploy-field__note {
  margin-top: 2px;
  color: var(--rmm-text-muted);
  font-size: var(--rmm-fs-xs);
  line-height: 1.4;
}

.deploy-field__error {
  color: var(--rmm-status-negative);
  font-size: var(--rmm-fs-xs);
}

.deploy-export {
  margin-bottom: 12px;
}

.deploy-line {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.deploy-line__code,
.deploy-command {
  border-radius: var(--rmm-radius-sm);
  background: var(--rmm-surface-3);
  color: var(--rmm-text);
  font-family: var(--rmm-mono);
  font-size: var(--rmm-fs-sm);
  overflow-wrap: anywhere;
}

.deploy-line__code {
  min-width: 0;
  flex: 1 1 320px;
  padding: 6px 8px;
}

.deploy-command {
  margin: 0 0 6px;
  padding: 10px 12px;
  white-space: pre-wrap;
}

@media (prefers-reduced-motion: reduce) {
  .deploy-option {
    transition: none;
  }
}
</style>
