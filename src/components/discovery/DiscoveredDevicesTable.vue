<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <div>
    <q-banner
      v-if="error && rows.length"
      dense
      rounded
      class="rmm-banner-warning q-mb-sm"
      role="status"
    >
      {{ error }}
      <template #action>
        <q-btn flat dense label="Retry" @click="load" />
      </template>
    </q-banner>
    <q-table
      v-sortable-headers
      dense
      flat
      class="rmm-table"
      :rows="filtered"
      :columns="columns"
      row-key="id"
      :loading="loading"
      :pagination="{ rowsPerPage: 0, sortBy: 'ip' }"
      hide-pagination
      virtual-scroll
      style="max-height: 58vh"
    >
      <template #top>
        <div class="rmm-toolbar discovery-toolbar full-width">
          <q-btn-toggle
            v-model="state"
            :options="stateOptions"
            dense
            no-caps
            unelevated
            toggle-color="primary"
            padding="3px 10px"
            role="group"
            aria-label="Filter by status"
            class="discovery-toolbar__state"
          />
          <q-select
            v-model="network"
            :options="networks"
            label="Network"
            dense
            outlined
            options-dense
            clearable
            class="discovery-toolbar__network"
          />
          <q-select
            v-if="vlanOptions.length"
            v-model="vlan"
            :options="vlanOptions"
            label="VLAN"
            dense
            outlined
            options-dense
            clearable
            class="discovery-toolbar__network"
          />
          <q-input
            v-model="search"
            dense
            outlined
            clearable
            debounce="150"
            placeholder="Address, name, MAC, SNMP"
            aria-label="Search discovered devices"
            class="discovery-toolbar__search"
          >
            <template #prepend><q-icon name="search" /></template>
          </q-input>
          <q-space />
          <span class="rmm-muted rmm-num">
            {{ filtered.length }} of {{ rows.length }}
            {{ rows.length === 1 ? "device" : "devices" }}
          </span>
        </div>
      </template>
      <template #header-cell="props">
        <q-th :props="props">
          {{ props.col.label }}
          <HelpTip
            v-if="HEADER_TIPS[props.col.name]"
            :text="HEADER_TIPS[props.col.name]"
            @click.stop
          />
        </q-th>
      </template>
      <template #no-data>
        <div
          v-if="!loading"
          class="full-width column flex-center q-gutter-sm q-py-md"
        >
          <template v-if="error">
            <q-icon name="error_outline" color="negative" size="24px" />
            <div>{{ error }}</div>
            <q-btn outline dense color="primary" label="Retry" @click="load" />
          </template>
          <EmptyState
            v-else-if="rows.length"
            class="full-width"
            icon="filter_alt_off"
            title="No device matches the filters"
            text="Another status, network or search text shows more."
          >
            <q-btn
              dense
              outline
              no-caps
              color="primary"
              label="Clear filters"
              class="q-px-md"
              @click="clearFilters"
            />
          </EmptyState>
          <EmptyState
            v-else
            class="full-width"
            icon="radar"
            title="No devices found yet"
            text="Scan a network the server may reach. Every address that answers ping or one of the ports shows up here."
          >
            <q-btn
              dense
              outline
              no-caps
              color="primary"
              icon="radar"
              label="New scan"
              class="q-pl-sm q-pr-md"
              :disable="scanBusy"
              @click="$emit('scan')"
            />
          </EmptyState>
        </div>
      </template>
      <template #body-cell-ip="props">
        <q-td :props="props" class="rmm-mono text-weight-medium">
          {{ props.value }}
        </q-td>
      </template>
      <template #body-cell-hostname="props">
        <q-td :props="props">
          <div class="discovery-clip">{{ props.value || "—" }}</div>
          <q-tooltip v-if="props.value">{{ props.value }}</q-tooltip>
        </q-td>
      </template>
      <template #body-cell-mac="props">
        <q-td :props="props" class="rmm-mono">
          {{ props.value || "—" }}
        </q-td>
      </template>
      <template #body-cell-vlan="props">
        <q-td :props="props">{{ vlanLabel(props.row) || "—" }}</q-td>
      </template>
      <template #body-cell-switch="props">
        <q-td :props="props">{{ props.row.switch || "—" }}</q-td>
      </template>
      <template #body-cell-port="props">
        <q-td :props="props">{{ props.row.port || "—" }}</q-td>
      </template>
      <template #body-cell-ports="props">
        <q-td :props="props">
          <span v-if="!props.row.open_ports?.length" class="rmm-muted">—</span>
          <div v-else class="discovery-ports">
            <span
              v-for="port in props.row.open_ports"
              :key="port"
              class="discovery-port rmm-num"
              >{{ port
              }}<span v-if="PORT_NAMES[port]" class="discovery-port__name">{{
                PORT_NAMES[port]
              }}</span></span
            >
          </div>
        </q-td>
      </template>
      <template #body-cell-snmp="props">
        <q-td :props="props">
          <template v-if="props.row.snmp?.sysName || props.row.snmp?.sysDescr">
            <span class="text-weight-medium">{{
              props.row.snmp.sysName || "—"
            }}</span>
            <span v-if="props.row.snmp.sysDescr" class="rmm-muted">
              · {{ props.row.snmp.sysDescr }}</span
            >
            <q-tooltip max-width="420px">
              {{ props.row.snmp.sysName }}
              <br v-if="props.row.snmp.sysName && props.row.snmp.sysDescr" />
              {{ props.row.snmp.sysDescr }}
            </q-tooltip>
          </template>
          <span v-else class="rmm-muted">—</span>
        </q-td>
      </template>
      <template #body-cell-last_seen="props">
        <q-td :props="props">
          {{ relativeTime(props.value) }}
          <q-tooltip>
            First seen {{ formatDate(props.row.first_seen) }}, last seen
            {{ formatDate(props.value) }}
          </q-tooltip>
        </q-td>
      </template>
      <template #body-cell-state="props">
        <q-td :props="props">
          <span class="rmm-pill" :class="stateMeta(props.row.state).cls">{{
            stateMeta(props.row.state).label
          }}</span>
          <router-link
            v-if="props.row.state === 'agent' && props.row.agent_id"
            class="rmm-link discovery-match q-ml-sm"
            :to="{
              name: 'Agent',
              params: { agent_id: props.row.agent_id },
            }"
            >{{ props.row.agent_hostname || props.row.agent_id }}</router-link
          >
          <button
            v-else-if="props.row.state === 'netmon' && props.row.netmon_id"
            type="button"
            class="rmm-link discovery-link discovery-match q-ml-sm"
            @click="openNetmon"
          >
            Network devices
          </button>
        </q-td>
      </template>
      <template #body-cell-actions="props">
        <q-td :props="props" auto-width>
          <RowActions :label="`Actions for ${props.row.ip}`">
            <q-list dense style="min-width: 260px">
              <q-item
                clickable
                v-close-popup
                :disable="props.row.state === 'agent'"
                @click="installOpen = true"
              >
                <q-item-section avatar>
                  <q-icon name="download" />
                </q-item-section>
                <q-item-section>
                  <q-item-label>Install agent</q-item-label>
                  <q-item-label caption>{{
                    props.row.state === "agent"
                      ? "An agent already reports this address"
                      : "Build an installer to run on the device"
                  }}</q-item-label>
                </q-item-section>
              </q-item>
              <q-item
                clickable
                v-close-popup
                :disable="props.row.state === 'netmon'"
                @click="addToNetmon(props.row)"
              >
                <q-item-section avatar>
                  <q-icon name="router" />
                </q-item-section>
                <q-item-section>
                  <q-item-label>Add to network devices</q-item-label>
                  <q-item-label caption>{{
                    props.row.state === "netmon"
                      ? "Already checked from the server"
                      : "Ping and ports checked from the server, no agent"
                  }}</q-item-label>
                </q-item-section>
              </q-item>
              <q-separator />
              <q-item clickable v-close-popup @click="toggleIgnore(props.row)">
                <q-item-section avatar>
                  <q-icon
                    :name="
                      props.row.state === 'ignored'
                        ? 'visibility'
                        : 'visibility_off'
                    "
                  />
                </q-item-section>
                <q-item-section>
                  <q-item-label>{{
                    props.row.state === "ignored" ? "Stop ignoring" : "Ignore"
                  }}</q-item-label>
                  <q-item-label caption>{{
                    props.row.state === "ignored"
                      ? "Back to New, Agent or Monitored, as it matches now"
                      : "Stays ignored in later scans"
                  }}</q-item-label>
                </q-item-section>
              </q-item>
            </q-list>
          </RowActions>
        </q-td>
      </template>
    </q-table>
    <q-dialog v-model="installOpen" aria-labelledby="install-agent-title">
      <InstallAgent :sitepk="sitepk" @close="installOpen = false" />
    </q-dialog>
  </div>
</template>

<script setup>
import { computed, ref } from "vue";
import { useQuasar } from "quasar";
import { useStore } from "vuex";
import EmptyState from "@/components/ui/EmptyState.vue";
import HelpTip from "@/components/ui/HelpTip.vue";
import RowActions from "@/components/ui/RowActions.vue";
import InstallAgent from "@/components/modals/agents/InstallAgent.vue";
import NetworkDevicesManager from "@/components/netmon/NetworkDevicesManager.vue";
import AddToNetmonDialog from "@/components/discovery/AddToNetmonDialog.vue";
import { fetchDiscoveredDevices, toggleIgnoreDevice } from "@/api/discovery";
import { inCidr, ipToInt } from "@/components/discovery/ipv4";
import { relativeTime } from "@/utils/format";
import { notifySuccess } from "@/utils/notify";
import { sortableHeaders as vSortableHeaders } from "@/utils/sortableHeaders";

defineProps({
  // CIDRs for the network filter
  networks: { type: Array, default: () => [] },
  // a scan is queued or running
  scanBusy: { type: Boolean, default: false },
});
defineEmits(["scan"]);

const $q = useQuasar();
const store = useStore();
const formatDate = (value) => (value ? store.getters.formatDate(value) : "");

const rows = ref([]);
const loading = ref(false);
const error = ref("");
const state = ref("all");
const network = ref(null);
const search = ref("");
const vlan = ref(null);
const installOpen = ref(false);

const STATES = {
  new: { label: "New", cls: "rmm-pill--info" },
  agent: { label: "Agent", cls: "rmm-pill--positive" },
  netmon: { label: "Monitored", cls: "rmm-pill--positive" },
  ignored: { label: "Ignored", cls: "rmm-pill--neutral" },
};
const stateMeta = (s) => STATES[s] || { label: s, cls: "rmm-pill--neutral" };

const PORT_NAMES = {
  22: "SSH",
  80: "HTTP",
  161: "SNMP",
  443: "HTTPS",
  445: "SMB",
  3389: "RDP",
  5900: "VNC",
  8080: "HTTP",
  8443: "HTTPS",
};

// vlan, switch and port come from the UniFi / OPNsense sync; null when unknown
function vlanLabel(r) {
  if (r.vlan_name && r.vlan_id) return `${r.vlan_name} (${r.vlan_id})`;
  return r.vlan_name || (r.vlan_id ? `VLAN ${r.vlan_id}` : "");
}

const vlanOptions = computed(() =>
  [...new Set(rows.value.map(vlanLabel).filter(Boolean))].sort(),
);

const HEADER_TIPS = {
  vlan: "From the UniFi or OPNsense sync under Global Settings > Network",
  mac: "Only known for hosts on a network the server is attached to; behind a router the server cannot see it",
  ports: "TCP ports from the scan that accepted a connection",
  last_seen:
    "When a scan last found it; hover a cell to see when it was first found",
  snmp: "sysName and sysDescr, read when the scan had a community",
  state:
    "New: no agent and not checked by the server. Agent: an agent reports this address. Monitored: a network device has this address. Ignored: hidden from New until you stop ignoring it",
};

const columns = [
  {
    name: "ip",
    label: "Address",
    field: "ip",
    align: "left",
    sortable: true,
    sort: (a, b) => ipToInt(a) - ipToInt(b),
  },
  {
    name: "hostname",
    field: (row) => row.hostname,
    label: "Hostname",
    sortable: true,
    align: "left",
  },
  { name: "mac", label: "MAC", field: "mac", align: "left" },
  {
    name: "vlan",
    label: "VLAN",
    field: (r) => vlanLabel(r),
    align: "left",
    sortable: true,
  },
  {
    name: "switch",
    label: "Switch",
    field: (r) => r.switch || "",
    align: "left",
    sortable: true,
  },
  {
    name: "port",
    label: "Port",
    field: (r) => r.port || "",
    align: "left",
  },
  {
    name: "ports",
    label: "Open ports",
    field: (r) => r.open_ports?.length || 0,
    align: "left",
    sortable: true,
  },
  {
    name: "snmp",
    label: "SNMP",
    field: (r) => r.snmp?.sysName || "",
    align: "left",
    sortable: true,
    // takes the room left over, cut with an ellipsis
    classes: "rmm-ellipsis-td",
    style: "width: 28%",
  },
  {
    name: "last_seen",
    label: "Last seen",
    field: "last_seen",
    align: "left",
    sortable: true,
  },
  {
    name: "state",
    label: "Status",
    field: "state",
    align: "left",
    sortable: true,
  },
  { name: "actions", label: "", field: "id", align: "right" },
];

const counts = computed(() => {
  const c = { all: rows.value.length };
  for (const r of rows.value) c[r.state] = (c[r.state] || 0) + 1;
  return c;
});

const stateOptions = computed(() =>
  [["all", "All"], ...Object.entries(STATES).map(([k, v]) => [k, v.label])].map(
    ([value, label]) => ({
      value,
      label: `${label} (${counts.value[value] || 0})`,
    }),
  ),
);

const filtered = computed(() => {
  const text = (search.value || "").trim().toLowerCase();
  return rows.value.filter(
    (r) =>
      (state.value === "all" || r.state === state.value) &&
      (!network.value || inCidr(r.ip, network.value)) &&
      (!vlan.value || vlanLabel(r) === vlan.value) &&
      (!text ||
        [
          r.ip,
          r.hostname,
          r.agent_hostname,
          r.mac,
          r.snmp?.sysName,
          r.snmp?.sysDescr,
          r.note,
        ]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(text))),
  );
});

function clearFilters() {
  state.value = "all";
  network.value = null;
  vlan.value = null;
  search.value = "";
}

// Install agent prefills the site picked in the tree, like the Devices page
const sitepk = computed(() => {
  const tree = store.state.selectedTree || "";
  return tree.startsWith("Site|") ? Number(tree.split("|")[1]) : undefined;
});

// rows name their match (agent_id, agent_hostname, netmon_id); agent_id is
// null when the agent is outside the role
async function load() {
  loading.value = true;
  error.value = "";
  try {
    rows.value = await fetchDiscoveredDevices();
  } catch (e) {
    error.value =
      e?.response?.status === 403
        ? "Your role may not run network discovery."
        : "The discovered devices could not be loaded.";
  }
  loading.value = false;
}

function openNetmon() {
  $q.dialog({ component: NetworkDevicesManager });
}

function addToNetmon(row) {
  $q.dialog({
    component: AddToNetmonDialog,
    componentProps: { device: row },
  }).onOk(load);
}

async function toggleIgnore(row) {
  try {
    const updated = await toggleIgnoreDevice(row.id);
    rows.value = rows.value.map((r) => (r.id === updated.id ? updated : r));
    notifySuccess(
      updated.state === "ignored"
        ? `${updated.ip} is ignored`
        : `${updated.ip} is no longer ignored`,
    );
  } catch {
    // the error toast comes from the axios boot
  }
}

defineExpose({ load });
load();
</script>

<style scoped>
.discovery-toolbar {
  flex-wrap: wrap;
}

.discovery-toolbar__network {
  min-width: 190px;
}

.discovery-toolbar__search {
  width: 240px;
}

.discovery-toolbar__state {
  border: 1px solid var(--rmm-border-strong);
  border-radius: var(--rmm-radius-sm);
}

.discovery-clip {
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.discovery-ports {
  display: flex;
  max-width: 230px;
  flex-wrap: wrap;
  gap: 2px 4px;
}

.discovery-match {
  display: inline-block;
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
  vertical-align: middle;
  white-space: nowrap;
}

.discovery-port {
  display: inline-flex;
  align-items: baseline;
  gap: 4px;
  padding: 0 6px;
  border: 1px solid var(--rmm-border-strong);
  border-radius: 999px;
  background: var(--rmm-surface-2);
  font-size: var(--rmm-fs-xs);
}

.discovery-port__name {
  color: var(--rmm-text-muted);
}

.discovery-link {
  padding: 0;
  border: 0;
  background: none;
  font: inherit;
}
</style>
