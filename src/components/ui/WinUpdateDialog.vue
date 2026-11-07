<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-dialog ref="dialogRef" :aria-labelledby="titleId" @hide="onDialogHide">
    <q-card class="q-dialog-plugin" :style="dialogStyle">
      <DialogHeader :title="title" :title-id="titleId" />
      <q-card-section class="win-update__body">
        <div>
          <div class="rmm-label">Last install result</div>
          <span class="rmm-pill q-mt-xs" :class="resultClass">{{
            resultText
          }}</span>
        </div>
        <div v-if="categories?.length">
          <div class="rmm-label">Categories</div>
          <div class="q-mt-xs">{{ categories.join(", ") }}</div>
        </div>
        <div v-if="description">
          <div class="rmm-label">Description</div>
          <p
            v-for="(para, i) in descriptionParagraphs"
            :key="i"
            class="q-mt-xs q-mb-none"
          >
            {{ para }}
          </p>
        </div>
        <div v-if="supportUrls?.length">
          <div class="rmm-label">Support links</div>
          <div v-for="url in supportUrls" :key="url" class="q-mt-xs">
            <a
              v-if="isWebUrl(url)"
              :href="url"
              target="_blank"
              rel="noopener"
              class="rmm-link"
              >{{ url }}</a
            >
            <span v-else>{{ url }}</span>
          </div>
        </div>
      </q-card-section>
      <q-card-actions align="right">
        <q-btn
          label="Close"
          color="primary"
          no-caps
          unelevated
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
import { isWebUrl } from "@/utils/helpers";

const props = defineProps({
  title: { required: true, type: String },
  dialogStyle: { default: () => ({}), type: [String, Object] },
  categories: { default: () => [], type: Array },
  description: { default: "", type: String },
  supportUrls: { default: () => [], type: Array },
  result: { default: "n/a", type: String },
});

defineEmits([...useDialogPluginComponent.emits]);
const titleId = `win-update-title-${getCurrentInstance()?.uid}`;

const { dialogRef, onDialogHide, onDialogOK } = useDialogPluginComponent();

const descriptionParagraphs = computed(() =>
  props.description
    .split(/\. +/)
    .map((sentence) => (sentence.endsWith(".") ? sentence : `${sentence}.`)),
);

const outcomes = {
  success: ["rmm-pill--positive", "Installed successfully"],
  failed: ["rmm-pill--negative", "Install failed on last attempt"],
};
const outcome = computed(
  () =>
    outcomes[props.result] ?? [
      "rmm-pill--neutral",
      "No install recorded by the RMM",
    ],
);
const resultClass = computed(() => outcome.value[0]);
const resultText = computed(() => outcome.value[1]);
</script>

<style scoped>
.win-update__body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.win-update__body a {
  overflow-wrap: anywhere;
}
</style>
