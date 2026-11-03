<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<script setup>
import { ref, computed, onMounted } from "vue";
import { useDialogPluginComponent, Loading } from "quasar";
import axios from "axios";
import PolicyChecksTab from "@/components/automation/PolicyChecksTab.vue";
import PolicyAutomatedTasksTab from "@/components/automation/PolicyAutomatedTasksTab.vue";
import DialogHeader from "@/components/ui/DialogHeader.vue";
import EmptyState from "@/components/ui/EmptyState.vue";

defineEmits(useDialogPluginComponent.emits);
const { dialogRef, onDialogHide } = useDialogPluginComponent();

const tabOpts = {
  dense: true,
  noCaps: true,
  align: "left",
  inlineLabel: true,
  narrowIndicator: true,
  activeColor: "primary",
  indicatorColor: "primary",
};

const splitterWidth = ref(25);
const selectedKey = ref(null);
const tab = ref("checks");
const nodes = ref([]);

const tabDefs = [
  {
    name: "checks",
    icon: "fas fa-check-double",
    label: "Checks",
    tip: "Checks in the selected policy",
    comp: PolicyChecksTab,
  },
  {
    name: "tasks",
    icon: "fas fa-tasks",
    label: "Tasks",
    tip: "Tasks in the selected policy",
    comp: PolicyAutomatedTasksTab,
  },
];

// leaf id of the selected tree node
const policyId = computed(() => {
  if (!selectedKey.value) return undefined;
  const walk = (list) => {
    for (const n of list) {
      if (n.key === selectedKey.value) return n.id;
      const hit = n.children && walk(n.children);
      if (hit !== undefined) return hit;
    }
    return undefined;
  };
  return walk(nodes.value);
});

function policyLeaf(policy, suffix) {
  const label = `${policy.name} (${suffix})${policy.active ? "" : " (disabled)"}`;
  return {
    label,
    icon: "policy",
    id: policy.id,
    key: `${policy.id}${label}`,
  };
}

function policyLeaves(owner) {
  const leaves = [];
  if (owner.server_policy)
    leaves.push(policyLeaf(owner.server_policy, "Servers"));
  if (owner.workstation_policy)
    leaves.push(policyLeaf(owner.workstation_policy, "Workstations"));
  return leaves;
}

// negative ids keep the group nodes apart from policy ids
function buildTree(clients) {
  let groupId = 0;
  const group = (name, icon, children) => {
    const node = {
      label: name,
      id: groupId,
      icon,
      selectable: false,
      key: `${groupId}${name}`,
    };
    if (children) node.children = children;
    groupId--;
    return node;
  };

  return clients.map((client) => {
    const clientNode = group(client.name, "business", policyLeaves(client));
    for (const site of client.sites) {
      const leaves = policyLeaves(site);
      clientNode.children.push(
        group(site.name, "apartment", leaves.length ? leaves : undefined),
      );
    }
    return clientNode;
  });
}

async function loadTree() {
  Loading.show();
  try {
    const { data } = await axios.get("/automation/policies/overview/");
    nodes.value = buildTree(data);
  } catch {
    // reported by the axios boot
  }
  Loading.hide();
}

onMounted(loadTree);
</script>

<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide">
    <q-card class="q-dialog-plugin" style="width: 90vw; max-width: 90vw">
      <DialogHeader
        title="Policy Overview"
        subtitle="Policies assigned to each client and site; select one to see its checks and tasks"
      >
        <template v-slot:actions>
          <q-btn
            @click="loadTree"
            class="q-mr-sm"
            dense
            flat
            icon="refresh"
            aria-label="Refresh policy tree"
          >
            <q-tooltip>Reload the client and site tree</q-tooltip>
          </q-btn>
        </template>
      </DialogHeader>
      <q-splitter v-model="splitterWidth" style="height: 600px">
        <template v-slot:before>
          <div class="q-pa-md">
            <q-tree
              node-key="key"
              no-nodes-label="No clients to show"
              selected-color="primary"
              :nodes="nodes"
              v-model:selected="selectedKey"
            />
          </div>
        </template>

        <template v-slot:after>
          <q-tabs v-model="tab" v-bind="tabOpts">
            <q-tab
              v-for="t in tabDefs"
              :key="t.name"
              :name="t.name"
              :icon="t.icon"
              :label="t.label"
            >
              <q-tooltip>{{ t.tip }}</q-tooltip>
            </q-tab>
          </q-tabs>
          <q-tab-panels
            v-model="tab"
            animated
            transition-prev="jump-up"
            transition-next="jump-up"
          >
            <q-tab-panel v-for="t in tabDefs" :key="t.name" :name="t.name">
              <component
                :is="t.comp"
                v-if="policyId !== undefined"
                :selectedPolicy="policyId"
              />
              <EmptyState
                v-else
                icon="policy"
                title="No policy selected"
                text="Pick a policy under a client or site on the left to see its checks and tasks."
              />
            </q-tab-panel>
          </q-tab-panels>
        </template>
      </q-splitter>
    </q-card>
  </q-dialog>
</template>
