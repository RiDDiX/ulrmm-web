<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-dialog
    ref="dialogRef"
    aria-labelledby="widget-picker-title"
    @hide="onDialogHide"
  >
    <q-card class="q-dialog-plugin rmm-dialog--md">
      <DialogHeader
        title-id="widget-picker-title"
        title="Add a widget"
        :subtitle="`${count} of ${MAX_WIDGETS} places used. A widget can be added more than once.`"
      />
      <q-card-section class="widget-picker__body">
        <q-list separator class="widget-picker__list">
          <q-item
            v-for="type in WIDGET_TYPES"
            :key="type"
            clickable
            :disable="count >= MAX_WIDGETS"
            :aria-label="`Add ${CATALOGUE[type].label}: ${CATALOGUE[type].description}`"
            @click="onDialogOK(type)"
          >
            <q-item-section avatar>
              <span class="widget-picker__icon">
                <q-icon :name="CATALOGUE[type].icon" size="20px" />
              </span>
            </q-item-section>
            <q-item-section>
              <q-item-label class="widget-picker__label">{{
                CATALOGUE[type].label
              }}</q-item-label>
              <q-item-label caption>{{
                CATALOGUE[type].description
              }}</q-item-label>
            </q-item-section>
            <q-item-section side>
              <span class="widget-picker__size">{{
                SIZE_LABELS[CATALOGUE[type].size]
              }}</span>
            </q-item-section>
          </q-item>
        </q-list>
      </q-card-section>
      <q-card-actions align="right">
        <q-btn flat no-caps label="Cancel" @click="onDialogCancel" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { useDialogPluginComponent } from "quasar";
import DialogHeader from "@/components/ui/DialogHeader.vue";
import {
  CATALOGUE,
  MAX_WIDGETS,
  SIZE_LABELS,
  WIDGET_TYPES,
} from "@/utils/overview";

defineProps<{ count: number }>();
defineEmits([...useDialogPluginComponent.emits]);
const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } =
  useDialogPluginComponent();
</script>

<style scoped>
.widget-picker__body {
  max-height: 65vh;
  padding-top: 4px;
  padding-bottom: 4px;
  overflow-y: auto;
}

.widget-picker__icon {
  display: inline-flex;
  width: 36px;
  height: 36px;
  align-items: center;
  justify-content: center;
  border-radius: var(--rmm-radius);
  color: var(--rmm-tile-icon-text);
  background: var(--rmm-tile-icon-bg);
}

.widget-picker__label {
  font-weight: 600;
}

.widget-picker__size {
  color: var(--rmm-text-muted);
  font-size: var(--rmm-fs-xs);
}
</style>
