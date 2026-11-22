<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<script setup>
import { computed, onMounted, ref, watch } from "vue";
import { useDialogPluginComponent, useQuasar } from "quasar";
import DialogHeader from "@/components/ui/DialogHeader.vue";
import { serverErrors } from "@/components/vault/stepUp";
import {
  fetchTaskCatalog,
  fetchTaskAssignments,
  changeTaskAssignments,
  removeTask,
} from "@/api/tasks";
import { notifySuccess } from "@/utils/notify";

const props = defineProps({
  taskId: Number,
  agentId: String,
  policyId: Number,
});
const emit = defineEmits(useDialogPluginComponent.emits);
const { dialogRef, onDialogHide, onDialogOK } = useDialogPluginComponent();
const $q = useQuasar();
const catalog = ref([]);
const selected = ref(props.taskId);
const data = ref(null);
const devices = ref([]);
const policies = ref([]);
const loadingCatalog = ref(false);
const loadingTask = ref(false);
const saving = ref(false);
const error = ref("");
let generation = 0;
let deleted = false;
function onHide(evt) {
  // a deleted definition leaves the opener's task list stale
  if (deleted) emit("ok");
  onDialogHide(evt);
}
const deviceRows = computed(() =>
  (data.value?.devices ?? []).filter(
    (d) => !props.agentId || d.agent_id === props.agentId,
  ),
);
const policyRows = computed(() =>
  (data.value?.policies ?? []).filter(
    (p) => !props.policyId || p.id === props.policyId,
  ),
);
const policyNames = computed(
  () => new Map((data.value?.policies ?? []).map((p) => [p.id, p.name])),
);
const policyName = (id) => policyNames.value.get(id) || "Policy #" + id;
const effectiveDirect = (d) => d.direct_effective ?? d.direct;
function apply(response) {
  data.value = response;
  devices.value = response.devices.filter((d) => d.direct).map((d) => d.id);
  policies.value = response.policies.filter((p) => p.assigned).map((p) => p.id);
}
async function loadCatalog() {
  loadingCatalog.value = true;
  error.value = "";
  try {
    catalog.value = await fetchTaskCatalog();
  } catch {
    error.value = "Unable to load the task catalog.";
  } finally {
    loadingCatalog.value = false;
  }
}
async function load(id) {
  const mine = ++generation;
  data.value = null;
  error.value = "";
  if (!id) {
    loadingTask.value = false;
    return;
  }
  loadingTask.value = true;
  try {
    const result = await fetchTaskAssignments(id);
    if (mine === generation) apply(result);
  } catch {
    if (mine === generation)
      error.value = "Unable to load assignments for this task.";
  } finally {
    if (mine === generation) loadingTask.value = false;
  }
}
const changes = computed(() => {
  const d = props.policyId ? [] : deviceRows.value;
  const p = props.agentId ? [] : policyRows.value;
  return {
    add_agents: d
      .filter((r) => devices.value.includes(r.id) && !r.direct)
      .map((r) => r.id),
    remove_agents: d
      .filter((r) => !devices.value.includes(r.id) && r.direct)
      .map((r) => r.id),
    add_policies: p
      .filter((r) => policies.value.includes(r.id) && !r.assigned)
      .map((r) => r.id),
    remove_policies: p
      .filter((r) => !policies.value.includes(r.id) && r.assigned)
      .map((r) => r.id),
  };
});
const dirty = computed(() =>
  Object.values(changes.value).some((values) => values.length),
);
const policyDevices = computed(() =>
  props.policyId
    ? deviceRows.value.filter((d) =>
        (d.member_policy_ids ?? d.policy_ids).includes(props.policyId),
      )
    : [],
);
function sourceNames(direct, ids) {
  return [direct ? "Direct" : "", ...ids.map(policyName)].filter(Boolean);
}
const preview = computed(() => {
  const change = changes.value;
  const added = new Set(change.add_policies);
  const removed = new Set(change.remove_policies);
  return deviceRows.value.flatMap((d) => {
    const direct =
      change.add_agents.includes(d.id) ||
      (effectiveDirect(d) && !change.remove_agents.includes(d.id));
    const assigned = d.policy_ids.filter((id) => !removed.has(id));
    const inherited = [
      ...new Set([
        ...assigned,
        ...(d.member_policy_ids ?? d.policy_ids).filter((id) => added.has(id)),
      ]),
    ];
    if (
      direct === effectiveDirect(d) &&
      inherited.join() === d.policy_ids.join()
    )
      return [];
    return [{ device: d, sources: sourceNames(direct, inherited) }];
  });
});
const search = ref("");
const matches = (value) =>
  value.toLowerCase().includes(search.value.trim().toLowerCase());
async function save() {
  if (!dirty.value || saving.value) return;
  saving.value = true;
  error.value = "";
  try {
    apply(await changeTaskAssignments(selected.value, changes.value));
    notifySuccess("Task assignments saved");
    deleted = false;
    onDialogOK();
  } catch (err) {
    error.value = serverErrors(err).message;
  } finally {
    saving.value = false;
  }
}
function deleteDefinition() {
  const id = selected.value;
  const task = catalog.value.find((item) => item.id === id);
  $q.dialog({
    title: `Delete task definition ${task?.name || ""}?`,
    message:
      "This permanently deletes the task and all of its device and policy assignments.",
    ok: { label: "Delete definition", color: "negative" },
    cancel: true,
    persistent: true,
  }).onOk(async () => {
    if (
      saving.value ||
      id !== selected.value ||
      !data.value?.can_delete_definition
    )
      return;
    saving.value = true;
    error.value = "";
    try {
      const result = await removeTask(id);
      deleted = true;
      selected.value = null;
      await loadCatalog();
      notifySuccess(result);
    } catch (err) {
      error.value = serverErrors(err).message;
    } finally {
      saving.value = false;
    }
  });
}
watch(selected, load, { immediate: true });
onMounted(loadCatalog);
</script>

<template>
  <q-dialog ref="dialogRef" @hide="onHide" :persistent="saving">
    <q-card style="width: 680px; max-width: 95vw">
      <DialogHeader title="Task assignments" />
      <q-card-section class="q-gutter-sm">
        <q-select
          v-model="selected"
          outlined
          dense
          label="Task"
          :options="catalog"
          option-value="id"
          option-label="name"
          emit-value
          map-options
          :disable="saving || loadingCatalog || !!taskId || dirty"
          :loading="loadingCatalog || loadingTask"
        />
        <q-banner v-if="error" dense class="rmm-banner-warning"
          >{{ error }}
          <template #action
            ><q-btn
              flat
              label="Reload"
              @click="
                loadCatalog();
                load(selected);
              "
          /></template>
        </q-banner>
        <template v-if="data">
          <div v-if="data.schedule" class="text-caption">
            Task schedule: {{ data.schedule }}
          </div>
          <q-input
            v-if="!policyId && !agentId"
            v-model="search"
            outlined
            dense
            clearable
            label="Filter by device or policy"
            @clear="search = ''"
          />
          <div class="scroll" style="max-height: 48vh">
            <template v-if="!policyId">
              <h3 class="rmm-label">Direct device assignments</h3>
              <div
                v-for="d in deviceRows.filter((d) => matches(d.hostname))"
                :key="d.id"
                class="q-mb-sm"
              >
                <q-checkbox
                  v-model="devices"
                  :val="d.id"
                  :label="d.hostname"
                  :disable="saving || d.editable === false"
                  dense
                />
                <div class="text-caption q-ml-lg">
                  {{ d.schedule || "No time schedule" }} · {{ d.timezone }} ·
                  {{
                    sourceNames(effectiveDirect(d), d.policy_ids).join(", ") ||
                    "Unassigned"
                  }}
                  <template v-if="d.direct && !effectiveDirect(d)">
                    · Direct assignment inactive on this platform</template
                  >
                </div>
              </div>
            </template>
            <template v-if="!agentId">
              <h3 class="rmm-label">Policy assignments</h3>
              <div
                v-for="p in policyRows.filter((p) => matches(p.name))"
                :key="p.id"
              >
                <q-checkbox
                  v-model="policies"
                  :val="p.id"
                  :label="p.name"
                  :disable="saving || p.editable === false"
                  dense
                />
              </div>
              <div class="text-caption q-mt-sm">
                Policy changes apply to current and future members.
              </div>
            </template>
            <template v-if="policyDevices.length">
              <h3 class="rmm-label">Current policy members</h3>
              <div v-for="d in policyDevices" :key="d.id" class="text-caption">
                {{ d.hostname }} · {{ d.schedule || "No time schedule" }} ·
                {{ d.timezone }} ·
                {{
                  sourceNames(effectiveDirect(d), d.policy_ids).join(", ") ||
                  "Unassigned"
                }}
              </div>
            </template>
            <div v-if="preview.length" class="q-mt-md" role="status">
              <h3 class="rmm-label">After saving</h3>
              <div
                v-for="{ device, sources } in preview"
                :key="device.id"
                class="text-caption"
              >
                {{ device.hostname }} ·
                {{
                  sources.length
                    ? "Sources: " + sources.join(", ")
                    : "Removing the last source stops future runs."
                }}
              </div>
            </div>
          </div>
        </template>
      </q-card-section>
      <q-card-actions align="right">
        <q-btn
          v-if="!agentId && !policyId && data?.can_delete_definition"
          flat
          color="negative"
          label="Delete task definition…"
          :disable="saving || dirty"
          @click="deleteDefinition"
        />
        <q-btn v-close-popup flat label="Close" :disable="saving" />
        <q-btn
          color="primary"
          label="Save assignments"
          :disable="!dirty || !data"
          :loading="saving"
          @click="save"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>
