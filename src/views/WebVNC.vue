<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <div>
    <AgentIdentityBar
      :hostname="identity.hostname"
      :client="identity.client"
      :site="identity.site"
      tool="VNC"
    />
    <div class="q-video" :style="{ height: `${$q.screen.height - 66}px` }">
      <EmptyState
        v-if="failure"
        icon="error_outline"
        title="Could not open the VNC session"
        :text="failure"
      >
        <q-btn
          outline
          no-caps
          color="primary"
          icon="refresh"
          label="Retry"
          @click="loadSession"
        />
      </EmptyState>
      <div v-else-if="!sessionUrl" class="web-vnc__status" role="status">
        <q-spinner size="24px" color="primary" />
        <span>Opening the VNC session...</span>
      </div>
      <iframe
        v-show="sessionUrl"
        :src="sessionUrl"
        frameborder="0"
        allowfullscreen
        title="VNC session"
        allow="clipboard-read; clipboard-write"
      ></iframe>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import { useQuasar, useMeta } from "quasar";

import { fetchAgent, fetchAgentWebVNCUrl, meshFailure } from "@/api/agents";
import AgentIdentityBar from "@/components/ui/AgentIdentityBar.vue";
import EmptyState from "@/components/ui/EmptyState.vue";
import { deviceName } from "@/utils/deviceName";

const route = useRoute();
const $q = useQuasar();
const sessionUrl = ref("");
const failure = ref("");
const identity = ref({ hostname: "", client: "", site: "" });

async function loadSession() {
  const { agent_id, port } = route.params;
  failure.value = "";
  try {
    const data = await fetchAgentWebVNCUrl(agent_id, port);
    const hostname = deviceName(data);
    sessionUrl.value = data.vnc;
    identity.value = { hostname, client: data.client, site: data.site };
    useMeta({ title: `${hostname} - ${data.client} - ${data.site} | VNC` });
  } catch (e) {
    console.error(e);
    failure.value = meshFailure(e);
    if (!identity.value.hostname) loadIdentity(agent_id as string);
  }
}

// a refused session carries no device details, the header still names it
async function loadIdentity(agent_id: string) {
  try {
    const agent = await fetchAgent(agent_id);
    identity.value = {
      hostname: deviceName(agent),
      client: agent.client,
      site: agent.site_name,
    };
  } catch (e) {
    console.error(e);
  }
}

onMounted(loadSession);
</script>

<style scoped>
.web-vnc__status {
  display: flex;
  height: 100%;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--rmm-text-muted);
}
</style>
