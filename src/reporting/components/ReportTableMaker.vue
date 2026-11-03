<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide">
    <q-card class="q-dialog-plugin" style="width: 80vw">
      <DialogHeader
        title="Insert Table"
        subtitle="Adds an HTML table below the cursor; edit it here or later in the template"
      />
      <q-card-section class="q-gutter-y-sm">
        <div class="row items-center q-gutter-x-md">
          <span class="rmm-label">Start from</span>
          <q-radio
            v-model="start"
            val="blank"
            label="Blank"
            dense
            @update:model-value="restart"
          />
          <q-radio
            v-model="start"
            val="variables"
            label="From Variables"
            dense
            @update:model-value="restart"
          />
        </div>
        <RmmSelect
          v-if="start === 'variables'"
          v-model="dataSource"
          :options="sourceOptions"
          label="Data Source"
          hint="List variables from this template; columns come from the fields of its first item"
          @update:model-value="build"
        />
      </q-card-section>
      <q-card-section class="scroll" style="max-height: 60vh">
        <q-input
          v-model="markup"
          type="textarea"
          filled
          label="Table markup"
          input-class="rmm-mono"
          autogrow
          :input-style="{ minHeight: '200px' }"
        />
      </q-card-section>
      <q-card-actions align="right">
        <q-btn flat no-caps label="Cancel" @click="onDialogCancel" />
        <q-btn
          unelevated
          no-caps
          color="primary"
          label="Insert"
          @click="onDialogOK(markup)"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useDialogPluginComponent } from "quasar";
import DialogHeader from "@/components/ui/DialogHeader.vue";
import RmmSelect from "@/components/ui/RmmSelect.vue";
import { useVariableAnalysisShared } from "@/reporting/stores";
import { BLANK_TABLE, isArrayType, tableFromSource } from "@/reporting/editing";

defineEmits([...useDialogPluginComponent.emits]);

const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } =
  useDialogPluginComponent();
const { variableAnalysis } = useVariableAnalysisShared;

const start = ref<"blank" | "variables">("blank");
const dataSource = ref<string | null>(null);
const markup = ref(BLANK_TABLE);

const sourceOptions = computed(() =>
  Object.entries(variableAnalysis.value)
    .filter(([, type]) => isArrayType(type))
    .map(([path]) => path),
);

function restart() {
  dataSource.value = null;
  markup.value = BLANK_TABLE;
}

function build() {
  markup.value = dataSource.value
    ? tableFromSource(variableAnalysis.value, dataSource.value)
    : BLANK_TABLE;
}
</script>
