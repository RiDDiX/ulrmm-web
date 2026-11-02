<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-card style="min-width: 70vw">
    <DialogHeader
      title-id="agent-download-title"
      title="Installation instructions"
      subtitle="Run these steps on the device you want to add"
    />
    <q-card-section class="q-gutter-y-md">
      <div v-if="windows">
        <div class="rmm-label">1. Download the installer</div>
        <p class="text-body2 rmm-muted q-mb-sm">
          Download the installer then run the following command from an elevated
          command prompt on the device you want to add.
        </p>
        <q-btn
          type="a"
          :href="info.data.url"
          icon="download"
          label="Download agent"
          color="primary"
          unelevated
        />
      </div>
      <div>
        <div class="rmm-label">
          {{
            windows ? "2. Run the install command" : "Run the install command"
          }}
        </div>
        <p v-if="info.plat === 'darwin'" class="text-body2 rmm-muted q-mb-sm">
          Run the following command from a terminal
        </p>
        <div class="agent-download__cmd rmm-mono">
          <code>{{ info.data.cmd }}</code>
        </div>
        <q-btn
          class="q-mt-sm"
          icon="content_copy"
          label="Copy to clipboard"
          flat
          no-caps
          @click="copyCommand"
        >
          <q-tooltip>Copies the install command to the clipboard</q-tooltip>
        </q-btn>
      </div>
      <q-expansion-item
        label="View optional command line args"
        caption="Flags you can add to the command above"
        header-class="text-primary"
        switch-toggle-side
        expand-separator
      >
        <div class="agent-download__args">
          <template v-for="flag in flags" :key="flag.code">
            <code>{{ flag.code }}</code>
            <span>{{ flag.text }}</span>
          </template>
        </div>
      </q-expansion-item>
      <q-banner v-if="windows" dense class="bg-info">
        <template #avatar>
          <q-icon name="schedule" />
        </template>
        <div>
          Note: The auth token above is valid for {{ info.expires }} hours.
        </div>
        <div>
          The installer executable itself is generic and can be reused for
          future installations.
        </div>
        <div>
          If the token expires, simply generate a new installation command
          rather than downloading the installer again.
        </div>
      </q-banner>
    </q-card-section>
  </q-card>
</template>

<script setup>
import { computed } from "vue";
import { copyToClipboard } from "quasar";
import DialogHeader from "@/components/ui/DialogHeader.vue";
import { notifySuccess } from "@/utils/notify";

defineOptions({ name: "AgentDownload" });

const props = defineProps({
  info: { type: Object, required: true },
});

const windows = computed(() => props.info.plat === "windows");

const flags = computed(() => [
  { code: "-log debug", text: "To enable verbose output during the install" },
  { code: "-silent", text: "Do not popup any message boxes during install" },
  { code: "-nomesh", text: "Don't install the mesh agent" },
  ...(windows.value
    ? [
        {
          code: '-cert "C:\\<some folder or path>\\ca.pem"',
          text: "To use a domain CA",
        },
      ]
    : []),
  {
    code: '-desc "Desired custom description on agent"',
    text: "Set agent description field during install",
  },
  { code: '-proxy "http://proxyserver:port"', text: "Use a http proxy" },
]);

function copyCommand() {
  copyToClipboard(props.info.data.cmd).then(() =>
    notifySuccess("Copied to clipboard"),
  );
}
</script>

<style scoped>
.agent-download__cmd {
  padding: 10px 12px;
  overflow-wrap: anywhere;
  border: 1px solid var(--rmm-border);
  border-radius: var(--rmm-radius-sm);
  background: var(--rmm-surface-2);
  font-size: var(--rmm-fs-sm);
  user-select: all;
}

.agent-download__args {
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr);
  gap: 6px 16px;
  align-items: baseline;
  padding: 8px 12px;
}

.agent-download__args code {
  justify-self: start;
  padding: 1px 6px;
  border-radius: var(--rmm-radius-sm);
  background: var(--rmm-surface-3);
  font-family: var(--rmm-mono);
  font-size: var(--rmm-fs-xs);
}
</style>
