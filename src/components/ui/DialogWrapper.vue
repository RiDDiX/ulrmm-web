<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-dialog
    ref="dialogRef"
    :aria-labelledby="title && !noCard ? titleId : undefined"
    @hide="onDialogHide"
    v-bind="dialogProps"
  >
    <q-card v-if="!noCard" :class="`q-dialog-plugin rmm-dialog--${size}`">
      <DialogHeader :title="title" :subtitle="subtitle" :title-id="titleId" />
      <div class="scroll" :style="`height: ${height}vh`">
        <component
          :is="vuecomponent"
          v-bind="passed()"
          @close="onDialogOK"
          @hide="onDialogHide"
        />
      </div>
    </q-card>
    <component
      :is="vuecomponent"
      v-else
      v-bind="passed()"
      class="q-dialog-plugin"
    />
  </q-dialog>
</template>

<script setup>
import { getCurrentInstance, useAttrs } from "vue";
import { useDialogPluginComponent } from "quasar";
import DialogHeader from "@/components/ui/DialogHeader.vue";

defineOptions({ name: "DialogWrapper", inheritAttrs: false });

const props = defineProps({
  vuecomponent: {},
  title: String,
  subtitle: String,
  // sm/md/lg size classes; nobody overrides the default today
  size: { type: String, default: "md" },
  height: { type: String, default: "50" },
  noCard: { type: Boolean, default: false },
  componentProps: Object,
  dialogProps: Object,
});

defineEmits([...useDialogPluginComponent.emits]);

const attrs = useAttrs();
// attrs are not reactive, so merge on every render
const passed = () => ({ ...attrs, ...props.componentProps });

const { dialogRef, onDialogHide, onDialogOK } = useDialogPluginComponent();
const titleId = `dialog-title-${getCurrentInstance().uid}`;
</script>
