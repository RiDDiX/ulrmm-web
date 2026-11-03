<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-dialog ref="dialogRef" :aria-labelledby="titleId" @hide="onDialogHide">
    <q-card class="q-dialog-plugin rmm-dialog--sm">
      <DialogHeader
        :title="`Uninstall ${software.name}?`"
        :title-id="titleId"
        :subtitle="
          software.source === 'app'
            ? 'The agent deletes the app bundle from /Applications'
            : 'The agent removes it with the package manager it came from'
        "
      />

      <q-card-section>
        <div class="rmm-kv q-mb-md">
          <span>Name</span><span>{{ software.name }}</span> <span>Version</span
          ><span class="rmm-mono">{{ software.version || "—" }}</span>
          <span>Source</span><span>{{ software.source }}</span>
          <template v-if="software.source === 'app'">
            <span>Location</span
            ><span class="rmm-mono">{{ software.location }}</span>
          </template>
        </div>
        <p class="q-mb-none rmm-muted">
          {{ warning }}
        </p>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat no-caps label="Cancel" @click="onDialogCancel" />
        <q-btn
          unelevated
          no-caps
          label="Uninstall"
          color="negative"
          @click="onDialogOK"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { computed, getCurrentInstance } from "vue";
import { useDialogPluginComponent } from "quasar";
import DialogHeader from "@/components/ui/DialogHeader.vue";

const props = defineProps({
  software: { type: Object, required: true },
});

defineEmits([...useDialogPluginComponent.emits]);
const titleId = `software-uninstall-title-${getCurrentInstance()?.uid}`;

const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } =
  useDialogPluginComponent();
const warning = computed(() =>
  props.software.source === "app"
    ? "The application bundle will be deleted. Packages other software depends on are not removed."
    : "Packages other software depends on are not removed.",
);
</script>
