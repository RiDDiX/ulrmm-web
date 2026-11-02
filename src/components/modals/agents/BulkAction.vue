<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-dialog
    ref="dialogRef"
    aria-labelledby="bulk-action-title"
    @hide="onDialogHide"
  >
    <q-card class="q-dialog-plugin" style="min-width: 50vw">
      <DialogHeader
        title-id="bulk-action-title"
        :title="modalTitle"
        :subtitle="modeSubtitles[mode]"
      />
      <ol class="bulk-steps" aria-label="Steps">
        <li
          v-for="(s, i) in stepLabels"
          :key="s"
          :class="stepClass(i)"
          :aria-current="
            stepClass(i)['bulk-steps__item--current'] ? 'step' : undefined
          "
        >
          <span class="bulk-steps__num">{{ i + 1 }}</span
          >{{ s }}
        </li>
      </ol>
      <q-form v-show="!reviewAgents" @submit.prevent="resolve">
        <div class="scroll" style="max-height: 65vh">
          <BulkTargetSection
            :draft="state"
            :mode="mode"
            :selected-package="selectedPackage"
            :os-type-label="osTypeLabel"
            :os-choices="osChoices"
            :client-options="clientOptions"
            :site-options="siteOptions"
            :group-options="groupOptions"
            :agent-options="agentOptions"
          />
          <q-separator class="q-my-sm" />
          <BulkActionSection
            v-model:valid="varsValid"
            v-model:collector="collector"
            :draft="state"
            :mode="mode"
            :action-text="actionText"
            :selected-package="selectedPackage"
            :package-options="packageOptions"
            :script-choices="scriptChoices"
            :custom-field-options="customFieldOptions"
            :syntax="syntax"
            :variables="variables"
          />
        </div>

        <FormButtons
          label="Review"
          icon-right="arrow_forward"
          :loading="resolving"
          :disable="resolving"
        />
      </q-form>
      <BulkReview
        v-if="reviewAgents"
        :agents="reviewAgents"
        :mode="mode"
        :run-as="state.run_as"
        :label="finalLabel"
        :target-text="targetText"
        :action-text="actionText"
        :destructive="destructive"
        :loading="loading"
        @back="reviewAgents = null"
        @run="confirmRun"
      />
    </q-card>
  </q-dialog>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from "vue";
import { useDialogPluginComponent, useQuasar } from "quasar";
import { runBulkAction, fetchAgents } from "@/api/agents";
import { fetchPackages } from "@/api/packages";
import { fetchGroupAgents, fetchGroups } from "@/api/groups";
import { useSiteDropdown, useClientDropdown } from "@/composables/clients";
import { useScriptDropdown } from "@/composables/scripts";
import { PLAT_LABELS, RUN_AS_LABELS } from "@/utils/packages";
import { useAgentDropdown } from "@/composables/agents";
import { useCustomFieldDropdown } from "@/composables/core";
import { notifyError, notifySuccess } from "@/utils/notify";

import DialogHeader from "@/components/ui/DialogHeader.vue";
import ConfirmYesDialog from "@/components/agents/ConfirmYesDialog.vue";
import DialogWrapper from "@/components/ui/DialogWrapper.vue";
import PackageInstalls from "@/components/packages/PackageInstalls.vue";
import BulkTargetSection from "@/components/modals/agents/BulkTargetSection.vue";
import BulkActionSection from "@/components/modals/agents/BulkActionSection.vue";
import FormButtons from "@/components/agents/FormButtons.vue";
import BulkReview from "@/components/modals/agents/BulkReview.vue";

defineOptions({ name: "BulkAction" });
defineEmits([...useDialogPluginComponent.emits]);

const props = defineProps({
  mode: { type: String, required: true },
  // agents picked in the fleet table; the dialog then targets exactly those
  initialAgents: { type: Array, default: () => [] },
});

const $q = useQuasar();
const { dialogRef, onDialogHide } = useDialogPluginComponent();

const OS_CHOICES = [
  { label: "Windows", value: "windows" },
  { label: "Linux", value: "linux" },
  { label: "macOS", value: "darwin" },
  { label: "FreeBSD", value: "freebsd" },
  { label: "All", value: "all" },
];

const modeSubtitles = {
  command: "Runs one command on every targeted agent that is online",
  script: "Runs a script on every targeted agent that is online",
  patch: "Scans for or installs updates on every targeted agent that is online",
  suspend: "Puts every targeted agent that is online to sleep",
  wake: "Sends Wake-on-LAN to every targeted agent, online or offline",
  package: "Installs a software package on every targeted agent that is online",
};

const modalTitles = {
  command: "Run bulk command",
  script: "Run bulk script",
  patch: "Bulk patch management",
  suspend: "Bulk sleep",
  wake: "Bulk wake-up (WoL)",
  package: "Bulk package install",
};
const modalTitle = modalTitles[props.mode] ?? "";

const stepLabels = ["Target and action", "Review and run"];

// a command cannot run on "all" operating systems
const osChoices =
  props.mode === "command"
    ? OS_CHOICES.filter((o) => o.value !== "all")
    : OS_CHOICES;

const {
  script,
  plat,
  scriptName,
  syntax,
  variables,
  getScriptOptions,
  filterByPlatformOptions: scriptChoices,
  defaultTimeout: timeoutSecs,
  defaultArgs: argList,
  defaultEnvVars: envList,
} = useScriptDropdown();
const { getAgentOptions, agentOptions, agents } = useAgentDropdown();
const { getSiteOptions, siteOptions, site } = useSiteDropdown();
const { getClientOptions, clientOptions, client } = useClientDropdown();
const { customFieldOptions } = useCustomFieldDropdown({ onMount: true });
const varsValid = ref(true);
const collector = ref(false);

// a single-platform selection preselects that platform, so Linux-only rows
// do not open on Windows with nothing matching
const preselected = props.initialAgents.length > 0;
const platformsPicked = new Set(
  props.initialAgents.map((a) => a.plat).filter(Boolean),
);
function startingOs() {
  if (!preselected) return "windows";
  if (platformsPicked.size === 1) return [...platformsPicked][0];
  return osChoices.some((o) => o.value === "all") ? "all" : "windows";
}

const off = (...keys) => Object.fromEntries(keys.map((k) => [k, false]));

const state = reactive({
  mode: props.mode,
  target: preselected ? "agents" : "client",
  osType: startingOs(),
  monType: "all",
  patchMode: "scan",
  run_as: "system",
  cmd: "",
  shell: "cmd",
  custom_shell: null,
  custom_field: null,
  package: null,
  // device group pk, used by target "group"
  group: null,
  ...off("collector_all_output", "save_to_agent_note", "run_as_user"),
  client,
  site,
  agents,
  script,
  timeout: timeoutSecs,
  args: argList,
  env_vars: envList,
});
if (preselected) agents.value = props.initialAgents.map((a) => a.agent_id);
plat.value = state.osType === "all" ? undefined : state.osType;

const loading = ref(false);
const resolving = ref(false);
const reviewAgents = ref(null);

watch(
  () => state.target,
  () => {
    client.value = null;
    site.value = null;
    agents.value = [];
    state.group = null;
    // the type filter is hidden for selected agents but would still narrow
    // an explicit selection on the server
    state.monType = "all";
  },
);

watch(
  () => state.osType,
  (os) => {
    state.custom_shell = null;
    state.run_as_user = false;
    state.shell = { windows: "cmd", freebsd: "/bin/sh" }[os] ?? "/bin/bash";
    plat.value = os === "all" ? undefined : os;
  },
);

const stepClass = (i) => ({
  "bulk-steps__item": true,
  "bulk-steps__item--current": (i === 1) === !!reviewAgents.value,
  "bulk-steps__item--done": i === 0 && !!reviewAgents.value,
});

const packages = ref([]);
const packageOptions = computed(() =>
  packages.value.map((p) => ({
    value: p.id,
    label: `${p.name} (${PLAT_LABELS[p.plat] ?? p.plat})`,
  })),
);
const selectedPackage = computed(() =>
  packages.value.find((p) => p.id === state.package),
);
// a package fixes the platform
watch(selectedPackage, (p) => {
  state.run_as = "system";
  if (p) state.osType = p.plat;
});

async function loadPackages() {
  try {
    packages.value = await fetchPackages();
  } catch (e) {
    console.error(e);
  }
}

// a role without the groups read has no group to pick
const groupOptions = ref([]);
async function loadGroups() {
  try {
    groupOptions.value = (await fetchGroups()).map((g) => ({
      value: g.id,
      label: `${g.name} (${g.count})`,
      name: g.name,
    }));
  } catch {
    groupOptions.value = [];
  }
}

const osTypeLabel = computed(
  () => OS_CHOICES.find((o) => o.value === state.osType)?.label,
);

const verb = computed(() => {
  const fixed = {
    command: "Run command",
    script: "Run script",
    suspend: "Sleep",
    wake: "Wake",
    package: "Install package",
  }[props.mode];
  if (fixed) return fixed;
  return state.patchMode === "install" ? "Install patches" : "Scan for patches";
});

const finalLabel = computed(
  () => `${verb.value} on ${(reviewAgents.value || []).length} agents`,
);

const destructive = computed(
  () =>
    ["command", "suspend"].includes(props.mode) ||
    (props.mode === "patch" && state.patchMode === "install"),
);

// fleet-wide command, script, sleep or patch install needs a typed confirm
const needsTypedConfirm = computed(
  () =>
    state.target === "all" &&
    props.mode !== "wake" &&
    (props.mode !== "patch" || state.patchMode === "install"),
);

const targetText = computed(() => {
  const os = state.osType === "all" ? "any OS" : osTypeLabel.value;
  if (state.target === "agents")
    return `${state.agents.length} selected agents (${os})`;
  const type =
    state.monType === "all" ? "servers and workstations" : state.monType;
  if (state.target === "all") return `all ${type} you can see (${os})`;
  if (state.target === "group") {
    const group = groupOptions.value.find((o) => o.value === state.group);
    return `${type} in group ${group?.name ?? ""} (${os})`;
  }
  const byClient = state.target === "client";
  const options = byClient ? clientOptions.value : siteOptions.value;
  const chosen = byClient ? state.client : state.site;
  const label = options.find((o) => o.value === chosen)?.label ?? "";
  return `${type} in ${state.target} ${label} (${os})`;
});

const actionText = computed(() => {
  const runAs = state.run_as_user ? ", run as user" : "";
  switch (props.mode) {
    case "command": {
      const shell = state.shell === "custom" ? state.custom_shell : state.shell;
      return `${shell}: ${state.cmd} (timeout ${state.timeout}s${runAs})`;
    }
    case "script": {
      const args = state.args.length ? `, args ${state.args.join(" ")}` : "";
      return `${scriptName.value}${args} (timeout ${state.timeout}s${runAs})`;
    }
    case "suspend":
      return "Switch on Wake-on-LAN, then sleep; agents that need an update are skipped";
    case "wake":
      return "Wake-on-LAN from the server, from online agents on the same network and through MeshCentral";
    case "package": {
      const p = selectedPackage.value;
      const args = p.default_args ? `, args ${p.default_args}` : "";
      const unsigned = p.allow_unsigned ? ", unsigned allowed" : "";
      return `${p.name} (${p.filename}) as ${RUN_AS_LABELS[state.run_as]}${args}${unsigned}`;
    }
    default:
      return state.patchMode === "install"
        ? "Install approved patches; reboots follow each agent's patch policy"
        : "Scan for pending patches";
  }
});

// filtered the way the server resolves the scope, so the review shows what
// will be hit
async function resolveScope() {
  const params = { detail: true };
  if (state.target === "client") params.client = state.client;
  else if (state.target === "site") params.site = state.site;

  let found =
    state.target === "group"
      ? await fetchGroupAgents(state.group)
      : await fetchAgents(params);
  if (state.target === "agents")
    found = found.filter((a) => state.agents.includes(a.agent_id));
  const monitoring = { servers: "server", workstations: "workstation" }[
    state.monType
  ];
  if (monitoring) found = found.filter((a) => a.monitoring_type === monitoring);
  if (state.osType !== "all")
    found = found.filter((a) => a.plat === state.osType);
  return found;
}

async function resolve() {
  if (props.mode === "script" && !varsValid.value) {
    return notifyError("Some script inputs are missing or invalid");
  }
  resolving.value = true;
  try {
    reviewAgents.value = await resolveScope();
  } catch (e) {
    // the form stays up, the interceptor already showed the error
    console.error(e);
  } finally {
    resolving.value = false;
  }
}

async function runAction() {
  loading.value = true;
  try {
    const data = await runBulkAction(state);
    if (props.mode === "package") {
      $q.dialog({
        component: DialogWrapper,
        componentProps: {
          vuecomponent: PackageInstalls,
          title: `${selectedPackage.value.name} on ${reviewAgents.value.length} agents`,
          size: "lg",
          height: "60",
          componentProps: { batch: data.batch },
        },
      });
    } else notifySuccess(data);
    onDialogHide();
  } catch {
    // the interceptor reports it
  }
  loading.value = false;
}

function confirmRun() {
  if (!needsTypedConfirm.value) return runAction();
  const kind = ["patch", "package"].includes(props.mode)
    ? `${props.mode} install`
    : `${props.mode} run`;
  $q.dialog({
    component: ConfirmYesDialog,
    componentProps: {
      hostname: `all ${reviewAgents.value.length} agents you can see`,
      actionVerb: `the bulk ${kind}`,
      title: `${finalLabel.value}?`,
      okLabel: finalLabel.value,
      consequence:
        "Applies to every agent you can see and cannot be recalled once queued.",
    },
  }).onOk(runAction);
}

onMounted(() => {
  [getAgentOptions, getSiteOptions, getClientOptions, loadGroups].forEach(
    (start) => start(),
  );
  if (props.mode === "script") getScriptOptions();
  if (props.mode === "package") loadPackages();
});
</script>

<style scoped>
.bulk-steps {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 20px;
  margin: 0;
  padding: 10px 16px;
  border-bottom: 1px solid var(--rmm-border);
  background: var(--rmm-surface-2);
  list-style: none;
}

.bulk-steps__item {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--rmm-text-subtle);
  font-size: var(--rmm-fs-xs);
  font-weight: 600;
}

.bulk-steps__num {
  display: inline-flex;
  width: 20px;
  height: 20px;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--rmm-border-strong);
  border-radius: 50%;
  background: var(--rmm-surface);
  font-variant-numeric: tabular-nums;
}

.bulk-steps__item--current {
  color: var(--rmm-accent-text);
}

.bulk-steps__item--current .bulk-steps__num {
  border-color: var(--rmm-accent);
  background: var(--rmm-accent-soft);
}

.bulk-steps__item--done {
  color: var(--rmm-text-muted);
}
</style>

<style>
.bulk-section-title {
  margin-bottom: 8px;
  color: var(--rmm-text);
  font-size: var(--rmm-fs-md);
  font-weight: 600;
}

.bulk-review__kv {
  grid-template-columns: max-content minmax(0, 1fr);
}
</style>
