<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-btn-toggle
    :model-value="source"
    :options="OPTIONS"
    dense
    no-caps
    unelevated
    toggle-color="primary"
    padding="3px 10px"
    role="group"
    aria-label="Patch source"
    class="patch-source"
    @update:model-value="select"
  />
</template>

<script setup>
// Windows only: the Patches tab shows either Windows Update or winget. The
// choice travels in ?src= next to ?tab=, so a reload or a shared link keeps it
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";

const OPTIONS = [
  { value: "updates", label: "Windows Updates" },
  { value: "winget", label: "winget" },
];

const route = useRoute();
const router = useRouter();
const source = computed(() =>
  route.query.src === "winget" ? "winget" : "updates",
);

function select(value) {
  const { src, ...query } = route.query;
  if (value === "winget") query.src = "winget";
  if (query.src === src) return;
  router.replace({ query });
}
</script>

<style scoped>
.patch-source {
  margin-right: 8px;
  border: 1px solid var(--rmm-border-strong);
  border-radius: var(--rmm-radius-sm);
}
</style>
