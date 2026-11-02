<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-dialog
    ref="dialogRef"
    aria-labelledby="test-url-action-title"
    @hide="onDialogHide"
  >
    <q-card class="q-dialog-plugin rmm-dialog--lg">
      <DialogHeader
        title-id="test-url-action-title"
        :title="`Testing ${urlAction.name}`"
        subtitle="Sends the request from the server now and shows what was sent and the reply"
      />

      <q-card-section>
        <div class="rmm-label q-mb-xs">
          Fill in variables such as <span v-pre>{{ agent.hostname }}</span> from
        </div>
        <q-option-group v-model="runAgainst" :options="SOURCES" inline dense />
      </q-card-section>

      <q-card-section v-if="picker">
        <rmm-select
          :key="runAgainst"
          v-model="picker.model.value"
          :options="picker.options.value"
          :label="picker.label"
          mapOptions
          filterable
        />
      </q-card-section>

      <q-card-section class="scroll test-output__body">
        <div v-if="!hasOutput" class="rmm-muted q-mb-md">
          {{
            picker && !sourceId
              ? `Choose the ${picker.label.toLowerCase()} to fill the variables from, then select Run.`
              : "Choose what to fill the variables from, then select Run."
          }}
        </div>
        <template v-for="part in output" :key="part.label">
          <div class="rmm-label">{{ part.label }}</div>
          <pre class="test-output rmm-mono">{{ part.text.value }}</pre>
        </template>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat label="Close" v-close-popup />
        <q-btn
          :loading="running"
          :disable="!!picker && !sourceId"
          unelevated
          icon="send"
          label="Run"
          color="primary"
          @click="run"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from "vue";
import DialogHeader from "@/components/ui/DialogHeader.vue";
import { useDialogPluginComponent } from "quasar";
import { runTestURLAction } from "@/api/core";
import RmmSelect from "@/components/ui/RmmSelect.vue";
import { useSiteDropdown, useClientDropdown } from "@/composables/clients";
import { useAgentDropdown } from "@/composables/agents";
import { URLAction } from "@/types/core/urlactions";

type Source = "agent" | "site" | "client" | "none";
const SOURCES = ["agent", "site", "client", "none"].map((value) => ({
  value,
  label: value[0].toUpperCase() + value.slice(1),
}));

const props = defineProps<{ urlAction: URLAction }>();
defineEmits([...useDialogPluginComponent.emits]);
const { dialogRef, onDialogHide } = useDialogPluginComponent();
const runAgainst = ref<Source>("none");

const { client, clientOptions } = useClientDropdown(true);
const { site, siteOptions } = useSiteDropdown(true);
const { agent, agentOptions } = useAgentDropdown({ onMount: true });

const pickers = {
  agent: { label: "Agent", model: agent, options: agentOptions },
  site: { label: "Site", model: site, options: siteOptions },
  client: { label: "Client", model: client, options: clientOptions },
};
const picker = computed(() =>
  runAgainst.value === "none" ? null : pickers[runAgainst.value],
);

const sourceId = computed(() => (picker.value ? picker.value.model.value : 0));

const restFields = (action: URLAction) => ({
  pattern: action.pattern,
  rest_body: action.rest_body,
  rest_headers: action.rest_headers,
  rest_method: action.rest_method,
});
const request = reactive({
  ...restFields(props.urlAction),
  run_instance_type: runAgainst,
  run_instance_id: sourceId,
});

const sentUrl = ref("");
const sentBody = ref("");
const reply = ref("");
const output = [
  { label: "URL", text: sentUrl },
  { label: "Body", text: sentBody },
  { label: "Response", text: reply },
];
const hasOutput = computed(
  () => !!(sentUrl.value || sentBody.value || reply.value),
);

const running = ref(false);
async function run() {
  running.value = true;
  try {
    const { url, result, body } = await runTestURLAction(request);
    reply.value = result;
    sentUrl.value = url;
    sentBody.value = body;
  } catch (e) {
    console.error(e);
  } finally {
    running.value = false;
  }
}
</script>

<style scoped>
.test-output__body {
  max-height: 60vh;
  min-height: 160px;
}

.test-output {
  min-height: 34px;
  margin: 4px 0 12px;
  padding: 8px 10px;
  overflow-x: auto;
  border: 1px solid var(--rmm-border);
  border-radius: var(--rmm-radius-sm);
  background: var(--rmm-surface-2);
  font-size: var(--rmm-fs-sm);
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
