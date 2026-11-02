<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-card class="q-dialog-plugin rmm-dialog--md">
    <DialogHeader :title-id="titleId" :title="title" :subtitle="subtitle" />
    <slot v-if="blank" name="blank" />
    <q-form v-else @submit.prevent="emit('save')">
      <div class="scroll" style="max-height: 70vh">
        <slot />
      </div>
      <q-card-actions align="right">
        <q-btn v-close-popup flat>Cancel</q-btn>
        <q-btn type="submit" unelevated color="primary" :loading="loading"
          >Save</q-btn
        >
      </q-card-actions>
    </q-form>
  </q-card>
</template>

<script setup>
import DialogHeader from "../ui/DialogHeader.vue";

defineProps({
  blank: Boolean,
  loading: Boolean,
  title: String,
  subtitle: String,
  titleId: String,
});
const emit = defineEmits(["save"]);
</script>
