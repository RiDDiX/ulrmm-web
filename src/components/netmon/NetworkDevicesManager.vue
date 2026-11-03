<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-dialog ref="dialogRef" aria-labelledby="netmon-title" @hide="onDialogHide">
    <q-card class="q-dialog-plugin" style="width: 90vw; max-width: 90vw">
      <DialogHeader
        title-id="netmon-title"
        title="Network devices"
        subtitle="Checked from the RMM server, no agent needed"
      >
        <template #actions>
          <q-btn
            dense
            flat
            icon="refresh"
            aria-label="Refresh network devices"
            @click="load"
          >
            <q-tooltip>Reload the device list and last results</q-tooltip>
          </q-btn>
        </template>
      </DialogHeader>
      <div class="q-pa-sm" style="min-height: 65vh; max-height: 65vh">
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
          dense
          flat
          class="rmm-table"
          row-key="id"
          :rows="rows"
          :columns="columns"
          :virtual-scroll="true"
          hide-pagination
          :loading="loading"
          :pagination="{ rowsPerPage: 0 }"
          :style="{ maxHeight: '60vh' }"
        >
          <template #top>
            <div class="rmm-toolbar full-width">
              <q-btn
                label="New device"
                dense
                unelevated
                class="q-pl-sm q-pr-md"
                no-caps
                color="primary"
                icon="add"
                @click="edit(null)"
              />
              <q-btn
                label="Discover"
                dense
                flat
                no-caps
                icon="radar"
                class="q-pl-sm q-pr-md"
                @click="discover"
              >
                <q-tooltip
                  >Scan the server's networks for devices to add</q-tooltip
                >
              </q-btn>
              <q-space />
              <span class="rmm-muted rmm-num">
                {{ rows.length }}
                {{ rows.length === 1 ? "device" : "devices" }}
              </span>
            </div>
          </template>
          <template #header-cell="props">
            <q-th :props="props">
              {{ props.col.label }}
              <q-tooltip v-if="HEADER_TIPS[props.col.name]">
                {{ HEADER_TIPS[props.col.name] }}
              </q-tooltip>
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
                <q-btn
                  outline
                  dense
                  color="primary"
                  label="Retry"
                  @click="load"
                />
              </template>
              <EmptyState
                v-else
                class="full-width"
                icon="router"
                title="No network devices yet"
                text="The server pings them, tries TCP ports and reads SNMP, but only in the networks it is attached to."
              >
                <q-btn
                  dense
                  outline
                  no-caps
                  color="primary"
                  icon="add"
                  label="New device"
                  class="q-pl-sm q-pr-md"
                  @click="edit(null)"
                />
              </EmptyState>
            </div>
          </template>
          <template #body-cell-status="props">
            <q-td :props="props">
              <span class="rmm-pill" :class="statusMeta(props.row).cls">{{
                statusMeta(props.row).label
              }}</span>
              <q-tooltip>{{ statusTip(props.row) }}</q-tooltip>
            </q-td>
          </template>
          <template #body-cell-name="props">
            <q-td :props="props" class="text-weight-medium">
              {{ props.value }}
            </q-td>
          </template>
          <template #body-cell-host="props">
            <q-td :props="props" class="rmm-mono">
              {{ props.value }}
            </q-td>
          </template>
          <template #body-cell-monitors="props">
            <q-td :props="props">
              <span
                v-for="(m, i) in props.row.last_result?.monitors ?? []"
                :key="i"
                class="rmm-pill q-mr-xs"
                :class="(MONITOR_STATUS[m.status] || STATUS.pending).cls"
              >
                {{ m.cert ? `${m.label} · ${m.cert.days_left} d` : m.label }}
                <q-tooltip>{{ monitorText(m) }}</q-tooltip>
              </span>
            </q-td>
          </template>
          <template #body-cell-toner="props">
            <q-td :props="props">
              <template v-if="tonerList(props.row).length">
                <span
                  v-for="(t, i) in tonerList(props.row)"
                  :key="i"
                  class="rmm-pill q-mr-xs"
                  :class="t.cls"
                >
                  {{ t.label }}
                  <q-tooltip>{{ t.tip }}</q-tooltip>
                </span>
              </template>
              <span v-else class="rmm-muted">—</span>
            </q-td>
          </template>
          <template #body-cell-result="props">
            <q-td :props="props">
              {{ props.value }}
              <q-tooltip v-if="props.value !== '—'">{{
                props.value
              }}</q-tooltip>
            </q-td>
          </template>
          <template #body-cell-actions="props">
            <q-td :props="props" auto-width>
              <q-btn
                dense
                flat
                round
                size="sm"
                icon="network_ping"
                :loading="testing === props.row.id"
                :disable="testing !== null"
                :aria-label="`Test ${props.row.name} now`"
                @click="test(props.row)"
              >
                <q-tooltip>Run all checks now and show the result</q-tooltip>
              </q-btn>
              <q-btn
                dense
                flat
                round
                size="sm"
                icon="edit"
                :aria-label="`Edit ${props.row.name}`"
                @click="edit(props.row)"
              >
                <q-tooltip>Edit this device</q-tooltip>
              </q-btn>
              <q-btn
                dense
                flat
                round
                size="sm"
                icon="delete"
                color="negative"
                :aria-label="`Delete ${props.row.name}`"
                @click="remove(props.row)"
              >
                <q-tooltip>Delete this device and its alerts</q-tooltip>
              </q-btn>
            </q-td>
          </template>
        </q-table>
      </div>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { onMounted, ref } from "vue";
import { useDialogPluginComponent, useQuasar } from "quasar";
import DialogHeader from "@/components/ui/DialogHeader.vue";
import EmptyState from "@/components/ui/EmptyState.vue";
import NetworkDeviceForm from "@/components/netmon/NetworkDeviceForm.vue";
import DiscoveryManager from "@/components/discovery/DiscoveryManager.vue";
import {
  fetchNetworkDevices,
  removeNetworkDevice,
  testNetworkDevice,
} from "@/api/netmon";
import { getTimeLapse } from "@/utils/format";
import { notifySuccess } from "@/utils/notify";

defineEmits(Array.from(useDialogPluginComponent.emits));
const $q = useQuasar();
const { dialogRef, onDialogHide } = useDialogPluginComponent();

const rows = ref([]);
const loading = ref(false);
const error = ref("");
const testing = ref(null);

const STATUS = {
  pending: { label: "Pending", cls: "rmm-pill--neutral" },
  up: { label: "Up", cls: "rmm-pill--positive" },
  degraded: { label: "Degraded", cls: "rmm-pill--warning" },
  down: { label: "Down", cls: "rmm-pill--negative" },
  error: { label: "Probe error", cls: "rmm-pill--warning" },
};

const MONITOR_STATUS = {
  ok: { cls: "rmm-pill--positive" },
  warning: { cls: "rmm-pill--warning" },
  error: { cls: "rmm-pill--negative" },
};

const STATUS_TIPS = {
  pending: "Not checked yet",
  up: "Every check answered",
  degraded: "Reachable, but a port, SNMP or monitor failed or warns",
  down: "No ping reply, or no check answered at all",
  error: "The server could not run the checks",
};

function statusTip(row) {
  if (!row.enabled) return "Turned off, the device is not checked";
  const tip = STATUS_TIPS[row.status] || STATUS_TIPS.pending;
  return row.maintenance_mode ? `${tip}. Maintenance mode: no alerts` : tip;
}

const HEADER_TIPS = {
  host: "IPv4 address the server checks",
  checks: "Ping, TCP ports and SNMP set for this device",
  monitors: "HTTP(S) and DNS monitors with their last result",
  result: "Outcome of the last check; hover a cell to read all of it",
  checked: "When the server last checked the device",
};

function statusMeta(row) {
  if (!row.enabled) return { label: "Off", cls: "rmm-pill--neutral" };
  const meta = STATUS[row.status] || STATUS.pending;
  if (row.maintenance_mode)
    return { ...meta, label: `${meta.label}, maintenance` };
  return meta;
}

function checks(row) {
  const parts = [];
  if (row.ping) parts.push("ping");
  if (row.tcp_ports?.length) parts.push(`TCP ${row.tcp_ports.join(", ")}`);
  if (row.snmp_version !== "off") parts.push(`SNMP ${row.snmp_version}`);
  const monitors = row.monitors?.length;
  if (monitors)
    parts.push(monitors === 1 ? "1 monitor" : `${monitors} monitors`);
  return parts.join(" · ");
}

function monitorText(m) {
  const details = [];
  if (m.code) details.push(`HTTP ${m.code}`);
  if (m.answers?.length) details.push(m.answers.join(", "));
  if (m.cert) {
    let cert = `certificate ${m.cert.days_left} days left`;
    if (m.cert.issuer) cert += `, issued by ${m.cert.issuer}`;
    if (!m.cert.verified) cert += ", not verified";
    details.push(cert);
  }
  if (m.message) details.push(m.message);
  return `${m.label}: ${details.join(", ") || m.status}`;
}

// printer supplies: {name, level, max, percent (null = unknown), low}
function tonerList(row) {
  const p = row.last_result?.printer;
  const mon = (row.monitors || []).find((m) => m.type === "printer");
  const threshold = mon?.threshold ?? 15;
  return (Array.isArray(p?.supplies) ? p.supplies : []).map((s) => {
    const pct = s.percent ?? null;
    const name = s.name || "Supply";
    return {
      label: pct === null ? `${name} ?` : `${name} ${pct}%`,
      tip:
        pct === null
          ? `${name}: level not reported`
          : `${name}: ${pct}% left, alert below ${threshold}%`,
      cls:
        pct === null
          ? "rmm-pill--neutral"
          : s.low
            ? "rmm-pill--negative"
            : "rmm-pill--positive",
    };
  });
}

function uptime(seconds) {
  if (typeof seconds !== "number") return "";
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  return days ? `${days} d ${hours} h` : `${hours} h`;
}

// dev + probe results as text only
function resultText(result) {
  const r = result || {};
  const parts = [];
  if (r.error) parts.push(r.error);
  if (r.ping === false) parts.push("no ping reply");
  else if (typeof r.rtt_ms === "number") parts.push(`ping ${r.rtt_ms} ms`);
  const ports = Object.entries(r.ports || {});
  if (ports.length)
    parts.push(
      ports.map(([p, open]) => `${p} ${open ? "open" : "closed"}`).join(", "),
    );
  if (r.printer?.pages != null)
    parts.push(`${r.printer.pages.toLocaleString()} pages printed`);
  if (r.snmp?.error) parts.push(`SNMP: ${r.snmp.error}`);
  else if (r.snmp) {
    let text = `SNMP ${r.snmp.sys_name || "answers"}`;
    if (r.snmp.sys_uptime != null) text += `, up ${uptime(r.snmp.sys_uptime)}`;
    if (r.snmp.if_up != null)
      text += `, ${r.snmp.if_up} interfaces up, ${r.snmp.if_down} down`;
    parts.push(text);
  }
  return parts.join(" · ");
}

const columns = [
  { name: "status", label: "Status", field: "status", align: "left" },
  { name: "name", label: "Name", field: "name", align: "left", sortable: true },
  { name: "host", label: "Address", field: "host", align: "left" },
  {
    name: "site",
    label: "Client / Site",
    field: (r) => `${r.client_name} / ${r.site_name}`,
    align: "left",
    sortable: true,
  },
  { name: "checks", label: "Checks", field: checks, align: "left" },
  { name: "monitors", label: "Monitors", field: "id", align: "left" },
  { name: "toner", label: "Toner", field: "id", align: "left" },
  {
    name: "result",
    label: "Last result",
    field: (r) => resultText(r.last_result) || "—",
    align: "left",
    classes: "rmm-ellipsis-td",
    style: "max-width: 420px",
  },
  {
    name: "checked",
    label: "Checked",
    field: (r) => (r.last_checked ? getTimeLapse(r.last_checked) : "never"),
    align: "left",
  },
  { name: "actions", label: "", field: "id", align: "right" },
];

async function load() {
  loading.value = true;
  error.value = "";
  try {
    rows.value = await fetchNetworkDevices();
  } catch {
    error.value = "The network devices could not be loaded.";
  }
  loading.value = false;
}

function edit(device) {
  $q.dialog({ component: NetworkDeviceForm, componentProps: { device } }).onOk(
    load,
  );
}

// discovery can add devices here
function discover() {
  $q.dialog({ component: DiscoveryManager }).onDismiss(load);
}

async function test(device) {
  testing.value = device.id;
  try {
    const result = await testNetworkDevice(device.id);
    $q.dialog({
      title: `${device.name}: ${(STATUS[result.status] || STATUS.pending).label}`,
      message:
        [resultText(result), ...(result.monitors ?? []).map(monitorText)]
          .filter(Boolean)
          .join(" · ") || "No result",
      ok: { label: "Close", flat: true },
    });
  } catch {
    // toast from axios layer
  }
  testing.value = null;
}

function remove(device) {
  $q.dialog({
    title: `Delete ${device.name}?`,
    message: "Its alerts are deleted too. This cannot be undone.",
    cancel: { label: "Cancel", flat: true },
    ok: { label: "Delete", color: "negative" },
  }).onOk(async () => {
    try {
      notifySuccess(await removeNetworkDevice(device.id));
    } catch {
      // toast from axios layer
    }
    load();
  });
}

onMounted(load);
</script>
