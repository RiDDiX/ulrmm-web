<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-card class="rmm-dialog--md">
    <DialogHeader
      title-id="install-agent-title"
      title="Add an agent"
      subtitle="Builds an installer or install script for a client and site"
    />
    <q-form @submit.prevent="build">
      <div class="scroll" style="max-height: 70vh">
        <q-card-section class="q-gutter-y-sm">
          <div class="rmm-label">Where the device belongs</div>
          <q-select
            v-model="client"
            v-bind="selectLook"
            :options="clientOptions"
            label="Client"
            @update:model-value="site = siteOptions[0]"
          />
          <q-select
            v-model="site"
            v-bind="selectLook"
            :options="siteOptions"
            label="Site"
          />
        </q-card-section>

        <q-card-section class="q-pt-none">
          <div class="row items-center q-gutter-x-xs">
            <div id="install-agent-os" class="rmm-label">Operating system</div>
            <HelpTip
              text="TrueNAS SCALE: pick Linux; the script detects TrueNAS and installs the agent so it survives TrueNAS updates"
            />
          </div>
          <div
            class="q-gutter-sm"
            role="radiogroup"
            aria-labelledby="install-agent-os"
          >
            <q-radio
              v-for="o in platforms"
              :key="o.val"
              v-model="plat"
              :val="o.val"
              :label="o.label"
              @update:model-value="pickPlatform(o)"
            />
          </div>
        </q-card-section>

        <q-card-section class="q-pt-none">
          <div class="row items-center q-gutter-x-xs">
            <div id="install-agent-arch" class="rmm-label">Architecture</div>
            <HelpTip
              text="Must match the processor: 64 bit for most PCs; on a Mac, Apple Silicon (M-series) or Intel"
            />
          </div>
          <div
            class="q-gutter-sm"
            role="radiogroup"
            aria-labelledby="install-agent-arch"
          >
            <q-radio
              v-for="a in archChoices"
              v-show="a.on.includes(plat)"
              :key="a.label"
              v-model="goarch"
              :val="a.val"
              :label="a.label"
            />
          </div>
        </q-card-section>

        <q-card-section class="q-pt-none">
          <div class="row items-center q-gutter-x-xs">
            <div id="install-agent-type" class="rmm-label">Agent type</div>
            <HelpTip
              text="Servers and workstations can get different policies and alert templates"
            />
          </div>
          <div
            class="q-gutter-sm"
            role="radiogroup"
            aria-labelledby="install-agent-type"
          >
            <q-radio
              v-for="t in agentTypes"
              :key="t.val"
              v-model="agenttype"
              :val="t.val"
              :label="t.label"
              @update:model-value="
                (v) => v === 'server' && (options.power = false)
              "
            />
          </div>
        </q-card-section>

        <q-card-section class="q-pt-none">
          <div class="rmm-label q-mb-sm">Installer</div>
          <div v-show="plat === 'windows'" class="q-mb-sm">
            <div class="row items-center q-gutter-x-xs">
              <div id="install-agent-method" class="rmm-label">
                Installation method
              </div>
              <HelpTip
                text="Standard EXE: a download plus a command to run. PowerShell: one script does both"
              />
            </div>
            <div
              class="q-gutter-sm"
              role="radiogroup"
              aria-labelledby="install-agent-method"
            >
              <q-radio v-model="method" val="manual" label="Standard EXE" />
              <q-radio v-model="method" val="powershell" label="PowerShell" />
            </div>
          </div>
          <q-input
            v-model.number="expires"
            :rules="[
              (v) =>
                (Number.isInteger(v) && v >= 1) ||
                'Enter a whole number of hours (1 or more)',
            ]"
            type="number"
            min="1"
            label="Token expiration (hours)"
            hint="The installer stops working after this long"
            style="max-width: 260px"
            outlined
            dense
            stack-label
            hide-bottom-space
          />
        </q-card-section>

        <q-card-section v-show="plat === 'windows'" class="q-pt-none">
          <div class="rmm-label">Windows options</div>
          <div class="column">
            <div
              v-for="(o, i) in windowsOptions"
              v-show="!o.workstationOnly || agenttype === 'workstation'"
              :key="o.key"
              :class="['row items-center no-wrap', { 'q-mt-xs': i > 0 }]"
            >
              <q-checkbox v-model="options[o.key]" :label="o.label" dense />
              <HelpTip class="q-ml-xs" :text="o.help" />
            </div>
          </div>
        </q-card-section>
      </div>

      <FormButtons :label="buttonLabel" />
    </q-form>
    <q-dialog v-model="showDownload" aria-labelledby="agent-download-title">
      <AgentDownload :info="downloadInfo" @close="showDownload = false" />
    </q-dialog>
  </q-card>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import { exportFile, useQuasar } from "quasar";
import axios from "axios";
import { getBaseUrl } from "@/boot/axios";
import { notifyError } from "@/utils/notify";
import { useBrandingStore } from "@/stores/branding";
import * as arch from "@/constants/constants";
import AgentDownload from "@/components/modals/agents/AgentDownload.vue";
import DialogHeader from "@/components/ui/DialogHeader.vue";
import HelpTip from "@/components/ui/HelpTip.vue";
import FormButtons from "@/components/agents/FormButtons.vue";

defineOptions({ name: "InstallAgent" });

const props = defineProps({
  sitepk: Number,
});

const $q = useQuasar();

// default install method per platform
const platforms = [
  { val: "windows", label: "Windows", method: "manual" },
  { val: "linux", label: "Linux", method: "bash" },
  { val: "darwin", label: "macOS", method: "mac" },
  { val: "freebsd", label: "FreeBSD", method: "freebsd" },
];

const archChoices = [
  {
    val: arch.GOARCH_AMD64,
    label: "64 bit",
    on: ["windows", "linux", "freebsd"],
  },
  { val: arch.GOARCH_AMD64, label: "Intel 64 bit", on: ["darwin"] },
  { val: arch.GOARCH_i386, label: "32 bit", on: ["windows", "linux"] },
  { val: arch.GOARCH_ARM64, label: "ARM 64 bit", on: ["linux", "freebsd"] },
  { val: arch.GOARCH_ARM64, label: "Apple Silicon (M-Series)", on: ["darwin"] },
  { val: arch.GOARCH_ARM32, label: "ARM 32 bit", on: ["linux"] },
];

const agentTypes = [
  { val: "server", label: "Server" },
  { val: "workstation", label: "Workstation" },
];
const selectLook = { outlined: true, dense: true, optionsDense: true };

const windowsOptions = [
  {
    key: "rdp",
    label: "Enable RDP",
    help: "Turns on Remote Desktop and its Windows firewall rule during install",
  },
  {
    key: "ping",
    label: "Enable Ping",
    help: "Enable ICMP echo requests in the local firewall, so the device answers ping",
  },
  {
    key: "power",
    label: "Disable sleep/hibernate",
    help: "Never sleeps, hibernates or turns off display/disk; fast startup and lid-close sleep off",
    workstationOnly: true,
  },
];

const buttonLabels = {
  powershell: "Download PowerShell script",
  manual: "Show installation instructions",
  bash: "Download Linux install script",
  mac: "Show installation instructions",
  freebsd: "Download FreeBSD install script",
};

const clientOptions = ref([]);
const client = ref(null);
const site = ref(null);
const agenttype = ref("server");
const expires = ref(24);
const options = reactive({ power: false, rdp: false, ping: false });
const method = ref("manual");
const goarch = ref(arch.GOARCH_AMD64);
const plat = ref("windows");
const showDownload = ref(false);
const downloadInfo = ref({});

const siteOptions = computed(() =>
  client.value
    ? client.value.sites.map((s) => ({ label: s.name, value: s.id }))
    : [],
);
const buttonLabel = computed(() => buttonLabels[method.value]);

function pickPlatform(entry) {
  method.value = entry.method;
  goarch.value = arch.GOARCH_AMD64;
}

async function loadClients() {
  $q.loading.show();
  try {
    const { data } = await axios.get("/clients/");
    clientOptions.value = data.map((c) => ({
      label: c.name,
      value: c.id,
      sites: c.sites,
    }));
    if (props.sitepk != null) {
      for (const c of clientOptions.value) {
        const match = c.sites.find((s) => s.id === props.sitepk);
        if (match) {
          client.value = c;
          site.value = { value: match.id, label: match.name };
        }
      }
    } else {
      client.value = clientOptions.value[0];
      site.value = siteOptions.value[0];
    }
  } catch {
    // the interceptor reports it
  }
  $q.loading.hide();
}

const slug = (text) =>
  text
    .replace(/\s/g, "")
    .toLowerCase()
    .replace(/([^a-zA-Z0-9]+)/g, "");

async function build() {
  const prefix = useBrandingStore()
    .productName.toLowerCase()
    .replace(/([^a-zA-Z0-9]+)/g, "");
  const stem = `${prefix}-${slug(client.value.label)}-${slug(site.value.label)}-${agenttype.value}`;

  const body = {
    installMethod: method.value,
    client: client.value.value,
    site: site.value.value,
    expires: expires.value,
    agenttype: agenttype.value,
    power: options.power ? 1 : 0,
    rdp: options.rdp ? 1 : 0,
    ping: options.ping ? 1 : 0,
    goarch: goarch.value,
    api: getBaseUrl(),
    fileName: `${stem}-${goarch.value}.exe`,
    plat: plat.value,
  };

  if (["manual", "mac"].includes(method.value)) {
    const { data } = await axios.post("/agents/installer/", body);
    downloadInfo.value = {
      expires: expires.value,
      data,
      goarch: goarch.value,
      plat: plat.value,
    };
    showDownload.value = true;
    return;
  }

  // powershell, bash and freebsd: the script itself is downloaded
  const scriptName = `${stem}.${method.value === "powershell" ? "ps1" : "sh"}`;
  $q.loading.show();
  try {
    const { data } = await axios.post("/agents/installer/", body, {
      responseType: "blob",
    });
    const saved = exportFile(scriptName, data, { mimeType: "text/plain" });
    $q.loading.hide();
    if (saved === true) announceDownload(scriptName);
    else notifyError("The browser blocked the download.");
  } catch {
    $q.loading.hide();
  }
}

function announceDownload(scriptName) {
  const runHints = {
    bash: `Copy ${scriptName} to the endpoint and run it as root: sudo bash ./${scriptName}. The script removes itself after the install.`,
    freebsd: `Copy ${scriptName} to the device and run it as root (FreeBSD has no sudo by default): sh ./${scriptName}. The script removes itself after the install.${
      goarch.value === arch.GOARCH_ARM64
        ? " ARM 64 bit devices get no Mesh agent, so Take Control is not available on them."
        : ""
    }`,
    powershell: `Run ${scriptName} in an elevated PowerShell: powershell -ExecutionPolicy Bypass -File .\\${scriptName}.`,
  };
  const runHint = runHints[method.value];
  $q.dialog({
    message: `Installer for ${client.value.label}, ${site.value.label} (${agenttype.value}) has been downloaded.
              ${runHint} The token inside is valid for ${expires.value} hours.`,
  });
}

onMounted(loadClients);
</script>
