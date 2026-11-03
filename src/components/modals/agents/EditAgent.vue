<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-dialog
    ref="dialogRef"
    aria-labelledby="edit-agent-title"
    @hide="onDialogHide"
  >
    <q-card style="width: 880px; max-width: 95vw">
      <DialogHeader
        title-id="edit-agent-title"
        :title="`Edit ${loadedName || 'agent'}`"
        subtitle="Settings that apply to this agent only"
      />
      <q-splitter v-model="splitterWidth">
        <template #before>
          <q-tabs
            v-model="tab"
            class="text-primary rmm-settings-tabs"
            dense
            no-caps
            vertical
          >
            <q-tab v-for="t in tabs" :key="t.name" v-bind="t" />
          </q-tabs>
        </template>
        <template #after>
          <q-form @submit.prevent="save">
            <div class="scroll" style="height: 65vh; max-height: 65vh">
              <q-tab-panels
                v-model="tab"
                v-bind="{
                  transitionPrev: 'jump-up',
                  transitionNext: 'jump-up',
                }"
                animated
              >
                <q-tab-panel name="general">
                  <EditAgentGeneral
                    v-model:timezone="timezone"
                    :agent="agent"
                    :site-options="siteOptions"
                    :timezones="allTimezones"
                    :tz-inherited="tzInherited"
                  />
                </q-tab-panel>

                <q-tab-panel name="customfields">
                  <EmptyState
                    v-if="customFields.length === 0"
                    icon="list_alt"
                    title="No agent custom fields"
                    text="Custom fields store your own data on agents. Create them under Settings > Global Settings > Custom Fields."
                  />
                  <div v-else class="column q-gutter-y-md">
                    <div v-for="field in customFields" :key="field.id">
                      <CustomField
                        v-model="fieldValues[field.name]"
                        :field="field"
                      />
                    </div>
                  </div>
                </q-tab-panel>

                <q-tab-panel name="patch" class="q-pa-none">
                  <PatchPolicyForm :agent="agent" />
                </q-tab-panel>

                <q-tab-panel name="policies">
                  <EditAgentPolicies :agent="agent" />
                </q-tab-panel>
              </q-tab-panels>
            </div>
            <FormButtons label="Save" />
          </q-form>
        </template>
      </q-splitter>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { onMounted, reactive, ref } from "vue";
import { useStore } from "vuex";
import axios from "axios";
import { useDialogPluginComponent } from "quasar";
import { notifySuccess, notifyError } from "@/utils/notify";
import { formatCustomFields } from "@/utils/format";
import { deviceName, displayNameError } from "@/utils/deviceName";
import PatchPolicyForm from "@/components/modals/agents/PatchPolicyForm.vue";
import EditAgentGeneral from "@/components/modals/agents/EditAgentGeneral.vue";
import EditAgentPolicies from "@/components/modals/agents/EditAgentPolicies.vue";
import CustomField from "@/components/ui/CustomField.vue";
import DialogHeader from "@/components/ui/DialogHeader.vue";
import EmptyState from "@/components/ui/EmptyState.vue";
import FormButtons from "@/components/agents/FormButtons.vue";

defineOptions({ name: "EditAgent" });
defineEmits([...useDialogPluginComponent.emits]);

const props = defineProps({
  agent_id: String,
});

const { dialogRef, onDialogHide, onDialogOK } = useDialogPluginComponent();
const store = useStore();

const tabs = [
  { name: "general", label: "General" },
  { name: "customfields", label: "Custom Fields" },
  { name: "patch", label: "Patches" },
  { name: "policies", label: "Automation Policies" },
];

const tab = ref("general");
const splitterWidth = ref(25);
const agent = reactive({});
const loadedName = ref("");
const customFields = ref([]);
const fieldValues = reactive({});
const siteOptions = ref([]);
const allTimezones = ref([]);
const timezone = ref(null);
const tzInherited = ref(true);
let storedTimezone = null;

const emptyValue = (type) =>
  type === "multiple" ? [] : type === "checkbox" ? false : "";

async function loadAgent() {
  const { data } = await axios.get(`/agents/${props.agent_id}/`);
  Object.assign(agent, data);
  loadedName.value = deviceName(data);
  allTimezones.value = Object.freeze(data.all_timezones);

  // time_zone is the stored column, timezone the inherited fallback
  tzInherited.value = data.time_zone === null;
  storedTimezone = tzInherited.value ? data.timezone : data.time_zone;
  timezone.value = storedTimezone;

  for (const field of customFields.value) {
    const saved = data.custom_fields.find((v) => v.field === field.id);
    fieldValues[field.name] = saved ? saved.value : emptyValue(field.type);
  }
}

async function loadSites() {
  const { data } = await axios.get("/clients/");
  for (const client of data) {
    siteOptions.value.push({ category: client.name });
    for (const site of client.sites) {
      siteOptions.value.push({
        label: site.name,
        value: site.id,
        cat: client.name,
      });
    }
  }
}

// fields the serializer returns that the update must not send back
const READ_ONLY_KEYS = [
  "created_by created_time modified_by modified_time",
  "all_timezones timezone wmi_detail services status cpu_model local_ips",
  "make_model physical_disks graphics checks patches_last_installed",
  "last_seen applied_policies effective_patch_policy version",
  "operating_system plat goarch hostname public_ip total_ram disks boot_time",
  "logged_in_username last_logged_in_user needs_reboot choco_installed",
  "policy mesh_node_id block_policy_inheritance maintenance_mode",
  "alert_template client site_name",
].flatMap((row) => row.split(" "));

async function save() {
  // the Patches panel unmounts with its tab and takes its own day check with
  // it, so a daily schedule without a day is caught here as well
  const wup = agent.winupdatepolicy?.[0];
  if (wup?.run_time_frequency === "daily" && !wup.run_time_days?.length) {
    tab.value = "patch";
    return notifyError("Select at least one day for the patch schedule.");
  }

  const nameError = displayNameError(agent.display_name);
  if (nameError) {
    tab.value = "general";
    return notifyError(`Display name: ${nameError}`);
  }

  // copy so a failed save leaves the form as it was
  const body = { ...agent };
  const hasName = "display_name" in body;
  if (hasName) body.display_name = (body.display_name || "").trim();
  READ_ONLY_KEYS.forEach((k) => delete body[k]);

  // an untouched timezone stays null on the server and keeps following the
  // global setting
  if (timezone.value !== storedTimezone) body.time_zone = timezone.value;

  body.custom_fields = formatCustomFields(customFields.value, fieldValues);
  await axios.put(`/agents/${props.agent_id}/`, body);

  if (hasName) {
    store.commit("setAgentDisplayName", {
      agent_id: props.agent_id,
      display_name: body.display_name,
    });
  }
  dialogRef.value.hide();
  onDialogOK();
  notifySuccess("Agent was edited!");
}

onMounted(() => {
  axios.patch("/core/customfields/", { model: "agent" }).then((r) => {
    customFields.value = r.data.filter((field) => !field.hide_in_ui);
  });
  loadAgent();
  loadSites();
});
</script>

<style scoped>
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
</style>
