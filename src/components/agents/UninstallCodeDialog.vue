<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-dialog
    ref="dialogRef"
    aria-labelledby="uninstall-code-title"
    @hide="onDialogHide"
  >
    <q-card class="q-dialog-plugin rmm-dialog--md">
      <DialogHeader
        title-id="uninstall-code-title"
        :title="`Uninstall code: ${name}`"
        subtitle="Needed to remove the agent by hand on the device"
      />
      <q-card-section class="q-gutter-y-sm">
        <q-banner dense rounded class="uninstall-note" role="note">
          <template #avatar><q-icon name="info" size="20px" /></template>
          The agent refuses a manual uninstall without this code. Removing the
          device from this console uninstalls it for you and needs no code.
        </q-banner>
        <ol class="q-pl-md q-my-sm">
          <li>Show the code below (two-factor code required, audited).</li>
          <li>
            Windows: set the machine variable
            <span class="rmm-mono">ULRMM_UNINSTALL_CODE</span> to it, or run the
            uninstaller with
            <span class="rmm-mono">/UNINSTALLCODE=&lt;code&gt;</span>.
          </li>
          <li>
            Linux, macOS and FreeBSD: run the agent with
            <span class="rmm-mono">-m uninstall</span> and the code.
          </li>
        </ol>
        <RevealSecret
          :request="(config) => revealUninstallCode(agentId, config)"
          label="uninstall code"
        />
      </q-card-section>
      <q-card-actions align="right">
        <q-btn flat label="Close" @click="onDialogCancel" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { useDialogPluginComponent } from "quasar";
import DialogHeader from "@/components/ui/DialogHeader.vue";
import RevealSecret from "@/components/vault/RevealSecret.vue";
import { revealUninstallCode } from "@/api/protection";

defineProps({
  agentId: { type: String, required: true },
  name: { type: String, default: "" },
});
defineEmits([...useDialogPluginComponent.emits]);
const { dialogRef, onDialogHide, onDialogCancel } = useDialogPluginComponent();
</script>

<style scoped>
.uninstall-note {
  color: var(--rmm-text-muted);
  background: var(--rmm-surface-2);
}
</style>
