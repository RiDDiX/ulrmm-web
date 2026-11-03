<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-card flat class="rmm-card">
    <div class="rmm-card__header">
      <div class="rmm-card__title">Agent fleet</div>
    </div>
    <div class="rmm-card__body">
      <div v-if="loading" aria-busy="true">
        <q-skeleton height="36px" />
      </div>
      <template v-else>
        <p class="af-line" role="status">
          <q-icon
            :name="outdated.length ? 'update' : 'check_circle'"
            :color="outdated.length ? 'warning' : 'positive'"
            size="20px"
          />
          <span v-if="latest">
            {{ outdated.length }} of {{ total }} agents below
            <span class="af-mono">{{ latest }}</span
            ><template v-if="unknown">, {{ unknown }} unknown</template>
          </span>
          <span v-else>The agent list could not be loaded.</span>
        </p>
        <q-btn
          unelevated
          no-caps
          color="primary"
          icon="system_update"
          label="Update outdated agents"
          :disable="!outdated.length"
          :loading="sending"
          @click="update"
        />
      </template>
    </div>
  </q-card>
</template>

<script setup lang="ts">
import axios from "axios";
import { computed, onMounted, ref } from "vue";
import { isNewer } from "@/utils/helpers";
import { notifyError, notifySuccess } from "@/utils/notify";

interface AgentRow {
  agent_id: string;
  version?: string;
}

const loading = ref(true);
const sending = ref(false);
const latest = ref("");
const agents = ref<AgentRow[]>([]);

const total = computed(() => agents.value.length);
// the server only sends the update to agents that are really older
const outdated = computed(() =>
  agents.value.filter((a) => a.version && isNewer(latest.value, a.version)),
);
// no version reported yet: not outdated, not current
const unknown = computed(() => agents.value.filter((a) => !a.version).length);

async function load() {
  loading.value = true;
  try {
    const { data } = await axios.get<{
      versions: string[];
      agents: AgentRow[];
    }>("/agents/versions/", { silent: true } as never);
    latest.value = data.versions[0] || "";
    agents.value = data.agents;
  } catch {
    latest.value = "";
    agents.value = [];
  } finally {
    loading.value = false;
  }
}

async function update() {
  sending.value = true;
  try {
    const { data } = await axios.post<string>("/agents/update/", {
      agent_ids: outdated.value.map((a) => a.agent_id),
    });
    notifySuccess(
      typeof data === "string" && data !== "ok"
        ? data
        : "Outdated agents will be updated shortly",
    );
  } catch {
    notifyError("The agent update could not be started.");
  } finally {
    sending.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.af-line {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 12px;
}
.af-mono {
  font-family: var(--rmm-mono);
}
</style>
