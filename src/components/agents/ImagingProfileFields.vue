<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<script setup>
import { wholeNumberIn } from "@/utils/validation";

const form = defineModel({ type: Object, required: true });
defineProps({ disabled: Boolean, location: { type: String, default: "" } });

const modeChoices = [
  { label: "ULRMM internal network only", value: "internal" },
  { label: "Internet upload allowed", value: "internet" },
];
</script>

<template>
  <div class="row q-gutter-sm">
    <q-input
      v-model="form.destination"
      label="Folder on backup server"
      :hint="location"
      outlined
      dense
      :disable="disabled"
    />
    <q-select
      v-model="form.network_mode"
      :options="modeChoices"
      emit-value
      map-options
      outlined
      dense
      label="Transfer network"
      :disable="disabled"
    />
    <q-select
      v-model="form.compression"
      :options="['gzip', 'none']"
      label="Compression"
      outlined
      dense
      :disable="disabled"
      @update:model-value="
        Number.isInteger(form.compression_level) || (form.compression_level = 0)
      "
    />
    <q-input
      v-if="form.compression === 'gzip'"
      v-model.number="form.compression_level"
      label="Gzip level"
      type="number"
      min="0"
      max="9"
      :rules="[wholeNumberIn(0, 9)]"
      outlined
      dense
      :disable="disabled"
    />
    <q-input
      v-model.number="form.keep_last"
      label="Keep last N verified points, 0 = keep all"
      type="number"
      min="0"
      max="365"
      :rules="[wholeNumberIn(0, 365)]"
      outlined
      dense
      :disable="disabled"
    />
  </div>
  <div class="row q-gutter-sm">
    <q-input
      v-model="form.schedule_time"
      type="time"
      clearable
      label="Daily capture"
      hint="Leave empty for manual capture"
      outlined
      dense
      :disable="disabled"
    />
    <q-input
      v-model="form.timezone"
      label="Time zone (IANA)"
      placeholder="Europe/Berlin"
      outlined
      dense
      :disable="disabled"
    />
  </div>
</template>
