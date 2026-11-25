<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<script setup>
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useQuasar } from "quasar";
import { FILES_METHOD, pointVolumes } from "./imagingVolumes";
import { fetchAgents } from "@/api/agents";
import { endpoint } from "@/api/http";
import { useAgentTab } from "@/components/agents/useAgentTab";
import BackupConfigFields from "@/components/backups/BackupConfigFields.vue";
import BackupPolicyDialog from "@/components/backups/BackupPolicyDialog.vue";
import BackupReadiness from "@/components/backups/BackupReadiness.vue";
import BackupRunPanel from "@/components/backups/BackupRunPanel.vue";
import {
  HOLD_CAUSE,
  TRIGGERS,
  deletePointPrompt,
  pointTime,
  returnFocus,
  copy,
  devicePayload,
  fieldErrors,
  fieldLabel,
  formFromEffective,
  hookConfirmPath,
  deviceSaveBody,
  needsReload,
  pointLabel,
  reloadState,
  runStatus,
  syncLabel,
  syncState,
  valueText,
} from "@/components/backups/backups";
import { stepUpCall, serverErrors } from "@/components/vault/stepUp";
import { fmtBytes } from "@/utils/format";
import { notifyInfo, notifySuccess } from "@/utils/notify";

const $q = useQuasar();
const api = endpoint("/imaging/agents");
const imaging = endpoint("/imaging");
const info = ref(null),
  form = ref({}),
  resets = ref([]),
  targetRows = ref([]),
  shownRun = ref(null),
  assignPolicies = ref(null),
  busy = ref(false),
  message = ref("");
const approval = ref(null),
  grant = ref(null),
  disk = ref(""),
  uuid = ref(""),
  targetSize = ref(""),
  targetSector = ref(null),
  confirmed = ref(false);
const targets = ref([]),
  targetId = ref(""),
  loadingTargets = ref(false);
let actionGeneration = 0,
  checkTimer = null;
const { selectedAgent, formatDate, error, errorMessage, loading, load } =
  useAgentTab({
    fetch: (id) => api.get(`/${id}/`),
    accept: (data) => {
      // unsaved edits and pending resets survive a reload
      const next = reloadState(
        info.value?.effective?.fields,
        form.value,
        resets.value,
        data.effective?.fields,
      );
      info.value = data;
      form.value = next.form;
      resets.value = next.resets;
      if (data.can_manage && !targetRows.value.length)
        imaging
          .get("/targets/", { silent: true })
          .then((rows) => (targetRows.value = rows))
          .catch(() => {});
    },
    clear: () => {
      actionGeneration += 1;
      clearTimeout(checkTimer);
      info.value = null;
      approval.value = null;
      grant.value = null;
      resets.value = [];
      shownRun.value = null;
      assignPolicies.value = null;
      message.value = "";
      busy.value = false;
    },
    forbidden: "Your role cannot view system images for this device.",
    failed: "System images could not be loaded.",
  });
const writable = computed(
  () =>
    info.value?.can_manage &&
    info.value.capability.supported &&
    info.value.storage.configured &&
    !error.value,
);
const payload = computed(() =>
  devicePayload(form.value, info.value?.effective?.fields, resets.value),
);
const dirty = computed(
  () =>
    !!info.value &&
    (Object.keys(payload.value.set).length > 0 ||
      payload.value.reset.length > 0),
);
// without the target list the field still names the current target
const targetOptions = computed(() =>
  targetRows.value.length || info.value?.config.target == null
    ? targetRows.value
    : [{ id: info.value.config.target, name: info.value.config.destination }],
);
// a background reload merges unsaved edits and keeps the tab on failure
const reloadIdle = () => {
  if (!busy.value && !loading.value) load({ quiet: true });
};
const pendingPoll = setInterval(() => {
  if (needsReload(info.value) && !document.hidden) reloadIdle();
}, 10_000);
onBeforeUnmount(() => {
  clearInterval(pendingPoll);
  clearTimeout(checkTimer);
});
function checkRequested() {
  clearTimeout(checkTimer);
  checkTimer = setTimeout(reloadIdle, 10_000);
}
// an ended run stays shown with its final log while the tab reloads
function runEnded(run) {
  shownRun.value = run;
  load();
}
const undoReset = (key) =>
  (resets.value = resets.value.filter((item) => item !== key));
function resetField(key) {
  resets.value = [...new Set([...resets.value, key])];
  form.value = {
    ...form.value,
    [key]: copy(info.value.effective.fields[key].value),
  };
}
const native = computed(() => info.value?.capability.native);
const isLinuxOffline = (image) =>
  image?.native?.method === "linux-offline-disk-v1";
const isMac = (image) => image?.native?.method === "macos-timemachine-disk-v1";
const isWindows = (image) => image?.native?.method === "windows-wbadmin-tar-v1";
const isFiles = (image) => image?.native?.method === FILES_METHOD;
const needsTargetDisk = (image) => isWindows(image) || isFiles(image);
const showLegacyPairing = computed(
  () =>
    !native.value?.method ||
    isLinuxOffline(info.value?.capability) ||
    info.value?.pairing,
);
const nativeCommand = computed(() => {
  const current = grant.value;
  if (!current?.image?.native?.method || isFiles(current.image)) return "";
  const verb = current.mode === "restore" ? "imaging-fetch" : "imaging-capture";
  const iface =
    current.network_mode === "internal"
      ? " --interface WIREGUARD_INTERFACE"
      : "";
  const output =
    current.mode === "restore" ? " --output NEW_ARTIFACT_PATH" : "";
  return `ulrmm-agent ${verb} --url URL --image ${current.image.id} --target "${current.target}" --disk "${current.disk}" --network-mode ${current.network_mode}${iface}${output}`;
});
// the assigned policies this device can join, as the old device dialog did
// the dialog unmounts on close; the focus goes back to this button
let restoreAssign = null;
function openAssign() {
  restoreAssign = returnFocus();
  return action(
    () => imaging.get("/policies/", { silent: true }),
    (rows) =>
      (assignPolicies.value = rows.filter((row) => row.scope === "assigned")),
  );
}
function closeAssign() {
  assignPolicies.value = null;
  restoreAssign?.();
}
// a run picked from the list shows below the running one
const pickedRun = computed(() =>
  shownRun.value?.id === info.value?.active_run?.id ? null : shownRun.value,
);
async function action(run, success) {
  if (busy.value) return;
  const id = selectedAgent.value;
  const generation = ++actionGeneration;
  message.value = "";
  busy.value = true;
  try {
    const current = () =>
      selectedAgent.value === id && actionGeneration === generation;
    const result = await run(id, current);
    if (!current() || result === null) return;
    success(result);
    await load();
  } catch (err) {
    if (selectedAgent.value === id && actionGeneration === generation)
      message.value = fieldErrors(serverErrors(err)).join(" ");
  } finally {
    if (actionGeneration === generation) busy.value = false;
  }
}
function save() {
  const { body, stepUp } = deviceSaveBody(payload.value, native.value?.volumes);
  return action(
    (id, current) =>
      stepUp
        ? stepUpCall($q, (config) =>
            current() ? api.put(`/${id}/`, body, config) : null,
          )
        : api.put(`/${id}/`, body),
    () => {
      // saved: the reload starts from the server's values again
      resets.value = [];
      form.value = formFromEffective(info.value.effective?.fields);
      notifySuccess("Backup configuration saved");
    },
  );
}
// at the device or at the policy whose pin is stale; the reload shows it
const confirmHook = (entry) =>
  action(
    (id, current) =>
      stepUpCall($q, (config) =>
        current()
          ? imaging.post(
              hookConfirmPath(entry, id),
              { script_id: entry.script_id, sha256: entry.sha256 },
              config,
            )
          : null,
      ),
    () => notifySuccess("Hook confirmed"),
  );
const protect = (image, value) =>
  action(
    (id, current) => {
      const call = (config) =>
        current()
          ? api.post(
              `/${id}/images/${image.id}/protect/`,
              { protected: value },
              config,
            )
          : null;
      // lifting the protection lets retention delete the point: step-up
      return value ? call({ silent: true }) : stepUpCall($q, call);
    },
    () =>
      notifySuccess(value ? "Point protected" : "Point no longer protected"),
  );
// a 409 means the change moved or was decided meanwhile: show it again;
// confirming a change of hooks needs the step-up
function decideHold(choice) {
  const { id, proposed_hash } = info.value.hold;
  return action(
    (agent, current) =>
      stepUpCall($q, (config) =>
        current()
          ? imaging
              .post(
                `/holds/${id}/confirm/`,
                { action: choice, proposed_hash },
                config,
              )
              .catch((e) => {
                if (e?.response?.status === 409) load();
                throw e;
              })
          : null,
      ),
    () =>
      notifySuccess(
        choice === "confirm" ? "Held change confirmed" : "Held change rejected",
      ),
  );
}
// a manual request returns the point that is already open
const queue = () => {
  const open = new Set(info.value.images.map((image) => image.id));
  return action(
    (id) => api.post(`/${id}/capture/`, {}),
    (point) =>
      open.has(point.id)
        ? notifyInfo("A backup point is already open.")
        : notifySuccess("Backup requested"),
  );
};
const recheck = (image) =>
  action(
    (id) => api.post(`/${id}/images/${image.id}/recheck/`, {}),
    () =>
      notifySuccess(
        "Block check requested. The point shows a new verification time when it passes.",
      ),
  );
async function authorize(mode, image = null) {
  const selection = { image, mode, agent: selectedAgent.value };
  approval.value = selection;
  message.value = "";
  disk.value = mode === "capture" ? image?.native?.source_id || "" : "";
  uuid.value = mode === "capture" ? image?.native?.device_uuid || "" : "";
  targetSize.value = "";
  targetSector.value = null;
  confirmed.value = false;
  targetId.value = mode === "restore" ? selection.agent : "";
  targets.value = [];
  if (mode !== "restore") return;
  loadingTargets.value = true;
  try {
    const devices = await fetchAgents({ detail: false });
    if (
      approval.value?.image === image &&
      selectedAgent.value === selection.agent
    )
      targets.value = devices.map((device) => ({
        label: `${device.effective_name} · ${device.client} / ${device.site}`,
        value: device.agent_id,
      }));
  } catch {
    if (
      approval.value?.image === image &&
      selectedAgent.value === selection.agent
    )
      message.value =
        "Could not load replacement devices. You can still select the source device.";
  } finally {
    if (
      approval.value?.image === image &&
      selectedAgent.value === selection.agent
    )
      loadingTargets.value = false;
  }
}
watch(
  [uuid, disk, targetId, targetSize, targetSector],
  () => (confirmed.value = false),
  {
    flush: "sync",
  },
);
function issue() {
  const { image, mode, agent } = approval.value;
  if (agent !== selectedAgent.value) return;
  const diskId = disk.value.trim();
  const target = targetId.value || agent;
  const body = { device_uuid: uuid.value.trim(), disk_id: diskId };
  if (mode === "restore")
    Object.assign(body, {
      confirmed: confirmed.value,
      target_agent_id: targetId.value,
    });
  if (mode === "restore" && needsTargetDisk(image))
    Object.assign(body, {
      raw_size: Number(targetSize.value),
      sector_size: targetSector.value,
    });
  return action(
    (id, current) =>
      stepUpCall($q, (config) =>
        current()
          ? api.post(
              mode === "pair"
                ? `/${id}/pair/`
                : `/${id}/images/${image.id}/${mode}-access/`,
              body,
              config,
            )
          : null,
      ),
    (result) => {
      approval.value = null;
      grant.value = { ...result, mode, image, target, disk: diskId };
    },
  );
}
function revokePairing() {
  const agent = selectedAgent.value;
  $q.dialog({
    title: "Unpair offline capture?",
    message: "This revokes the pairing and any capture grants it issued.",
    ok: { label: "Unpair", color: "negative" },
    cancel: true,
  }).onOk(() => {
    if (selectedAgent.value === agent)
      action(
        (id, current) =>
          stepUpCall($q, (config) =>
            current() ? api.delete(`/${id}/pair/`, config) : null,
          ),
        () => notifySuccess("Offline capture unpaired"),
      );
  });
}
function cancelImage(image) {
  const agent = selectedAgent.value;
  $q.dialog({
    title: "Discard incomplete image?",
    message: image.id,
    ok: { label: "Discard", color: "negative" },
    cancel: true,
  }).onOk(() => {
    if (selectedAgent.value === agent)
      action(
        (id) => api.post(`/${id}/images/${image.id}/cancel/`, {}),
        () => notifySuccess("Capture cancelled"),
      );
  });
}
function deleteImage(image) {
  const agent = selectedAgent.value;
  $q.dialog({
    ...deletePointPrompt(image, formatDate),
    ok: { label: "Delete", color: "negative" },
    cancel: true,
  }).onOk(() => {
    if (selectedAgent.value === agent)
      action(
        (id, current) =>
          stepUpCall($q, (config) =>
            current() ? api.delete(`/${id}/images/${image.id}/`, config) : null,
          ),
        () => notifySuccess("System image deleted"),
      );
  });
}
</script>

<template>
  <section class="q-pa-md">
    <div class="row items-center q-gutter-sm">
      <h3 class="rmm-label">Backups</h3>
      <q-btn
        flat
        dense
        icon="refresh"
        aria-label="Refresh backups"
        :loading="loading"
        :disable="busy"
        @click="load"
      />
    </div>
    <q-banner v-if="message || error" dense class="rmm-banner-warning">{{
      message || errorMessage
    }}</q-banner>
    <template v-if="info">
      <p>{{ info.capability.reason }}</p>
      <template v-if="native?.scope">
        <p v-if="info.capability.supported">
          <strong>Agent capture</strong>
          {{ native.ready ? "Ready" : "Waiting for preparation" }}
        </p>
        <p><strong>Backup scope</strong> {{ native.scope }}</p>
        <p><strong>Recovery</strong> {{ native.recovery }}</p>
        <p v-if="native.encryption">
          <strong>Source and local backup encryption</strong>
          {{ native.encryption }}
        </p>
      </template>
      <p v-if="info.at_rest">
        <strong>Current backup folder ({{ info.config.destination }})</strong>
        {{ info.at_rest }}
      </p>
      <p v-if="isMac(info.capability) && form.network_mode === 'internal'">
        Internal-only macOS backups wait for a verifiable WireGuard-bound
        connection.
      </p>
      <div v-if="info.sync" class="q-my-sm" role="status">
        <span
          class="rmm-pill q-mr-xs"
          :class="syncState(info.sync.state).cls"
          >{{ syncState(info.sync.state).label }}</span
        >
        {{ syncLabel(info.sync, formatDate) }}
        <div v-for="item in info.sync.errors" :key="item.field">
          {{ fieldLabel(item.field) }}: {{ item.message }}
        </div>
      </div>
      <q-banner
        v-if="info.hold"
        dense
        rounded
        class="rmm-banner-warning q-my-sm"
        role="status"
      >
        A backup settings change waits for confirmation because
        {{ HOLD_CAUSE[info.hold.cause] ?? info.hold.cause }} (by
        {{ info.hold.author || "an unknown user" }},
        {{ formatDate(info.hold.created_at) }}).
        <q-markup-table
          flat
          dense
          class="rmm-table q-mt-xs"
          aria-label="Held changes"
        >
          <thead>
            <tr>
              <th class="text-left">Setting</th>
              <th class="text-left">Now</th>
              <th class="text-left">After confirming</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="change in info.hold.changes" :key="change.field">
              <td>{{ fieldLabel(change.field) }}</td>
              <td style="white-space: pre-line">
                {{ valueText(change.field, change.held, targetRows) }}
              </td>
              <td style="white-space: pre-line">
                {{ valueText(change.field, change.proposed, targetRows) }}
              </td>
            </tr>
          </tbody>
        </q-markup-table>
        <template v-if="info.can_manage" #action>
          <q-btn
            flat
            dense
            no-caps
            label="Reject"
            :disable="busy"
            @click="decideHold('reject')"
          />
          <q-btn
            flat
            dense
            no-caps
            color="primary"
            label="Confirm"
            :disable="busy"
            @click="decideHold('confirm')"
          />
        </template>
      </q-banner>
      <div v-if="info.can_manage" class="row items-center q-gutter-sm q-my-xs">
        <router-link :to="{ name: 'Backups' }" class="rmm-link"
          >Backup policies</router-link
        >
        <span v-if="info.policy" class="rmm-muted"
          >Assigned policy {{ info.policy.name }}</span
        >
        <q-btn
          v-if="native?.method"
          flat
          dense
          no-caps
          label="Assign a backup policy…"
          :disable="busy"
          @click="openAssign"
        />
      </div>
      <template v-if="info.capability.supported">
        <p v-if="!info.storage.configured && info.storage.problem">
          {{ info.storage.problem }} Backups and checks wait until it is back.
        </p>
        <p v-else-if="!info.storage.configured">
          System images are not set up on this server yet.
          <template v-if="info.can_manage">
            Set the folder in Global Settings > System Images, which also shows
            the command that prepares it. Details are in the
            <a
              href="https://github.com/RiDDiX/ulrmm/blob/main/docs/CLIENT_IMAGING.md#server-setup"
              target="_blank"
              rel="noopener"
              class="rmm-link"
              >client imaging guide</a
            >.
          </template>
        </p>
        <p v-else-if="info.can_manage">
          Stored on the ULRMM server in {{ info.storage.location }} ·
          {{ fmtBytes(info.storage.free_bytes) }} free. Backups wait while less
          than {{ fmtBytes(info.storage.reserve_bytes) }} would stay free.
        </p>
        <p v-for="use in info.usage ?? []" :key="use.target">
          This device stores {{ fmtBytes(use.stored_bytes) }} on target
          {{ use.name
          }}<template v-if="use.quota_bytes">
            of a {{ fmtBytes(use.quota_bytes) }} quota</template
          >.
        </p>
        <q-form @submit="save" class="q-gutter-sm">
          <BackupConfigFields
            v-if="info.effective"
            v-model="form"
            mode="device"
            :effective="info.effective"
            :targets="targetOptions"
            :internal="info.storage.internal"
            :volumes="isFiles(info.capability) ? (native.volumes ?? []) : null"
            :suspended="info.hooks_suspended ?? []"
            :can-run-scripts="info.can_run_scripts ?? false"
            :agent-id="selectedAgent"
            :disabled="!writable || busy"
            :pending="payload"
            @reset="resetField"
            @undo-reset="undoReset"
            @confirm-hook="confirmHook"
          />
          <p v-if="info.config.next_run">
            Next scheduled request: {{ formatDate(info.config.next_run) }}
          </p>
          <p v-if="writable && dirty">
            Save device settings before requesting a backup.
          </p>
          <q-btn
            v-if="info.can_manage"
            label="Save device settings"
            type="submit"
            dense
            no-caps
            flat
            :disable="!writable || busy || !dirty"
          />
          <q-btn
            v-if="info.can_manage"
            label="Request backup"
            color="primary"
            dense
            no-caps
            :disable="!writable || busy || dirty"
            @click="queue"
          />
        </q-form>
        <div v-if="info.can_manage && showLegacyPairing" class="q-mt-md">
          <p v-if="info.pairing">
            Offline capture paired with {{ info.pairing.disk_id }} until
            {{ formatDate(info.pairing.expires_at) }}.
          </p>
          <p v-else>
            Pair an offline recovery environment to claim scheduled backups
            automatically.
          </p>
          <q-btn
            :label="
              info.pairing
                ? 'Replace capture pairing…'
                : 'Pair offline capture…'
            "
            dense
            flat
            no-caps
            :disable="!writable || busy || dirty"
            @click="authorize('pair')"
          />
          <q-btn
            v-if="info.pairing"
            label="Unpair…"
            dense
            flat
            no-caps
            :disable="busy || !!error"
            @click="revokePairing"
          />
        </div>
      </template>
      <BackupReadiness
        v-if="info.checks"
        :agent-id="selectedAgent"
        :checks="info.checks"
        :ready="info.ready"
        :not-ready-reason="info.not_ready_reason"
        :can-manage="info.can_manage"
        @requested="checkRequested"
      />
      <BackupRunPanel
        v-for="run in [info.active_run, pickedRun].filter(Boolean)"
        :key="run.id"
        :agent-id="selectedAgent"
        :run="run"
        :can-manage="info.can_manage"
        @ended="runEnded"
      />
      <q-list
        v-if="info.runs?.length"
        dense
        separator
        class="q-mt-md"
        aria-label="Recent runs"
      >
        <q-item-label header>Recent runs</q-item-label>
        <q-item v-for="run in info.runs.slice(0, 10)" :key="run.id">
          <q-item-section>
            <q-item-label
              >{{ formatDate(run.created_at) }} ·
              {{ TRIGGERS[run.trigger] ?? run.trigger }}
              <span
                class="rmm-pill q-ml-xs"
                :class="runStatus(run.status).cls"
                >{{ runStatus(run.status).label }}</span
              ></q-item-label
            >
            <q-item-label v-if="run.reason" caption>{{
              run.reason
            }}</q-item-label>
          </q-item-section>
          <q-item-section side>
            <q-btn
              flat
              dense
              no-caps
              label="Details"
              :aria-label="`Details of the run ${formatDate(run.created_at)}`"
              :disable="
                run.id === info.active_run?.id || run.id === shownRun?.id
              "
              @click="shownRun = run"
            />
          </q-item-section>
        </q-item>
      </q-list>
      <q-list separator class="q-mt-md" aria-label="Images">
        <q-item v-for="row in info.images" :key="row.id">
          <q-item-section>
            <q-item-label
              >{{ formatDate(pointTime(row)) }} · {{ row.status }} ·
              {{ pointLabel(row) }}</q-item-label
            >
            <q-item-label caption
              >{{ row.id }} · {{ row.destination }} ·
              {{ row.network_mode }}</q-item-label
            >
            <q-item-label caption>{{ row.reason }}</q-item-label>
            <q-item-label v-if="row.native?.scope" caption>{{
              row.native.scope
            }}</q-item-label>
            <template v-if="isFiles(row)">
              <q-item-label caption
                >Volumes ·
                {{ pointVolumes(row.native).join(", ") }}</q-item-label
              >
              <q-item-label v-if="row.native.missing?.length" caption
                >Not backed up on this device ·
                {{ row.native.missing.join(", ") }}</q-item-label
              >
              <q-item-label v-if="row.native.report" caption
                >Changed while read {{ row.native.report.changed }} · vanished
                {{ row.native.report.vanished }} · skipped
                {{ row.native.report.skipped }}</q-item-label
              >
            </template>
            <q-item-label v-if="row.native?.encryption" caption>{{
              row.native.encryption
            }}</q-item-label>
            <q-item-label v-if="row.native?.storage_encryption" caption>
              Server storage · {{ row.native.storage_encryption }}
            </q-item-label>
            <q-item-label caption>
              {{
                row.compression === "gzip"
                  ? `Gzip (level ${row.compression_level})`
                  : "Uncompressed"
              }}
              <template v-if="row.verified_at">
                · {{ row.size?.toLocaleString() }} stored bytes ·
                {{ row.raw_size?.toLocaleString() }} raw bytes
                <template v-if="row.native?.method">
                  · {{ row.new_bytes?.toLocaleString() }} new bytes</template
                >
              </template>
              <template v-else>
                · {{ row.offset?.toLocaleString() }} bytes received</template
              >
            </q-item-label>
            <q-item-label
              v-if="row.verified_at"
              caption
              style="overflow-wrap: anywhere"
              >Verified {{ formatDate(row.verified_at) }} · Raw SHA-256
              {{ row.raw_sha256 || row.sha256 }}</q-item-label
            >
          </q-item-section>
          <q-item-section side>
            <q-toggle
              v-if="info.can_manage && row.status === 'verified'"
              :model-value="!!row.protected"
              dense
              label="Protected"
              :disable="busy || !!error"
              @update:model-value="protect(row, $event)"
            />
            <q-btn
              v-if="info.can_restore && row.status === 'verified'"
              label="Restore…"
              dense
              flat
              no-caps
              :disable="busy || !!error"
              @click="authorize('restore', row)"
            />
            <q-btn
              v-if="
                info.can_manage &&
                ['waiting', 'uploading'].includes(row.status) &&
                (!row.native?.method || isLinuxOffline(row))
              "
              label="Capture access…"
              dense
              flat
              no-caps
              :disable="busy || !!error"
              @click="authorize('capture', row)"
            />
            <q-btn
              v-if="
                info.can_manage &&
                ['failed', 'waiting', 'uploading'].includes(row.status)
              "
              label="Discard…"
              dense
              flat
              no-caps
              :disable="busy || !!error"
              @click="cancelImage(row)"
            />
            <q-btn
              v-if="
                info.can_manage && ['verified', 'failed'].includes(row.status)
              "
              label="Delete…"
              dense
              flat
              no-caps
              :disable="busy || !!error"
              @click="deleteImage(row)"
            />
          </q-item-section>
        </q-item>
      </q-list>
      <p v-if="!info.images.length" class="rmm-muted">
        No images for this device.
      </p>
    </template>
    <BackupPolicyDialog
      v-if="assignPolicies && info"
      :agent-id="selectedAgent"
      :config="info.overrides ?? {}"
      :policies="assignPolicies"
      :policy-id="info.policy?.id ?? null"
      :internal="info.storage.internal"
      :targets="targetOptions"
      @close="closeAssign"
      @saved="load"
    />
    <q-dialog
      :model-value="!!approval"
      :persistent="busy"
      @update:model-value="approval = null"
    >
      <q-card v-if="approval" class="q-pa-md" style="width: 540px">
        <h3 class="text-h6">
          {{
            approval.mode === "restore"
              ? "Authorize restore"
              : approval.mode === "pair"
                ? "Pair offline capture"
                : "Authorize offline capture"
          }}
        </h3>
        <p>
          <template v-if="approval.image"
            >Image {{ approval.image.id }}<br
          /></template>
          {{ approval.mode === "restore" ? "Source device" : "Device" }}
          {{ approval.agent }}
        </p>
        <q-select
          v-if="approval.mode === 'restore'"
          v-model="targetId"
          :options="
            targets.length
              ? targets
              : [{ label: approval.agent, value: approval.agent }]
          "
          emit-value
          map-options
          :loading="loadingTargets"
          outlined
          dense
          label="Target device"
          class="q-mb-sm"
        />
        <template v-if="approval.mode === 'restore' && isFiles(approval.image)">
          <p>
            {{ approval.image.native.recovery }} The target disk must be blank,
            hold at least
            {{ approval.image.native.min_target_size?.toLocaleString() }} bytes
            and use {{ approval.image.native.sector_size }}-byte logical
            sectors. Enter the target device UUID, the target disk ID and the
            size and sector size that
            <code
              >python3 ulrmm_image_recovery.py --identify restore --disk-id
              DISK_ID</code
            >
            reports for that disk.
          </p>
          <p>
            The restore writes before the whole point is checked. Check all
            blocks first to find damage before anything is written.
          </p>
          <q-btn
            label="Check all blocks"
            dense
            flat
            no-caps
            class="q-mb-sm"
            :disable="busy"
            @click="recheck(approval.image)"
          />
        </template>
        <p
          v-else-if="
            approval.image?.native?.method && approval.mode === 'restore'
          "
        >
          {{ approval.image.native.recovery }}
          The recovery disk requires
          {{ approval.image.native.size?.toLocaleString() }} bytes with
          {{ approval.image.native.sector_size }}-byte logical sectors. Enter
          the authorized target device UUID and the ID of its intended recovery
          disk.
          <template v-if="isWindows(approval.image)">
            Also enter the size and sector size that
            <code>ulrmm_image_recovery.py --identify restore</code> reports for
            that disk. A smaller disk or another sector size is refused.
          </template>
          <template v-if="isMac(approval.image)">
            The approved disk is the disposable external Time Machine disk. Use
            the Mac's platform UUID from
            <code>ioreg -rd1 -c IOPlatformExpertDevice</code> and the external
            disk identifier you verified.
          </template>
        </p>
        <p v-else>
          Boot the offline recovery environment on
          {{
            approval.mode === "restore" ? "the target device" : "this device"
          }}. Select the disk's stable name under
          <code>/dev/disk/by-id</code> and enter the identifiers displayed by
          <code v-if="isLinuxOffline(approval.image)"
            >cat /sys/class/dmi/id/product_uuid</code
          >
          <code v-else
            >python3 ulrmm_image_recovery.py --identify
            {{ approval.mode === "restore" ? "restore" : "capture" }} --disk-id
            DISK_ID</code
          >.
        </p>
        <p v-if="approval.mode === 'pair' && info?.pairing">
          Issuing a new pairing revokes the previous pairing and its capture
          grants.
        </p>
        <q-input
          v-model="uuid"
          outlined
          dense
          label="Device UUID"
          class="q-mb-sm"
        />
        <q-input
          v-model="disk"
          outlined
          dense
          :label="
            approval.mode === 'restore' ? 'Target disk ID' : 'Source disk ID'
          "
        />
        <template
          v-if="approval.mode === 'restore' && needsTargetDisk(approval.image)"
        >
          <q-input
            v-model="targetSize"
            type="number"
            outlined
            dense
            label="Target disk size in bytes"
            class="q-mt-sm"
          />
          <q-select
            v-model="targetSector"
            :options="[512, 4096]"
            outlined
            dense
            label="Target logical sector size"
            class="q-mt-sm"
          />
        </template>
        <q-checkbox
          v-if="approval.mode === 'restore'"
          v-model="confirmed"
          :label="
            isFiles(approval.image)
              ? `I authorize partitioning ${disk || 'the selected disk'} on ${targetId} and writing this point to it.`
              : `I authorize overwriting ${disk || 'the selected disk'} on ${targetId} with this image.`
          "
        />
        <p v-if="message" role="alert">{{ message }}</p>
        <q-card-actions align="right"
          ><q-btn v-close-popup label="Cancel" flat :disable="busy" /><q-btn
            label="Issue access"
            color="primary"
            :loading="busy"
            :disable="
              !disk.trim() ||
              !uuid.trim() ||
              (approval.mode === 'restore' && !confirmed) ||
              (approval.mode === 'restore' &&
                needsTargetDisk(approval.image) &&
                (!targetSize || !targetSector))
            "
            @click="issue"
        /></q-card-actions>
      </q-card>
    </q-dialog>
    <q-dialog :model-value="!!grant" @update:model-value="grant = null">
      <q-card v-if="grant" class="q-pa-md" style="width: 540px">
        <h3 class="text-h6">
          {{
            grant.mode === "pair" ? "Capture pairing access" : "Recovery access"
          }}
        </h3>
        <p>
          Use this URL and token on the authorized recovery system. Access
          expires {{ formatDate(grant.expires_at) }}.
        </p>
        <q-input
          readonly
          outlined
          dense
          label="Transfer URL"
          :model-value="grant.url"
          class="q-mb-sm"
        />
        <q-input
          readonly
          outlined
          dense
          label="Transfer token"
          :model-value="grant.token"
        />
        <p>Network mode: {{ grant.network_mode }}</p>
        <p v-if="nativeCommand">
          Run <code>{{ nativeCommand }}</code> and supply the token via standard
          input.
        </p>
        <p v-if="grant.mode === 'restore' && grant.image?.native?.recovery">
          {{ grant.image.native.recovery }}
        </p>
        <p v-if="!nativeCommand">
          Run
          <code
            >python3 ulrmm_image_recovery.py
            {{ grant.mode === "pair" ? "--poll-url" : "--url" }} URL --disk-id
            DISK_ID --network-mode {{ grant.network_mode
            }}<template v-if="grant.network_mode === 'internal'">
              --interface wg0</template
            ><template v-if="grant.mode === 'restore' && !isFiles(grant.image)">
              --staging-dir STAGING_DIRECTORY</template
            ></code
          >
          and supply the token via the prompt or standard input.
        </p>
        <p v-if="grant.mode === 'restore' && isFiles(grant.image)">
          The helper asks you to type
          <code>RESTORE {{ grant.claim }} {{ grant.disk }}</code> before it
          writes.
        </p>
        <q-card-actions align="right"
          ><q-btn v-close-popup label="Close" flat
        /></q-card-actions>
      </q-card>
    </q-dialog>
  </section>
</template>
