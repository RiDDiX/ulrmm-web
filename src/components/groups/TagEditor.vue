<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-dialog
    ref="dialogRef"
    aria-labelledby="tag-editor-title"
    @hide="onDialogHide"
  >
    <q-card class="q-dialog-plugin rmm-dialog--sm">
      <DialogHeader
        title-id="tag-editor-title"
        :title="`Tags of ${deviceName(agent)}`"
        subtitle="Tags filter the device list and can be used in dynamic groups"
      />
      <q-form @submit="save">
        <q-card-section class="q-gutter-y-md">
          <div>
            <div id="tag-editor-current" class="rmm-label q-mb-xs">
              Assigned tags
            </div>
            <div
              v-if="selected.length"
              class="tag-editor__chips"
              role="list"
              aria-labelledby="tag-editor-current"
            >
              <span v-for="tag in selected" :key="tag.id" role="listitem">
                <TagChip :tag="tag" removable @remove="remove" />
              </span>
            </div>
            <div v-else class="rmm-muted">No tags on this device.</div>
          </div>
          <q-select
            :model-value="null"
            :options="options"
            option-value="id"
            option-label="name"
            label="Add a tag"
            hint="Pick a tag, or type a new name and press Enter to create it"
            outlined
            dense
            options-dense
            use-input
            input-debounce="0"
            :maxlength="TAG_NAME_MAX"
            :loading="loading || creating"
            :error="!!createError"
            :error-message="createError"
            @filter="filter"
            @new-value="create"
            @update:model-value="add"
            @input-value="createError = ''"
          >
            <template #option="scope">
              <q-item v-bind="scope.itemProps">
                <q-item-section>
                  <span><TagChip :tag="scope.opt" /></span>
                </q-item-section>
              </q-item>
            </template>
            <template #no-option>
              <q-item>
                <q-item-section class="rmm-muted">
                  {{
                    needle
                      ? "Press Enter to create this tag"
                      : "No more tags. Type a name to create one"
                  }}
                </q-item-section>
              </q-item>
            </template>
          </q-select>
          <div v-if="loadError" class="text-negative" role="alert">
            {{ loadError }}
          </div>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn v-close-popup flat label="Cancel" />
          <q-btn
            type="submit"
            label="Save"
            color="primary"
            :unelevated="true"
            :loading="saving"
            :disable="loading || !!loadError"
          />
        </q-card-actions>
      </q-form>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { computed, onMounted, ref } from "vue";
import { useDialogPluginComponent } from "quasar";
import DialogHeader from "@/components/ui/DialogHeader.vue";
import TagChip from "@/components/groups/TagChip.vue";
import { fetchTags, saveTag, setAgentTags } from "@/api/groups";
import { TAG_COLORS, TAG_NAME_MAX, tagNameError } from "@/utils/groupRules";
import { deviceName } from "@/utils/deviceName";
import { notifySuccess } from "@/utils/notify";

const props = defineProps({
  // a table row: agent_id, hostname, tags
  agent: { type: Object, required: true },
});
defineEmits([...useDialogPluginComponent.emits]);
const { dialogRef, onDialogHide, onDialogOK } = useDialogPluginComponent();

const tags = ref([]);
const selected = ref([...(props.agent.tags || [])]);
const needle = ref("");
const loading = ref(false);
const loadError = ref("");
const creating = ref(false);
const createError = ref("");
const saving = ref(false);

const options = computed(() => {
  const taken = new Set(selected.value.map((t) => t.id));
  const text = needle.value.toLowerCase();
  return tags.value.filter(
    (t) => !taken.has(t.id) && t.name.toLowerCase().includes(text),
  );
});

function filter(value, update) {
  update(() => (needle.value = value.trim()));
}

function add(tag) {
  if (tag && !selected.value.some((t) => t.id === tag.id))
    selected.value = [...selected.value, tag];
}

function remove(tag) {
  selected.value = selected.value.filter((t) => t.id !== tag.id);
}

async function create(value, done) {
  const name = value.trim();
  const existing = tags.value.find(
    (t) => t.name.toLowerCase() === name.toLowerCase(),
  );
  if (existing) {
    add(existing);
    done();
    return;
  }
  createError.value = tagNameError(name, tags.value);
  if (createError.value) return;
  creating.value = true;
  try {
    const color = TAG_COLORS[tags.value.length % TAG_COLORS.length];
    const tag = await saveTag(null, { name, color });
    tags.value = [...tags.value, tag];
    add(tag);
    done();
  } catch {
    // the error toast comes from the axios boot
  }
  creating.value = false;
}

async function load() {
  loading.value = true;
  loadError.value = "";
  try {
    tags.value = await fetchTags();
  } catch (e) {
    loadError.value =
      e.response?.status === 403
        ? "Your role cannot list tags."
        : "The tags could not be loaded.";
  }
  loading.value = false;
}

async function save() {
  saving.value = true;
  try {
    await setAgentTags(
      props.agent.agent_id,
      selected.value.map((t) => t.id),
    );
    notifySuccess(`Tags of ${deviceName(props.agent)} were saved`);
    // no payload. onOk is refreshDashboard; that argument is clearTreeSelected
    onDialogOK();
  } catch {
    // the error toast comes from the axios boot
  }
  saving.value = false;
}

onMounted(load);
</script>

<style scoped>
.tag-editor__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
</style>
