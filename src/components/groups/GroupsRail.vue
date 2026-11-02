<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <section class="groups-rail" aria-label="Device groups and tags">
    <div class="rmm-card__header groups-rail__header">
      <q-icon name="workspaces" class="rmm-muted" size="18px" />
      <span id="groups-rail-title" class="rmm-card__title">Groups</span>
      <q-space />
      <q-btn
        flat
        dense
        round
        size="sm"
        icon="tune"
        aria-label="Manage device groups and tags"
        @click="manage('groups')"
      >
        <q-tooltip>Manage device groups and tags</q-tooltip>
      </q-btn>
    </div>
    <q-list dense class="groups-rail__list" aria-labelledby="groups-rail-title">
      <div v-if="error" class="groups-rail__note">
        {{ error }}
        <q-btn
          flat
          dense
          no-caps
          color="primary"
          label="Retry"
          @click="load()"
        />
      </div>
      <div v-else-if="loaded && !groups.length" class="groups-rail__note">
        <span class="rmm-muted">No groups yet.</span>
        <q-btn
          flat
          dense
          no-caps
          color="primary"
          label="New group"
          @click="manage('groups')"
        />
      </div>
      <q-item
        v-for="g in groups"
        :key="g.id"
        clickable
        role="button"
        :aria-pressed="group?.id === g.id"
        :active="group?.id === g.id"
        active-class="groups-rail__active"
        @click="toggleGroup(g)"
      >
        <q-item-section avatar>
          <q-icon
            :name="g.kind === 'dynamic' ? 'auto_awesome' : 'folder_special'"
            size="16px"
            class="groups-rail__icon"
          />
        </q-item-section>
        <q-item-section class="groups-rail__name">{{ g.name }}</q-item-section>
        <q-item-section side>
          <q-spinner v-if="pending === g.id" size="14px" />
          <span v-else class="rmm-num groups-rail__count">{{ g.count }}</span>
        </q-item-section>
        <q-tooltip :delay="600">
          {{ g.kind === "dynamic" ? "Dynamic" : "Static" }} group,
          {{ g.count }} {{ g.count === 1 ? "device" : "devices" }} in all
          clients. Click to show only its members.
        </q-tooltip>
      </q-item>
    </q-list>
    <div class="rmm-card__header groups-rail__header">
      <q-icon name="sell" class="rmm-muted" size="18px" />
      <span id="tags-rail-title" class="rmm-card__title">Tags</span>
    </div>
    <div
      class="groups-rail__tags"
      role="group"
      aria-labelledby="tags-rail-title"
    >
      <TagChip
        v-for="t in tags"
        :key="t.id"
        :tag="t"
        clickable
        :active="tag?.id === t.id"
        :count="tagCounts[t.id] || 0"
        @click="toggleTag"
      />
      <span v-if="loaded && !tags.length && !error" class="rmm-muted">
        No tags yet. Add them from a device's menu with Edit tags.
      </span>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, ref, watch } from "vue";
import { useQuasar } from "quasar";
import { useStore } from "vuex";
import TagChip from "@/components/groups/TagChip.vue";
import GroupsManager from "@/components/groups/GroupsManager.vue";
import { fetchGroupAgents, fetchGroups, fetchTags } from "@/api/groups";
import { SILENT_REQUEST_CONFIG } from "@/constants/constants";

const props = defineProps({
  // {id, name, members: Set of agent_id} or null
  group: { type: Object, default: null },
  // {id, name, color} or null
  tag: { type: Object, default: null },
});
const emit = defineEmits(["update:group", "update:tag"]);
const $q = useQuasar();
const store = useStore();

const groups = ref([]);
const tags = ref([]);
const loaded = ref(false);
const error = ref("");
const pending = ref(null);

// devices per tag in the loaded list, so the count is what a click shows
const tagCounts = computed(() => {
  const counts = {};
  for (const agent of store.state.agents)
    for (const t of agent.tags || []) counts[t.id] = (counts[t.id] || 0) + 1;
  return counts;
});

async function load(silent = false) {
  const config = silent ? SILENT_REQUEST_CONFIG : {};
  try {
    const [g, t] = await Promise.all([fetchGroups(config), fetchTags(config)]);
    groups.value = g;
    tags.value = t;
    error.value = "";
  } catch (e) {
    if (!silent)
      error.value =
        e.response?.status === 403
          ? "Your role cannot view groups."
          : "Groups could not be loaded.";
    return;
  } finally {
    loaded.value = true;
  }
  // a deleted group or tag stops filtering; a renamed one keeps going
  if (props.tag)
    emit("update:tag", tags.value.find((t) => t.id === props.tag.id) || null);
  if (props.group && !groups.value.some((g) => g.id === props.group.id))
    emit("update:group", null);
}

// the light agent list is enough for the ids
async function withMembers(group, config = {}) {
  const rows = await fetchGroupAgents(group.id, {
    ...config,
    params: { detail: false },
  });
  return {
    id: group.id,
    name: group.name,
    members: new Set(rows.map((r) => r.agent_id)),
  };
}

async function toggleGroup(g) {
  if (props.group?.id === g.id) {
    emit("update:group", null);
    return;
  }
  pending.value = g.id;
  try {
    const group = await withMembers(g);
    // a later click wins
    if (pending.value === g.id) emit("update:group", group);
  } catch {
    // the error toast comes from the axios boot
  }
  if (pending.value === g.id) pending.value = null;
}

function toggleTag(t) {
  emit("update:tag", props.tag?.id === t.id ? null : t);
}

// every reload of the device list (the 30 s refresh, after an edit)
// refreshes the groups and the members of the selected one
watch(
  () => store.state.agents,
  async () => {
    await load(true);
    const selected = groups.value.find((g) => g.id === props.group?.id);
    if (!selected) return;
    try {
      const group = await withMembers(selected, SILENT_REQUEST_CONFIG);
      // unless the user cleared or switched the group meanwhile
      if (props.group?.id === group.id) emit("update:group", group);
    } catch {
      // kept until the next refresh
    }
  },
);

function manage(initialTab) {
  $q.dialog({ component: GroupsManager, componentProps: { initialTab } })
    // tags may have changed on devices too
    .onDismiss(() => store.dispatch("loadAgents", { silent: true }));
}

onMounted(load);
</script>

<style scoped>
.groups-rail__header {
  border-top: 1px solid var(--rmm-border);
}

.groups-rail__list {
  padding: 6px;
}

.groups-rail__list :deep(.q-item) {
  min-height: 32px;
  padding: 2px 8px;
  border-radius: var(--rmm-radius-sm);
}

.groups-rail__list :deep(.q-item__section--avatar) {
  min-width: 0;
  padding-right: 7px;
}

.groups-rail__icon {
  color: var(--rmm-text-subtle);
}

.groups-rail__name {
  overflow: hidden;
  min-width: 0;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.groups-rail__count {
  color: var(--rmm-text-muted);
  font-weight: 500;
}

.groups-rail__active,
.groups-rail__active .groups-rail__icon,
.groups-rail__active .groups-rail__count {
  color: var(--rmm-accent-text);
}

.groups-rail__active {
  background: var(--rmm-accent-soft);
}

.groups-rail__note {
  padding: 4px 8px;
  font-size: var(--rmm-fs-xs);
}

.groups-rail__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 10px 12px 14px;
  font-size: var(--rmm-fs-xs);
}
</style>
