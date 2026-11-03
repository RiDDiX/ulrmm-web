<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <div class="rmm-label q-mb-sm">Agent</div>
  <div class="column q-gutter-y-sm">
    <q-input
      v-if="'display_name' in info"
      v-model="info.display_name"
      :placeholder="info.hostname"
      :hint="`Shown in the dashboard and in MeshCentral. Empty shows the hostname ${info.hostname}, which stays unchanged on the computer`"
      :rules="[(v) => displayNameError(v) || true]"
      label="Display name"
      outlined
      dense
      hide-bottom-space
    />
    <rmm-select
      v-model="info.site"
      :options="siteOptions"
      label="Site"
      hint="Moving the agent to another site can change which policies apply"
      hide-bottom-space
      outlined
      mapOptions
      filterable
    />
    <q-select
      v-model="info.monitoring_type"
      :options="monitoringTypes"
      label="Type"
      emit-value
      map-options
      hint="Servers and workstations can get different policies and alert templates"
      hide-bottom-space
      outlined
      dense
      options-dense
    />
    <q-input v-model="info.description" label="Description" outlined dense />
    <rmm-select
      v-model="timezone"
      :options="timezones"
      :hint="`Used for scheduled reboots, patching and maintenance. ${
        tzInherited
          ? 'Follows the global default until you pick one'
          : 'Set for this agent; clear it to follow the global default again'
      }`"
      label="Timezone"
      clearable
      hide-bottom-space
      filterable
      outlined
      dense
      options-dense
    />
  </div>

  <div class="row items-center q-gutter-x-xs q-mt-lg">
    <div id="edit-agent-shell" class="rmm-label">Default Terminal</div>
    <HelpTip text="Shell that the remote terminal opens on this agent" />
  </div>
  <q-option-group
    v-if="info.plat"
    v-model="info.default_shell"
    :options="shellChoices"
    class="q-gutter-lg"
    aria-labelledby="edit-agent-shell"
    type="radio"
    inline
    dense
  />
  <q-input
    v-if="info.default_shell === 'custom'"
    v-model="info.default_shell_custom"
    class="q-mt-md"
    placeholder="Enter custom shell path"
    aria-label="Custom shell path"
    dense
    outlined
    bottom-slots
  >
    <template #hint>{{ shellExample }}</template>
  </q-input>

  <div class="rmm-label q-mt-lg q-mb-sm">Checks and status</div>
  <div class="column q-gutter-y-sm">
    <q-input
      v-for="f in timingFields"
      :key="f.key"
      v-model.number="info[f.key]"
      :label="f.label"
      :hint="f.hint"
      :rules="f.rules"
      type="number"
      outlined
      dense
      hide-bottom-space
    >
      <template v-if="f.color" #prepend>
        <q-icon name="fas fa-signal" size="1em" :color="f.color" />
      </template>
    </q-input>
  </div>

  <div class="row items-center q-gutter-x-xs q-mt-lg">
    <div class="rmm-label">Overdue alerts</div>
    <HelpTip
      text="Sent when this agent becomes overdue; an alert template can also turn them on"
    />
  </div>
  <div class="column">
    <q-checkbox
      v-for="[key, label] in alertFlags"
      :key="key"
      v-model="info[key]"
      :label="label"
    />
  </div>
</template>

<script setup>
import { computed, toRef } from "vue";
import { useStore } from "vuex";
import { displayNameError } from "@/utils/deviceName";
import RmmSelect from "@/components/ui/RmmSelect.vue";
import HelpTip from "@/components/ui/HelpTip.vue";

const props = defineProps({
  agent: { type: Object, required: true },
  siteOptions: { type: Array, default: () => [] },
  timezones: { type: Array, default: () => [] },
  tzInherited: Boolean,
});
const timezone = defineModel("timezone");
const info = toRef(props, "agent");
const store = useStore();

const monitoringTypes = [
  { label: "Server", value: "server" },
  { label: "Workstation", value: "workstation" },
];

const alertFlags = [
  ["overdue_email_alert", "Get overdue email alerts"],
  ["overdue_text_alert", "Get overdue sms alerts"],
  ["overdue_dashboard_alert", "Get overdue dashboard alerts"],
];

const minutes = (min) => [
  (v) => !!v || "Required",
  (v) => v >= min || `Minimum is ${min} minutes`,
  (v) => v < 9999999 || "Maximum is 9999999 minutes",
];

const timingFields = computed(() => [
  {
    key: "check_interval",
    label: "Run checks every (seconds)",
    hint: "How often this agent runs its checks, unless a check sets its own interval",
    rules: [
      (v) => !!v || "Required",
      (v) => v >= 15 || "Minimum is 15 seconds",
      (v) => v <= 86400 || "Maximum is 86400 seconds",
    ],
  },
  {
    key: "offline_time",
    label: "Mark as offline after (minutes)",
    hint: "The agent shows as offline when it has not checked in for this long",
    rules: minutes(2),
    color: store.state.dash_warning_color,
  },
  {
    key: "overdue_time",
    label: "Mark as overdue after (minutes)",
    hint: "After this long without a check-in the agent counts as overdue when an alert below or its alert template watches it, otherwise it shows as offline",
    rules: minutes(3),
    color: store.state.dash_negative_color,
  },
]);

const INHERIT = { label: "Inherit from Global Setting", value: "use_global" };
const CUSTOM = { label: "Custom", value: "custom" };
const shellsByPlat = {
  windows: [
    { label: "CMD", value: "cmd" },
    { label: "PowerShell", value: "powershell" },
  ],
  linux: [{ label: "Bash", value: "bash" }],
  darwin: [{ label: "Bash", value: "bash" }],
  freebsd: [
    { label: "sh", value: "sh" },
    { label: "Bash", value: "bash" },
  ],
};
const shellChoices = computed(() => {
  const own = shellsByPlat[info.value.plat];
  return own ? [INHERIT, ...own, CUSTOM] : [];
});

const shellExamples = {
  windows: "C:\\Program Files\\PowerShell\\7\\pwsh.exe",
  linux: "/usr/bin/fish",
  darwin: "/bin/zsh",
  freebsd: "/usr/local/bin/zsh",
};
const shellExample = computed(() =>
  shellExamples[info.value.plat]
    ? `Enter custom shell path (e.g. ${shellExamples[info.value.plat]})`
    : "Enter custom shell path",
);
</script>
