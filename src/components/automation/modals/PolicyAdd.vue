<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<script setup>
import { ref, reactive, computed, onMounted } from "vue";
import { useDialogPluginComponent, Loading } from "quasar";
import axios from "axios";
import RmmSelect from "@/components/ui/RmmSelect.vue";
import DialogHeader from "@/components/ui/DialogHeader.vue";
import EmptyState from "@/components/ui/EmptyState.vue";
import HelpTip from "@/components/ui/HelpTip.vue";
import { notifySuccess } from "@/utils/notify";

const props = defineProps({
  object: Object,
  type: {
    required: true,
    type: String,
    validator: (value) => ["agent", "site", "client"].includes(value),
  },
});
defineEmits(useDialogPluginComponent.emits);
const { dialogRef, onDialogHide, onDialogOK } = useDialogPluginComponent();

const options = ref([]);
const isAgent = props.type === "agent";
const picked = reactive({
  server: isAgent ? null : props.object.server_policy,
  workstation: isAgent ? null : props.object.workstation_policy,
  agent: isAgent ? props.object.policy : null,
});
const blockInheritance = ref(props.object.block_policy_inheritance);

const selectors = isAgent
  ? [{ model: "agent", label: "Policy" }]
  : [
      {
        model: "server",
        label: "Server Policy",
        hint: `Applies to every server in this ${props.type}`,
      },
      {
        model: "workstation",
        label: "Workstation Policy",
        hint: `Applies to every workstation in this ${props.type}`,
      },
    ];

const inheritanceTip = computed(() => {
  switch (props.type) {
    case "agent":
      return "The agent ignores policies from its site, its client and the Global Settings defaults";
    case "site":
      return "Agents in this site ignore policies from the client and the Global Settings defaults";
    default:
      return "Agents in this client ignore the default policies from Global Settings";
  }
});

function unchanged() {
  const o = props.object;
  if (isAgent)
    return (
      o.policy === picked.agent &&
      o.block_policy_inheritance === blockInheritance.value
    );
  return (
    o.workstation_policy === picked.workstation &&
    o.server_policy === picked.server &&
    o.block_policy_inheritance === blockInheritance.value
  );
}

function request() {
  const block = blockInheritance.value;
  const pair = {
    server_policy: picked.server,
    workstation_policy: picked.workstation,
    block_policy_inheritance: block,
  };
  if (props.type === "client")
    return [`/clients/${props.object.id}/`, { client: pair }];
  if (props.type === "site")
    return [`/clients/sites/${props.object.id}/`, { site: pair }];
  return [
    `/agents/${props.object.agent_id}/`,
    { policy: picked.agent, block_policy_inheritance: block },
  ];
}

async function save() {
  if (unchanged()) {
    dialogRef.value.hide();
    return;
  }
  Loading.show();
  try {
    const [url, body] = request();
    await axios.put(url, body);
    Loading.hide();
    onDialogOK();
    notifySuccess("Policies saved");
  } catch {
    Loading.hide();
  }
}

onMounted(async () => {
  Loading.show();
  try {
    const { data } = await axios.get("/automation/policies/");
    options.value = data.map((p) => ({ label: p.name, value: p.id }));
  } catch {
    // reported by the axios boot
  }
  Loading.hide();
});
</script>

<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide">
    <q-card class="q-dialog-plugin" style="width: 60vw">
      <DialogHeader
        :title="`Edit policies assigned to ${type}`"
        :subtitle="
          type === 'agent'
            ? 'The agent runs the checks and tasks of this policy on top of inherited ones'
            : `Agents in this ${type} run the checks and tasks of these policies`
        "
      />
      <q-form @submit="save">
        <q-card-section v-if="options.length > 0" class="q-gutter-y-md">
          <rmm-select
            v-for="f in selectors"
            :key="f.model"
            v-model="picked[f.model]"
            :options="options"
            :label="f.label"
            :hint="f.hint"
            outlined
            clearable
            mapOptions
            filterable
          />

          <div class="row items-center no-wrap">
            <q-checkbox
              label="Block policy inheritance"
              v-model="blockInheritance"
            />
            <HelpTip class="q-ml-xs" :text="inheritanceTip" />
          </div>
        </q-card-section>
        <q-card-section v-else>
          <EmptyState
            icon="policy"
            title="No policies yet"
            text="Create one under Settings > Automation Manager, then assign it here."
          />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn v-close-popup flat label="Cancel" />
          <q-btn
            v-if="options.length"
            type="submit"
            color="primary"
            unelevated
            label="Submit"
          />
        </q-card-actions>
      </q-form>
    </q-card>
  </q-dialog>
</template>
