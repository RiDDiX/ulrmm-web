<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-page class="security-page" :style-fn="fitPage">
    <header class="security-heading">
      <div>
        <h1>Image library</h1>
        <p>
          Base installation media and the images the deployment builder made.
        </p>
      </div>
      <q-btn
        unelevated
        no-caps
        color="primary"
        icon="rocket_launch"
        label="Deployment builder"
        @click="openBuilder"
      />
    </header>

    <IsoLibraryPanel ref="panel" builder @build="openBuilder" />
  </q-page>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useQuasar } from "quasar";
import DeployBuilder from "@/components/deploy/DeployBuilder.vue";
import IsoLibraryPanel from "@/components/deploy/IsoLibraryPanel.vue";

const $q = useQuasar();
const panel = ref<InstanceType<typeof IsoLibraryPanel> | null>(null);

// images built meanwhile show up once the builder closes
function openBuilder() {
  $q.dialog({ component: DeployBuilder }).onDismiss(() => panel.value?.load());
}

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
