<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <div v-if="schedules.length || failed" class="col-12 col-sm-6 col-md-4">
    <q-card flat class="rmm-card detail-card">
      <div class="rmm-card__header">
        <div class="rmm-card__title">Maintenance &amp; power</div>
        <HelpTip
          text="Maintenance windows and sleep or wake schedules for this agent, with next and last run"
        />
      </div>
      <div v-if="failed" class="rmm-card__body rmm-muted">
        The schedules could not be loaded.
      </div>
      <div v-else class="rmm-card__body rmm-kv">
        <template v-for="s in schedules" :key="s.id">
          <span>{{ s.name }}</span>
          <span>
            <span class="rmm-muted">{{ KIND_LABELS[s.kind] || s.kind }}</span
            ><template v-if="!s.enabled">, disabled</template
            ><template v-else-if="s.next_runs.length"
              >, next
              {{ formatRun(s.next_runs[0].start, s.timezone) }}</template
            >
            <span v-if="s.last_run" class="summary-list-item">
              Last run
              <span
                class="rmm-pill"
                :class="runStateMeta(s.last_run.state).cls"
                >{{ runStateMeta(s.last_run.state).label }}</span
              >
              <span class="rmm-muted">
                {{ formatRun(s.last_run.occurrence, s.timezone) }}</span
              >
              <span v-if="s.last_run.detail" class="rmm-muted"
                >, {{ s.last_run.detail }}</span
              >
            </span>
          </span>
        </template>
      </div>
    </q-card>
  </div>
</template>

<script setup>
import { ref, watch } from "vue";
import { fetchAgentSchedules } from "@/api/maintenance";
import { KIND_LABELS, formatRun, runStateMeta } from "@/utils/maintenance";
import HelpTip from "@/components/ui/HelpTip.vue";

const props = defineProps({
  agentId: { type: String, required: true },
});

const schedules = ref([]);
const failed = ref(false);

watch(
  () => props.agentId,
  async (agentId) => {
    failed.value = false;
    try {
      const data = await fetchAgentSchedules(agentId);
      if (agentId === props.agentId) schedules.value = data;
    } catch (e) {
      schedules.value = [];
      // no List Agents role => no card
      failed.value = e?.response?.status !== 403;
    }
  },
  { immediate: true },
);
</script>

<style scoped>
.detail-card {
  height: 100%;
}

.rmm-kv > span {
  min-width: 0;
  overflow-wrap: anywhere;
}

.summary-list-item {
  display: block;
  margin-top: 4px;
}
</style>
