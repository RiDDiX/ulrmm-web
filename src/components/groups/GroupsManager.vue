<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-dialog
    ref="dialogRef"
    aria-labelledby="groups-manager-title"
    @hide="onDialogHide"
  >
    <q-card class="q-dialog-plugin" style="width: 90vw; max-width: 1200px">
      <DialogHeader
        title-id="groups-manager-title"
        title="Device groups"
        subtitle="Groups and tags filter the device list and target bulk actions"
      >
        <template #actions>
          <q-btn
            dense
            flat
            icon="refresh"
            aria-label="Reload groups and tags"
            @click="load"
          >
            <q-tooltip>Reload groups and tags</q-tooltip>
          </q-btn>
        </template>
      </DialogHeader>
      <q-tabs
        v-model="tab"
        align="left"
        :inline-label="true"
        indicator-color="primary"
        active-color="primary"
        no-caps
        :dense="true"
        class="q-px-sm"
      >
        <q-tab
          name="groups"
          icon="workspaces"
          :label="`Groups (${groups.length})`"
        />
        <q-tab name="tags" icon="sell" :label="`Tags (${tags.length})`" />
      </q-tabs>
      <q-separator />
      <q-tab-panels v-model="tab" animated class="groups-manager__panels">
        <q-tab-panel name="groups" class="q-pa-sm">
          <q-table
            dense
            flat
            class="rmm-table"
            row-key="id"
            :rows="groups"
            :columns="columns"
            :virtual-scroll="true"
            hide-pagination
            :loading="loading"
            :pagination="{ rowsPerPage: 0 }"
            :style="{ maxHeight: '60vh' }"
          >
            <template #top>
              <div class="rmm-toolbar full-width">
                <q-btn
                  label="New group"
                  dense
                  unelevated
                  no-caps
                  color="primary"
                  icon="add"
                  class="q-pl-sm q-pr-md"
                  @click="editGroup(null)"
                />
              </div>
            </template>
            <template #no-data>
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
                    @click="load"
                  />
                </template>
                <EmptyState
                  v-else
                  class="full-width"
                  icon="workspaces"
                  title="No device groups yet"
                  text="A dynamic group collects devices by rules, for example every Linux server tagged web. A static group holds the devices you pick."
                >
                  <q-btn
                    dense
                    outline
                    no-caps
                    color="primary"
                    icon="add"
                    label="New group"
                    class="q-pl-sm q-pr-md"
                    @click="editGroup(null)"
                  />
                </EmptyState>
              </div>
            </template>
            <template #body-cell-name="props">
              <q-td :props="props">
                <div class="text-weight-medium">{{ props.row.name }}</div>
                <div
                  v-if="props.row.description"
                  class="rmm-muted text-caption groups-manager__clamp"
                >
                  {{ props.row.description }}
                </div>
              </q-td>
            </template>
            <template #body-cell-kind="props">
              <q-td :props="props">
                <span
                  class="rmm-pill"
                  :class="
                    props.row.kind === 'dynamic'
                      ? 'rmm-pill--info'
                      : 'rmm-pill--neutral'
                  "
                  >{{
                    props.row.kind === "dynamic" ? "Dynamic" : "Static"
                  }}</span
                >
              </q-td>
            </template>
            <template #body-cell-rules="props">
              <q-td :props="props">
                <span class="groups-manager__clamp">{{ props.value }}</span>
              </q-td>
            </template>
            <template #body-cell-actions="props">
              <q-td :props="props" auto-width>
                <q-btn
                  dense
                  flat
                  round
                  size="sm"
                  icon="edit"
                  :aria-label="`Edit ${props.row.name}`"
                  @click="editGroup(props.row)"
                >
                  <q-tooltip>Edit this group</q-tooltip>
                </q-btn>
                <q-btn
                  dense
                  flat
                  round
                  size="sm"
                  icon="delete"
                  color="negative"
                  :aria-label="`Delete ${props.row.name}`"
                  @click="deleteGroup(props.row)"
                >
                  <q-tooltip>Delete this group; its devices stay</q-tooltip>
                </q-btn>
              </q-td>
            </template>
          </q-table>
        </q-tab-panel>

        <q-tab-panel name="tags" class="q-pa-md">
          <q-form class="tag-form" @submit="submitTag">
            <q-input
              ref="tagNameInput"
              v-model="tagForm.name"
              :label="tagForm.id ? 'Tag name' : 'New tag'"
              :maxlength="TAG_NAME_MAX"
              dense
              outlined
              class="tag-form__name"
              :rules="[(v) => tagNameError(v, tags, tagForm.id) || true]"
              lazy-rules="ondemand"
            />
            <label class="tag-form__color">
              <span class="rmm-label">Color</span>
              <input v-model="tagForm.color" type="color" />
            </label>
            <TagChip
              :tag="{
                id: 0,
                name: tagForm.name.trim() || 'Preview',
                color: tagForm.color,
              }"
            />
            <q-btn
              v-if="tagForm.id"
              flat
              no-caps
              label="Cancel"
              @click="resetTagForm"
            />
            <q-btn
              unelevated
              no-caps
              color="primary"
              :icon="tagForm.id ? undefined : 'add'"
              :label="tagForm.id ? 'Save tag' : 'Add tag'"
              type="submit"
              :loading="tagSaving"
            />
          </q-form>
          <q-list v-if="tags.length" separator class="tag-list rmm-card">
            <q-item v-for="tag in tags" :key="tag.id">
              <q-item-section>
                <span><TagChip :tag="tag" /></span>
              </q-item-section>
              <q-item-section side class="row no-wrap">
                <div>
                  <q-btn
                    dense
                    flat
                    round
                    size="sm"
                    icon="edit"
                    :aria-label="`Edit tag ${tag.name}`"
                    @click="editTag(tag)"
                  >
                    <q-tooltip>Rename or recolor this tag</q-tooltip>
                  </q-btn>
                  <q-btn
                    dense
                    flat
                    round
                    size="sm"
                    icon="delete"
                    color="negative"
                    :aria-label="`Delete tag ${tag.name}`"
                    @click="deleteTag(tag)"
                  >
                    <q-tooltip>Delete this tag from every device</q-tooltip>
                  </q-btn>
                </div>
              </q-item-section>
            </q-item>
          </q-list>
          <EmptyState
            v-else-if="!loading"
            icon="sell"
            title="No tags yet"
            text="Add one here, or from a device's menu with Edit tags."
          />
        </q-tab-panel>
      </q-tab-panels>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import { useDialogPluginComponent, useQuasar } from "quasar";
import DialogHeader from "@/components/ui/DialogHeader.vue";
import EmptyState from "@/components/ui/EmptyState.vue";
import GroupForm from "@/components/groups/GroupForm.vue";
import TagChip from "@/components/groups/TagChip.vue";
import {
  fetchGroups,
  fetchTags,
  removeGroup,
  removeTag,
  saveTag,
} from "@/api/groups";
import { fetchClients } from "@/api/clients";
import { fetchCustomFields } from "@/api/core";
import { formatClientOptions, formatSiteOptions } from "@/utils/format";
import {
  TAG_COLORS,
  TAG_NAME_MAX,
  rulesSummary,
  tagNameError,
} from "@/utils/groupRules";
import { notifySuccess } from "@/utils/notify";

const props = defineProps({
  // "groups" or "tags"
  initialTab: { type: String, default: "groups" },
});
defineEmits([...useDialogPluginComponent.emits]);
const { dialogRef, onDialogHide } = useDialogPluginComponent();
const $q = useQuasar();

const tab = ref(props.initialTab);
const groups = ref([]);
const tags = ref([]);
const clients = ref([]);
const customFields = ref([]);
const loading = ref(false);
const error = ref("");

const lookups = computed(() => ({
  clientOptions: formatClientOptions(clients.value),
  siteOptions: formatSiteOptions(clients.value),
  tags: tags.value,
  customFields: customFields.value,
}));

const names = computed(() => {
  const byId = (rows) => Object.fromEntries(rows.map((r) => [r.id, r.name]));
  return {
    client: byId(clients.value),
    site: byId(clients.value.flatMap((c) => c.sites || [])),
    tag: byId(tags.value),
    custom_field: byId(customFields.value),
  };
});

const columns = [
  { name: "name", label: "Name", field: "name", align: "left", sortable: true },
  { name: "kind", label: "Kind", field: "kind", align: "left", sortable: true },
  {
    name: "rules",
    label: "Members",
    field: (g) =>
      g.kind === "dynamic"
        ? rulesSummary(g.rules, names.value)
        : "Picked devices",
    align: "left",
  },
  {
    name: "count",
    label: "Devices",
    field: "count",
    align: "right",
    sortable: true,
  },
  { name: "actions", label: "", field: "id", align: "right" },
];

async function load() {
  loading.value = true;
  error.value = "";
  const [g, t, c, cf] = await Promise.allSettled([
    fetchGroups(),
    fetchTags(),
    fetchClients(),
    fetchCustomFields({ model: "agent" }),
  ]);
  if (g.status === "rejected" || t.status === "rejected") {
    error.value =
      g.reason?.response?.status === 403
        ? "Your role cannot view device groups."
        : "The groups could not be loaded.";
  }
  groups.value = g.value || [];
  tags.value = t.value || [];
  // a role without clients or custom fields still edits the other rules
  clients.value = c.value || [];
  customFields.value = (cf.value || []).filter((f) => f.model === "agent");
  loading.value = false;
}

function editGroup(group) {
  $q.dialog({
    component: GroupForm,
    componentProps: { group, lookups: lookups.value },
  }).onOk(load);
}

function deleteGroup(group) {
  $q.dialog({
    title: `Delete ${group.name}?`,
    message:
      "The group goes away; its devices, their tags and any running action stay.",
    cancel: { label: "Cancel", flat: true },
    ok: { label: "Delete", color: "negative", unelevated: true },
  }).onOk(async () => {
    try {
      notifySuccess(await removeGroup(group.id));
    } catch {
      // error toast from axios boot
    }
    load();
  });
}

const tagForm = reactive({ id: null, name: "", color: TAG_COLORS[0] });
const tagSaving = ref(false);
const tagNameInput = ref(null);

function resetTagForm() {
  tagForm.id = null;
  tagForm.name = "";
  tagForm.color = TAG_COLORS[tags.value.length % TAG_COLORS.length];
  tagNameInput.value?.resetValidation();
}

function editTag(tag) {
  tagForm.id = tag.id;
  tagForm.name = tag.name;
  tagForm.color = tag.color;
  tagNameInput.value?.focus();
}

async function submitTag() {
  if (!(await tagNameInput.value.validate())) return;
  tagSaving.value = true;
  try {
    const payload = { name: tagForm.name.trim(), color: tagForm.color };
    await saveTag(tagForm.id, payload);
    notifySuccess(`${payload.name} was saved`);
    tags.value = await fetchTags();
    resetTagForm();
  } catch {
    // error toast from axios boot
  }
  tagSaving.value = false;
}

function deleteTag(tag) {
  $q.dialog({
    title: `Delete tag ${tag.name}?`,
    message:
      "It is removed from every device. Dynamic groups with a condition on this tag stop matching it.",
    cancel: { label: "Cancel", flat: true },
    ok: { label: "Delete", color: "negative", unelevated: true },
  }).onOk(async () => {
    try {
      notifySuccess(await removeTag(tag.id));
    } catch {
      // error toast from axios boot
    }
    if (tagForm.id === tag.id) resetTagForm();
    load();
  });
}

onMounted(load);
</script>

<style scoped>
.groups-manager__panels {
  min-height: 60vh;
}

.groups-manager__clamp {
  display: -webkit-box;
  overflow: hidden;
  max-width: 520px;
  white-space: normal;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
}

.tag-form {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 16px;
}

.tag-form__name {
  width: 260px;
}

.tag-form__color {
  display: flex;
  height: 40px;
  align-items: center;
  gap: 8px;
}

.tag-form__color input {
  width: 40px;
  height: 32px;
  padding: 2px;
  border: 1px solid var(--rmm-input-border);
  border-radius: var(--rmm-radius-sm);
  background: var(--rmm-surface);
  cursor: pointer;
}

.tag-form > .tag-chip {
  margin-top: 9px;
}

.tag-list {
  max-width: 640px;
}
</style>
