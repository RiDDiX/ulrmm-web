<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-dialog
    ref="dialogRef"
    aria-labelledby="discovery-title"
    @hide="onDialogHide"
  >
    <q-card class="q-dialog-plugin" style="width: 96vw; max-width: 1680px">
      <DialogHeader
        title-id="discovery-title"
        title="Network discovery"
        subtitle="Finds devices in the networks the server may scan; install an agent on them or check them from the server"
      >
        <template #actions>
          <q-btn
            dense
            flat
            icon="refresh"
            aria-label="Reload scans and devices"
            @click="load"
          >
            <q-tooltip>Reload scans and devices</q-tooltip>
          </q-btn>
        </template>
      </DialogHeader>
      <div class="discovery-bar">
        <div v-if="active" class="discovery-bar__progress" role="status">
          <q-spinner size="20px" color="primary" />
          <div class="ellipsis">
            <div class="text-weight-medium ellipsis">
              {{ active.status === "queued" ? "Scan queued:" : "Scanning" }}
              <span class="rmm-mono">{{ active.networks.join(", ") }}</span>
            </div>
            <div class="rmm-muted text-caption ellipsis">
              {{ progressText }}
            </div>
          </div>
        </div>
        <div v-else class="rmm-muted text-caption">
          One scan runs at a time and stops after 10 minutes at the latest.
          {{ lastScanText }}
        </div>
        <q-space />
        <q-btn
          unelevated
          no-caps
          color="primary"
          icon="radar"
          label="New scan"
          class="q-pl-sm q-pr-md"
          :disable="!!active || !info"
          @click="newScan"
        />
      </div>
      <q-tabs
        v-model="tab"
        align="left"
        :inline-label="true"
        indicator-color="primary"
        active-color="primary"
        no-caps
        :dense="true"
        class="q-px-sm"
      >
        <q-tab name="devices" icon="devices_other" label="Devices" />
        <q-tab name="scans" icon="history" :label="`Scans (${scans.length})`" />
      </q-tabs>
      <q-separator />
      <q-tab-panels v-model="tab" keep-alive class="discovery-panels">
        <q-tab-panel name="devices" class="q-pa-sm">
          <DiscoveredDevicesTable
            ref="devicesRef"
            :networks="networkOptions"
            :scan-busy="!!active || !info"
            @scan="newScan"
          />
        </q-tab-panel>
        <q-tab-panel name="scans" class="q-pa-sm">
          <q-table
            dense
            flat
            class="rmm-table"
            row-key="id"
            :rows="scans"
            :columns="scanColumns"
            virtual-scroll
            hide-pagination
            :loading="loading"
            :pagination="{ rowsPerPage: 0 }"
            :style="{ maxHeight: '58vh' }"
          >
            <template #no-data>
              <div
                v-if="!loading"
                class="full-width column flex-center q-gutter-sm q-py-md"
              >
                <template v-if="scansError">
                  <q-icon name="error_outline" color="negative" size="24px" />
                  <div>{{ scansError }}</div>
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
                  icon="history"
                  title="No scans yet"
                  text="Scans of the last 90 days are listed here with what they found."
                />
              </div>
            </template>
            <template #body-cell-status="props">
              <q-td :props="props">
                <span
                  class="rmm-pill"
                  :class="scanStatus(props.row).cls"
                  :aria-busy="ACTIVE.includes(props.row.status)"
                  >{{ scanStatus(props.row).label }}</span
                >
              </q-td>
            </template>
            <template #body-cell-networks="props">
              <q-td :props="props" class="rmm-mono">{{ props.value }}</q-td>
            </template>
            <template #body-cell-ports="props">
              <q-td :props="props">
                {{ props.value }}
                <q-tooltip>{{ props.value }}</q-tooltip>
              </q-td>
            </template>
            <template #body-cell-error="props">
              <q-td :props="props">
                {{ props.value || "—" }}
                <q-tooltip v-if="props.value" max-width="420px">{{
                  props.value
                }}</q-tooltip>
              </q-td>
            </template>
          </q-table>
        </q-tab-panel>
      </q-tab-panels>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { computed, onBeforeUnmount, ref } from "vue";
import { useDialogPluginComponent, useQuasar } from "quasar";
import { useStore } from "vuex";
import DialogHeader from "@/components/ui/DialogHeader.vue";
import EmptyState from "@/components/ui/EmptyState.vue";
import DiscoveredDevicesTable from "@/components/discovery/DiscoveredDevicesTable.vue";
import ScanForm from "@/components/discovery/ScanForm.vue";
import { fetchDiscoveryNetworks, fetchScan, fetchScans } from "@/api/discovery";
import { relativeTime } from "@/utils/format";
import { notifyError, notifySuccess } from "@/utils/notify";

defineEmits(Array.from(useDialogPluginComponent.emits));
const $q = useQuasar();
const store = useStore();
const { dialogRef, onDialogHide } = useDialogPluginComponent();

const POLL_MS = 5000;
const ACTIVE = ["queued", "running"];

const tab = ref("devices");
const scans = ref([]);
const info = ref(null);
const loading = ref(false);
const scansError = ref("");
const devicesRef = ref(null);
const now = ref(Date.now());

const active = computed(() =>
  scans.value.find((s) => ACTIVE.includes(s.status)),
);

const networkOptions = computed(() => [
  ...new Set([
    ...(info.value?.networks || []).map((n) => n.network),
    ...scans.value.flatMap((s) => s.networks),
  ]),
]);

const SCAN_STATUS = {
  queued: { label: "Queued", cls: "rmm-pill--neutral" },
  running: { label: "Running", cls: "rmm-pill--info" },
  done: { label: "Done", cls: "rmm-pill--positive" },
  failed: { label: "Failed", cls: "rmm-pill--negative" },
};

// done with an error text: stopped at the time limit or some pings failed
function scanStatus(scan) {
  if (scan.status === "done" && scan.error)
    return { label: "Partly done", cls: "rmm-pill--warning" };
  return SCAN_STATUS[scan.status] || SCAN_STATUS.queued;
}

function duration(scan) {
  const end = scan.finished_at ? new Date(scan.finished_at) : now.value;
  const s = Math.max(0, Math.round((end - new Date(scan.started_at)) / 1000));
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${s % 60} s`;
}

const scanColumns = [
  { name: "status", label: "Status", field: "status", align: "left" },
  {
    name: "networks",
    label: "Networks",
    field: (r) => r.networks.join(", "),
    align: "left",
  },
  {
    name: "ports",
    label: "Ports",
    field: (r) => r.ports.join(", "),
    align: "left",
    classes: "rmm-ellipsis-td",
    style: "max-width: 180px",
  },
  {
    name: "snmp",
    label: "SNMP",
    field: (r) => (r.snmp ? "Yes" : "No"),
    align: "left",
  },
  {
    name: "hosts",
    label: "Answered",
    field: (r) =>
      ACTIVE.includes(r.status)
        ? r.hosts_total
          ? `${r.hosts_total} addresses`
          : "—"
        : `${r.hosts_up} of ${r.hosts_total}`,
    align: "left",
  },
  {
    name: "started",
    label: "Started",
    field: (r) =>
      [store.getters.formatDate(r.started_at), r.started_by]
        .filter(Boolean)
        .join(" by "),
    align: "left",
  },
  { name: "duration", label: "Duration", field: duration, align: "left" },
  {
    name: "error",
    label: "Error",
    field: "error",
    align: "left",
    classes: "rmm-ellipsis-td",
    style: "max-width: 360px",
  },
];

const progressText = computed(() => {
  const scan = active.value;
  const who = scan.started_by ? ` by ${scan.started_by}` : "";
  const parts =
    scan.status === "queued"
      ? [`waiting for a worker, started ${relativeTime(scan.started_at)}${who}`]
      : [
          `${scan.hosts_total} addresses`,
          `running ${duration(scan)}${who}`,
          "stops after 10 minutes at the latest",
        ];
  return parts.join(" · ");
});

const lastScanText = computed(() => {
  const last = scans.value[0];
  if (!last) return "";
  return `Last scan ${relativeTime(last.finished_at || last.started_at)}: ${scanStatus(last).label.toLowerCase()}, ${last.hosts_up} of ${last.hosts_total} addresses answered.`;
});

let timer = null;
let alive = true;

function schedule() {
  clearTimeout(timer);
  if (alive && active.value) timer = setTimeout(poll, POLL_MS);
}

function finished(scan) {
  if (scan.status === "done")
    notifySuccess(
      `Scan finished: ${scan.hosts_up} of ${scan.hosts_total} addresses answered`,
      4000,
    );
  else notifyError(`Scan failed: ${scan.error || "no reason given"}`);
  devicesRef.value?.load();
}

async function poll() {
  const scan = active.value;
  if (!scan || !alive) return;
  if (!document.hidden) {
    try {
      const fresh = await fetchScan(scan.id);
      if (!alive) return;
      now.value = Date.now();
      scans.value = scans.value.map((s) => (s.id === fresh.id ? fresh : s));
      if (!ACTIVE.includes(fresh.status)) finished(fresh);
    } catch (e) {
      // pruned meanwhile; other errors retry next round
      if (e?.response?.status === 404) return loadScans();
    }
  }
  schedule();
}

async function loadScans() {
  try {
    scans.value = await fetchScans();
    now.value = Date.now();
    scansError.value = "";
  } catch (e) {
    scansError.value =
      e?.response?.status === 403
        ? "Your role may not run network discovery."
        : "The scans could not be loaded.";
  }
  schedule();
}

async function load(devices = true) {
  loading.value = true;
  await Promise.all([
    loadScans(),
    fetchDiscoveryNetworks()
      .then((data) => (info.value = data))
      .catch(() => {}),
    devices && devicesRef.value?.load(),
  ]);
  loading.value = false;
}

function newScan() {
  $q.dialog({ component: ScanForm, componentProps: { info: info.value } }).onOk(
    (scan) => {
      scans.value = [scan, ...scans.value.filter((s) => s.id !== scan.id)];
      now.value = Date.now();
      schedule();
    },
  );
}

onBeforeUnmount(() => {
  alive = false;
  clearTimeout(timer);
});

// the devices table loads itself
load(false);
</script>

<style scoped>
.discovery-bar {
  display: flex;
  min-height: 52px;
  align-items: center;
  gap: 12px;
  padding: 8px 16px;
  border-bottom: 1px solid var(--rmm-border);
}

.discovery-bar__progress {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 10px;
}

.discovery-panels {
  min-height: 62vh;
}
</style>
