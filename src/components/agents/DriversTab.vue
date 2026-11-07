<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <div v-if="!selectedAgent" class="q-pa-sm rmm-muted">No agent selected</div>
  <div v-else class="drivers-tab">
    <StaleBanner
      v-if="error && inventory"
      :message="errorMessage"
      :loaded-at="lastLoadedAt"
      :format-date="formatDate"
      @retry="load"
    />
    <q-table
      v-model:pagination="pagination"
      v-sortable-headers
      class="tabs-tbl-sticky rmm-table drivers-table"
      v-bind="denseTable"
      wrap-cells
      :rows="drivers"
      :columns="columns"
      :filter="filter"
      :style="{ 'max-height': tabHeight }"
      :loading="loading && !quiet"
      :row-key="rowKey"
    >
      <template #loading>
        <q-inner-loading showing color="primary" />
      </template>

      <template #top>
        <div class="full-width">
          <TabToolbar title="Drivers" :count="drivers.length">
            <q-btn
              icon="cloud_sync"
              label="Refresh from agent"
              :loading="refreshing"
              dense
              flat
              no-caps
              @click="refresh"
            >
              <q-tooltip
                >Ask the agent for its drivers; the list reloads once after 20
                seconds</q-tooltip
              >
            </q-btn>
            <q-btn
              icon="install_desktop"
              label="Install driver…"
              :loading="opening"
              dense
              flat
              no-caps
              @click="openInstallDriver"
            >
              <q-tooltip
                >Install a driver package on this device, or upload a new
                one</q-tooltip
              >
            </q-btn>
            <q-btn
              v-if="inventory"
              icon="travel_explore"
              label="Check catalog"
              :loading="checking"
              :disable="catalogProgress !== null"
              dense
              flat
              no-caps
              @click="checkCatalog"
            >
              <q-tooltip
                >Look up newer drivers for these devices in the Microsoft Update
                Catalog</q-tooltip
              >
            </q-btn>
            <q-btn
              icon="fact_check"
              label="SDIO approvals…"
              dense
              flat
              no-caps
              @click="openSdioApprovals"
            >
              <q-tooltip
                >Newer drivers from the SDIO index for all your devices, the
                approved ones and the index itself</q-tooltip
              >
            </q-btn>
            <span
              v-if="inventory?.stale"
              class="rmm-muted"
              :title="formatDate(inventory.received)"
              >last reported {{ relativeTime(inventory.received) }}</span
            >
            <q-space />
            <q-input
              v-if="drivers.length"
              v-model="filter"
              class="drivers-search"
              placeholder="Search drivers"
              aria-label="Search drivers"
              outlined
              dense
              clearable
            >
              <template #prepend>
                <q-icon name="search" class="rmm-muted" />
              </template>
            </q-input>
          </TabToolbar>

          <div v-if="catalogProgress" class="drivers-progress" role="status">
            <div class="rmm-muted">
              Checking the Microsoft Update Catalog<template
                v-if="catalogProgress.total > 0"
                >: {{ catalogProgress.done }} of
                {{ catalogProgress.total }} devices</template
              >
            </div>
            <q-linear-progress
              :value="
                catalogProgress.total > 0
                  ? catalogProgress.done / catalogProgress.total
                  : 0
              "
              :indeterminate="!catalogProgress.total"
              size="3px"
              color="primary"
            />
          </div>

          <q-banner
            v-if="problems.length"
            dense
            rounded
            class="rmm-banner-warning q-ma-sm"
            role="status"
          >
            <template #avatar>
              <q-icon name="warning_amber" color="warning" />
            </template>
            {{ problems.length }}
            {{ problems.length === 1 ? "device has" : "devices have" }} a
            problem
            <ul class="drivers-problems">
              <li v-for="(p, i) in problems" :key="`${i}|${p.device_id}`">
                <strong>{{ p.name || p.device_id }}</strong>
                <span v-if="p.class" class="rmm-muted"> · {{ p.class }}</span>
                · {{ problemText(p.code) }}
              </li>
            </ul>
          </q-banner>
          <p v-if="inventory?.errors?.length" class="drivers-errors rmm-muted">
            Part of the inventory could not be read:
            {{ inventory.errors.join("; ") }}
          </p>
        </div>
      </template>

      <template #no-data>
        <div v-if="!loading" class="full-width">
          <LoadFailed
            v-if="error && !inventory"
            title="Unable to load drivers"
            :message="errorMessage"
            @retry="load"
          />
          <EmptyState
            v-else-if="!inventory"
            icon="settings_input_component"
            title="No driver inventory yet"
            text="The agent reports its drivers once a day. Refresh asks for them now."
          >
            <q-btn
              icon="cloud_sync"
              label="Refresh from agent"
              :loading="refreshing"
              color="primary"
              unelevated
              dense
              no-caps
              @click="refresh"
            />
          </EmptyState>
          <EmptyState
            v-else-if="filter && inventory.drivers.length"
            icon="filter_alt_off"
            title="No drivers match your search"
            text="Clear the search to see every driver."
          >
            <q-btn
              label="Clear search"
              outline
              dense
              no-caps
              color="primary"
              @click="filter = ''"
            />
          </EmptyState>
          <EmptyState
            v-else
            icon="settings_input_component"
            title="No drivers reported"
            text="The last inventory from the agent holds no drivers."
          />
        </div>
      </template>

      <template #body="tr">
        <q-tr :props="tr">
          <q-td v-for="column in tr.cols" :key="column.name" :props="tr">
            <template v-if="column.name === 'actions'">
              <q-btn
                v-if="tr.row.catalog"
                icon="system_update_alt"
                size="sm"
                flat
                round
                dense
                :loading="catalogBusy === rowKey(tr.row)"
                :disable="catalogBusy !== null"
                :aria-label="`Install ${tr.row.catalog.title} on ${tr.row.device}`"
                @click="confirmCatalogInstall(tr.row)"
              >
                <q-tooltip
                  >Install version {{ tr.row.catalog.version }} from the
                  Microsoft Update Catalog</q-tooltip
                >
              </q-btn>
              <q-btn
                v-if="
                  tr.row.sdio && !tr.row.sdio.approved && tr.row.sdio.pack_http
                "
                icon="verified"
                size="sm"
                flat
                round
                dense
                :loading="approving === rowKey(tr.row)"
                :disable="approving !== null"
                :aria-label="`Approve ${sdioName(tr.row.sdio)} ${tr.row.sdio.version} for all devices`"
                @click="confirmSdioApprove(tr.row)"
              >
                <q-tooltip
                  >Approve version {{ tr.row.sdio.version }} from SDIO for every
                  device with this hardware id</q-tooltip
                >
              </q-btn>
              <q-btn
                v-if="tr.row.removable"
                icon="delete"
                size="sm"
                flat
                round
                dense
                :loading="removing === tr.row.inf"
                :disable="removing !== null"
                :aria-label="`Remove driver ${tr.row.inf} of ${tr.row.device}`"
                @click="confirmRemove(tr.row)"
              >
                <q-tooltip
                  >Remove this driver package from the device</q-tooltip
                >
              </q-btn>
            </template>
            <template v-else-if="column.name === 'catalog'">
              <a
                v-if="tr.row.catalog"
                :href="catalogSearchUrl(tr.row.catalog.query)"
                target="_blank"
                rel="noopener"
                class="rmm-link rmm-mono"
                :title="tr.row.catalog.title"
                >{{ tr.row.catalog.version }}
                <span class="rmm-muted">· {{ tr.row.catalog.date }}</span></a
              >
              <span
                v-else-if="tr.row.catalog_error"
                class="text-warning"
                :title="tr.row.catalog_error"
                >catalog unavailable</span
              >
              <span
                v-else-if="tr.row.catalog_checked"
                class="rmm-muted"
                :title="`Checked ${formatDate(tr.row.catalog_checked)}`"
                >—</span
              >
              <span v-else class="rmm-muted">not checked</span>
            </template>
            <span v-else-if="column.name === 'sdio'" class="drivers-sdio">
              <span
                v-if="tr.row.sdio"
                class="rmm-mono"
                :title="sdioTitle(tr.row.sdio)"
                >{{ tr.row.sdio.version }}
                <span class="rmm-muted">· {{ tr.row.sdio.date }}</span></span
              >
              <span
                v-else-if="tr.row.sdio_checked"
                class="rmm-muted"
                :title="`Checked ${formatDate(tr.row.sdio_checked)}`"
                >—</span
              >
              <span
                v-else
                class="rmm-muted"
                :title="inventory?.sdio_index?.error || undefined"
                >not checked</span
              >
              <span
                v-if="tr.row.sdio?.approved"
                class="rmm-pill rmm-pill--positive"
                >approved</span
              >
              <span
                v-if="tr.row.sdio && !tr.row.sdio.pack_http"
                class="rmm-pill"
                :title="BITTORRENT_ONLY"
                >BitTorrent only</span
              >
              <span v-if="tr.row.sdio_job" class="drivers-job">
                <span
                  class="rmm-pill"
                  :class="`rmm-pill--${sdioJobMeta(tr.row.sdio_job).tone}`"
                  :title="sdioJobTitle(tr.row.sdio_job)"
                  >{{ sdioJobMeta(tr.row.sdio_job).label }}</span
                >
                <q-linear-progress
                  v-if="sdioJobMeta(tr.row.sdio_job).percent !== null"
                  :value="(sdioJobMeta(tr.row.sdio_job).percent ?? 0) / 100"
                  size="2px"
                  color="info"
                  rounded
                />
              </span>
            </span>
            <span
              v-else-if="column.name === 'signed'"
              class="rmm-pill"
              :class="`rmm-pill--${signedMeta(tr.row.signed).tone}`"
              >{{ signedMeta(tr.row.signed).label }}</span
            >
            <span
              v-else
              :class="{
                'rmm-muted': !column.value,
                'rmm-mono': column.name === 'version' || column.name === 'inf',
              }"
              >{{ column.value || "—" }}</span
            >
          </q-td>
        </q-tr>
      </template>
    </q-table>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useQuasar } from "quasar";
import {
  approveSdioDriver,
  checkDriverCatalog,
  fetchAgentDrivers,
  fetchCatalogCheck,
  fetchCatalogJob,
  installCatalogDriver,
  refreshAgentDrivers,
} from "@/api/software";
import { fetchAgent } from "@/api/agents";
import { fetchPackages, removeDriver } from "@/api/packages";
import {
  BITTORRENT_ONLY,
  BOOT_WARNING,
  NET_WARNING,
  catalogSearchUrl,
  isBootClass,
  isNetClass,
  isSdioJobActive,
  problemText,
  sdioApproveDialog,
  sdioJobMeta,
  sdioName,
  sdioPackText,
  signedMeta,
  type Driver,
  type DriverInventory,
  type SdioEntry,
  type SdioJob,
} from "@/utils/drivers";
import { fmtBytes, relativeTime } from "@/utils/format";
import {
  notifyError,
  notifyInfo,
  notifySuccess,
  notifyWarning,
} from "@/utils/notify";
import { sortableHeaders as vSortableHeaders } from "@/utils/sortableHeaders";
import EmptyState from "@/components/ui/EmptyState.vue";
import TabToolbar from "@/components/agents/TabToolbar.vue";
import StaleBanner from "@/components/agents/StaleBanner.vue";
import LoadFailed from "@/components/agents/LoadFailed.vue";
import { denseTable } from "@/components/agents/tableProps";
import { useAgentTab } from "@/components/agents/useAgentTab";
import DialogWrapper from "@/components/ui/DialogWrapper.vue";
import InstallPackage from "@/components/packages/InstallPackage.vue";
import PackageInstalls from "@/components/packages/PackageInstalls.vue";
import SdioApprovals from "@/components/agents/SdioApprovals.vue";
import { withStepUp } from "@/components/vault/stepUp";

defineOptions({ name: "DriversTab" });

const col = (name: string, label: string, extra = {}) => ({
  name,
  label,
  field: name,
  align: "left" as const,
  sortable: true,
  ...extra,
});
const columns = [
  col("device", "Device"),
  col("class", "Class"),
  col("provider", "Provider"),
  col("manufacturer", "Manufacturer"),
  col("version", "Version"),
  col("catalog", "Newer in catalog", {
    field: (row: Driver) => row.catalog?.version ?? "",
  }),
  col("sdio", "Newer in SDIO", {
    field: (row: Driver) => row.sdio?.version ?? "",
  }),
  col("date", "Date", { classes: "text-no-wrap" }),
  col("inf", "INF"),
  col("signed", "Signature", {
    field: (row: Driver) => signedMeta(row.signed).label,
  }),
  col("actions", "", { align: "right" as const, sortable: false }),
];

const $q = useQuasar();
const inventory = ref<DriverInventory | null>(null);
const filter = ref<string | null>("");
const refreshing = ref(false);
// the INF whose removal is running
const removing = ref<string | null>(null);
const pagination = ref({ rowsPerPage: 0, sortBy: "class", descending: false });
let followUp = 0;

const {
  selectedAgent,
  tabHeight,
  formatDate,
  loading,
  error,
  errorMessage,
  lastLoadedAt,
  load,
} = useAgentTab({
  // 404: the agent has not reported yet
  fetch: (agentId: string) =>
    fetchAgentDrivers(agentId).catch((e) => {
      if (e?.response?.status === 404) return null;
      throw e;
    }),
  accept: (data: DriverInventory | null) => {
    inventory.value = data;
    pollSdio(data);
  },
  clear: () => (inventory.value = null),
  forbidden: "Your role cannot view drivers of this device.",
  failed: "The driver inventory could not be loaded.",
});

const drivers = computed(() => inventory.value?.drivers ?? []);
const problems = computed(() => inventory.value?.problems ?? []);

function later(agentId: string, ms = 20000) {
  window.clearTimeout(followUp);
  followUp = window.setTimeout(() => {
    if (agentId === selectedAgent.value) void load();
  }, ms);
}

// after an install: now, and again once the agent has sent its new list
function reloadAfterInstall(agentId: string) {
  if (agentId !== selectedAgent.value) return;
  void load();
  later(agentId);
}

const rowKey = (r: Driver) => `${r.device_id}|${r.inf}`;

const opening = ref(false);
async function openInstallDriver() {
  const agentId = selectedAgent.value;
  opening.value = true;
  try {
    const [agent, packages] = await Promise.all([
      fetchAgent(agentId),
      fetchPackages().catch((e) => {
        if (e?.response?.status === 403)
          notifyError("Your role cannot install packages.");
        throw e;
      }),
    ]);
    if (agentId !== selectedAgent.value) return;
    $q.dialog({
      component: InstallPackage,
      componentProps: { agent, packages, kind: "driver", allowUpload: true },
    }).onOk((installs) =>
      installs?.onDismiss(() => reloadAfterInstall(agentId)),
    );
  } catch (e) {
    console.error(e);
  } finally {
    opening.value = false;
  }
}

const checking = ref(false);
async function checkCatalog() {
  const agentId = selectedAgent.value;
  checking.value = true;
  try {
    const reply = await checkDriverCatalog(agentId);
    notifySuccess(
      reply?.detail || "Checking the Microsoft Update Catalog",
      5000,
    );
    watchCatalogCheck(agentId);
  } catch {
    // the response interceptor shows the error
  } finally {
    checking.value = false;
  }
}

// the running check: progress every 2 s, at most 10 minutes; the tab
// reloads once it is over, or when none showed up within 10 s
const catalogProgress = ref<{ done: number; total: number } | null>(null);
let checkTimer = 0;
// a newer check, an agent change or unmount ends the older poll chain
let checkRun = 0;

function stopCatalogCheck() {
  checkRun++;
  window.clearTimeout(checkTimer);
  catalogProgress.value = null;
}

// running: a check already in progress, e.g. started by someone else
function watchCatalogCheck(
  agentId: string,
  running: { done: number; total: number } | null = null,
) {
  stopCatalogCheck();
  catalogProgress.value = running;
  const mine = checkRun;
  const started = Date.now();
  let seen = running !== null;
  const tick = async () => {
    let reply;
    let status = 0;
    try {
      reply = await fetchCatalogCheck(agentId);
    } catch (e) {
      // other failures are retried
      status = (e as { response?: { status?: number } })?.response?.status ?? 0;
    }
    if (mine !== checkRun || agentId !== selectedAgent.value) return;
    // role lost or agent gone: nothing to wait for or reload
    if (status === 403 || status === 404) return stopCatalogCheck();
    if (reply) catalogProgress.value = reply.progress ?? null;
    if (catalogProgress.value) seen = true;
    const age = Date.now() - started;
    const running =
      catalogProgress.value !== null || !reply || (!seen && age < 10000);
    if (running && age < 10 * 60 * 1000) {
      checkTimer = window.setTimeout(tick, 2000);
      return;
    }
    catalogProgress.value = null;
    void load();
  };
  checkTimer = window.setTimeout(tick, 2000);
}

// on open and agent change: show a check that is already running
async function probeCatalogCheck() {
  const agentId = selectedAgent.value;
  if (!agentId) return;
  const run = checkRun;
  try {
    const reply = await fetchCatalogCheck(agentId);
    if (reply?.progress && run === checkRun && agentId === selectedAgent.value)
      watchCatalogCheck(agentId, reply.progress);
  } catch {
    // no bar then
  }
}

// the row whose catalog install job runs; one at a time
const catalogBusy = ref<string | null>(null);
let pollTimer = 0;
// a stop or a newer install ends the older chain, also with a reply in flight
let pollRun = 0;
const POLL_MS = 3000;
const POLL_LIMIT_MS = 30 * 60 * 1000;

function stopPoll() {
  pollRun++;
  window.clearTimeout(pollTimer);
  catalogBusy.value = null;
}

function confirmCatalogInstall(row: Driver) {
  const entry = row.catalog;
  if (!entry) return;
  const facts = [
    !entry.title.includes(entry.version) && `version ${entry.version}`,
    entry.date && `from ${entry.date}`,
    entry.size > 0 && fmtBytes(entry.size),
  ].filter(Boolean);
  const parts = [
    `${entry.title} (${facts.join(", ")}) for ${row.device || row.device_id}.`,
    "Downloads it from the Microsoft Update Catalog to the RMM server and installs it with pnputil as system.",
  ];
  if (isNetClass(row.class)) parts.push(NET_WARNING);
  if (isBootClass(row.class)) parts.push(BOOT_WARNING);
  $q.dialog({
    title: "Install driver from the catalog",
    message: parts.join(" "),
    cancel: true,
    ok: { label: "Install", color: "primary", unelevated: true, noCaps: true },
    persistent: true,
  }).onOk(() => installFromCatalog(row));
}

async function installFromCatalog(row: Driver) {
  const entry = row.catalog;
  if (!entry) return;
  const agentId = selectedAgent.value;
  catalogBusy.value = rowKey(row);
  try {
    const { job } = await installCatalogDriver(agentId, {
      device_id: row.device_id,
      update_id: entry.update_id,
    });
    notifyInfo(
      `Downloading ${entry.title} from the Microsoft Update Catalog`,
      4000,
    );
    poll(agentId, job, entry.title, Date.now() + POLL_LIMIT_MS, ++pollRun);
  } catch {
    // the response interceptor shows the error
    catalogBusy.value = null;
  }
}

function poll(
  agentId: string,
  job: string,
  title: string,
  deadline: number,
  run: number,
) {
  pollTimer = window.setTimeout(async () => {
    if (agentId !== selectedAgent.value) return stopPoll();
    let reply = null;
    try {
      reply = await fetchCatalogJob(agentId, job);
    } catch (e) {
      if (run !== pollRun) return;
      if ((e as { response?: { status?: number } })?.response?.status === 404) {
        stopPoll();
        notifyError(`The install job for ${title} expired on the server.`);
        return;
      }
      // a missed poll is retried
    }
    if (run !== pollRun) return;
    if (agentId !== selectedAgent.value) return stopPoll();
    if (reply?.state === "queued") {
      stopPoll();
      if (reply.batch) showInstalls(agentId, reply.batch, title);
      else notifySuccess(reply.detail || `${title} was sent to the agent`);
      return;
    }
    if (reply?.state === "failed") {
      stopPoll();
      notifyError(
        `${title} was not installed: ${reply.detail || "no reason given"}`,
      );
      return;
    }
    if (Date.now() > deadline) {
      stopPoll();
      notifyWarning(
        `${title} is still downloading on the server; check the package installs later.`,
        6000,
      );
      return;
    }
    poll(agentId, job, title, deadline, run);
  }, POLL_MS);
}

function showInstalls(agentId: string, batch: string, title: string) {
  $q.dialog({
    component: DialogWrapper,
    componentProps: {
      vuecomponent: PackageInstalls,
      title,
      size: "lg",
      height: "40",
      componentProps: { batch },
    },
  }).onDismiss(() => reloadAfterInstall(agentId));
}

async function refresh() {
  const agentId = selectedAgent.value;
  refreshing.value = true;
  try {
    const reply = await refreshAgentDrivers(agentId);
    notifySuccess(
      typeof reply === "string" && reply
        ? reply
        : "Asked the agent for its drivers",
    );
    later(agentId);
  } catch {
    // the response interceptor shows the error
  } finally {
    refreshing.value = false;
  }
}

function confirmRemove(row: Driver) {
  const shared = drivers.value.filter((d) => d.inf === row.inf).length;
  const about = [row.provider, row.version].filter(Boolean).join(" ");
  const parts = [
    `Remove the driver package ${row.inf}${about ? ` (${about})` : ""} from ${row.device || row.device_id}?`,
  ];
  if (shared > 1) parts.push(`${shared} devices use this package.`);
  parts.push(
    "Windows falls back to another driver if it has one; the device may stop working until a driver is installed again.",
  );
  if (drivers.value.some((d) => d.inf === row.inf && isNetClass(d.class)))
    parts.push(NET_WARNING);
  $q.dialog({
    title: "Remove driver",
    message: parts.join(" "),
    cancel: true,
    ok: { label: "Remove", color: "negative", unelevated: true, noCaps: true },
    persistent: true,
  }).onOk(() => remove(row));
}

async function remove(row: Driver) {
  const agentId = selectedAgent.value;
  removing.value = row.inf;
  try {
    const result = await removeDriver(agentId, row.inf);
    const detail = result?.detail ? `: ${result.detail}` : "";
    if (result?.state === "succeeded") notifySuccess(`${row.inf} removed`);
    else if (result?.state === "reboot_required")
      notifyWarning(`${row.inf} removed, restart the device to finish`, 6000);
    else notifyError(`${row.inf} was not removed${detail}`);
    // the server asks the agent for a new inventory afterwards
    if (agentId === selectedAgent.value) {
      void load();
      later(agentId);
    }
  } catch {
    // the response interceptor shows the error
  } finally {
    removing.value = null;
  }
}

// a running SDIO job: reload every 10 s (5 s while one downloads), at most
// 4 hours
const SDIO_POLL_LIMIT_MS = 4 * 60 * 60 * 1000;
let sdioTimer = 0;
let sdioUntil = 0;
// a reload still in flight at unmount must not arm the poll again
let unmounted = false;
// background reloads leave the table without the loading overlay
const quiet = ref(false);

function stopSdioPoll() {
  window.clearTimeout(sdioTimer);
  sdioUntil = 0;
}

function pollSdio(data: DriverInventory | null) {
  window.clearTimeout(sdioTimer);
  if (unmounted) return;
  if (!data?.drivers.some((d) => isSdioJobActive(d.sdio_job))) {
    sdioUntil = 0;
    return;
  }
  if (!sdioUntil) sdioUntil = Date.now() + SDIO_POLL_LIMIT_MS;
  if (Date.now() > sdioUntil) return;
  const agentId = selectedAgent.value;
  const ms = data.drivers.some((d) => d.sdio_job?.state === "downloading")
    ? 5000
    : 10000;
  sdioTimer = window.setTimeout(async () => {
    if (agentId !== selectedAgent.value) return;
    quiet.value = true;
    await load();
    quiet.value = false;
    // a failed reload does not reach accept; try again
    if (error.value && agentId === selectedAgent.value)
      pollSdio(inventory.value);
  }, ms);
}

function sdioTitle(e: SdioEntry) {
  return [e.desc, e.provider, sdioPackText(e), `${e.folder}${e.inf}`, e.hwid]
    .filter(Boolean)
    .join("\n");
}

function sdioJobTitle(job: SdioJob) {
  return [job.detail, job.updated && `Updated ${formatDate.value(job.updated)}`]
    .filter(Boolean)
    .join("\n");
}

function openSdioApprovals() {
  const agentId = selectedAgent.value;
  $q.dialog({ component: SdioApprovals }).onDismiss(() => {
    if (agentId === selectedAgent.value) void load();
  });
}

function confirmSdioApprove(row: Driver) {
  if (!row.sdio) return;
  $q.dialog(sdioApproveDialog(row.sdio, [row.class])).onOk(() =>
    approveSdio(row),
  );
}

// the row whose approval is being sent
const approving = ref<string | null>(null);
async function approveSdio(row: Driver) {
  const entry = row.sdio;
  if (!entry) return;
  const agentId = selectedAgent.value;
  approving.value = rowKey(row);
  const approval = await withStepUp($q, (config) =>
    approveSdioDriver({ hwid: entry.hwid, version: entry.version }, config),
  );
  approving.value = null;
  if (approval === null) return;
  notifySuccess(
    `${sdioName(entry)} ${entry.version} approved for all devices`,
    5000,
  );
  // the server makes the install jobs in the background
  reloadAfterInstall(agentId);
}

onMounted(probeCatalogCheck);
watch(selectedAgent, () => {
  window.clearTimeout(followUp);
  stopPoll();
  stopSdioPoll();
  stopCatalogCheck();
  void probeCatalogCheck();
  filter.value = "";
});
onBeforeUnmount(() => {
  unmounted = true;
  window.clearTimeout(followUp);
  stopPoll();
  stopSdioPoll();
  stopCatalogCheck();
});
</script>

<style scoped>
.drivers-tab {
  min-width: 0;
  background: var(--rmm-surface);
}

.drivers-table :deep(.q-table__top) {
  padding: 0;
}

/* eleven columns outgrow the tab below ~1700 px; the row actions stay
   pinned on the right while the rest scrolls */
.drivers-table :deep(tbody td:last-child),
.drivers-table :deep(thead th:last-child) {
  position: sticky;
  right: 0;
  box-shadow: inset 1px 0 var(--rmm-border);
}

.drivers-table :deep(tbody td:last-child) {
  background: var(--rmm-surface);
}

.drivers-table :deep(thead th:last-child) {
  z-index: 2;
}

.drivers-search {
  width: min(260px, 45vw);
}

.drivers-problems {
  margin: 4px 0 0;
  padding-left: 18px;
}

.drivers-sdio {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 6px;
}

/* headers, versions and pills stay whole; the cells wrap between them */
.drivers-table :deep(th),
.drivers-table :deep(.rmm-mono),
.drivers-table :deep(.rmm-pill) {
  white-space: nowrap;
}

.drivers-job {
  display: inline-flex;
  flex-direction: column;
  gap: 2px;
}

.drivers-progress {
  margin: 0 10px 8px;
  font-size: var(--rmm-fs-sm);
}

.drivers-errors {
  margin: 0 10px 8px;
  font-size: var(--rmm-fs-sm);
}

.drivers-table :deep(td:last-child),
.drivers-table :deep(th:last-child) {
  width: 1%;
  white-space: nowrap;
}
</style>
