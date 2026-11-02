<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-dialog
    ref="dialogRef"
    aria-labelledby="netmon-form-title"
    @hide="onDialogHide"
  >
    <q-card class="q-dialog-plugin rmm-dialog--md">
      <DialogHeader
        title-id="netmon-form-title"
        :title="device ? `Edit ${device.name}` : 'New network device'"
        subtitle="Checked from the RMM server, no agent needed on the device"
      />
      <q-form @submit="submit">
        <q-card-section class="scroll q-gutter-y-sm" style="max-height: 72vh">
          <div class="text-subtitle2">Device</div>
          <rmm-select
            v-model="form.site"
            :options="siteOptions"
            label="Site"
            hint="Alerts use this site's template, else its client's or the default; access follows the site"
            map-options
            filterable
            :rules="[(v) => !!v || 'Required']"
          />
          <q-input
            v-model="form.name"
            label="Name"
            maxlength="255"
            dense
            outlined
            :rules="[(v) => !!v?.trim() || 'Required']"
          />
          <q-input
            v-model="form.host"
            label="IPv4 address"
            hint="Only in a network the RMM server is attached to"
            dense
            outlined
            :rules="[(v) => !!v?.trim() || 'Required']"
          />

          <div class="row items-center q-gutter-xs q-pt-sm">
            <span class="text-subtitle2">Checks</span>
            <HelpTip
              text="Turn on ping, a TCP port, SNMP or a monitor; without one the device cannot be saved"
            />
          </div>
          <div class="row items-center no-wrap">
            <q-toggle v-model="form.ping" label="Ping" />
            <HelpTip
              text="ICMP echo from the server. With ping on, no reply means Down."
            />
          </div>
          <q-input
            v-model="ports"
            label="TCP ports"
            hint="Up to 8, comma separated, e.g. 443, 53. Only connects, sends nothing."
            dense
            outlined
          />
          <q-input
            v-model.number="form.interval"
            type="number"
            label="Check every"
            hint="60 to 86400 seconds (1 minute to 1 day)"
            suffix="seconds"
            min="60"
            max="86400"
            dense
            outlined
            :rules="[(v) => (v >= 60 && v <= 86400) || '60 to 86400 seconds']"
          />

          <div class="q-pt-sm">
            <div class="row items-center q-gutter-xs q-mb-xs">
              <span class="text-subtitle2">SNMP (read only)</span>
              <HelpTip
                text="Reads name, uptime and interface states. v3 signs and encrypts; v2c is cleartext"
              />
            </div>
            <q-btn-toggle
              v-model="form.snmp_version"
              :options="SNMP_OPTIONS"
              aria-label="SNMP"
              no-caps
              unelevated
              spread
              toggle-color="primary"
              class="netmon-toggle"
            />
          </div>
          <q-banner
            v-if="form.snmp_version === 'v2c'"
            dense
            rounded
            class="rmm-banner-warning"
            role="status"
          >
            v2c sends the community in cleartext over the network. Use v3 where
            the device supports it.
          </q-banner>
          <template v-if="form.snmp_version !== 'off'">
            <q-input
              v-model.number="form.snmp_port"
              type="number"
              label="SNMP port"
              hint="Usually 161"
              min="1"
              max="65535"
              dense
              outlined
            />
            <SecretInput
              v-if="form.snmp_version === 'v2c'"
              v-model="form.snmp_community"
              v-model:clear="form.snmp_secret_clear"
              :stored="storedSecret"
              label="Community"
            />
            <template v-else>
              <q-input
                v-model="form.snmp_v3_user"
                label="User"
                hint="1 to 32 letters, digits, dot, dash or underscore"
                maxlength="32"
                dense
                outlined
              />
              <q-select
                v-model="form.snmp_v3_auth_proto"
                :options="AUTH_OPTIONS"
                label="Authentication"
                hint="Has to match the user's setting on the device"
                emit-value
                map-options
                dense
                outlined
              />
              <SecretInput
                v-model="form.snmp_auth_key"
                v-model:clear="form.snmp_secret_clear"
                :stored="storedSecret"
                label="Authentication key"
              />
              <SecretInput
                v-model="form.snmp_priv_key"
                v-model:clear="form.snmp_secret_clear"
                :stored="storedSecret"
                label="Privacy key (AES-128)"
              />
              <div class="rmm-muted text-caption">
                Both keys need at least 8 characters.
              </div>
            </template>
            <div v-if="device?.snmp_secret_set" class="rmm-muted text-caption">
              The stored secret is kept only while the version, address{{
                form.snmp_version === "v3" ? ", port and user" : " and port"
              }}
              stay the same. Change one and it has to be entered again.
            </div>
          </template>

          <div class="row items-center q-gutter-xs q-pt-sm">
            <span class="text-subtitle2">Monitors</span>
            <span class="rmm-muted text-caption rmm-num"
              >{{ monitors.length }} of {{ MAX_MONITORS }}</span
            >
          </div>
          <div class="rmm-muted text-caption">
            HTTP(S) and DNS go to the address above only. A server name is sent
            as SNI and Host and checked against the certificate, it is never
            used to connect.
          </div>
          <q-card v-for="(m, i) in monitors" :key="i" flat bordered>
            <q-card-section class="q-pa-sm q-gutter-y-sm">
              <div class="row items-center">
                <div class="col text-body2 text-weight-medium">
                  {{ MONITOR_LABELS[m.type] || m.type }}
                </div>
                <q-btn
                  dense
                  flat
                  round
                  size="sm"
                  icon="delete"
                  color="negative"
                  :aria-label="`Remove monitor ${i + 1}`"
                  @click="monitors.splice(i, 1)"
                >
                  <q-tooltip>Remove this monitor</q-tooltip>
                </q-btn>
              </div>
              <template v-if="m.type === 'http'">
                <div class="row q-col-gutter-sm">
                  <q-select
                    :model-value="m.scheme"
                    :options="['https', 'http']"
                    label="Scheme"
                    dense
                    outlined
                    class="col-4"
                    @update:model-value="(v) => setScheme(m, v)"
                  />
                  <q-select
                    v-model="m.method"
                    :options="['GET', 'HEAD']"
                    label="Method"
                    dense
                    outlined
                    class="col-4"
                  />
                  <q-input
                    v-model.number="m.port"
                    type="number"
                    label="Port"
                    min="1"
                    max="65535"
                    dense
                    outlined
                    class="col-4"
                  />
                </div>
                <q-input
                  v-model="m.path"
                  label="Path"
                  hint="Starts with /, e.g. /health"
                  maxlength="256"
                  dense
                  outlined
                />
                <q-input
                  v-model="m.server_name"
                  label="Server name (optional)"
                  hint="e.g. nas.example.lan, no URL or port"
                  maxlength="253"
                  dense
                  outlined
                />
                <q-input
                  v-model="m.status"
                  label="Expected status"
                  hint="e.g. 200-399, 401. Redirects are reported, not followed."
                  maxlength="64"
                  dense
                  outlined
                />
                <template v-if="m.scheme === 'https'">
                  <div class="row q-col-gutter-sm">
                    <q-input
                      v-model.number="m.warn_days"
                      type="number"
                      label="Certificate warning below"
                      hint="Days left before a warning"
                      suffix="days"
                      min="0"
                      max="365"
                      dense
                      outlined
                      class="col-6"
                    />
                    <q-input
                      v-model.number="m.error_days"
                      type="number"
                      label="Certificate error below"
                      hint="At most the warning days"
                      suffix="days"
                      min="0"
                      max="365"
                      dense
                      outlined
                      class="col-6"
                    />
                  </div>
                  <q-checkbox
                    v-model="m.allow_self_signed"
                    label="Allow a self-signed certificate, the name and expiry are still checked"
                  />
                </template>
              </template>
              <template v-else-if="m.type === 'dns'">
                <div class="row q-col-gutter-sm">
                  <q-input
                    v-model="m.query"
                    label="Name to look up"
                    hint="Asked from the address above on UDP 53"
                    maxlength="253"
                    dense
                    outlined
                    class="col-8"
                  />
                  <q-select
                    v-model="m.record"
                    :options="['A', 'AAAA']"
                    label="Record"
                    dense
                    outlined
                    class="col-4"
                  />
                </div>
                <q-input
                  v-model="m.expect"
                  label="Expected addresses (optional)"
                  hint="Comma separated, up to 8, IPv4 for A and IPv6 for AAAA. The answer has to be exactly these."
                  dense
                  outlined
                />
              </template>
              <template v-else>
                <q-input
                  v-model.number="m.threshold"
                  type="number"
                  label="Alert below toner level"
                  hint="Percent left in the lowest supply. Needs SNMP on (Printer MIB); the page count is recorded too. Low supplies are listed in the device alert"
                  suffix="%"
                  min="1"
                  max="99"
                  dense
                  outlined
                  :rules="[(v) => (v >= 1 && v <= 99) || '1 to 99 percent']"
                />
              </template>
            </q-card-section>
          </q-card>
          <div class="row items-center q-gutter-x-sm">
            <q-btn
              flat
              dense
              no-caps
              icon="add"
              label="HTTP(S) monitor"
              :disable="monitors.length >= MAX_MONITORS"
              @click="monitors.push({ ...HTTP_MONITOR })"
            />
            <q-btn
              flat
              dense
              no-caps
              icon="add"
              label="DNS monitor"
              :disable="monitors.length >= MAX_MONITORS"
              @click="monitors.push({ ...DNS_MONITOR })"
            />
            <!-- a wrapper keeps the tooltip alive while the button is disabled -->
            <div>
              <q-btn
                flat
                dense
                no-caps
                icon="add"
                label="Printer monitor"
                :disable="
                  form.snmp_version === 'off' ||
                  monitors.length >= MAX_MONITORS ||
                  monitors.some((m) => m.type === 'printer')
                "
                @click="monitors.push({ ...PRINTER_MONITOR })"
              />
              <q-tooltip v-if="form.snmp_version === 'off'"
                >Reads the supply levels over SNMP. Turn SNMP on
                first.</q-tooltip
              >
            </div>
            <span
              v-if="monitors.length >= MAX_MONITORS"
              class="rmm-muted text-caption"
              >At most {{ MAX_MONITORS }} monitors per device</span
            >
          </div>

          <div class="text-subtitle2 q-pt-sm">Alerts</div>
          <q-input
            v-model.number="form.fails_b4_alert"
            type="number"
            label="Alert after this many failed checks"
            hint="1 to 100 Down or Degraded results in a row"
            min="1"
            max="100"
            dense
            outlined
          />
          <div>
            <div class="rmm-label">Alert by</div>
            <div class="row q-gutter-x-md">
              <q-checkbox v-model="form.dashboard_alert" label="Dashboard" />
              <q-checkbox v-model="form.email_alert" label="Email" />
              <q-checkbox v-model="form.text_alert" label="SMS" />
            </div>
          </div>
          <div class="rmm-muted text-caption">
            Alert templates apply with their check settings. Script actions need
            an agent and are skipped for network devices.
          </div>

          <div class="text-subtitle2 q-pt-sm">State</div>
          <div class="row items-center no-wrap">
            <q-toggle
              v-model="form.maintenance_mode"
              label="Maintenance mode"
            />
            <HelpTip text="Keeps checking the device but creates no alerts" />
          </div>
          <div class="row items-center no-wrap">
            <q-toggle v-model="form.enabled" label="Enabled" />
            <HelpTip text="Turned off, the device is kept but not checked" />
          </div>
        </q-card-section>
        <DialogActions :loading="saving" @cancel="onDialogCancel" />
      </q-form>
    </q-card>
  </q-dialog>
</template>

<script setup>
import DialogActions from "@/components/ui/DialogActions.vue";
import { computed, reactive, ref } from "vue";
import { useDialogPluginComponent } from "quasar";
import DialogHeader from "@/components/ui/DialogHeader.vue";
import RmmSelect from "@/components/ui/RmmSelect.vue";
import SecretInput from "@/components/ui/SecretInput.vue";
import HelpTip from "@/components/ui/HelpTip.vue";
import { saveNetworkDevice } from "@/api/netmon";
import { useSiteDropdown } from "@/composables/clients";
import { notifySuccess } from "@/utils/notify";

const props = defineProps({
  // null => new
  device: { type: Object, default: null },
});
defineEmits([...useDialogPluginComponent.emits]);
const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } =
  useDialogPluginComponent();

const SNMP_OPTIONS = [
  { value: "off", label: "Off" },
  { value: "v3", label: "v3" },
  { value: "v2c", label: "v2c" },
];
const MAX_MONITORS = 8;
const HTTP_MONITOR = {
  type: "http",
  scheme: "https",
  port: 443,
  path: "/",
  method: "GET",
  server_name: "",
  status: "200-399",
  allow_self_signed: false,
  warn_days: 21,
  error_days: 7,
};
const DNS_MONITOR = { type: "dns", query: "", record: "A", expect: "" };
const PRINTER_MONITOR = { type: "printer", threshold: 15 };
const MONITOR_LABELS = {
  http: "HTTP(S)",
  dns: "DNS",
  printer: "Printer toner",
};
const AUTH_OPTIONS = [
  { value: "sha", label: "SHA-1" },
  { value: "sha224", label: "SHA-224" },
  { value: "sha256", label: "SHA-256" },
  { value: "sha384", label: "SHA-384" },
  { value: "sha512", label: "SHA-512" },
];

// snapshot on open; secrets empty
function initialForm() {
  const d = props.device;
  return {
    site: d?.site ?? null,
    name: d?.name ?? "",
    host: d?.host ?? "",
    enabled: d?.enabled ?? true,
    maintenance_mode: d?.maintenance_mode ?? false,
    interval: d?.interval ?? 300,
    ping: d?.ping ?? true,
    snmp_version: d?.snmp_version ?? "off",
    snmp_port: d?.snmp_port ?? 161,
    snmp_v3_user: d?.snmp_v3_user ?? "",
    snmp_v3_auth_proto: d?.snmp_v3_auth_proto ?? "sha256",
    snmp_community: "",
    snmp_auth_key: "",
    snmp_priv_key: "",
    snmp_secret_clear: false,
    fails_b4_alert: d?.fails_b4_alert ?? 2,
    dashboard_alert: d?.dashboard_alert ?? true,
    email_alert: d?.email_alert ?? false,
    text_alert: d?.text_alert ?? false,
  };
}
const form = reactive(initialForm());
const ports = ref((props.device?.tcp_ports ?? []).join(", "));
// dns expects as text
const monitors = ref(
  (props.device?.monitors ?? []).map((m) =>
    m.type === "dns"
      ? { ...DNS_MONITOR, ...m, expect: (m.expect ?? []).join(", ") }
      : m.type === "printer"
        ? { ...PRINTER_MONITOR, ...m }
        : { ...HTTP_MONITOR, ...m },
  ),
);

function setScheme(m, scheme) {
  if (m.port === (m.scheme === "https" ? 443 : 80))
    m.port = scheme === "https" ? 443 : 80;
  m.scheme = scheme;
}
// secret tied to ver+host+port+user; server re-prompts on mismatch
const storedSecret = computed(
  () =>
    !!props.device?.snmp_secret_set &&
    form.snmp_version === props.device.snmp_version &&
    form.host.trim() === props.device.host &&
    form.snmp_port === props.device.snmp_port &&
    (form.snmp_version !== "v3" ||
      form.snmp_v3_user === props.device.snmp_v3_user),
);
const saving = ref(false);

const { siteOptions, getSiteOptions } = useSiteDropdown();
getSiteOptions();

async function submit() {
  saving.value = true;
  try {
    const tcp_ports = ports.value
      .split(/[\s,]+/)
      .filter(Boolean)
      .map(Number);
    notifySuccess(
      await saveNetworkDevice(props.device?.id, {
        ...form,
        name: form.name.trim(),
        host: form.host.trim(),
        tcp_ports,
        monitors: monitors.value.map((m) =>
          m.type === "dns"
            ? { ...m, expect: m.expect.split(/[\s,]+/).filter(Boolean) }
            : m,
        ),
      }),
    );
    onDialogOK();
  } catch {
    // the error toast comes from the axios boot
  }
  saving.value = false;
}
</script>

<style scoped>
.netmon-toggle {
  border: 1px solid var(--rmm-border-strong);
  border-radius: var(--rmm-radius-sm);
}
</style>
