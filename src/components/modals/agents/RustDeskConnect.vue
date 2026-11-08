<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-dialog
    ref="dialogRef"
    aria-labelledby="rustdesk-connect-title"
    @hide="onHide"
  >
    <q-card class="q-dialog-plugin rmm-dialog--md">
      <DialogHeader
        title-id="rustdesk-connect-title"
        :title="
          step === 'installed'
            ? `RustDesk is ready on ${deviceName(agent)}`
            : `Connect to ${deviceName(agent)}`
        "
        subtitle="Opens the RustDesk client on this computer with the device's ID and password"
      />

      <div role="status">
        <q-card-section v-if="step === 'installed'">
          ID <span class="rmm-mono">{{ rustdesk.rustdesk_id }}</span
          ><template v-if="rustdesk.client_version">
            (client {{ rustdesk.client_version }})</template
          >.
        </q-card-section>
        <q-card-section
          v-else-if="step === 'loading'"
          class="row items-center q-gutter-sm"
        >
          <q-spinner size="sm" color="primary" />
          <span>Getting the connection details...</span>
        </q-card-section>
        <q-card-section v-else-if="step === 'failed'" class="text-negative">
          The connection details could not be loaded.
        </q-card-section>
        <q-card-section v-else>
          RustDesk opens on this computer and connects to ID
          <span class="rmm-mono">{{ rustdesk.rustdesk_id }}</span
          >.
        </q-card-section>
      </div>

      <q-card-section v-if="step === 'open'" class="q-pt-none">
        <div class="text-weight-medium">Nothing happened?</div>
        <div class="rmm-muted">
          The RustDesk client has to be installed on this computer, with the
          installer rather than the portable version. Then press Open RustDesk
          again.
        </div>
        <div v-if="downloads.length" class="row q-gutter-sm q-mt-xs">
          <q-btn
            v-for="d in downloads"
            :key="d.url"
            :href="d.url"
            target="_blank"
            rel="noopener"
            download
            no-caps
            color="primary"
            icon="download"
            :unelevated="d.mine"
            :outline="!d.mine"
            :label="d.label"
            :aria-label="`Download RustDesk for ${d.label}`"
          >
            <q-tooltip>{{ d.file }}</q-tooltip>
          </q-btn>
        </div>
        <div v-if="agent.plat === 'darwin'" class="rmm-muted q-mt-sm">
          "ID does not exist", a black screen or no input: on
          {{ deviceName(agent) }}, allow RustDesk under System Settings >
          Privacy &amp; Security > Local Network, Screen Recording and
          Accessibility.
        </div>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat label="Close" @click="onDialogCancel" />
        <q-btn flat label="Copy ID" @click="copyOutput(rustdesk.rustdesk_id)">
          <q-tooltip>Copies the RustDesk ID to the clipboard</q-tooltip>
        </q-btn>
        <q-btn
          v-if="step === 'open'"
          flat
          label="Copy password"
          @click="copyPassword"
        >
          <q-tooltip>Copies the device's RustDesk password</q-tooltip>
        </q-btn>
        <q-btn
          ref="primaryBtn"
          unelevated
          color="primary"
          data-autofocus
          :label="PRIMARY_LABEL[step]"
          :loading="step === 'loading'"
          @click="step === 'open' ? openLink() : reveal()"
        >
          <q-tooltip v-if="step === 'installed' || step === 'failed'"
            >Gets the stored password, which is recorded in the audit log, and
            opens RustDesk</q-tooltip
          >
        </q-btn>
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { computed, nextTick, ref, watch } from "vue";
import { useDialogPluginComponent, useQuasar } from "quasar";
import { revealAgentRustDeskPassword } from "@/api/rustdesk";
import { withStepUp } from "@/components/vault/stepUp";
import { copyOutput, isWebUrl } from "@/utils/helpers";
import DialogHeader from "@/components/ui/DialogHeader.vue";
import { deviceName } from "@/utils/deviceName";

const props = defineProps({
  agent: { type: Object, required: true },
  // GET /agents/<id>/rustdesk/
  rustdesk: { type: Object, required: true },
  // just installed: show the id, don't open yet
  justInstalled: { type: Boolean, default: false },
});

defineEmits([...useDialogPluginComponent.emits]);

const { dialogRef, onDialogHide, onDialogCancel } = useDialogPluginComponent();
const $q = useQuasar();

const PRIMARY_LABEL = {
  installed: "Connect",
  loading: "Open RustDesk again",
  open: "Open RustDesk again",
  failed: "Try again",
};

const step = ref(props.justInstalled ? "installed" : "loading");
const primaryBtn = ref(null);

// plain let. password stays out of the template. wiped on close
let password = "";
let link = "";
let closed = false;

function thisOs() {
  const p = (
    navigator.userAgentData?.platform || navigator.userAgent
  ).toLowerCase();
  if (p.includes("mac")) return "macOS";
  if (p.includes("win")) return "Windows";
  if (p.includes("linux")) return "Linux";
  return null;
}

// own os first; only web links end up in an href
const downloads = computed(() => {
  const os = thisOs();
  const list = (props.rustdesk.downloads ?? [])
    .filter((d) => isWebUrl(d.url))
    .map((d) => ({
      ...d,
      mine: !!os && d.label.startsWith(os),
    }));
  return [...list.filter((d) => d.mine), ...list.filter((d) => !d.mine)];
});

// click a throwaway <a>. protocol handlers don't report success
function openLink() {
  const a = document.createElement("a");
  a.href = link;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

// reveal is audited on the server. axios already toasts the error
async function reveal() {
  step.value = "loading";
  try {
    const data = await withStepUp($q, (config) =>
      revealAgentRustDeskPassword(props.agent.agent_id, config),
    );
    if (closed) return;
    if (!data) {
      step.value = "failed";
      return;
    }
    password = data.password;
    // no uri until rustdesk is configured on the server
    link =
      data.uri ||
      `rustdesk://connection/new/${encodeURIComponent(
        props.rustdesk.rustdesk_id,
      )}?password=${encodeURIComponent(data.password)}`;
    step.value = "open";
    openLink();
  } catch (e) {
    console.error(e);
    step.value = "failed";
  }
}

function copyPassword() {
  copyOutput(password);
}

function onHide() {
  closed = true;
  password = "";
  link = "";
  onDialogHide();
}

watch(step, (s) => {
  if (s !== "loading") nextTick(() => primaryBtn.value?.$el.focus());
});

if (!props.justInstalled) void reveal();
</script>
