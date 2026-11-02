<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide">
    <q-card class="q-dialog-plugin" style="min-width: 65vw">
      <DialogHeader
        title="Script test"
        :subtitle="
          ctx === 'server'
            ? 'Runs the current editor content on the UniversalLocal RMM server; nothing is saved'
            : 'Runs the current editor content on the selected agent; nothing is saved'
        "
      />
      <q-card-section style="height: 70vh" class="scroll">
        <div v-if="variables.length" class="test-result__vars">
          <div class="rmm-label">Variables for this test</div>
          <div class="text-caption rmm-muted q-mb-sm">
            Prefilled with the defaults; try other values and run again.
          </div>
          <ScriptVariablesForm
            v-model="envVars"
            v-model:valid="varsValid"
            :variables="variables"
            :disable="loading"
          />
        </div>
        <template v-if="ran">
          <div class="rmm-kv test-result__facts">
            <div>Run time</div>
            <div>
              <code class="rmm-mono">{{ ret.execution_time }} seconds</code>
            </div>
            <div>
              Return code
              <HelpTip
                text="Exit code of the script; 0 usually means success"
              />
            </div>
            <div>
              <code class="rmm-mono">{{ ret.retcode }}</code>
            </div>
          </div>
          <div v-if="ret.stdout" class="q-mt-md">
            <script-output-copy-clip
              label="Standard Output"
              :data="ret.stdout"
            />
            <q-separator />
            <pre class="test-result__output">{{ ret.stdout }}</pre>
          </div>
          <div v-if="ret.stderr" class="q-mt-md">
            <script-output-copy-clip
              label="Standard Error"
              :data="ret.stderr"
            />
            <q-separator />
            <pre class="test-result__output">{{ ret.stderr }}</pre>
          </div>
          <div
            v-if="!loading && ret.retcode !== '' && !ret.stdout && !ret.stderr"
            class="text-caption rmm-muted q-mt-md"
          >
            The script wrote nothing to standard output or standard error.
          </div>
        </template>
        <q-inner-loading :showing="loading" label="Running script" />
      </q-card-section>
      <q-card-actions v-if="variables.length" align="right">
        <q-btn flat label="Close" v-close-popup />
        <q-btn
          unelevated
          color="primary"
          icon="play_arrow"
          :label="ran ? 'Run again' : 'Run test'"
          :loading="loading"
          :disable="!varsValid"
          @click="runTestScript"
        >
          <q-tooltip v-if="!varsValid">Fill in the required fields</q-tooltip>
        </q-btn>
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useDialogPluginComponent, useQuasar } from "quasar";
import { testScript, testScriptOnServer } from "@/api/scripts";
import { withStepUp } from "@/components/vault/stepUp";
import { applyVariableDefaults } from "@/utils/scriptVariables";
import ScriptOutputCopyClip from "@/components/scripts/ScriptOutputCopyClip.vue";
import ScriptVariablesForm from "@/components/scripts/ScriptVariablesForm.vue";
import DialogHeader from "@/components/ui/DialogHeader.vue";
import HelpTip from "@/components/ui/HelpTip.vue";
import type { Script } from "@/types/scripts";

const props = defineProps<{
  script: Script;
  agent?: string;
  ctx: string;
}>();

defineEmits([...useDialogPluginComponent.emits]);

const { dialogRef, onDialogHide } = useDialogPluginComponent();
const $q = useQuasar();

const variables = props.script.variables || [];
const envVars = ref(
  applyVariableDefaults(props.script.env_vars || [], variables),
);
const varsValid = ref(true);

const ret = ref({
  execution_time: "",
  retcode: "",
  stdout: "",
  stderr: "",
});
const loading = ref(false);
const ran = ref(false);

async function runTestScript() {
  loading.value = true;
  const s = props.script;
  const data = {
    code: s.script_body,
    shell: s.shell,
    timeout: s.default_timeout,
    args: s.args,
    env_vars: envVars.value,
    run_as_user: s.run_as_user,
  };
  try {
    const res =
      props.ctx === "server"
        ? await withStepUp($q, (config: object) =>
            testScriptOnServer(data, config),
          )
        : await testScript(props.agent, data);
    if (res) {
      ret.value = res;
      ran.value = true;
    }
  } catch (e) {
    console.error("test run failed", e?.response?.status);
  }
  loading.value = false;
}

// no variables to fill in, run now
onMounted(() => {
  if (!variables.length) runTestScript();
});
</script>

<style scoped>
.test-result__vars {
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--rmm-border);
}

.test-result__facts {
  max-width: 420px;
}

.test-result__output {
  margin: 8px 0 0;
  padding: 8px 12px;
  border: 1px solid var(--rmm-border);
  border-radius: var(--rmm-radius-sm);
  background: var(--rmm-surface-2);
  font-family: var(--rmm-mono);
  font-size: var(--rmm-fs-sm);
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
