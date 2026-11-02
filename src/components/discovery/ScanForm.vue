<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-dialog
    ref="dialogRef"
    aria-labelledby="discovery-scan-title"
    @hide="onDialogHide"
  >
    <q-card class="q-dialog-plugin rmm-dialog--md">
      <DialogHeader
        title-id="discovery-scan-title"
        title="New network scan"
        subtitle="Ping sweep, TCP ports, reverse DNS and optional SNMP, run from the RMM server"
      />
      <q-form @submit="submit">
        <q-card-section class="scroll q-gutter-y-sm" style="max-height: 72vh">
          <q-select
            v-model="networks"
            label="Networks"
            hint="IPv4 networks in CIDR notation, e.g. 192.168.1.0/24; press Enter after each"
            multiple
            use-chips
            use-input
            hide-dropdown-icon
            input-debounce="0"
            dense
            outlined
            :error="!!networkError"
            :error-message="networkError"
            @new-value="addNetworks"
            @input-value="(v) => (pendingNetworks = v)"
            @blur="commit(pendingNetworks, addNetworks)"
            @remove="badNetworks = []"
          />
          <div v-if="info.networks?.length" class="scan-form__offer">
            <div class="row items-center q-gutter-xs">
              <span class="rmm-label">Networks the server may scan</span>
              <HelpTip
                text="Private networks the server has an address in, plus the extra networks set on the server. Attached networks also report MAC addresses."
              />
            </div>
            <div class="row q-gutter-xs">
              <q-chip
                v-for="n in info.networks"
                :key="n.network"
                clickable
                dense
                role="button"
                :aria-pressed="networks.includes(n.network)"
                :outline="!networks.includes(n.network)"
                :color="networks.includes(n.network) ? 'primary' : undefined"
                :icon="networks.includes(n.network) ? 'check' : 'add'"
                @click="toggleNetwork(n.network)"
              >
                <span class="rmm-mono">{{ n.network }}</span>
                <span v-if="n.attached" class="scan-form__attached"
                  >attached</span
                >
                <q-tooltip>
                  {{ n.addresses }} addresses{{
                    n.attached
                      ? ", the server is attached to it"
                      : ", reached through a router"
                  }}
                </q-tooltip>
              </q-chip>
            </div>
          </div>

          <div v-if="vlans.length" class="scan-form__offer">
            <div class="row items-center q-gutter-xs">
              <span class="rmm-label">Scan VLAN</span>
              <HelpTip
                text="VLAN subnets synced from UniFi or OPNsense (Global Settings > Network). Click one to add its network."
              />
            </div>
            <div class="row q-gutter-xs">
              <q-chip
                v-for="v in vlans"
                :key="v.subnet"
                clickable
                dense
                role="button"
                :aria-pressed="networks.includes(v.subnet)"
                :outline="!networks.includes(v.subnet)"
                :color="networks.includes(v.subnet) ? 'primary' : undefined"
                :icon="networks.includes(v.subnet) ? 'check' : 'add'"
                @click="toggleNetwork(v.subnet)"
              >
                {{ v.name || `VLAN ${v.vlan_id}` }}
                <span class="rmm-mono scan-form__attached">{{ v.subnet }}</span>
              </q-chip>
            </div>
          </div>

          <q-select
            v-model="ports"
            label="TCP ports"
            :hint="`Up to ${maxPorts}; connects only, sends nothing. Press Enter after each`"
            multiple
            use-chips
            use-input
            hide-dropdown-icon
            input-debounce="0"
            dense
            outlined
            :error="!!portError"
            :error-message="portError"
            @new-value="addPorts"
            @input-value="(v) => (pendingPorts = v)"
            @blur="commit(pendingPorts, addPorts)"
            @remove="badPorts = []"
          >
            <template #after>
              <q-btn
                flat
                dense
                no-caps
                label="Defaults"
                :disable="!info.default_ports?.length"
                @click="ports = [...info.default_ports]"
              >
                <q-tooltip
                  >Use the server's default ports
                  {{ (info.default_ports || []).join(", ") }}</q-tooltip
                >
              </q-btn>
            </template>
          </q-select>

          <q-input
            v-model="community"
            :type="showCommunity ? 'text' : 'password'"
            label="SNMP community (optional)"
            hint="v2c, read only, for sysName and sysDescr. Cleartext on the network; kept only while the scan runs"
            autocomplete="new-password"
            maxlength="64"
            dense
            outlined
            :rules="[
              (v) => /^[ -~]*$/.test(v) || 'Printable ASCII characters only',
            ]"
          >
            <template #append>
              <q-btn
                flat
                dense
                round
                size="sm"
                :icon="showCommunity ? 'visibility_off' : 'visibility'"
                :aria-label="
                  showCommunity ? 'Hide the community' : 'Show the community'
                "
                @click="showCommunity = !showCommunity"
              >
                <q-tooltip>{{
                  showCommunity ? "Hide the community" : "Show the community"
                }}</q-tooltip>
              </q-btn>
            </template>
          </q-input>

          <q-banner dense rounded class="scan-form__note" role="note">
            <template #avatar>
              <q-icon name="info" size="20px" />
            </template>
            One scan runs at a time. A scan stops after 10 minutes and keeps
            what it found until then. At most {{ maxAddresses }} addresses per
            scan.
          </q-banner>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancel" @click="onDialogCancel" />
          <q-btn
            unelevated
            color="primary"
            label="Start scan"
            type="submit"
            :loading="saving"
          />
        </q-card-actions>
      </q-form>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { computed, onMounted, ref } from "vue";
import { useDialogPluginComponent } from "quasar";
import DialogHeader from "@/components/ui/DialogHeader.vue";
import HelpTip from "@/components/ui/HelpTip.vue";
import { startScan } from "@/api/discovery";
import { fetchVlans } from "@/api/integrations";
import {
  normalizeCidr,
  parseCidr,
  parsePorts,
  subnetOf,
} from "@/components/discovery/ipv4";
import { notifySuccess } from "@/utils/notify";

// info: GET /discovery/networks/
const props = defineProps({ info: { type: Object, default: () => ({}) } });
defineEmits([...useDialogPluginComponent.emits]);
const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } =
  useDialogPluginComponent();

const maxAddresses = computed(() => props.info.max_addresses || 4096);
const maxPorts = computed(() => props.info.max_ports || 16);

const networks = ref([]);
const vlans = ref([]);

// only VLANs that carry a valid subnet can be scanned
onMounted(async () => {
  try {
    const list = await fetchVlans();
    vlans.value = (Array.isArray(list) ? list : []).filter((v) =>
      normalizeCidr(v?.subnet || ""),
    );
  } catch {
    vlans.value = [];
  }
});
const ports = ref([...(props.info.default_ports || [])]);
const community = ref("");
const showCommunity = ref(false);
const pendingNetworks = ref("");
const pendingPorts = ref("");
const badNetworks = ref([]);
const badPorts = ref([]);
const saving = ref(false);
const tried = ref(false);

// an invalid entry stays in the input (done not called) until fixed
function addNetworks(text, done) {
  const parts = text.split(/[\s,;]+/).filter(Boolean);
  const nets = parts.map(normalizeCidr);
  badNetworks.value = parts.filter((_, i) => !nets[i]);
  if (badNetworks.value.length) return;
  networks.value = [...new Set([...networks.value, ...nets])];
  done();
}

function addPorts(text, done) {
  const { ports: valid, bad } = parsePorts(text);
  badPorts.value = bad;
  if (bad.length) return;
  ports.value = [...new Set([...ports.value, ...valid])].sort((a, b) => a - b);
  done();
}

// text typed without Enter counts too. The field reports blur only after a
// click on Start scan was handled, so submit commits it as well
function commit(text, add) {
  if (text.trim()) add(text, () => {});
}

function toggleNetwork(net) {
  badNetworks.value = [];
  networks.value = networks.value.includes(net)
    ? networks.value.filter((n) => n !== net)
    : [...networks.value, net];
}

const networkError = computed(() => {
  if (tried.value && !networks.value.length && !badNetworks.value.length)
    return "Add at least one network";
  if (badNetworks.value.length)
    return `Not an IPv4 network in CIDR notation: ${badNetworks.value.join(", ")}`;
  const allowed = (props.info.networks || []).map((n) => n.network);
  const outside = networks.value.filter(
    (n) => allowed.length && !allowed.some((a) => subnetOf(n, a)),
  );
  if (outside.length)
    return `Outside the networks the server may scan: ${outside.join(", ")}`;
  const total = networks.value.reduce(
    (sum, n) => sum + (parseCidr(n)?.size || 0),
    0,
  );
  if (total > maxAddresses.value)
    return `${total} addresses; at most ${maxAddresses.value} per scan. Pick a smaller network, e.g. a /20 or /24.`;
  return "";
});

const portError = computed(() => {
  if (badPorts.value.length)
    return `Not a port from 1 to 65535: ${badPorts.value.join(", ")}`;
  if (ports.value.length > maxPorts.value)
    return `At most ${maxPorts.value} ports (now ${ports.value.length})`;
  return "";
});

async function submit() {
  commit(pendingNetworks.value, addNetworks);
  commit(pendingPorts.value, addPorts);
  tried.value = true;
  if (!networks.value.length || networkError.value || portError.value) return;
  saving.value = true;
  try {
    const payload = { networks: networks.value, ports: ports.value };
    if (community.value) payload.snmp_community = community.value;
    const scan = await startScan(payload);
    community.value = "";
    notifySuccess(`Scan of ${scan.networks.join(", ")} started`);
    onDialogOK(scan);
  } catch {
    // the error toast comes from the axios boot
  }
  saving.value = false;
}
</script>

<style scoped>
.scan-form__offer {
  padding: 8px 10px;
  border: 1px solid var(--rmm-border);
  border-radius: var(--rmm-radius-sm);
  background: var(--rmm-surface-2);
}

.scan-form__attached {
  margin-left: 6px;
  color: var(--rmm-text-muted);
  font-size: var(--rmm-fs-xs);
}

.scan-form__note {
  color: var(--rmm-text-muted);
  background: var(--rmm-surface-2);
}
</style>
