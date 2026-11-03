<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-list dense style="min-width: 220px">
    <q-item clickable v-close-popup @click="$emit('view')">
      <q-item-section side>
        <q-icon name="remove_red_eye" />
      </q-item-section>
      <q-item-section>View code</q-item-section>
    </q-item>

    <q-item clickable v-close-popup @click="$emit('clone')">
      <q-item-section side>
        <q-icon name="content_copy" />
      </q-item-section>
      <q-item-section>
        <q-item-label>Clone</q-item-label>
        <q-item-label caption>Creates an editable copy</q-item-label>
      </q-item-section>
    </q-item>

    <div>
      <q-item clickable v-close-popup @click="$emit('edit')" :disable="builtin">
        <q-item-section side>
          <q-icon name="edit" />
        </q-item-section>
        <q-item-section>Edit</q-item-section>
      </q-item>
      <q-tooltip v-if="builtin">
        Community scripts are read-only; use Clone
      </q-tooltip>
    </div>

    <q-separator />

    <q-item clickable v-close-popup @click="$emit('favorite')">
      <q-item-section side>
        <q-icon name="star" />
      </q-item-section>
      <q-item-section>{{
        script.favorite ? "Remove from favorites" : "Add to favorites"
      }}</q-item-section>
    </q-item>

    <q-item clickable v-close-popup @click="$emit('download')">
      <q-item-section side>
        <q-icon name="cloud_download" />
      </q-item-section>
      <q-item-section>Download</q-item-section>
    </q-item>

    <q-item clickable v-close-popup @click="$emit('hide')">
      <q-item-section side>
        <q-icon :name="script.hidden ? 'visibility' : 'visibility_off'" />
      </q-item-section>
      <q-item-section>
        <q-item-label>{{
          script.hidden ? "Show script" : "Hide script"
        }}</q-item-label>
        <q-item-label caption>{{
          script.hidden
            ? "Lists it in script pickers again"
            : "Leaves it out of script pickers"
        }}</q-item-label>
      </q-item-section>
    </q-item>

    <q-separator />

    <div>
      <q-item
        clickable
        v-close-popup
        class="text-negative"
        @click="$emit('delete')"
        :disable="builtin"
      >
        <q-item-section side>
          <q-icon name="delete" color="negative" />
        </q-item-section>
        <q-item-section>Delete</q-item-section>
      </q-item>
      <q-tooltip v-if="builtin">
        Community scripts are read-only; use Clone
      </q-tooltip>
    </div>

    <template v-if="withClose">
      <q-separator />
      <q-item clickable v-close-popup>
        <q-item-section>Close</q-item-section>
      </q-item>
    </template>
  </q-list>
</template>

<script setup>
import { computed } from "vue";

// row button, context menu and detail panel share this list
const props = defineProps({
  script: { type: Object, required: true },
  withClose: { type: Boolean, default: false },
});

defineEmits([
  "view",
  "clone",
  "edit",
  "delete",
  "favorite",
  "download",
  "hide",
]);

const builtin = computed(() => props.script.script_type === "builtin");
</script>
