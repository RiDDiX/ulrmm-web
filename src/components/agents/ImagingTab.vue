<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<script setup>
import { computed, ref, watch } from "vue";
import { useQuasar } from "quasar";
import ImagingPolicyDialog from "./ImagingPolicyDialog.vue";
import ImagingProfileFields from "./ImagingProfileFields.vue";
import { fetchAgents } from "@/api/agents";
import { endpoint } from "@/api/http";
import { useAgentTab } from "@/components/agents/useAgentTab";
import { stepUpCall, serverErrors } from "@/components/vault/stepUp";
import { fmtBytes } from "@/utils/format";
import { notifySuccess } from "@/utils/notify";

const $q = useQuasar();
const api = endpoint("/imaging/agents");
const info = ref(null),
  form = ref({}),
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
const policyOpen = ref(false);
let actionGeneration = 0;
const { selectedAgent, formatDate, error, errorMessage, loading, load } =
  useAgentTab({
    fetch: (id) => api.get(`/${id}/`),
    accept: (data) => {
      info.value = data;
      form.value = { ...data.config };
    },
    clear: () => {
      actionGeneration += 1;
      info.value = null;
      approval.value = null;
      grant.value = null;
      policyOpen.value = false;
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
const dirty = computed(
  () =>
    info.value &&
    Object.keys(info.value.config).some(
      (k) => form.value[k] !== info.value.config[k],
    ),
);
const native = computed(() => info.value?.capability.native);
const isLinuxOffline = (image) =>
  image?.native?.method === "linux-offline-disk-v1";
const isMac = (image) => image?.native?.method === "macos-timemachine-disk-v1";
const isWindows = (image) => image?.native?.method === "windows-wbadmin-tar-v1";
const showLegacyPairing = computed(
  () =>
    !native.value?.method ||
    isLinuxOffline(info.value?.capability) ||
    info.value?.pairing,
);
const nativeCommand = computed(() => {
  const current = grant.value;
  if (!current?.image?.native?.method) return "";
  const verb = current.mode === "restore" ? "imaging-fetch" : "imaging-capture";
  const iface =
    current.network_mode === "internal"
      ? " --interface WIREGUARD_INTERFACE"
      : "";
  const output =
    current.mode === "restore" ? " --output NEW_ARTIFACT_PATH" : "";
  return `ulrmm-agent ${verb} --url URL --image ${current.image.id} --target "${current.target}" --disk "${current.disk}" --network-mode ${current.network_mode}${iface}${output}`;
});
const captureKinds = computed(() => {
  const methods = new Set();
  const kinds = {};
  for (const row of (info.value?.images ?? []).slice().reverse()) {
    const method = row.native?.method;
    if (!method) {
      kinds[row.id] = "Offline disk image";
      continue;
    }
    const series = `${method}:${row.native.source_id}:${row.destination}`;
    kinds[row.id] = methods.has(series) ? "Follow-up backup" : "Initial backup";
    if (row.status === "verified") methods.add(series);
  }
  return kinds;
});
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
      message.value = serverErrors(err).message;
  } finally {
    if (actionGeneration === generation) busy.value = false;
  }
}
function save() {
  const payload = {
    ...form.value,
    schedule_time: form.value.schedule_time || null,
  };
  delete payload.next_run;
  return action(
    (id) => api.put(`/${id}/`, payload),
    () => notifySuccess("Backup configuration saved"),
  );
}
const queue = () =>
  action(
    (id) => api.post(`/${id}/capture/`, {}),
    () => notifySuccess("Backup requested"),
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
  if (mode === "restore" && isWindows(image))
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
    title: "Delete system image?",
    message: `${formatDate(image.created_at)} · ${image.status} · ${image.id}`,
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
      <h3 class="rmm-label">System images</h3>
      <q-btn
        flat
        dense
        icon="refresh"
        aria-label="Refresh images"
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
      <div
        v-if="info.can_manage && native?.method"
        class="row items-center q-gutter-sm"
      >
        <span>{{
          info.policy
            ? `Backup policy · ${info.policy.name}`
            : "Device backup settings"
        }}</span>
        <q-btn
          flat
          dense
          no-caps
          label="Backup policies…"
          :disable="busy"
          @click="policyOpen = true"
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
        <q-form @submit="save" class="q-gutter-sm">
          <ImagingProfileFields
            v-model="form"
            :location="info.storage.location"
            :internal="info.storage.internal"
            :disabled="!writable || busy"
          />
          <p v-if="info.config.next_run">
            Next scheduled request: {{ formatDate(info.config.next_run) }}
          </p>
          <p v-if="info.policy && dirty">
            Saving device settings removes this device from its shared policy.
          </p>
          <p v-else-if="writable && dirty">
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
      <q-list separator class="q-mt-md" aria-label="Images">
        <q-item v-for="row in info.images" :key="row.id">
          <q-item-section>
            <q-item-label
              >{{ formatDate(row.created_at) }} · {{ row.status }} ·
              {{ captureKinds[row.id] }}</q-item-label
            >
            <q-item-label caption
              >{{ row.id }} · {{ row.destination }} ·
              {{ row.network_mode }}</q-item-label
            >
            <q-item-label caption>{{ row.reason }}</q-item-label>
            <q-item-label v-if="row.native?.scope" caption>{{
              row.native.scope
            }}</q-item-label>
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
            <q-item-label v-if="row.verified_at" caption
              >Verified {{ formatDate(row.verified_at) }} · Raw SHA-256
              {{ row.raw_sha256 || row.sha256 }}</q-item-label
            >
          </q-item-section>
          <q-item-section side>
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
    <ImagingPolicyDialog
      v-if="policyOpen && info"
      :agent-id="selectedAgent"
      :config="form"
      :active-policy="info.policy"
      :storage-location="info.storage.location"
      :storage-internal="info.storage.internal"
      :agent-supported="info.capability.supported && !!native?.method"
      @close="policyOpen = false"
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
        <p v-if="approval.image?.native?.method && approval.mode === 'restore'">
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
          v-if="approval.mode === 'restore' && isWindows(approval.image)"
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
          :label="`I authorize overwriting ${disk || 'the selected disk'} on ${targetId} with this image.`"
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
                isWindows(approval.image) &&
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
            ><template v-if="grant.mode === 'restore'">
              --staging-dir STAGING_DIRECTORY</template
            ></code
          >
          and supply the token via the prompt or standard input.
        </p>
        <q-card-actions align="right"
          ><q-btn v-close-popup label="Close" flat
        /></q-card-actions>
      </q-card>
    </q-dialog>
  </section>
</template>
