<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-page class="backups-page" :style-fn="fitPage">
    <header class="backups-heading">
      <div>
        <h1>Backups</h1>
        <p>
          Backup state of every device, held settings changes and the backup
          policies of each level.
        </p>
      </div>
      <q-tabs
        v-model="tab"
        dense
        no-caps
        inline-label
        align="left"
        active-color="primary"
      >
        <q-tab name="fleet" icon="backup" label="Devices" />
        <q-tab name="policies" icon="tune" label="Policies" />
      </q-tabs>
    </header>
    <q-tab-panels v-model="tab" animated keep-alive class="backups-panels">
      <q-tab-panel name="fleet" class="q-pa-none">
        <BackupFleet @internal="internal = $event" />
      </q-tab-panel>
      <q-tab-panel name="policies" class="q-pa-none">
        <BackupPolicies :internal="internal" />
      </q-tab-panel>
    </q-tab-panels>
  </q-page>
</template>

<script setup>
import { ref } from "vue";
import BackupFleet from "@/components/backups/BackupFleet.vue";
import BackupPolicies from "@/components/backups/BackupPolicies.vue";

const tab = ref("fleet");
const internal = ref(false);

function fitPage(offset, height) {
  return { height: `${height - offset}px` };
}
</script>

<style scoped>
.backups-page {
  padding: 28px;
  overflow-y: auto;
  color: var(--rmm-text);
  background: var(--rmm-bg);
}

.backups-heading {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 20px;
}

.backups-heading h1 {
  margin: 0 0 6px;
  font-size: 32px;
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: -0.02em;
}

.backups-heading p {
  margin: 0;
  color: var(--rmm-text-muted);
}

.backups-panels {
  background: transparent;
}

@media (max-width: 599px) {
  .backups-page {
    padding: 16px;
  }

  .backups-heading h1 {
    font-size: 24px;
  }
}
</style>
