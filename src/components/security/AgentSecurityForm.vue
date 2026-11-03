<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <div>
    <SettingsPanelHeader
      title="Agent security"
      text="Client certificates (mTLS) tie each agent connection to the key of that agent, so a copied agent token alone no longer works."
    >
      <q-btn
        unelevated
        no-caps
        color="primary"
        label="Save"
        :disable="!settings || !dirty || !!backup.error"
        :loading="saving"
        @click="save"
      />
    </SettingsPanelHeader>
    <div v-if="loading" class="q-py-md rmm-muted" role="status">
      <q-spinner size="1em" class="q-mr-sm" />Loading...
    </div>
    <div v-else-if="!settings" class="q-py-md">
      <div class="rmm-muted q-mb-sm">{{ loadError }}</div>
      <q-btn
        dense
        no-caps
        outline
        color="primary"
        label="Retry"
        @click="load"
      />
    </div>
    <template v-else>
      <div id="mtls-mode-title" class="settings-group-title">
        Certificate mode
      </div>
      <div role="radiogroup" aria-labelledby="mtls-mode-title">
        <div v-for="m in MODES" :key="m.value" class="q-mb-xs">
          <q-radio
            v-model="mode"
            :val="m.value"
            :label="m.label"
            :disable="m.value === 'required' && settings.nats_standard"
            dense
          />
          <div class="text-caption rmm-muted mtls-mode__text">
            {{ m.text }}
          </div>
        </div>
      </div>
      <div
        v-if="err('mtls_mode')"
        class="text-caption text-negative"
        role="alert"
      >
        {{ err("mtls_mode") }}
      </div>
      <div v-if="settings.nats_standard" class="text-caption rmm-muted q-mt-xs">
        Required is not available while NATS listens beyond this server
        (USE_NATS_STANDARD, or NATS_STD_BIND_HOST / NATS_WS_BIND_HOST not on
        localhost): agents then reach NATS without nginx, so their certificate
        cannot be checked there.
      </div>
      <q-banner
        v-if="mode === 'off' && settings.mtls_mode !== 'off'"
        dense
        rounded
        class="rmm-banner-warning q-mt-sm"
        role="status"
      >
        Nothing checks certificates then: an agent token copied from a device
        works from anywhere until it is revoked.
      </q-banner>
      <q-banner
        v-if="
          mode === 'required' &&
          notSeen > 0 &&
          settings.mtls_mode !== 'required'
        "
        dense
        rounded
        class="rmm-banner-warning q-mt-sm"
        role="alert"
      >
        {{ notSeen }} of {{ coverage.agents }}
        {{ coverage.agents === 1 ? "agent was" : "agents were" }} not seen with
        a certificate yet. Once you save, they cannot reach the agent API or
        NATS until they have one; agents too old to request one stay cut off
        until they are updated or reinstalled.
        <div class="q-mt-sm">
          <q-checkbox
            v-model="force"
            dense
            label="Switch anyway. I accept that these agents lose contact."
          />
        </div>
        <div class="text-caption q-mt-xs">
          Forcing it asks for a two-factor code.
        </div>
      </q-banner>

      <div class="settings-group-title">Coverage</div>
      <div class="row q-gutter-md q-mb-sm" role="list">
        <div v-for="k in kpis" :key="k.label" class="mtls-kpi" role="listitem">
          <div class="mtls-kpi__value rmm-num">{{ k.value }}</div>
          <div class="text-caption rmm-muted">{{ k.label }}</div>
        </div>
      </div>
      <div v-if="coverage.missing.length" class="rmm-label q-mb-xs">
        Not covered
      </div>
      <q-table
        v-if="coverage.missing.length"
        dense
        flat
        bordered
        class="rmm-table"
        :rows="coverage.missing"
        :columns="missingColumns"
        row-key="agent_id"
        :pagination="{ rowsPerPage: 0 }"
        hide-pagination
        style="max-height: 260px"
      />
      <div v-if="moreMissing > 0" class="text-caption rmm-muted q-mt-xs">
        And {{ moreMissing }} more not shown.
      </div>

      <div class="settings-group-title">Certificate authority</div>
      <div class="text-caption rmm-muted">SHA-256 fingerprint</div>
      <div class="row items-center no-wrap q-gutter-x-sm">
        <span class="rmm-mono mtls-fingerprint">{{
          settings.ca_fingerprint_sha256 || "Not created yet"
        }}</span>
        <q-btn
          v-if="settings.ca_fingerprint_sha256"
          dense
          flat
          round
          size="sm"
          icon="content_copy"
          aria-label="Copy the CA fingerprint"
          @click="copyOutput(settings.ca_fingerprint_sha256)"
        >
          <q-tooltip>Copy the SHA-256 fingerprint of the agent CA</q-tooltip>
        </q-btn>
      </div>
      <div v-if="settings.ca_not_after" class="text-caption rmm-muted q-mt-xs">
        Valid until {{ formatDate(settings.ca_not_after) }}
      </div>

      <div class="settings-group-title">Certificates</div>
      <q-input
        v-model.number="certDays"
        type="number"
        label="Certificate lifetime"
        suffix="days"
        min="30"
        max="825"
        hint="30 to 825 days; agents renew at the rotation policy's renew point. Applies to certificates issued from now on."
        dense
        outlined
        style="max-width: 320px"
        :error="!!err('cert_days')"
        :error-message="err('cert_days')"
        :rules="[(v) => (v >= 30 && v <= 825) || '30 to 825 days']"
      />
      <div
        v-if="settings.cert_ttl_hours"
        class="text-caption rmm-muted q-mt-xs"
      >
        The global rotation policy sets {{ settings.cert_ttl_hours }} hours now;
        saving a new lifetime here replaces it.
      </div>

      <div class="settings-group-title">Server pins</div>
      <div class="text-caption rmm-muted q-mb-sm">
        Agents accept this server only with a certificate chain that contains
        one of these keys (SHA-256 of the public key, base64). Primary pins come
        from the chain this server presents; backup pins keep agents connected
        when the certificate moves to another key or CA.
      </div>
      <div v-if="!settings.pins" class="rmm-muted q-mb-sm">
        No pin set stored yet.
      </div>
      <template v-else>
        <div class="rmm-kv q-mb-sm" style="max-width: 360px">
          <span>Sequence</span>
          <span class="rmm-num">{{ settings.pins.seq }}</span>
          <template v-if="settings.pins.created">
            <span>Since</span>
            <span>{{ formatDate(settings.pins.created) }}</span>
          </template>
        </div>
        <div v-for="group in pinGroups" :key="group.label" class="q-mb-sm">
          <div class="text-caption rmm-muted">{{ group.label }}</div>
          <div v-if="!group.pins.length" class="rmm-muted">None</div>
          <div
            v-for="(pin, i) in group.pins"
            :key="pin"
            class="row items-center no-wrap q-gutter-x-sm"
          >
            <span class="rmm-mono mtls-fingerprint">{{ pin }}</span>
            <q-btn
              dense
              flat
              round
              size="sm"
              icon="content_copy"
              :aria-label="`Copy ${group.noun} pin ${i + 1}`"
              @click="copyOutput(pin)"
            >
              <q-tooltip>Copy this pin</q-tooltip>
            </q-btn>
          </div>
        </div>
      </template>
      <q-input
        v-model="backupText"
        type="textarea"
        autogrow
        label="Backup pins"
        dense
        outlined
        input-class="rmm-mono"
        :hint="`One pin per line, up to ${MAX_BACKUP_PINS}. Changing them asks for a two-factor code.`"
        :error="!!backupError"
        :error-message="backupError"
        style="max-width: 640px"
      />
      <div class="text-caption rmm-muted q-mt-sm">
        Pin of a certificate or CA in cert.pem:
      </div>
      <div class="row items-center no-wrap q-gutter-x-sm">
        <span class="rmm-mono mtls-fingerprint text-caption">{{
          PIN_COMMAND
        }}</span>
        <q-btn
          dense
          flat
          round
          size="sm"
          icon="content_copy"
          aria-label="Copy the command that prints a pin"
          @click="copyOutput(PIN_COMMAND)"
        >
          <q-tooltip>Copy the command</q-tooltip>
        </q-btn>
      </div>

      <div class="row items-center q-gutter-x-sm q-mt-sm">
        <q-btn
          dense
          no-caps
          outline
          color="primary"
          icon="published_with_changes"
          label="Promote pins"
          :disable="dirty || !settings.pins"
          :loading="busy === 'pins'"
          @click="confirmPromote"
        >
          <q-tooltip v-if="dirty">Save or undo your changes first</q-tooltip>
        </q-btn>
        <span class="text-caption rmm-muted"
          >After the server certificate moved onto a backup pin: clears the old
          backup pins and sends agents a new pin document.</span
        >
      </div>

      <template v-if="settings.sec2_mode">
        <div id="sec2-mode-title" class="settings-group-title">
          Command protection
        </div>
        <div class="text-caption rmm-muted q-mb-sm">
          Agents with an identity key log in to NATS with it and only run
          commands signed by this server, encrypted end to end. Older agents
          keep the token login and plain commands unless this is required.
        </div>
        <div role="radiogroup" aria-labelledby="sec2-mode-title">
          <div v-for="m in SEC2_MODES" :key="m.value" class="q-mb-xs">
            <q-radio v-model="sec2Mode" :val="m.value" :label="m.label" dense />
            <div class="text-caption rmm-muted mtls-mode__text">
              {{ m.text }}
            </div>
          </div>
        </div>
        <div
          v-if="err('sec2_mode')"
          class="text-caption text-negative"
          role="alert"
        >
          {{ err("sec2_mode") }}
        </div>
        <q-banner
          v-if="sec2Lowered"
          dense
          rounded
          class="rmm-banner-warning q-mt-sm"
          role="status"
        >
          {{
            sec2Mode === "off"
              ? "Agents then run plain, unsigned commands again and keep the token login."
              : "Agents without an identity key reach NATS and run plain commands again."
          }}
          Lowering it asks for a two-factor code.
        </q-banner>
        <q-banner
          v-if="sec2Switching && sec2Missing > 0"
          dense
          rounded
          class="rmm-banner-warning q-mt-sm"
          role="alert"
        >
          {{ sec2Missing }} of {{ sec2Coverage.agents }}
          {{ sec2Coverage.agents === 1 ? "agent has" : "agents have" }} no
          identity key or token family yet. Once you save, they lose NATS until
          they are updated.
          <div class="q-mt-sm">
            <q-checkbox
              v-model="sec2Force"
              dense
              label="Switch anyway. I accept that these agents lose contact."
            />
          </div>
          <div class="text-caption q-mt-xs">
            Forcing it asks for a two-factor code.
          </div>
        </q-banner>
        <div class="row q-gutter-md q-my-sm" role="list">
          <div
            v-for="k in sec2Kpis"
            :key="k.label"
            class="mtls-kpi"
            role="listitem"
          >
            <div class="mtls-kpi__value rmm-num">{{ k.value }}</div>
            <div class="text-caption rmm-muted">{{ k.label }}</div>
          </div>
        </div>
        <div v-if="sec2Coverage.missing.length" class="rmm-label q-mb-xs">
          Without an identity key
        </div>
        <q-table
          v-if="sec2Coverage.missing.length"
          dense
          flat
          bordered
          class="rmm-table"
          :rows="sec2Coverage.missing"
          :columns="missingColumns"
          row-key="agent_id"
          :pagination="{ rowsPerPage: 0 }"
          hide-pagination
          style="max-height: 260px"
        />
        <div v-if="sec2MoreMissing > 0" class="text-caption rmm-muted q-mt-xs">
          And {{ sec2MoreMissing }} more not shown.
        </div>

        <div class="settings-group-title">Command keys</div>
        <div class="text-caption rmm-muted q-mb-sm">
          The server signs commands with the current key. A new key starts as
          next and becomes current once every agent knows it, at the latest
          after 24 hours; retired keys stay valid for 7 more days.
        </div>
        <div v-if="!commandKeys.length" class="rmm-muted q-mb-sm">
          No command key yet. The first one is made with the first signed
          command.
        </div>
        <div
          v-for="k in commandKeys"
          :key="k.kid"
          class="row items-center no-wrap q-gutter-x-sm q-mb-xs"
        >
          <span class="rmm-mono">{{ k.kid }}</span>
          <span class="rmm-pill" :class="KEY_STATE[k.state].cls">{{
            KEY_STATE[k.state].label
          }}</span>
        </div>
        <q-btn
          dense
          no-caps
          outline
          color="primary"
          icon="autorenew"
          label="Rotate command key"
          class="q-mt-xs"
          :disable="dirty || commandKeys.some((k) => k.state === 'next')"
          :loading="busy === 'cmdkey'"
          @click="confirmRotateKey"
        >
          <q-tooltip v-if="dirty">Save or undo your changes first</q-tooltip>
          <q-tooltip v-else-if="commandKeys.some((k) => k.state === 'next')"
            >A new key is already waiting to become current</q-tooltip
          >
        </q-btn>
      </template>

      <div class="settings-group-title">Security events</div>
      <SecurityEventsTable />
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useQuasar } from "quasar";
import { useStore } from "vuex";
import SettingsPanelHeader from "@/components/modals/coresettings/SettingsPanelHeader.vue";
import SecurityEventsTable from "@/components/security/SecurityEventsTable.vue";
import {
  MAX_BACKUP_PINS,
  fetchAgentSecurity,
  parseBackupPins,
  promotePins,
  rotateCommandKey,
  saveAgentSecurity,
  type AgentSecurity,
  type CommandKey,
  type Coverage,
  type MtlsMode,
  type Sec2Coverage,
  type Sec2Mode,
} from "@/api/security";
import {
  serverErrors,
  stepUpCall,
  withStepUp,
} from "@/components/vault/stepUp";
import { copyOutput } from "@/utils/helpers";
import { notifyError, notifySuccess } from "@/utils/notify";

const MODES: { value: MtlsMode; label: string; text: string }[] = [
  {
    value: "off",
    label: "Off",
    text: "No certificates are issued or checked.",
  },
  {
    value: "optional",
    label: "Optional",
    text: "Agents get a certificate and renew it on their own. A certificate an agent presents has to be its own; agents without one still connect.",
  },
  {
    value: "required",
    label: "Required",
    text: "The agent API and the NATS connection need a valid certificate of that agent.",
  },
];

const SEC2_MODES: { value: Sec2Mode; label: string; text: string }[] = [
  {
    value: "off",
    label: "Off",
    text: "Commands go out unsigned and in plain text. Agents still register their identity key for later.",
  },
  {
    value: "optional",
    label: "Optional",
    text: "Agents with an identity key get signed, encrypted commands and refuse plain ones; older agents keep working as before.",
  },
  {
    value: "required",
    label: "Required",
    text: "Only agents with an identity key reach NATS. Plain commands are never sent.",
  },
];
const SEC2_RANK: Record<Sec2Mode, number> = {
  off: 0,
  optional: 1,
  required: 2,
};

const KEY_STATE: Record<CommandKey["state"], { label: string; cls: string }> = {
  current: { label: "Current", cls: "rmm-pill--positive" },
  next: { label: "Next", cls: "rmm-pill--info" },
  retired: { label: "Retired", cls: "rmm-pill--neutral" },
};

const PIN_COMMAND =
  "openssl x509 -in cert.pem -pubkey -noout | openssl pkey -pubin -outform der | openssl dgst -sha256 -binary | base64";

const $q = useQuasar();
const store = useStore();
const formatDate = (v: string) => store.getters.formatDate(v) as string;

const settings = ref<AgentSecurity | null>(null);
const mode = ref<MtlsMode>("optional");
const certDays = ref(180);
const force = ref(false);
const sec2Mode = ref<Sec2Mode>("optional");
const sec2Force = ref(false);
const busy = ref<"" | "pins" | "cmdkey">("");
const backupText = ref("");
const loading = ref(true);
const loadError = ref("");
const saving = ref(false);
const errors = ref<Record<string, unknown>>({});

// list fields answer per item, e.g. {"backup_pins": {"1": ["..."]}}
const firstText = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return "";
  return Object.values(value).map(firstText).find(Boolean) ?? "";
};
const err = (key: string) => firstText(errors.value[key]);

const backup = computed(() => parseBackupPins(backupText.value));
const backupChanged = computed(
  () =>
    !!settings.value &&
    backup.value.pins.join("\n") !== settings.value.backup_pins.join("\n"),
);
// a server error on the pins goes once they are edited
watch(backupText, () => delete errors.value.backup_pins);
const backupError = computed(() => backup.value.error || err("backup_pins"));
const pinGroups = computed(() => [
  {
    label: "Primary",
    noun: "primary",
    pins: settings.value?.pins?.primary ?? [],
  },
  { label: "Backup", noun: "backup", pins: settings.value?.pins?.backup ?? [] },
]);

const coverage = computed<Coverage>(
  () =>
    settings.value?.coverage ?? {
      agents: 0,
      with_cert: 0,
      seen_with_cert: 0,
      missing: [],
    },
);
const notSeen = computed(() =>
  Math.max(0, coverage.value.agents - coverage.value.seen_with_cert),
);
// the server lists the agents not seen with a certificate, capped
const moreMissing = computed(
  () => notSeen.value - coverage.value.missing.length,
);
const kpis = computed(() => [
  { label: "Agents", value: coverage.value.agents },
  { label: "With a certificate", value: coverage.value.with_cert },
  { label: "Seen using it", value: coverage.value.seen_with_cert },
]);
const sec2Coverage = computed<Sec2Coverage>(
  () =>
    settings.value?.sec2_coverage ?? {
      agents: 0,
      with_identity: 0,
      with_family: 0,
      missing: [],
    },
);
// an agent counts once it has both an identity and a token family
const sec2Missing = computed(() =>
  Math.max(0, sec2Coverage.value.agents - sec2Coverage.value.with_family),
);
const sec2MoreMissing = computed(
  () => sec2Missing.value - sec2Coverage.value.missing.length,
);
const sec2Kpis = computed(() => [
  { label: "Agents", value: sec2Coverage.value.agents },
  { label: "With an identity key", value: sec2Coverage.value.with_identity },
  { label: "With a token family", value: sec2Coverage.value.with_family },
]);
const sec2Switching = computed(
  () =>
    sec2Mode.value === "required" && settings.value?.sec2_mode !== "required",
);
const sec2Lowered = computed(
  () =>
    !!settings.value?.sec2_mode &&
    SEC2_RANK[sec2Mode.value] < SEC2_RANK[settings.value.sec2_mode],
);
const commandKeys = computed(() => settings.value?.pins?.cmd ?? []);

const missingColumns = [
  {
    name: "hostname",
    label: "Agent",
    field: "hostname",
    align: "left" as const,
    sortable: true,
  },
  {
    name: "version",
    label: "Agent version",
    field: "version",
    align: "left" as const,
    sortable: true,
  },
  {
    name: "last_seen",
    label: "Last seen",
    field: "last_seen",
    align: "left" as const,
    format: (v: string | null) => (v ? formatDate(v) : "Never"),
    sortable: true,
  },
];

const dirty = computed(
  () =>
    !!settings.value &&
    (mode.value !== settings.value.mtls_mode ||
      certDays.value !== settings.value.cert_days ||
      (!!settings.value.sec2_mode &&
        sec2Mode.value !== settings.value.sec2_mode) ||
      backupChanged.value),
);

function apply(data: AgentSecurity) {
  settings.value = data;
  mode.value = data.mtls_mode;
  certDays.value = data.cert_days;
  backupText.value = data.backup_pins.join("\n");
  force.value = false;
  sec2Mode.value = data.sec2_mode ?? "optional";
  sec2Force.value = false;
}

async function load() {
  loading.value = true;
  loadError.value = "";
  try {
    apply(await fetchAgentSecurity());
  } catch (e) {
    settings.value = null;
    loadError.value =
      (e as { response?: { status?: number } })?.response?.status === 403
        ? "Your role cannot view Global Settings."
        : "Agent security could not be loaded.";
  } finally {
    loading.value = false;
  }
}

async function save() {
  if (certDays.value < 30 || certDays.value > 825) return;
  if (backup.value.error) return;
  saving.value = true;
  errors.value = {};
  const sec2Changed =
    !!settings.value?.sec2_mode && sec2Mode.value !== settings.value.sec2_mode;
  // one force flag covers both switches, so it is sent only when every
  // switch to required that lacks coverage was confirmed
  const forced = [
    mode.value === "required" &&
    settings.value?.mtls_mode !== "required" &&
    notSeen.value > 0
      ? force.value
      : null,
    sec2Switching.value && sec2Missing.value > 0 ? sec2Force.value : null,
  ].filter((v) => v !== null);
  const payload = {
    mtls_mode: mode.value,
    cert_days: certDays.value,
    ...(sec2Changed ? { sec2_mode: sec2Mode.value } : {}),
    ...(forced.length && forced.every(Boolean) ? { force: true } : {}),
    ...(backupChanged.value ? { backup_pins: backup.value.pins } : {}),
  };
  try {
    const saved = await stepUpCall($q, (config: { silent: boolean }) =>
      saveAgentSecurity(payload, config),
    );
    if (!saved) return;
    apply(saved);
    notifySuccess("Agent security saved");
  } catch (e) {
    const { fields, message } = serverErrors(e);
    errors.value = fields;
    // a refused switch to required comes back with the current coverage
    const data = (
      e as {
        response?: {
          data?: { coverage?: Coverage; sec2_coverage?: Sec2Coverage };
        };
      }
    )?.response?.data;
    if (settings.value && data?.coverage)
      settings.value = { ...settings.value, coverage: data.coverage };
    if (settings.value && data?.sec2_coverage)
      settings.value = { ...settings.value, sec2_coverage: data.sec2_coverage };
    if (
      !err("mtls_mode") &&
      !err("cert_days") &&
      !err("backup_pins") &&
      !err("sec2_mode")
    )
      notifyError(message);
  } finally {
    saving.value = false;
  }
}

// both act at once and change the pin document, so the page reloads after
async function act(
  what: "pins" | "cmdkey",
  call: (config: { silent: boolean }) => Promise<unknown>,
  done: string,
) {
  busy.value = what;
  try {
    if ((await withStepUp($q, call)) === null) return;
    notifySuccess(done);
    await load();
  } finally {
    busy.value = "";
  }
}

function confirmRotateKey() {
  $q.dialog({
    title: "Rotate the command key?",
    message:
      "A new signing key is made and sent to the agents with the pin document. It becomes current once every agent knows it, at the latest after 24 hours.",
    cancel: { label: "Cancel", flat: true },
    ok: { label: "Rotate command key", color: "primary", noCaps: true },
    persistent: true,
  }).onOk(() => act("cmdkey", rotateCommandKey, "A new command key was made"));
}

function confirmPromote() {
  $q.dialog({
    title: "Promote the pins?",
    message:
      "The old backup pins are cleared and agents get a new pin document. The server refuses this unless its current certificate chain contains one of the backup pins.",
    cancel: { label: "Cancel", flat: true },
    ok: { label: "Promote pins", color: "primary", noCaps: true },
    persistent: true,
  }).onOk(() => act("pins", promotePins, "The pins were promoted"));
}

onMounted(load);
</script>

<style scoped>
.mtls-mode__text {
  padding-left: 28px;
}

.mtls-kpi {
  min-width: 120px;
  padding: 8px 12px;
  border: 1px solid var(--rmm-border);
  border-radius: var(--rmm-radius-sm);
  background: var(--rmm-surface-2);
}

.mtls-kpi__value {
  color: var(--rmm-text);
  font-size: var(--rmm-fs-lg);
  font-weight: 600;
}

.mtls-fingerprint {
  overflow-wrap: anywhere;
}
</style>
