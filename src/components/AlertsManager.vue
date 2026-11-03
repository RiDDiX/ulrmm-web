<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide">
    <div class="q-dialog-plugin" style="width: 90vw; max-width: 90vw">
      <q-card>
        <DialogHeader
          title="Alerts Manager"
          subtitle="Alert templates decide who is notified and what runs when an agent, check or task fails"
        >
          <template v-slot:actions>
            <q-btn
              class="q-mr-sm"
              dense
              flat
              icon="refresh"
              aria-label="Refresh alert templates"
              @click="reload"
            >
              <q-tooltip>Reload the alert templates</q-tooltip>
            </q-btn>
          </template>
        </DialogHeader>
        <div class="q-pa-sm" style="min-height: 65vh; max-height: 65vh">
          <div class="row items-center q-gutter-sm q-pb-sm">
            <q-btn
              label="New template"
              dense
              unelevated
              no-caps
              color="primary"
              icon="add"
              class="q-px-sm"
              @click="addTemplate"
            />
            <span class="text-caption rmm-muted">
              Assign templates to policies, clients or sites. Default is the
              Global Settings template, else the default policy's. Excluded
              agents skip a template.
            </span>
            <q-space />
            <span class="rmm-muted rmm-num">
              {{ templates.length }}
              {{ templates.length === 1 ? "template" : "templates" }}
            </span>
            <HelpTip
              text="First active one wins: agent policy, site policy, site, client policy, client, default"
            />
          </div>
          <q-table
            v-bind="tableProps"
            v-model:pagination="pagination"
            :rows="templates"
            :columns="columns"
            :loading="loading"
            v-sortable-headers
          >
            <template v-slot:loading>
              <q-inner-loading showing color="primary" />
            </template>

            <template v-slot:no-data>
              <div
                v-if="!loading"
                class="full-width column flex-center q-gutter-sm q-py-md"
              >
                <template v-if="error">
                  <q-icon name="error_outline" color="negative" size="24px" />
                  <div>{{ error }}</div>
                  <q-btn
                    outline
                    dense
                    color="primary"
                    label="Retry"
                    @click="loadTemplates"
                  />
                </template>
                <EmptyState
                  v-else
                  icon="notifications"
                  title="No alert templates yet"
                  text="Create a template to choose who gets emails and SMS and which scripts or web hooks run on alerts."
                >
                  <q-btn
                    outline
                    no-caps
                    color="primary"
                    icon="add"
                    label="New template"
                    @click="addTemplate"
                  />
                </EmptyState>
              </div>
            </template>

            <template
              v-for="tip in headerTips"
              :key="tip.name"
              v-slot:[`header-cell-${tip.name}`]="props"
            >
              <q-th :props="props" :auto-width="tip.narrow">
                {{ tip.text ?? props.col.label }}
                <q-tooltip>{{ tip.tip }}</q-tooltip>
              </q-th>
            </template>
            <template v-slot:header-cell-rowactions="props">
              <q-th :props="props" auto-width>
                <span class="sr-only">{{ props.col.label }}</span>
              </q-th>
            </template>
            <template v-slot:body="props">
              <q-tr
                :props="props"
                class="cursor-pointer"
                :class="{ highlight: selected?.id === props.row.id }"
                @click="selected = props.row"
                @contextmenu="selected = props.row"
                @dblclick="editTemplate(props.row)"
              >
                <q-menu context-menu>
                  <q-list dense style="min-width: 220px">
                    <template v-for="item in menuItems" :key="item.icon">
                      <q-separator v-if="item.divider" />
                      <q-item
                        clickable
                        v-close-popup
                        :class="item.danger ? 'text-negative' : undefined"
                        @click="item.run(props.row)"
                      >
                        <q-item-section side>
                          <q-icon
                            :name="item.icon"
                            :color="item.danger ? 'negative' : undefined"
                          />
                        </q-item-section>
                        <q-item-section v-if="item.hint">
                          <q-item-label>{{ item.label }}</q-item-label>
                          <q-item-label caption>{{ item.hint }}</q-item-label>
                        </q-item-section>
                        <q-item-section v-else>{{ item.label }}</q-item-section>
                      </q-item>
                    </template>
                    <q-separator />
                    <q-item clickable v-close-popup>
                      <q-item-section>Close</q-item-section>
                    </q-item>
                  </q-list>
                </q-menu>
                <q-td>
                  <q-checkbox
                    dense
                    :model-value="props.row.is_active"
                    :disable="busyIds.includes(props.row.id)"
                    :aria-label="`Active for ${props.row.name}`"
                    @update:model-value="toggleActive(props.row)"
                  />
                </q-td>
                <q-td v-for="flag in settingFlags" :key="flag.key">
                  <template v-if="props.row[flag.key]">
                    <q-icon name="done" size="sm" class="rmm-muted">
                      <q-tooltip>{{ flag.tip }}</q-tooltip>
                    </q-icon>
                    <span class="sr-only">Yes</span>
                  </template>
                </q-td>
                <q-td>
                  <span class="text-weight-medium">{{ props.row.name }}</span>
                  <q-chip
                    v-if="props.row.default_template"
                    color="primary"
                    text-color="white"
                    size="sm"
                  >
                    Default
                    <q-tooltip>
                      Set in Global Settings; used when no policy, site or
                      client template applies
                    </q-tooltip>
                  </q-chip>
                </q-td>
                <q-td>
                  <a
                    href="#"
                    role="button"
                    class="rmm-link"
                    @click.prevent="showApplied(props.row)"
                    @keydown.space.prevent="showApplied(props.row)"
                  >
                    Show where template is applied ({{
                      props.row.applied_count
                    }})
                  </a>
                </q-td>
                <q-td>
                  <a
                    href="#"
                    role="button"
                    class="rmm-link"
                    @click.prevent="editExclusions(props.row)"
                    @keydown.space.prevent="editExclusions(props.row)"
                  >
                    {{ exclusionSummary(props.row) }}
                  </a>
                </q-td>
                <q-td>{{ props.row.action_name }}</q-td>
                <q-td>{{ props.row.resolved_action_name }}</q-td>
                <!-- same entries as the context menu -->
                <q-td @click.stop>
                  <RowActions :label="`Actions for ${props.row.name}`">
                    <q-list dense style="min-width: 220px">
                      <template v-for="item in menuItems" :key="item.icon">
                        <q-separator v-if="item.divider" />
                        <q-item
                          clickable
                          v-close-popup
                          :class="item.danger ? 'text-negative' : undefined"
                          @click="item.run(props.row)"
                        >
                          <q-item-section side>
                            <q-icon
                              :name="item.icon"
                              :color="item.danger ? 'negative' : undefined"
                            />
                          </q-item-section>
                          <q-item-section v-if="item.hint">
                            <q-item-label>{{ item.label }}</q-item-label>
                            <q-item-label caption>{{ item.hint }}</q-item-label>
                          </q-item-section>
                          <q-item-section v-else>{{
                            item.label
                          }}</q-item-section>
                        </q-item>
                      </template>
                    </q-list>
                  </RowActions>
                </q-td>
              </q-tr>
            </template>
          </q-table>
        </div>
      </q-card>
    </div>
  </q-dialog>
</template>

<script setup>
import axios from "axios";
import { useDialogPluginComponent, useQuasar } from "quasar";
import { onMounted, ref } from "vue";
import { useStore } from "vuex";
import DialogHeader from "@/components/ui/DialogHeader.vue";
import EmptyState from "@/components/ui/EmptyState.vue";
import HelpTip from "@/components/ui/HelpTip.vue";
import RowActions from "@/components/ui/RowActions.vue";
import { withStepUp } from "@/components/vault/stepUp";
import AlertExclusions from "@/components/modals/alerts/AlertExclusions.vue";
import AlertTemplateForm from "@/components/modals/alerts/AlertTemplateForm.vue";
import AlertTemplateRelated from "@/components/modals/alerts/AlertTemplateRelated.vue";
import { notifySuccess } from "@/utils/notify";
import { sortableHeaders as vSortableHeaders } from "@/utils/sortableHeaders";

defineOptions({ name: "AlertsManager" });
defineEmits([...useDialogPluginComponent.emits]);

const $q = useQuasar();
const store = useStore();
const { dialogRef, onDialogHide } = useDialogPluginComponent();

const templates = ref([]);
const selected = ref(null);
const loading = ref(false);
const error = ref("");
const busyIds = ref([]);
const pagination = ref({ rowsPerPage: 0, sortBy: "name", descending: false });

const tableProps = {
  class: "rmm-table",
  rowKey: "id",
  dense: true,
  virtualScroll: true,
  hidePagination: true,
  binaryStateSort: true,
  rowsPerPageOptions: [0],
};

const left = (name, label) => ({ name, label, field: name, align: "left" });
const columns = [
  left("is_active", "Active"),
  { name: "agent_settings", label: "Agent settings", field: "agent_settings" },
  { name: "check_settings", label: "Check settings", field: "check_settings" },
  { name: "task_settings", label: "Task settings", field: "task_settings" },
  left("name", "Name"),
  left("applied_to", "Applied to"),
  left("alert_exclusions", "Alert exclusions"),
  left("action_name", "Failure action"),
  left("resolved_action_name", "Resolved action"),
  { name: "rowactions", label: "Actions", align: "right", field: () => "" },
];

const headerTips = [
  {
    name: "is_active",
    narrow: true,
    tip: "Inactive templates are skipped for every agent",
  },
  {
    name: "agent_settings",
    narrow: true,
    text: "Agent",
    tip: "Has agent overdue alert settings",
  },
  {
    name: "check_settings",
    narrow: true,
    text: "Check",
    tip: "Has check alert settings",
  },
  {
    name: "task_settings",
    narrow: true,
    text: "Task",
    tip: "Has automated task alert settings",
  },
  {
    name: "action_name",
    narrow: false,
    tip: "Script or web hook that runs when an alert starts",
  },
  {
    name: "resolved_action_name",
    narrow: false,
    tip: "Script or web hook that runs when an alert resolves",
  },
];

const settingFlags = [
  {
    key: "agent_settings",
    tip: "Template changes agent overdue alert settings",
  },
  { key: "check_settings", tip: "Template changes check alert settings" },
  { key: "task_settings", tip: "Template changes task alert settings" },
];

function loadTemplates() {
  loading.value = true;
  error.value = "";
  axios
    .get("alerts/templates/")
    .then(({ data }) => {
      templates.value = data;
    })
    .catch((err) => {
      error.value =
        err?.response?.status === 403
          ? "Your role cannot view alert templates."
          : "Alert templates could not be loaded.";
    })
    .finally(() => {
      loading.value = false;
    });
}

function reload() {
  store.dispatch("refreshDashboard");
  loadTemplates();
  selected.value = null;
}

function openModal(component, componentProps) {
  $q.dialog({ component, componentProps }).onOk(reload);
}

function addTemplate() {
  selected.value = null;
  openModal(AlertTemplateForm);
}
const editTemplate = (template) =>
  openModal(AlertTemplateForm, { alertTemplate: template });
const editExclusions = (template) => openModal(AlertExclusions, { template });
const showApplied = (template) =>
  $q.dialog({ component: AlertTemplateRelated, componentProps: { template } });

function removeTemplate(template) {
  $q.dialog({
    ok: { label: "Delete", color: "negative" },
    title: `Delete alert template ${template.name}?`,
    cancel: true,
  }).onOk(async () => {
    const url = `alerts/templates/${template.id}/`;
    $q.loading.show();
    try {
      await axios.delete(url);
      reload();
      notifySuccess(`Alert template ${template.name} was deleted!`);
    } catch {
      // the interceptor reports the failure
    } finally {
      $q.loading.hide();
    }
  });
}

const menuItems = [
  { icon: "edit", label: "Edit", run: editTemplate },
  {
    icon: "rule",
    label: "Alert exclusions",
    hint: "Agents, sites or clients it skips",
    run: editExclusions,
  },
  {
    icon: "delete",
    label: "Delete",
    danger: true,
    divider: true,
    run: removeTemplate,
  },
];

function toggleActive(template) {
  const next = !template.is_active;
  busyIds.value.push(template.id);
  withStepUp($q, (config) =>
    axios.put(
      `alerts/templates/${template.id}/`,
      { id: template.id, is_active: next },
      config,
    ),
  )
    .then((r) => {
      if (r === null) return;
      // show the confirmed state now; the reload swaps in the server's row
      template.is_active = next;
      notifySuccess(
        next
          ? "Template enabled successfully"
          : "Template disabled successfully",
      );
      store.dispatch("refreshDashboard");
      loadTemplates();
    })
    .finally(() => {
      busyIds.value = busyIds.value.filter((id) => id !== template.id);
    });
}

function exclusionSummary(t) {
  const groups = [
    ["Workstations", t.exclude_workstations],
    ["Servers", t.exclude_servers],
  ].filter(([, on]) => on);
  const count =
    t.excluded_agents.length +
    t.excluded_clients.length +
    t.excluded_sites.length +
    groups.length;
  const extra = groups.length
    ? `, +${groups.map(([name]) => name).join(", ")}`
    : "";
  return `Alert exclusions (${count}${extra})`;
}

onMounted(loadTemplates);
</script>
