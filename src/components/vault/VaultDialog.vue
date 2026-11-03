<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-dialog
    ref="dialogRef"
    aria-labelledby="vault-dialog-title"
    @hide="onDialogHide"
  >
    <q-card class="q-dialog-plugin rmm-dialog--lg vault-dialog">
      <DialogHeader
        title-id="vault-dialog-title"
        :title="`Vault of ${name}`"
        :subtitle="
          scope === 'client'
            ? 'Documents and credentials of this client; its sites and devices show them too'
            : 'Documents and credentials of this site; its devices show them too'
        "
      />
      <VaultPanel
        :scope="scope"
        :scope-key="scopeKey"
        class="vault-dialog__panel"
      />
    </q-card>
  </q-dialog>
</template>

<script setup>
import { useDialogPluginComponent } from "quasar";
import DialogHeader from "@/components/ui/DialogHeader.vue";
import VaultPanel from "@/components/vault/VaultPanel.vue";

defineProps({
  // client | site
  scope: { type: String, required: true },
  scopeKey: { type: Number, required: true },
  // shown in the title: client name or "Client / Site"
  name: { type: String, required: true },
});
defineEmits([...useDialogPluginComponent.emits]);
const { dialogRef, onDialogHide } = useDialogPluginComponent();
</script>

<style scoped>
/* the credentials table needs more than the 60vw of rmm-dialog--lg */
.q-dialog__inner--minimized > .vault-dialog {
  width: min(95vw, 1120px);
}

.vault-dialog__panel {
  height: min(70vh, 760px);
}
</style>
