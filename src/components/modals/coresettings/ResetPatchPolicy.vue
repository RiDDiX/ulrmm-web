<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide">
    <q-card class="q-dialog-plugin rmm-dialog--md">
      <DialogHeader title="Reset Agent Patch Policy" />
      <q-card-section>
        Removes the per-agent patch overrides (approval levels, schedule, reboot
        after install) of every agent in the chosen scope. The agents fall back
        to the policy inherited from their site, client or global settings. This
        cannot be undone and might take a while.
      </q-card-section>

      <q-card-section class="q-pt-none">
        <div class="rmm-label q-mb-xs">Scope</div>
        <q-option-group
          v-model="scope"
          :options="SCOPES"
          color="primary"
          inline
          dense
        />
        <div class="text-caption rmm-muted q-mt-sm" role="status">
          {{ scopeText }}
        </div>
      </q-card-section>

      <q-form @submit="submit">
        <q-card-section v-if="picker">
          <rmm-select
            :key="scope"
            v-model="picks[scope]"
            :label="picker.label"
            :options="picker.options"
            :rules="[(val) => !!val || '*Required']"
            mapOptions
            filterable
            clearable
            outlined
          />
        </q-card-section>
        <FormActions
          color="negative"
          :disable="!hasScope"
          :loading="busy"
          :label="buttonLabel"
        />
      </q-form>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from "vue";
import { useDialogPluginComponent, useQuasar } from "quasar";
import { fetchClients } from "@/api/clients";
import { sendPatchPolicyReset as resetPatchPolicies } from "@/api/automation";
import { notifySuccess } from "@/utils/notify";
import { formatClientOptions, formatSiteOptions } from "@/utils/format";
import DialogHeader from "@/components/ui/DialogHeader.vue";
import RmmSelect from "@/components/ui/RmmSelect.vue";
import ConfirmYesDialog from "@/components/agents/ConfirmYesDialog.vue";
import FormActions from "@/core/ui/FormActions.vue";

defineEmits([...useDialogPluginComponent.emits]);

const $q = useQuasar();
const { dialogRef, onDialogHide, onDialogOK } = useDialogPluginComponent();

const SCOPES = ["client", "site", "all"].map((value) => ({
  value,
  label: value[0].toUpperCase() + value.slice(1),
}));

// the raw /clients/ response keeps the agent counts next to the options
const clients = ref([]);
const loadFailed = ref(false);
const scope = ref("client");
const picks = reactive({ client: null, site: null });
const busy = ref(false);

const picker = computed(() => {
  if (scope.value === "client") {
    return { label: "Clients", options: formatClientOptions(clients.value) };
  }
  if (scope.value === "site") {
    return { label: "Sites", options: formatSiteOptions(clients.value) };
  }
  return null;
});

watch(scope, () => {
  picks.client = null;
  picks.site = null;
});

// "all" needs the loaded client list, otherwise the count is unknown
const hasScope = computed(() =>
  scope.value === "all" ? clients.value.length > 0 : !!picks[scope.value],
);

// the client's own agent_count is not role-filtered, its sites are
const agentsOf = (client) =>
  client.sites.reduce((sum, s) => sum + s.agent_count, 0);

const agentCount = computed(() => {
  if (scope.value === "all") {
    return clients.value.reduce((sum, c) => sum + agentsOf(c), 0);
  }
  if (scope.value === "client") {
    const picked = clients.value.find((c) => c.id === picks.client);
    return picked ? agentsOf(picked) : 0;
  }
  const picked = clients.value
    .flatMap((c) => c.sites)
    .find((s) => s.id === picks.site);
  return picked?.agent_count ?? 0;
});

const scopeText = computed(() => {
  if (loadFailed.value) {
    return "Could not load the client list; the scope is unknown.";
  }
  if (hasScope.value) return `${agentCount.value} agents in scope.`;
  return scope.value === "all"
    ? "Loading the client list to count the agents in scope."
    : `Select a ${scope.value} to see how many agents are affected.`;
});

const buttonLabel = computed(
  () =>
    `Reset policies on ${scope.value === "all" ? "all " : ""}${agentCount.value} agents`,
);

function submit() {
  if (scope.value !== "all") return send();
  $q.dialog({
    component: ConfirmYesDialog,
    componentProps: {
      hostname: `all ${agentCount.value} agents`,
      actionVerb: "the patch policy reset",
      title: "Reset patch policies for all agents?",
      okLabel: "Reset",
      consequence:
        "Every per-agent patch override is removed. This cannot be undone.",
    },
  }).onOk(send);
}

async function send() {
  busy.value = true;
  try {
    const body =
      scope.value === "all" ? {} : { [scope.value]: picks[scope.value] };
    notifySuccess(await resetPatchPolicies(body));
    onDialogOK();
  } catch (e) {
    console.error(e);
  }
  busy.value = false;
}

onMounted(async () => {
  try {
    clients.value = await fetchClients();
  } catch (e) {
    console.error(e);
    loadFailed.value = true;
  }
});
</script>
