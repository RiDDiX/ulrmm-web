<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-dialog
    ref="dialogRef"
    @hide="onDialogHide"
    persistent
    @keydown.esc="onDialogHide"
    aria-labelledby="send-command-title"
  >
    <q-card
      class="q-dialog-plugin"
      :style="{ 'min-width': reply || streamText ? '70vw' : '40vw' }"
    >
      <DialogHeader
        title-id="send-command-title"
        :title="`Send command on ${deviceName(agent)}`"
        subtitle="Runs one command on this agent now and shows its output"
      />
      <q-form @submit="submit">
        <q-card-section class="q-gutter-y-sm">
          <div id="shell-label" class="rmm-label">Shell</div>
          <div
            class="q-gutter-sm"
            role="radiogroup"
            aria-labelledby="shell-label"
          >
            <q-radio
              v-for="s in shellChoices"
              :key="s.value"
              v-model="form.shell"
              :val="s.value"
              :label="s.label"
              dense
              @update:model-value="form.custom_shell = null"
            />
          </div>
          <q-input
            v-if="form.shell === 'custom'"
            v-model="form.custom_shell"
            :rules="[(v) => !!v || 'Required']"
            label="Custom shell"
            placeholder="/usr/bin/python3"
            hint="Full path of the interpreter that runs the command"
            outlined
            dense
            stack-label
            hide-bottom-space
          />
          <div v-if="windows" class="row items-center no-wrap">
            <q-checkbox v-model="form.run_as_user" label="Run As User" dense />
            <HelpTip
              class="q-ml-xs"
              text="Runs in the logged-in user's session instead of as SYSTEM. Fails if nobody is logged in."
            />
          </div>
        </q-card-section>
        <q-card-section class="q-gutter-y-sm q-pt-none">
          <q-input
            v-model="form.cmd"
            :placeholder="cmdPlaceholder(form.shell)"
            :rules="[(v) => !!v || 'Required']"
            label="Command"
            outlined
            stack-label
          />
          <q-input
            v-model.number="form.timeout"
            :rules="[
              (v) => !!v || 'Required',
              (v) => v >= 10 || 'Minimum is 10 seconds',
              (v) => v <= 3600 || 'Maximum is 3600 seconds',
            ]"
            type="number"
            label="Timeout (seconds)"
            hint="Stopped after this long, 10–3600"
            style="max-width: 220px"
            outlined
            dense
            stack-label
            hide-bottom-space
          />
        </q-card-section>
        <FormButtons label="Send" :loading="loading">
          <div class="row items-center no-wrap">
            <q-toggle v-model="followLive" label="Stream Output" />
            <HelpTip
              class="q-ml-xs"
              text="Shows the output line by line while the command runs instead of all at the end"
            />
          </div>
        </FormButtons>
        <template v-if="reply !== null">
          <q-card-section>
            <ScriptOutputCopyClip :data="reply" label="Output" />
            <q-separator />
          </q-card-section>
          <q-card-section
            style="max-height: 50vh"
            class="q-px-md q-pt-none q-ma-none scroll"
          >
            <pre class="send-command__pre">{{ reply }}</pre>
          </q-card-section>
        </template>
        <q-card-section v-if="streamOpen" class="q-py-xs">
          <CommandStream
            :key="runKey"
            :agent-id="agent.agent_id"
            :cmd="streamCommand"
            :shell="form.shell"
            :run_as_user="form.run_as_user"
            :custom_shell="form.custom_shell"
            :timeout="form.timeout"
            @update-output="(text) => (streamText = text)"
            @stream-loaded="loading = false"
            @stream-closed="streamEnded"
          />
          <div v-if="closedSilent" class="text-caption text-negative q-mt-xs">
            Connection closed before the agent sent any output.
          </div>
        </q-card-section>
      </q-form>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { ref, nextTick } from "vue";
import { useDialogPluginComponent } from "quasar";
import { deviceName } from "@/utils/deviceName";
import { cmdPlaceholder } from "@/composables/agents";
import { sendAgentCommand } from "@/api/agents";
import ScriptOutputCopyClip from "@/components/scripts/ScriptOutputCopyClip.vue";
import CommandStream from "@/components/agents/CommandStream.vue";
import DialogHeader from "@/components/ui/DialogHeader.vue";
import HelpTip from "@/components/ui/HelpTip.vue";
import FormButtons from "@/components/agents/FormButtons.vue";

defineOptions({ name: "SendCommand" });
defineEmits([...useDialogPluginComponent.emits]);

const props = defineProps({
  agent: { type: Object, required: true },
});

const { dialogRef, onDialogHide } = useDialogPluginComponent();

const windows = props.agent.plat === "windows";
// FreeBSD base has no bash
const posixShell =
  props.agent.plat === "freebsd"
    ? { label: "sh", value: "/bin/sh" }
    : { label: "Bash", value: "/bin/bash" };
const shellChoices = windows
  ? [
      { label: "CMD", value: "cmd" },
      { label: "PowerShell", value: "powershell" },
    ]
  : [posixShell, { label: "Custom", value: "custom" }];

const form = ref({
  shell: windows ? "cmd" : posixShell.value,
  cmd: null,
  timeout: 30,
  custom_shell: null,
  run_as_user: false,
});

const loading = ref(false);
const reply = ref(null);
const followLive = ref(false);
const streamOpen = ref(false);
const streamText = ref("");
const streamCommand = ref("");
const runKey = ref(0);
const closedSilent = ref(false);

async function submit() {
  loading.value = true;
  reply.value = null;
  streamText.value = "";
  closedSilent.value = false;
  streamOpen.value = false;

  if (followLive.value) {
    streamCommand.value = form.value.cmd;
    // a fresh key remounts the stream component for every run
    await nextTick();
    runKey.value++;
    streamOpen.value = true;
    return;
  }

  try {
    reply.value = await sendAgentCommand(props.agent.agent_id, form.value);
  } catch (e) {
    console.error(e);
  }
  loading.value = false;
}

function streamEnded(completed) {
  loading.value = false;
  if (completed === false && !streamText.value.trim()) {
    closedSilent.value = true;
  }
}
</script>

<style scoped>
.send-command__pre {
  margin: 0;
  font-family: var(--rmm-mono);
  font-size: var(--rmm-fs-sm);
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
