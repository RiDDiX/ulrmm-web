<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-card class="rmm-dialog--lg" aria-labelledby="server-backups-title">
    <DialogHeader
      title="Server backups"
      subtitle="Database, settings and certificates of this RMM server"
      title-id="server-backups-title"
    />

    <q-tabs
      v-model="tab"
      dense
      no-caps
      align="left"
      active-color="primary"
      indicator-color="primary"
    >
      <q-tab name="list" label="Backups" />
      <q-tab name="settings" label="Settings" />
    </q-tabs>
    <q-separator />

    <q-banner
      v-if="info && !info.runner_installed"
      dense
      class="bg-warning text-dark"
    >
      The backup runner is not installed on this server yet. Run update.sh once
      on the server; after that, backups can be started from here.
    </q-banner>

    <q-tab-panels v-model="tab" animated>
      <q-tab-panel name="list" class="q-pa-none">
        <q-table
          flat
          dense
          :rows="info?.backups || []"
          :columns="columns"
          row-key="name"
          :loading="loading"
          :pagination="{ sortBy: 'created', descending: true, rowsPerPage: 25 }"
          :rows-per-page-options="[25, 50, 0]"
          no-data-label="No backups yet"
        >
          <template v-slot:top>
            <div class="sb-top">
              <q-btn
                unelevated
                no-caps
                color="primary"
                icon="backup"
                label="Back up now"
                :disable="!canStart"
                :loading="starting"
                @click="start"
              />
              <div v-if="running" class="sb-running" role="status">
                <q-spinner size="16px" color="primary" />
                Backup running…
              </div>
              <div
                v-else-if="lastState === 'failed'"
                class="sb-running text-negative"
                role="status"
              >
                <q-icon name="error" size="16px" />
                The last backup failed.
                <q-btn
                  flat
                  dense
                  no-caps
                  label="Show log"
                  @click="showLog = !showLog"
                />
              </div>
              <q-space />
              <div v-if="info?.can_download" class="text-caption rmm-muted">
                Large backups download faster with scp from /rmmbackups.
              </div>
              <div v-if="info?.disk?.free" class="text-caption rmm-muted">
                {{ fmtBytes(info.disk.free) }} free
              </div>
              <q-btn
                flat
                round
                dense
                icon="refresh"
                aria-label="Refresh"
                @click="load"
              />
            </div>
            <pre v-if="showLog || running" class="sb-log">{{ log }}</pre>
          </template>
          <template v-slot:body-cell-type="props">
            <q-td :props="props">
              <span class="rmm-pill" :class="typeClass(props.value)">{{
                props.value
              }}</span>
            </q-td>
          </template>
          <template v-slot:body-cell-actions="props">
            <q-td :props="props" class="text-right">
              <q-btn
                v-if="info?.can_download"
                flat
                round
                dense
                icon="download"
                :aria-label="`Download ${props.row.name}`"
                :loading="downloading === props.row.name"
                @click="download(props.row)"
              >
                <q-tooltip>Download</q-tooltip>
              </q-btn>
              <q-btn
                flat
                round
                dense
                icon="delete"
                color="negative"
                :aria-label="`Delete ${props.row.name}`"
                @click="remove(props.row)"
              >
                <q-tooltip>Delete</q-tooltip>
              </q-btn>
            </q-td>
          </template>
        </q-table>
      </q-tab-panel>

      <q-tab-panel name="settings">
        <q-form v-if="form" class="sb-form" @submit.prevent="saveSettings">
          <q-toggle
            v-model="form.schedule_enabled"
            label="Back up every night"
          />
          <q-input
            v-model="form.schedule_time"
            outlined
            dense
            label="Time (24 h, server time)"
            mask="##:##"
            :disable="!form.schedule_enabled"
            :rules="[
              (v) =>
                /^([01]\d|2[0-3]):[0-5]\d$/.test(v) || 'HH:MM, 00:00 to 23:59',
            ]"
          />
          <div class="text-caption rmm-muted">
            The nightly backup is filed as monthly on the 10th of the month,
            weekly on Fridays and daily on all other days.
          </div>
          <q-input
            v-for="f in keepFields"
            :key="f.key"
            v-model.number="form[f.key]"
            type="number"
            outlined
            dense
            :label="f.label"
            :hint="f.hint"
            :rules="[
              (v) =>
                (Number.isInteger(v) && v >= f.min && v <= f.max) ||
                `${f.min} to ${f.max}`,
            ]"
          />
          <div>
            <q-btn
              unelevated
              no-caps
              color="primary"
              type="submit"
              label="Save"
              :loading="saving"
              :disable="!info?.runner_installed"
            />
          </div>
        </q-form>
      </q-tab-panel>
    </q-tab-panels>

    <q-card-actions align="right">
      <q-btn v-close-popup flat no-caps label="Close" />
    </q-card-actions>
  </q-card>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { exportFile, useQuasar } from "quasar";
import { useStore } from "vuex";

import DialogHeader from "@/components/ui/DialogHeader.vue";
import { withStepUp } from "@/components/vault/stepUp";
import { ensureConsoleStepUp } from "@/composables/accounts";
import { notifySuccess, notifyError } from "@/utils/notify";
import { fmtBytes } from "@/utils/format";
import {
  deleteBackup,
  downloadBackup,
  fetchBackups,
  fetchTaskLog,
  saveBackupSettings,
  startBackup,
  type Backup,
  type BackupSettings,
  type BackupsInfo,
} from "@/api/server";

const $q = useQuasar();
const store = useStore();

const tab = ref("list");
const loading = ref(true);
const starting = ref(false);
const saving = ref(false);
const downloading = ref("");
const showLog = ref(false);
const info = ref<BackupsInfo | null>(null);
const form = ref<BackupSettings | null>(null);
const log = ref("");
let timer: ReturnType<typeof setTimeout> | null = null;

const keepFields = [
  {
    key: "daily_keep_days",
    label: "Keep daily backups (days)",
    hint: "",
    min: 1,
    max: 3650,
  },
  {
    key: "weekly_keep_days",
    label: "Keep weekly backups (days)",
    hint: "",
    min: 1,
    max: 3650,
  },
  {
    key: "monthly_keep_days",
    label: "Keep monthly backups (days)",
    hint: "",
    min: 1,
    max: 3650,
  },
  {
    key: "pre_update_keep",
    label: "Keep backups taken before updates (number)",
    hint: "0 keeps all of them",
    min: 0,
    max: 100,
  },
] as const;

const columns = [
  {
    name: "created",
    label: "Created",
    field: "created",
    align: "left" as const,
    sortable: true,
    format: (v: string) => store.getters.formatDate(v),
  },
  {
    name: "type",
    label: "Type",
    field: "type",
    align: "left" as const,
    sortable: true,
  },
  {
    name: "size",
    label: "Size",
    field: "size",
    align: "right" as const,
    sortable: true,
    format: (v: number) => fmtBytes(v),
  },
  {
    name: "name",
    label: "File",
    field: "name",
    align: "left" as const,
    sortable: true,
  },
  { name: "actions", label: "", field: "name", align: "right" as const },
];

const running = computed(() => info.value?.state?.state === "running");
const lastState = computed(() => info.value?.state?.state);
const canStart = computed(
  () => !!info.value?.runner_installed && !info.value?.busy,
);

// theme tokens keep the text readable in light and dark
function typeClass(t: string) {
  return (
    {
      manual: "rmm-pill--info",
      "pre-update": "rmm-pill--warning",
      daily: "rmm-pill--positive",
      weekly: "rmm-pill--positive",
      monthly: "rmm-pill--positive",
    }[t] || "rmm-pill--neutral"
  );
}

async function load() {
  loading.value = true;
  try {
    info.value = await fetchBackups();
    form.value = { ...info.value.settings };
    if (running.value || lastState.value === "failed") await readLog();
    if (running.value || info.value.busy) schedulePoll();
  } finally {
    loading.value = false;
  }
}

async function readLog() {
  try {
    const data = await fetchTaskLog("backup", 0);
    log.value = data.text;
  } catch {
    // shown again on the next poll
  }
}

function schedulePoll() {
  if (timer) clearTimeout(timer);
  timer = setTimeout(async () => {
    timer = null;
    await load();
  }, 3000);
}

async function start() {
  starting.value = true;
  const ok = await withStepUp($q, (config) => startBackup(config));
  starting.value = false;
  if (ok === null) return;
  notifySuccess(ok);
  // the runner picks the request up within a second
  setTimeout(load, 1500);
}

async function remove(b: Backup) {
  $q.dialog({
    title: "Delete backup?",
    message: `${b.type} backup ${b.name} is deleted from the server. This cannot be undone.`,
    cancel: true,
    persistent: true,
    ok: { label: "Delete", color: "negative", unelevated: true, noCaps: true },
  }).onOk(async () => {
    const ok = await withStepUp($q, (config) => deleteBackup(b, config));
    if (ok === null) return;
    notifySuccess(ok);
    load();
  });
}

async function download(b: Backup) {
  // a blob response cannot carry the step-up answer, so open the window first
  if (!(await ensureConsoleStepUp($q))) return;
  downloading.value = b.name;
  try {
    if (exportFile(b.name, await downloadBackup(b)) !== true)
      notifyError("The browser blocked the download.");
  } catch {
    // the axios boot shows the error
  } finally {
    downloading.value = "";
  }
}

async function saveSettings() {
  if (!form.value) return;
  saving.value = true;
  const saved = await withStepUp($q, (config) =>
    saveBackupSettings(form.value as BackupSettings, config),
  );
  saving.value = false;
  if (saved === null) return;
  form.value = { ...saved };
  notifySuccess("Backup settings saved.");
}

onMounted(() => {
  load().catch(() => notifyError("The backups could not be loaded."));
});
onBeforeUnmount(() => {
  if (timer) clearTimeout(timer);
});
</script>

<style scoped>
.sb-top {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  flex-wrap: wrap;
}
.sb-running {
  display: flex;
  align-items: center;
  gap: 6px;
}
.sb-log {
  width: 100%;
  max-height: 200px;
  overflow: auto;
  margin: 8px 0 0;
  padding: 8px;
  font-family: var(--rmm-mono);
  font-size: 12px;
  white-space: pre-wrap;
  background: var(--rmm-surface-2, rgba(127, 127, 127, 0.08));
  border-radius: 4px;
}
.sb-form {
  display: grid;
  gap: 12px;
  max-width: 420px;
}
</style>
