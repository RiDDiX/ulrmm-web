<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-page class="security-page" :style-fn="fitPage">
    <header class="security-heading">
      <div>
        <h1>Updates</h1>
        <p>Signed server releases, the live update run and the agent fleet.</p>
      </div>
    </header>

    <q-banner v-if="!allowed" dense rounded class="rmm-banner-warning">
      <template #avatar><q-icon name="lock" /></template>
      Your role cannot manage server updates.
    </q-banner>
    <UpdateCenter v-else />
  </q-page>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useStore } from "vuex";
import UpdateCenter from "@/components/update/UpdateCenter.vue";

const store = useStore();
const allowed = computed(
  () => store.state.can_manage_server_updates && !store.state.hosted,
);

function fitPage(offset: number, height: number) {
  return { height: `${height - offset}px` };
}
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

@media (max-width: 599px) {
  .security-page {
    padding: 16px;
  }

  .security-heading h1 {
    font-size: 24px;
  }
}
</style>
