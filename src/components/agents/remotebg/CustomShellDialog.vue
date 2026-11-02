<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-dialog v-model="open" persistent>
    <q-card class="rmm-dialog--sm">
      <q-form @submit.prevent="emit('start')">
        <q-card-section class="shell-head">
          <div class="shell-head__title">Custom shell</div>
          <div class="rmm-muted">
            Starts a new terminal session with this shell on the agent.
          </div>
        </q-card-section>
        <q-card-section>
          <q-input
            v-model="path"
            label="Shell path"
            input-class="rmm-mono"
            :hint="`Full path on the agent, e.g. ${example}`"
            autofocus
            outlined
            dense
          />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn label="Cancel" flat no-caps @click="emit('cancel')" />
          <q-btn
            label="Start"
            type="submit"
            color="primary"
            unelevated
            no-caps
          />
        </q-card-actions>
      </q-form>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{ windows: boolean }>();
const open = defineModel<boolean>({ required: true });
const path = defineModel<string>("path", { required: true });
const emit = defineEmits<{ start: []; cancel: [] }>();

const example = computed(() =>
  props.windows ? "C:\\Program Files\\PowerShell\\7\\pwsh.exe" : "/bin/zsh",
);
</script>

<style scoped>
.shell-head {
  border-bottom: 1px solid var(--rmm-border);
}
.shell-head__title {
  font-size: var(--rmm-fs-lg);
  font-weight: 600;
  letter-spacing: -0.01em;
}
</style>
