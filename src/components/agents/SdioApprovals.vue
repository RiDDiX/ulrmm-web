<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-dialog
    ref="dialogRef"
    aria-labelledby="sdio-approvals-title"
    @hide="onDialogHide"
  >
    <q-card class="q-dialog-plugin rmm-dialog--lg">
      <DialogHeader
        title-id="sdio-approvals-title"
        title="SDIO approvals"
        subtitle="Newer drivers from the SDIO index for your devices. Approved drivers install on every device with that hardware id."
      >
        <template #actions>
          <q-btn
            dense
            flat
            icon="refresh"
            aria-label="Reload the lists"
            @click="load"
          >
            <q-tooltip>Reload the lists</q-tooltip>
          </q-btn>
        </template>
      </DialogHeader>

      <div class="rmm-toolbar full-width sdio-bar">
        <q-btn
          icon="sync"
          label="Refresh index"
          :loading="refreshing"
          :disable="progress !== null"
          dense
          flat
          no-caps
          @click="refreshIndex"
        >
          <q-tooltip
            >Download the newest SDIO index and look up the devices again; takes
            a few minutes</q-tooltip
          >
        </q-btn>
        <span
          v-if="index"
          class="rmm-muted"
          :title="
            index.updated
              ? `Downloaded ${formatDate(index.updated)}`
              : undefined
          "
          >{{ indexText }}</span
        >
      </div>
      <div v-if="progress" class="sdio-progress" role="status">
        <div class="rmm-muted">{{ progressText }}</div>
        <q-linear-progress
          :value="progress.total > 0 ? progress.done / progress.total : 0"
          :indeterminate="!progress.total"
          size="4px"
          color="primary"
        />
      </div>
      <q-banner
        v-if="index?.error"
        dense
        rounded
        class="rmm-banner-warning q-ma-sm"
        role="status"
      >
        <template #avatar>
          <q-icon name="warning_amber" color="warning" />
        </template>
        The SDIO index could not be refreshed: {{ index.error }}
      </q-banner>

      <q-tabs
        v-model="tab"
        dense
        no-caps
        align="left"
        active-color="primary"
        indicator-color="primary"
      >
        <q-tab name="offers" :label="`Newer drivers (${offers.length})`" />
        <q-tab name="approved" :label="`Approved (${approvals.length})`" />
      </q-tabs>
      <q-separator />

      <q-tab-panels v-model="tab">
        <q-tab-panel name="offers" class="q-pa-none">
          <q-table
            :rows="offers"
            :columns="offerColumns"
            :loading="loading"
            :row-key="offerKey"
            :pagination="{ rowsPerPage: 0 }"
            v-bind="tableAttrs"
          >
            <template #loading>
              <q-inner-loading showing color="primary" />
            </template>
            <template #no-data>
              <NoDataPanel
                :loading="loading"
                :error="offersError"
                icon="fact_check"
                title="No newer drivers"
                text="No newer drivers in the SDIO index for your devices."
                @retry="load"
              />
            </template>
            <template #body-cell-version="cell">
              <q-td :props="cell" class="rmm-mono">
                {{ cell.row.version }}
                <span class="rmm-muted">· {{ cell.row.date }}</span>
              </q-td>
            </template>
            <template #body-cell-pack="cell">
              <q-td :props="cell">
                <span :title="`${cell.row.folder}${cell.row.inf}`">{{
                  sdioPackText(cell.row)
                }}</span>
                <span
                  v-if="!cell.row.pack_http"
                  class="rmm-pill q-ml-xs"
                  :title="BITTORRENT_ONLY"
                  >BitTorrent only</span
                >
              </q-td>
            </template>
            <template #body-cell-devices="cell">
              <q-td :props="cell" class="rmm-num">
                {{ deviceCount(cell.row) }}
                <q-tooltip>
                  <div
                    v-for="(d, i) in cell.row.devices"
                    :key="`${i}|${d.agent_id}`"
                  >
                    {{ d.hostname }} · {{ d.device }} · {{ d.version }}
                  </div>
                  <div v-if="deviceCount(cell.row) > cell.row.devices.length">
                    and {{ deviceCount(cell.row) - cell.row.devices.length }}
                    more
                  </div>
                </q-tooltip>
              </q-td>
            </template>
            <template #body-cell-actions="cell">
              <q-td :props="cell">
                <span
                  v-if="cell.row.approved"
                  class="rmm-pill rmm-pill--positive"
                  >approved</span
                >
                <q-btn
                  v-else-if="cell.row.pack_http"
                  icon="verified"
                  size="sm"
                  flat
                  round
                  dense
                  :loading="approving === offerKey(cell.row)"
                  :disable="approving !== null"
                  :aria-label="`Approve ${sdioName(cell.row)} ${cell.row.version} for all devices`"
                  @click="confirmApprove(cell.row)"
                >
                  <q-tooltip
                    >Approve version {{ cell.row.version }} for every device
                    with this hardware id</q-tooltip
                  >
                </q-btn>
              </q-td>
            </template>
          </q-table>
        </q-tab-panel>

        <q-tab-panel name="approved" class="q-pa-none">
          <q-table
            row-key="id"
            :loading="loading"
            :rows="approvals"
            :columns="columns"
            :pagination="{
              rowsPerPage: 0,
              sortBy: 'created',
              descending: true,
            }"
            v-bind="tableAttrs"
          >
            <template #loading>
              <q-inner-loading showing color="primary" />
            </template>
            <template #no-data>
              <NoDataPanel
                :loading="loading"
                :error="error"
                icon="fact_check"
                title="No approved drivers"
                text="Approve a driver on the Newer drivers tab or in the Newer in SDIO column of a device's Drivers tab."
                @retry="load"
              />
            </template>
            <template #body-cell-actions="cell">
              <q-td :props="cell">
                <q-btn
                  icon="delete"
                  size="sm"
                  flat
                  round
                  dense
                  :loading="revoking === cell.row.id"
                  :disable="revoking !== null"
                  :aria-label="`Revoke the approval of ${cell.row.desc || cell.row.hwid} ${cell.row.version}`"
                  @click="confirmRevoke(cell.row)"
                >
                  <q-tooltip>Revoke this approval</q-tooltip>
                </q-btn>
              </q-td>
            </template>
          </q-table>
        </q-tab-panel>
      </q-tab-panels>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useDialogPluginComponent, useQuasar, type QTableColumn } from "quasar";
import { useStore } from "vuex";
import {
  approveSdioDriver,
  fetchSdioApprovals,
  fetchSdioOffers,
  fetchSdioProgress,
  refreshSdioIndex,
  revokeSdioApproval,
} from "@/api/software";
import {
  BITTORRENT_ONLY,
  sdioApproveDialog,
  sdioName,
  sdioPackText,
  type SdioApproval,
  type SdioIndex,
  type SdioOffer,
  type SdioProgress,
} from "@/utils/drivers";
import { notifySuccess } from "@/utils/notify";
import { withStepUp } from "@/components/vault/stepUp";
import DialogHeader from "@/components/ui/DialogHeader.vue";
import NoDataPanel from "@/core/ui/NoDataPanel.vue";

defineEmits([...useDialogPluginComponent.emits]);
const { dialogRef, onDialogHide } = useDialogPluginComponent();

const store = useStore();
const formatDate = computed(() => store.getters.formatDate);

const tableAttrs = {
  dense: true,
  flat: true,
  "binary-state-sort": true,
  // the 60vw card is narrower than one-line rows; wrapping keeps the
  // approve and revoke buttons of the last column in view
  "wrap-cells": true,
  "rows-per-page-options": [0],
  "table-class": "table-bgcolor",
  class: "settings-tbl-sticky rmm-table",
  style: "max-height: 60vh",
};

const $q = useQuasar();

const col = (
  name: string,
  label: string,
  extra: Partial<QTableColumn> = {},
): QTableColumn => ({
  name,
  label,
  field: name,
  align: "left",
  sortable: true,
  ...extra,
});
// unsorted: the server lists the drivers with the most devices first
const offerColumns: QTableColumn[] = [
  col("desc", "Driver"),
  col("hwid", "Hardware id", { classes: "rmm-mono" }),
  col("version", "Version"),
  col("provider", "Provider"),
  col("pack", "Pack"),
  col("devices", "Devices", {
    align: "right",
    field: (row: SdioOffer) => deviceCount(row),
  }),
  col("actions", "", { align: "right", sortable: false }),
];
const columns: QTableColumn[] = [
  col("hwid", "Hardware id", { classes: "rmm-mono" }),
  col("desc", "Driver"),
  col("version", "Version", { classes: "rmm-mono" }),
  col("date", "Date"),
  col("created_by", "Approved by"),
  col("created", "Approved on", {
    format: (v: string) => formatDate.value(v),
  }),
  col("devices", "Devices", { align: "right" }),
  col("actions", "", { align: "right", sortable: false }),
];

const tab = ref("offers");
const offers = ref<SdioOffer[]>([]);
const offersError = ref("");
const approvals = ref<SdioApproval[]>([]);
const index = ref<SdioIndex | null>(null);
const loading = ref(false);
const error = ref("");
const refreshing = ref(false);
const revoking = ref<number | null>(null);
const approving = ref<string | null>(null);

const offerKey = (o: SdioOffer) => `${o.hwid}|${o.version}`;
// devices lists at most 200, device_count all of them
const deviceCount = (o: SdioOffer) => o.device_count ?? o.devices.length;

const indexText = computed(() => {
  const i = index.value;
  if (!i?.files) return "The SDIO index has not been downloaded yet.";
  const when = i.torrent_time ? i.torrent_time * 1000 : i.updated;
  return `SDIO index from ${formatDate.value(when)}, ${i.files} files, ${i.http_packs} pack${i.http_packs === 1 ? "" : "s"} on the mirror`;
});

type HttpError = { response?: { status?: number } };
const failText = (e: unknown, what: string) =>
  (e as HttpError)?.response?.status === 403
    ? `Your role cannot view ${what}.`
    : `The ${what} could not be loaded.`;

async function load() {
  loading.value = true;
  const [a, o] = await Promise.allSettled([
    fetchSdioApprovals(),
    fetchSdioOffers(),
  ]);
  if (a.status === "fulfilled") {
    index.value = a.value.index;
    approvals.value = a.value.approvals ?? [];
    error.value = "";
  } else {
    console.error(a.reason);
    error.value = failText(a.reason, "driver approvals");
  }
  if (o.status === "fulfilled") {
    offers.value = o.value.offers ?? [];
    offersError.value = "";
  } else {
    console.error(o.reason);
    offersError.value = failText(o.reason, "newer drivers");
  }
  loading.value = false;
}

const PHASES: Record<string, string> = {
  torrent: "Fetching the torrent",
  indexes: "Downloading indexes",
  verify: "Checking pieces",
  packs: "Checking which packs the mirror serves",
  scan: "Matching drivers",
  apply: "Applying approvals",
};

const progress = ref<SdioProgress | null>(null);
const progressText = computed(() => {
  const p = progress.value;
  if (!p) return "";
  const text = PHASES[p.phase] ?? p.phase;
  return p.total > 0 ? `${text}: ${p.done} of ${p.total}` : text;
});

// a running refresh: progress every 2 s; both lists reload when it is over.
// Right after "Refresh index" the task may not have started yet, so up to
// 10 s without progress are waited out.
let progressTimer = 0;
// a newer watch or closing the dialog ends the older poll chain
let run = 0;
// the server drops progress older than 10 minutes, this is the backstop
const PROGRESS_LIMIT_MS = 15 * 60 * 1000;

function watchProgress(justStarted = false) {
  window.clearTimeout(progressTimer);
  const now = Date.now();
  void pollProgress(
    ++run,
    justStarted ? now + 10000 : 0,
    now + PROGRESS_LIMIT_MS,
    false,
  );
}

async function pollProgress(
  mine: number,
  waitUntil: number,
  stopAt: number,
  seen: boolean,
) {
  let reply;
  let status = 0;
  try {
    reply = await fetchSdioProgress();
  } catch (e) {
    // keep the last state; retried while a refresh runs
    status = (e as HttpError)?.response?.status ?? 0;
  }
  if (mine !== run) return;
  if (status === 403) {
    progress.value = null;
    return;
  }
  if (reply) progress.value = reply.progress ?? null;
  const ran = seen || progress.value !== null;
  const waiting = progress.value || (!ran && Date.now() < waitUntil);
  if (waiting && Date.now() < stopAt) {
    progressTimer = window.setTimeout(
      () => pollProgress(mine, waitUntil, stopAt, ran),
      2000,
    );
    return;
  }
  progress.value = null;
  if (ran || waitUntil) void load();
}

async function refreshIndex() {
  refreshing.value = true;
  try {
    const reply = await refreshSdioIndex();
    notifySuccess(
      typeof reply === "string" && reply
        ? reply
        : reply?.detail ||
            "Refreshing the SDIO index; this takes a few minutes",
      5000,
    );
    watchProgress(true);
  } catch (e) {
    // the response interceptor shows the error; 409 = one runs already
    if ((e as HttpError)?.response?.status === 409) watchProgress(true);
  } finally {
    refreshing.value = false;
  }
}

function confirmApprove(o: SdioOffer) {
  $q.dialog(
    sdioApproveDialog(
      o,
      o.devices.map((d) => d.class),
    ),
  ).onOk(() => approve(o));
}

async function approve(o: SdioOffer) {
  approving.value = offerKey(o);
  const approval = await withStepUp($q, (config) =>
    approveSdioDriver({ hwid: o.hwid, version: o.version }, config),
  );
  approving.value = null;
  if (approval === null) return;
  notifySuccess(`${sdioName(o)} ${o.version} approved for all devices`, 5000);
  void load();
}

function confirmRevoke(a: SdioApproval) {
  $q.dialog({
    title: "Revoke approval",
    message: `Revoke the approval of ${a.desc || a.hwid} ${a.version} (${a.hwid})? Devices no longer get this driver automatically. Jobs that already run are not stopped.`,
    cancel: true,
    ok: { label: "Revoke", color: "negative", unelevated: true, noCaps: true },
    persistent: true,
  }).onOk(() => revoke(a));
}

async function revoke(a: SdioApproval) {
  revoking.value = a.id;
  const done = await withStepUp($q, (config) =>
    revokeSdioApproval(a.id, config),
  );
  revoking.value = null;
  if (done === null) return;
  notifySuccess(`Approval of ${a.desc || a.hwid} ${a.version} revoked`);
  void load();
}

onMounted(() => {
  void load();
  watchProgress();
});
onBeforeUnmount(() => {
  run++;
  window.clearTimeout(progressTimer);
});
</script>

<style scoped>
/* headers, ids, versions and pills stay whole; cells wrap between them */
:deep(.q-table th),
:deep(.q-table .rmm-mono),
:deep(.q-table .rmm-pill) {
  white-space: nowrap;
}

.sdio-bar {
  padding: 4px 8px;
}

.sdio-progress {
  margin: 0 10px 8px;
  font-size: var(--rmm-fs-sm);
}
</style>
