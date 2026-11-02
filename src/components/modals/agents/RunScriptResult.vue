<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-card-section
    class="q-pl-md q-pr-md q-pt-none q-ma-none scroll"
    style="max-height: 50vh"
  >
    <template v-if="!onServer">
      <ScriptOutputCopyClip label="Output" :data="result" />
      <q-separator />
      <pre class="run-script__pre">{{ result }}</pre>
    </template>
    <template v-else>
      <q-separator />
      <div class="rmm-kv q-my-md">
        <div>Run time</div>
        <div class="rmm-num">{{ result.execution_time }} seconds</div>
        <div>Return code</div>
        <div class="rmm-mono">{{ result.retcode }}</div>
      </div>
      <div v-for="s in streams" :key="s.key">
        <template v-if="result[s.key]">
          <ScriptOutputCopyClip :label="s.label" :data="result[s.key]" />
          <q-separator />
          <pre class="run-script__pre">{{ result[s.key] }}</pre>
        </template>
      </div>
    </template>
  </q-card-section>
</template>

<script setup>
import ScriptOutputCopyClip from "@/components/scripts/ScriptOutputCopyClip.vue";

defineProps({ result: { required: true }, onServer: Boolean });

const streams = [
  { key: "stdout", label: "Standard output" },
  { key: "stderr", label: "Standard error" },
];
</script>

<style scoped>
.run-script__pre {
  margin: 8px 0 16px;
  font-family: var(--rmm-mono);
  font-size: var(--rmm-fs-sm);
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
