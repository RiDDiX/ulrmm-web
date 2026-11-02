<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <div v-if="!denied" class="col-12 col-sm-6 col-md-4">
    <q-card flat class="rmm-card detail-card">
      <div class="rmm-card__header">
        <div class="rmm-card__title">Actions</div>
        <HelpTip
          text="Queued reboots, agent updates, installs and scripts for this device, and the latest completed ones"
        />
        <q-space />
        <a
          href="#"
          role="button"
          class="rmm-link"
          @click.prevent="emit('show')"
          @keydown.space.prevent="emit('show')"
          >Show all</a
        >
      </div>
      <div v-if="failed" class="rmm-card__body rmm-muted">
        The actions could not be loaded.
      </div>
      <div v-else class="rmm-card__body">
        <div v-for="list in lists" :key="list.title" class="actions-list">
          <div class="actions-list__title rmm-muted">{{ list.title }}</div>
          <div v-if="!list.rows.length" class="rmm-muted">{{ list.empty }}</div>
          <div v-for="a in list.rows" :key="a.id" class="actions-list__row">
            <span class="actions-list__desc">{{ a.description }}</span>
            <span class="rmm-muted" :title="formatDate(a.entry_time)">{{
              relativeTime(a.entry_time)
            }}</span>
          </div>
        </div>
      </div>
    </q-card>
  </div>
</template>

<script setup>
import { computed, ref, watch } from "vue";
import { useStore } from "vuex";
import { fetchAgentPendingActions } from "@/api/logs";
import { SILENT_REQUEST_CONFIG } from "@/constants/constants";
import { relativeTime } from "@/utils/format";
import HelpTip from "@/components/ui/HelpTip.vue";

const props = defineProps({
  agentId: { type: String, required: true },
  // bumped by the summary tab after a reload
  tick: { type: Number, default: 0 },
});
// count: pending actions, for the header pill
const emit = defineEmits(["count", "show"]);

const store = useStore();
const formatDate = (v) => store.getters.formatDate(v);

const SHOWN = 5;
const actions = ref([]);
const failed = ref(false);
// no pending actions permission => no card
const denied = ref(false);
let seq = 0;

const lists = computed(() => [
  {
    title: "Pending",
    rows: actions.value.filter((a) => a.status === "pending").slice(0, SHOWN),
    empty: "Nothing pending.",
  },
  {
    title: "Completed",
    rows: actions.value
      .filter((a) => a.status === "completed")
      .sort((a, b) => (a.entry_time < b.entry_time ? 1 : -1))
      .slice(0, SHOWN),
    empty: "Nothing completed yet.",
  },
]);

watch(
  () => [props.agentId, props.tick],
  async ([agentId], [oldId] = []) => {
    const mine = ++seq;
    if (agentId !== oldId) actions.value = [];
    try {
      const data = await fetchAgentPendingActions(
        agentId,
        SILENT_REQUEST_CONFIG,
      );
      if (mine !== seq) return;
      actions.value = Array.isArray(data) ? data : [];
      failed.value = false;
      denied.value = false;
    } catch (e) {
      if (mine !== seq) return;
      denied.value = e?.response?.status === 403;
      failed.value = !denied.value;
      actions.value = [];
    }
    emit("count", actions.value.filter((a) => a.status === "pending").length);
  },
  { immediate: true },
);
</script>

<style scoped>
.detail-card {
  height: 100%;
}

.actions-list + .actions-list {
  margin-top: 10px;
}

.actions-list__title {
  margin-bottom: 4px;
  font-size: var(--rmm-fs-xs);
  font-weight: 600;
}

.actions-list__row {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  padding: 3px 0;
}

.actions-list__desc {
  min-width: 0;
  overflow-wrap: anywhere;
}

.actions-list__row > .rmm-muted {
  flex-shrink: 0;
  white-space: nowrap;
}
</style>
