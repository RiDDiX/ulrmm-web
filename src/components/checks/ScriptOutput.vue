<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-dialog
    ref="dialogRef"
    @hide="onDialogHide"
    aria-labelledby="script-output-title"
  >
    <q-card class="q-dialog-plugin" style="min-width: 70vw">
      <DialogHeader
        title-id="script-output-title"
        title="Script output"
        subtitle="Output, return code and run time"
      />
      <q-card-section class="scroll" style="height: 70vh">
        <div class="rmm-kv q-mb-md">
          <div>Last run</div>
          <div class="rmm-num">{{ formatDate(scriptInfo.last_run) }}</div>
          <div>Run time</div>
          <div class="rmm-num">{{ scriptInfo.execution_time }} seconds</div>
          <div>Return code</div>
          <div class="rmm-mono">{{ scriptInfo.retcode }}</div>
        </div>
        <div v-for="s in streams" :key="s.label">
          <template v-if="scriptInfo[s.field]">
            <script-output-copy-clip
              :label="s.label"
              :data="scriptInfo[s.field]"
            />
            <q-separator />
            <pre class="script-output__pre">{{ scriptInfo[s.field] }}</pre>
          </template>
        </div>
        <div
          v-if="!scriptInfo.stdout && !scriptInfo.stderr"
          class="text-caption rmm-muted"
        >
          Nothing was written to standard output or standard error.
        </div>
      </q-card-section>
      <q-card-actions align="right">
        <q-btn v-close-popup flat label="Close" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { computed } from "vue";
import { useStore } from "vuex";
import { useDialogPluginComponent } from "quasar";
import ScriptOutputCopyClip from "@/components/scripts/ScriptOutputCopyClip.vue";
import DialogHeader from "@/components/ui/DialogHeader.vue";

defineProps({ scriptInfo: null });
defineEmits([...useDialogPluginComponent.emits]);

const { dialogRef, onDialogHide } = useDialogPluginComponent();

const store = useStore();
const formatDate = computed(() => store.getters.formatDate);

const streams = [
  { field: "stdout", label: "Standard Output" },
  { field: "stderr", label: "Standard Error" },
];
</script>

<style scoped>
.script-output__pre {
  margin: 8px 0 16px;
  font-family: var(--rmm-mono);
  font-size: var(--rmm-fs-sm);
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
