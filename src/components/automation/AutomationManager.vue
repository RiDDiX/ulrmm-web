<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<script setup>
import axios from "axios";
import { useStore } from "vuex";
import { ref, onMounted } from "vue";
import { useQuasar, useDialogPluginComponent } from "quasar";
import DialogHeader from "@/components/ui/DialogHeader.vue";
import EmptyState from "../ui/EmptyState.vue";
import HelpTip from "@/components/ui/HelpTip.vue";
import RowActions from "../ui/RowActions.vue";
import DialogWrapper from "@/components/ui/DialogWrapper.vue";
import PolicyActionsMenu from "@/components/automation/PolicyActionsMenu.vue";
import PolicyChecksTab from "@/components/automation/PolicyChecksTab.vue";
import PolicyAutomatedTasksTab from "./PolicyAutomatedTasksTab.vue";
import PolicyOverview from "@/components/automation/PolicyOverview.vue";
import PolicyForm from "./modals/PolicyForm.vue";
import PolicyExclusions from "@/components/automation/modals/PolicyExclusions.vue";
import RelationsView from "@/components/automation/modals/RelationsView.vue";
import PatchPolicyForm from "../modals/agents/PatchPolicyForm.vue";
import AlertTemplateAdd from "@/components/modals/alerts/AlertTemplateAdd.vue";
import { policySummary, policySummaryCompact } from "../../utils/patchSchedule";
import { notifySuccess } from "@/utils/notify";
import { sortableHeaders as vSortableHeaders } from "@/utils/sortableHeaders";

defineEmits(useDialogPluginComponent.emits);
const store = useStore();
const $q = useQuasar();
const { dialogRef, onDialogHide } = useDialogPluginComponent();

const tableOpts = {
  dense: true,
  rowKey: "id",
  virtualScroll: true,
  hidePagination: true,
  binaryStateSort: true,
  rowsPerPageOptions: [0],
};
const tabOpts = {
  dense: true,
  noCaps: true,
  align: "left",
  inlineLabel: true,
  narrowIndicator: true,
  activeColor: "primary",
  indicatorColor: "primary",
};
const deleteBtn = { label: "Delete", color: "negative" };

const policies = ref([]);
const selected = ref(null);
const subtab = ref("checks");
const busy = ref(false);
const loadError = ref("");
const pagination = ref({ rowsPerPage: 0, sortBy: "name", descending: false });

const subtabs = [
  {
    name: "checks",
    icon: "fas fa-check-double",
    label: "Checks",
    tip: "Checks every agent under the policy runs",
    comp: PolicyChecksTab,
  },
  {
    name: "tasks",
    icon: "fas fa-tasks",
    label: "Tasks",
    tip: "Scheduled or triggered tasks created on every agent under the policy",
    comp: PolicyAutomatedTasksTab,
  },
];

const col = (name, label, field, sortable) => ({
  name,
  label,
  field,
  align: "left",
  sortable,
});
const columns = [
  col("active", "Active", "active"),
  col("enforced", "Enforced", "enforced"),
  col("name", "Name", "name", true),
  col("desc", "Description", "desc"),
  col("relations", "Relations", "relations"),
  col("exclusions", "Exclusions"),
  col("winupdatepolicy", "Patch policy", "winupdatepolicy"),
  col("alert_template", "Alert template", "alert_template"),
  col("actions", "Actions", "actions"),
  { name: "rowactions", label: "Actions", align: "right", field: () => "" },
];

const headerTips = {
  active: "Active policies apply to their agents; inactive ones are ignored",
  enforced:
    "Enforced policy checks win over an agent's own checks of the same kind",
  relations:
    "Where the policy is assigned; the number counts every agent it applies to",
  exclusions:
    "Clients, sites and agents the policy skips even though it is assigned above them",
};

// the two checkbox columns; texts are the success toasts for on / off
const flagCols = [
  {
    field: "active",
    title: "Active",
    onText: "Policy enabled successfully",
    offText: "Policy disabled successfully",
  },
  {
    field: "enforced",
    title: "Enforced",
    onText: "Policy enforced successfully",
    offText: "Policy enforcement disabled",
  },
];

async function loadPolicies() {
  busy.value = true;
  loadError.value = "";
  try {
    const { data } = await axios.get("/automation/policies/");
    policies.value = data;
    // keep the selection across a reload unless the policy is gone
    if (selected.value) {
      selected.value = data.find((p) => p.id === selected.value.id) || null;
    }
  } catch (err) {
    loadError.value =
      err?.response?.status === 403
        ? "Your role cannot view policies."
        : "Policies could not be loaded.";
  } finally {
    busy.value = false;
  }
}

function openThenReload(component, componentProps) {
  $q.dialog({ component, componentProps }).onOk(loadPolicies);
}

const addPolicy = () => openThenReload(PolicyForm);
const copyPolicy = (policy) =>
  openThenReload(PolicyForm, { copyPolicy: policy });
const editPolicy = (policy) => openThenReload(PolicyForm, { policy });
const editExclusions = (policy) => openThenReload(PolicyExclusions, { policy });
const editAlertTemplate = (policy) =>
  openThenReload(AlertTemplateAdd, { type: "policy", object: policy });
const editPatchPolicy = (policy) =>
  openThenReload(DialogWrapper, {
    title:
      policy.winupdatepolicy.length > 0
        ? "Edit patch policy"
        : "Add patch policy",
    vuecomponent: PatchPolicyForm,
    // the form is long; 50vh hid its save button below the fold
    height: "80",
    componentProps: { policy },
  });

const showRelations = (policy) =>
  $q.dialog({ component: RelationsView, componentProps: { policy } });
const openOverview = () => $q.dialog({ component: PolicyOverview });

function removePolicy(policy) {
  const defaults = [];
  if (policy.default_server_policy) defaults.push("server");
  if (policy.default_workstation_policy) defaults.push("workstation");
  let message = `Applied to ${policy.agents_count} agents. Its checks and tasks will be removed from them.`;
  if (defaults.length)
    message = `This is the default ${defaults.join(" and ")} policy. ${message}`;
  $q.dialog({
    title: `Delete policy ${policy.name}?`,
    message,
    ok: deleteBtn,
    persistent: true,
    cancel: true,
  }).onOk(async () => {
    $q.loading.show();
    try {
      await axios.delete(`/automation/policies/${policy.id}/`);
      loadPolicies();
      $q.loading.hide();
      notifySuccess("Policy was deleted!");
      store.dispatch("loadTree");
    } catch {
      $q.loading.hide();
    }
  });
}

// `on` is the value the checkbox just took
async function setFlag(policy, flag, on) {
  $q.loading.show();
  try {
    await axios.put(`/automation/policies/${policy.id}/`, {
      id: policy.id,
      name: policy.name,
      desc: policy.desc,
      [flag.field]: on,
    });
    loadPolicies();
    $q.loading.hide();
    notifySuccess(on ? flag.onText : flag.offText);
  } catch {
    // the checkbox flipped already; show what the server still has
    policy[flag.field] = !on;
    $q.loading.hide();
  }
}

const menuEvents = (policy) => ({
  edit: () => editPolicy(policy),
  copy: () => copyPolicy(policy),
  delete: () => removePolicy(policy),
  relations: () => showRelations(policy),
  exclusions: () => editExclusions(policy),
  patch: () => editPatchPolicy(policy),
  "alert-template": () => editAlertTemplate(policy),
});

function defaultChips(policy) {
  const chips = [];
  if (policy.default_server_policy)
    chips.push({
      text: "Default server",
      tip: "Set in Global Settings; applies to every server unless inheritance is blocked",
    });
  if (policy.default_workstation_policy)
    chips.push({
      text: "Default workstation",
      tip: "Set in Global Settings; applies to every workstation unless inheritance is blocked",
    });
  return chips;
}

function linkCells(policy) {
  const hasPatch = policy.winupdatepolicy.length > 0;
  const patchText = policySummaryCompact(policy.winupdatepolicy[0]);
  const excluded =
    policy.excluded_agents.length +
    policy.excluded_clients.length +
    policy.excluded_sites.length;
  return [
    {
      text: `Show relations (${policy.agents_count})`,
      run: () => showRelations(policy),
    },
    {
      text: `Show policy exclusions (${excluded})`,
      run: () => editExclusions(policy),
    },
    {
      text: patchText,
      // starts with the visible text, so speech input can address the link
      aria: hasPatch
        ? `${patchText}. Modify Patch Policy: ${policySummary(policy.winupdatepolicy[0])}`
        : patchText,
      tip: hasPatch ? policySummary(policy.winupdatepolicy[0]) : "",
      run: () => editPatchPolicy(policy),
    },
    {
      text: policy.alert_template
        ? "Modify Alert Template"
        : "Assign Alert Template",
      run: () => editAlertTemplate(policy),
    },
  ];
}

onMounted(loadPolicies);
</script>

<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide">
    <div class="q-dialog-plugin" style="width: 90vw; max-width: 90vw">
      <q-card>
        <DialogHeader
          title="Automation Manager"
          subtitle="A policy bundles checks and tasks; every agent it applies to runs them"
        >
          <template v-slot:actions>
            <q-btn
              @click="loadPolicies"
              class="q-mr-sm"
              dense
              flat
              icon="refresh"
              aria-label="Refresh policies"
            >
              <q-tooltip>Reload the policy list</q-tooltip>
            </q-btn>
          </template>
        </DialogHeader>
        <q-card-section>
          <div class="row items-center q-gutter-sm">
            <q-btn
              label="New policy"
              dense
              unelevated
              no-caps
              color="primary"
              icon="add"
              class="q-px-sm"
              @click="addPolicy"
            />
            <q-btn
              label="Policy overview"
              dense
              flat
              no-caps
              icon="remove_red_eye"
              class="q-px-sm"
              @click="openOverview"
            >
              <q-tooltip
                >See which policy each client and site uses, with its checks and
                tasks</q-tooltip
              >
            </q-btn>
            <q-space />
            <span class="rmm-muted rmm-num">
              {{ policies.length }}
              {{ policies.length === 1 ? "policy" : "policies" }}
            </span>
            <HelpTip
              text="Assign a policy with Assign Automation Policy on a client, site or agent, or pick a default server and workstation policy in Global Settings. An agent gets the policies of every level above it unless inheritance is blocked there."
            />
          </div>
          <div class="text-caption rmm-muted q-py-xs">
            Enforced policies win over an agent's own checks of the same kind;
            tasks from every active policy are added. Exclusions skip chosen
            clients, sites or agents.
          </div>
          <!-- shrinks to a short list so the checks and tasks below stay in view -->
          <div class="scroll" style="max-height: 30vh">
            <q-table
              table-class="table-bgcolor"
              class="tabs-tbl-sticky rmm-table"
              v-bind="tableOpts"
              :rows="policies"
              :columns="columns"
              v-model:pagination="pagination"
              :loading="busy"
              v-sortable-headers
            >
              <template v-slot:loading>
                <q-inner-loading showing color="primary" />
              </template>

              <template v-slot:no-data>
                <div
                  v-if="!busy"
                  class="full-width column flex-center q-gutter-sm q-py-md"
                >
                  <template v-if="loadError">
                    <q-icon name="error_outline" color="negative" size="24px" />
                    <div>{{ loadError }}</div>
                    <q-btn
                      outline
                      dense
                      color="primary"
                      label="Retry"
                      @click="loadPolicies"
                    />
                  </template>
                  <EmptyState
                    v-else
                    icon="policy"
                    title="No policies yet"
                    text="Create a policy to push the same checks and tasks to many agents at once."
                  >
                    <q-btn
                      unelevated
                      no-caps
                      color="primary"
                      icon="add"
                      label="New policy"
                      @click="addPolicy"
                    />
                  </EmptyState>
                </div>
              </template>

              <template
                v-for="(tip, colName) in headerTips"
                :key="colName"
                #[`header-cell-${colName}`]="cell"
              >
                <q-th
                  :props="cell"
                  :auto-width="colName === 'active' || colName === 'enforced'"
                >
                  {{ cell.col.label }}
                  <q-tooltip>{{ tip }}</q-tooltip>
                </q-th>
              </template>
              <template v-slot:header-cell-rowactions="cell">
                <q-th :props="cell" auto-width>
                  <span class="sr-only">{{ cell.col.label }}</span>
                </q-th>
              </template>

              <template v-slot:body="cell">
                <q-tr
                  :props="cell"
                  class="cursor-pointer"
                  :class="
                    selected && selected.id === cell.row.id ? 'highlight' : ''
                  "
                  @click="selected = cell.row"
                  @contextmenu="selected = cell.row"
                  @dblclick="editPolicy(cell.row)"
                >
                  <!-- centered on the click, same as the agent rows -->
                  <q-menu context-menu anchor="center left" self="center left">
                    <PolicyActionsMenu
                      :policy="cell.row"
                      with-close
                      v-on="menuEvents(cell.row)"
                    />
                  </q-menu>
                  <q-td v-for="flag in flagCols" :key="flag.field">
                    <q-checkbox
                      dense
                      v-model="cell.row[flag.field]"
                      @update:model-value="(on) => setFlag(cell.row, flag, on)"
                      :aria-label="`${flag.title} for ${cell.row.name}`"
                    />
                  </q-td>
                  <q-td>
                    <span class="text-weight-medium">{{ cell.row.name }}</span>
                    <q-chip
                      v-for="d in defaultChips(cell.row)"
                      :key="d.text"
                      color="primary"
                      text-color="white"
                      size="sm"
                      >{{ d.text }} <q-tooltip>{{ d.tip }}</q-tooltip></q-chip
                    >
                  </q-td>
                  <!-- takes the width the other columns leave over -->
                  <q-td
                    class="ellipsis rmm-muted"
                    style="max-width: 0; width: 100%"
                    :title="cell.row.desc"
                    >{{ cell.row.desc }}</q-td
                  >
                  <q-td v-for="link in linkCells(cell.row)" :key="link.text">
                    <a
                      href="#"
                      role="button"
                      class="rmm-link"
                      :aria-label="link.aria"
                      @click.prevent="link.run()"
                      @keydown.space.prevent="link.run()"
                      >{{ link.text }}
                      <q-tooltip v-if="link.tip">{{ link.tip }}</q-tooltip>
                    </a>
                  </q-td>
                  <q-td>
                    <q-btn
                      flat
                      round
                      dense
                      size="sm"
                      icon="content_copy"
                      class="rmm-muted"
                      :aria-label="`Create a copy of ${cell.row.name}`"
                      @click="copyPolicy(cell.row)"
                    >
                      <q-tooltip
                        >Create a copy of this policy with its checks and
                        tasks</q-tooltip
                      >
                    </q-btn>
                  </q-td>
                  <!-- mirrors the context menu -->
                  <q-td @click.stop>
                    <RowActions :label="`Actions for ${cell.row.name}`">
                      <PolicyActionsMenu
                        :policy="cell.row"
                        v-on="menuEvents(cell.row)"
                      />
                    </RowActions>
                  </q-td>
                </q-tr>
              </template>
            </q-table>
          </div>
        </q-card-section>

        <q-card-section>
          <div v-if="selected" class="rmm-label q-pb-xs">
            Checks and tasks in {{ selected.name }}
          </div>
          <q-tabs v-model="subtab" v-bind="tabOpts">
            <q-tab
              v-for="t in subtabs"
              :key="t.name"
              :name="t.name"
              :icon="t.icon"
              :label="t.label"
            >
              <q-tooltip>{{ t.tip }}</q-tooltip>
            </q-tab>
          </q-tabs>
          <q-separator />
          <q-tab-panels v-model="subtab" :animated="false">
            <q-tab-panel v-for="t in subtabs" :key="t.name" :name="t.name">
              <div class="scroll" style="min-height: 25vh; max-height: 25vh">
                <component
                  :is="t.comp"
                  v-if="!!selected"
                  :selectedPolicy="selected.id"
                />
                <EmptyState
                  v-else
                  icon="ads_click"
                  title="No policy selected"
                  text="Click a policy above to manage its checks and tasks."
                />
              </div>
            </q-tab-panel>
          </q-tab-panels>
        </q-card-section>
      </q-card>
    </div>
  </q-dialog>
</template>
