<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-card
    class="q-dialog-plugin rmm-dialog--lg"
    aria-labelledby="iso-lib-title"
  >
    <DialogHeader
      title-id="iso-lib-title"
      title="Image library"
      subtitle="Installation media that full ISOs are built from, and the ISOs built from them"
    />
    <q-card-section>
      <IsoLibraryPanel @changed="emit('changed')" />
    </q-card-section>
  </q-card>
</template>

<script setup lang="ts">
import DialogHeader from "@/components/ui/DialogHeader.vue";
import IsoLibraryPanel from "@/components/deploy/IsoLibraryPanel.vue";

const emit = defineEmits<{ changed: [] }>();
</script>
