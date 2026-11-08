<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-page class="security-page" :style-fn="fitPage">
    <header class="security-heading">
      <div>
        <h1>Security Center</h1>
        <p>
          Rotation policies, the trust state of every agent, security events and
          the emergency actions.
        </p>
      </div>
      <q-tabs
        v-model="tab"
        dense
        no-caps
        inline-label
        align="left"
        class="security-tabs"
        active-color="primary"
      >
        <q-tab name="matrix" icon="verified_user" label="Trust matrix" />
        <q-tab name="policies" icon="tune" label="Policies" />
        <q-tab name="events" icon="history" label="Events" />
        <q-tab name="emergency" icon="emergency" label="Emergency" />
      </q-tabs>
    </header>

    <EmptyState
      v-if="denied"
      icon="lock"
      title="No permission"
      text="Your role cannot view Global Settings, which the Security Center is part of."
    />
    <q-tab-panels
      v-else
      v-model="tab"
      animated
      keep-alive
      class="security-panels"
    >
      <q-tab-panel name="matrix" class="q-pa-none">
        <TrustMatrix ref="matrixRef" @denied="denied = true" />
      </q-tab-panel>
      <q-tab-panel name="policies" class="q-pa-none">
        <RotationPolicies @denied="denied = true" />
      </q-tab-panel>
      <q-tab-panel name="events" class="q-pa-none">
        <div class="row items-center q-gutter-x-md q-mb-sm">
          <q-toggle
            v-model="live"
            dense
            label="Live"
            aria-label="Refresh the events every 15 seconds"
          />
          <span class="text-caption rmm-muted">{{
            live ? "Refreshes every 15 seconds" : "Refresh by hand"
          }}</span>
        </div>
        <SecurityEventsTable ref="eventsRef" />
      </q-tab-panel>
      <q-tab-panel name="emergency" class="q-pa-none">
        <EmergencyActions @done="matrixRef?.reload()" />
      </q-tab-panel>
    </q-tab-panels>
  </q-page>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from "vue";
import EmptyState from "@/components/ui/EmptyState.vue";
import EmergencyActions from "@/components/security/EmergencyActions.vue";
import RotationPolicies from "@/components/security/RotationPolicies.vue";
import SecurityEventsTable from "@/components/security/SecurityEventsTable.vue";
import TrustMatrix from "@/components/security/TrustMatrix.vue";

const LIVE_MS = 15_000;

const tab = ref("matrix");
const denied = ref(false);
const live = ref(false);
const matrixRef = ref<InstanceType<typeof TrustMatrix> | null>(null);
const eventsRef = ref<InstanceType<typeof SecurityEventsTable> | null>(null);
let timer: ReturnType<typeof setInterval> | null = null;

function stopLive() {
  if (timer) clearInterval(timer);
  timer = null;
}

watch(live, (on) => {
  stopLive();
  if (on) timer = setInterval(() => eventsRef.value?.load(true), LIVE_MS);
});

function fitPage(offset: number, height: number) {
  return { height: `${height - offset}px` };
}

onBeforeUnmount(stopLive);
</script>

<style scoped>
.security-page {
  padding: 28px;
  overflow-y: auto;
  color: var(--rmm-text);
  background: var(--rmm-bg);
}

.security-heading {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 20px;
}

.security-heading h1 {
  margin: 0 0 6px;
  font-size: 32px;
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: -0.02em;
}

.security-heading p {
  margin: 0;
  color: var(--rmm-text-muted);
}

.security-tabs {
  max-width: 100%;
}

.security-panels {
  background: transparent;
}

@media (max-width: 599px) {
  .security-page {
    padding: 16px;
  }

  .security-heading h1 {
    font-size: 24px;
  }
}
</style>
