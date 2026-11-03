<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-dialog v-model="open" persistent :aria-labelledby="titleId">
    <q-card class="rmm-dialog--sm">
      <DialogHeader :title="title" :title-id="titleId" />

      <q-card-section class="row items-center no-wrap q-gutter-sm">
        <q-icon v-if="icon" size="32px" :color="iconColor" :name="icon" />
        <div>{{ message }}</div>
      </q-card-section>

      <q-card-actions align="right">
        <template v-if="type === 'confirm'">
          <q-btn v-close-popup flat label="Cancel" />
          <q-btn
            :label="okLabel || 'Confirm'"
            color="negative"
            unelevated
            @click="confirmAction"
          />
        </template>
        <q-btn
          v-else
          label="OK"
          color="primary"
          unelevated
          @click="open = false"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { getCurrentInstance, ref, watch } from "vue";
import DialogHeader from "@/components/ui/DialogHeader.vue";

interface Props {
  modelValue: boolean;
  title: string;
  message: string;
  type?: "warning" | "confirm";
  okLabel?: string;
  icon?: string;
  iconColor?: string;
}
const props = defineProps<Props>();

const emit = defineEmits(["update:modelValue", "confirm"]);

const titleId = `confirm-dialog-title-${getCurrentInstance()?.uid}`;

// local copy so the dialog closes itself as well as following the parent
const open = ref(props.modelValue);
watch(
  () => props.modelValue,
  (val) => (open.value = val),
);
watch(open, (val) => emit("update:modelValue", val));

function confirmAction() {
  emit("confirm");
  open.value = false;
}
</script>
