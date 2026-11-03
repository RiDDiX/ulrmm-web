<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <div v-if="selectedAgent" class="enc-tab">
    <TabToolbar title="Encryption" :count="loaded ? volumes.length : null">
      <q-btn
        unelevated
        dense
        no-caps
        color="primary"
        icon="sync"
        label="Collect now"
        class="enc-tab__btn"
        :class="{ 'enc-tab__btn--off': offline }"
        :aria-disabled="offline ? 'true' : undefined"
        :loading="collecting"
        @click="collect"
      >
        <q-tooltip v-if="offline">{{ offlineReason }}</q-tooltip>
        <q-tooltip v-else
          >Read the disk encryption from the device now; Windows recovery keys
          are stored right away</q-tooltip
        >
      </q-btn>
      <q-btn
        v-if="plat === 'darwin'"
        outline
        dense
        no-caps
        color="primary"
        icon="key"
        label="Rotate and escrow"
        class="enc-tab__btn"
        :class="{ 'enc-tab__btn--off': offline }"
        :aria-disabled="offline ? 'true' : undefined"
        @click="openRotate"
      >
        <q-tooltip v-if="offline">{{ offlineReason }}</q-tooltip>
        <q-tooltip v-else
          >Create a new FileVault personal recovery key on the Mac and store it
          here</q-tooltip
        >
      </q-btn>
      <span v-if="collectedAt" class="enc-tab__when rmm-muted"
        >Collected {{ formatDate(collectedAt) }}</span
      >
      <q-space />
      <q-btn
        dense
        flat
        round
        icon="refresh"
        aria-label="Reload the stored encryption status"
        @click="load"
      >
        <q-tooltip>Reload what the server has stored</q-tooltip>
      </q-btn>
    </TabToolbar>

    <div class="enc-tab__body">
      <q-inner-loading :showing="loading" color="primary" />

      <EmptyState
        v-if="error && !loaded && !loading"
        icon="error_outline"
        title="Unable to load the encryption status"
        :text="error"
      >
        <q-btn
          outline
          dense
          no-caps
          color="primary"
          label="Retry"
          @click="load"
        />
      </EmptyState>

      <template v-else-if="loaded">
        <q-banner v-if="error" dense rounded class="rmm-banner-warning q-mb-sm">
          <template #avatar>
            <q-icon name="warning_amber" color="warning" />
          </template>
          {{ error }} Showing what was loaded before.
          <template #action>
            <q-btn
              flat
              dense
              no-caps
              color="primary"
              label="Retry"
              @click="load"
            />
          </template>
        </q-banner>
        <q-banner
          v-if="lastError"
          dense
          rounded
          class="rmm-banner-warning q-mb-sm"
        >
          <template #avatar>
            <q-icon name="warning_amber" color="warning" />
          </template>
          The last collection failed: {{ lastError }}
          <span v-if="volumes.length"
            >The volumes below are from the last complete one.</span
          >
        </q-banner>
        <div v-if="NOTE[plat]" class="enc-tab__note rmm-muted">
          <q-icon name="info" size="16px" />
          <span>{{ NOTE[plat] }}</span>
        </div>

        <EmptyState
          v-if="!volumes.length"
          icon="lock"
          title="No encryption status yet"
          text="Collect now reads BitLocker, FileVault or LUKS from the device. Windows devices are read every night and their recovery keys stored."
        >
          <q-btn
            unelevated
            dense
            no-caps
            color="primary"
            icon="sync"
            label="Collect now"
            :class="{ 'enc-tab__btn--off': offline }"
            :aria-disabled="offline ? 'true' : undefined"
            :loading="collecting"
            @click="collect"
          />
        </EmptyState>

        <template v-else>
          <q-table
            flat
            dense
            class="rmm-table enc-tab__table"
            title="Volumes"
            :rows="volumes"
            :columns="volumeColumns"
            row-key="volume"
            :pagination="{ rowsPerPage: 0 }"
            :rows-per-page-options="[0]"
            hide-bottom
          >
            <template #body-cell-volume="props">
              <q-td :props="props">
                <span class="rmm-mono">{{ props.row.volume }}</span>
                <span v-if="props.row.mount" class="rmm-muted q-ml-sm">{{
                  props.row.mount
                }}</span>
              </q-td>
            </template>
            <template #body-cell-protection="props">
              <q-td :props="props">
                <span
                  class="rmm-pill"
                  :class="`rmm-pill--${protectionMeta(props.row.protection).tone}`"
                  >{{ protectionMeta(props.row.protection).label }}</span
                >
              </q-td>
            </template>
            <template #body-cell-escrow="props">
              <q-td :props="props">
                <span v-if="props.row.kind === 'luks'" class="rmm-muted"
                  >Status only</span
                >
                <span v-else-if="props.row.has_key"
                  >Yes, {{ formatDate(escrowDate(props.row)) }}</span
                >
                <span v-else class="text-warning">{{
                  props.row.kind === "filevault"
                    ? "No, rotate to store one"
                    : "No"
                }}</span>
              </q-td>
            </template>
          </q-table>

          <q-table
            v-if="keys.length"
            flat
            dense
            class="rmm-table enc-tab__table q-mt-md"
            title="Recovery keys"
            :rows="keys"
            :columns="keyColumns"
            row-key="id"
            :pagination="{ rowsPerPage: 0 }"
            :rows-per-page-options="[0]"
            hide-bottom
          >
            <template #body-cell-protector_id="props">
              <q-td :props="props">
                <span class="rmm-mono">{{
                  props.row.protector_id || "–"
                }}</span>
              </q-td>
            </template>
            <template #body-cell-status="props">
              <q-td :props="props">
                <span
                  class="rmm-pill"
                  :class="
                    props.row.status === 'active'
                      ? 'rmm-pill--positive'
                      : 'rmm-pill--neutral'
                  "
                  >{{ props.row.status === "active" ? "Active" : "Stale" }}
                  <q-tooltip v-if="props.row.status !== 'active'"
                    >No longer reported by the device; kept for older backups
                    and images</q-tooltip
                  ></span
                >
              </q-td>
            </template>
            <template #body-cell-key="props">
              <q-td :props="props">
                <RevealSecret
                  :request="(config) => revealRecoveryKey(props.row.id, config)"
                  :label="`recovery key of ${props.row.volume}`"
                />
              </q-td>
            </template>
          </q-table>
        </template>
      </template>
    </div>

    <q-dialog
      v-model="rotateOpen"
      persistent
      aria-labelledby="enc-rotate-title"
      @hide="clearRotate"
    >
      <q-card class="rmm-dialog--sm">
        <DialogHeader
          title-id="enc-rotate-title"
          title="Rotate the FileVault key"
          subtitle="Creates a new personal recovery key on the Mac and stores it here"
        />
        <q-form autocomplete="off" @submit="rotate">
          <q-card-section class="q-gutter-y-sm">
            <div class="rmm-muted">
              The current personal recovery key stops working. Enter a macOS
              account that can unlock the disk; the password goes to the agent
              once and is not stored.
            </div>
            <q-input
              v-model="rotateUser"
              label="User name"
              maxlength="255"
              dense
              outlined
              autofocus
              autocomplete="off"
              :disable="rotating"
              :rules="[(v) => !!v || 'Required']"
            />
            <q-input
              v-model="rotatePassword"
              :type="showPassword ? 'text' : 'password'"
              label="Password"
              maxlength="1024"
              dense
              outlined
              autocomplete="new-password"
              :disable="rotating"
              :rules="[(v) => !!v || 'Required']"
            >
              <template #append>
                <q-btn
                  round
                  dense
                  flat
                  size="sm"
                  :icon="showPassword ? 'visibility_off' : 'visibility'"
                  :aria-label="showPassword ? 'Hide password' : 'Show password'"
                  @click="showPassword = !showPassword"
                >
                  <q-tooltip>{{
                    showPassword ? "Hide password" : "Show password"
                  }}</q-tooltip>
                </q-btn>
              </template>
            </q-input>
          </q-card-section>
          <q-card-actions align="right">
            <q-btn
              flat
              no-caps
              label="Cancel"
              :disable="rotating"
              @click="rotateOpen = false"
            />
            <q-btn
              unelevated
              no-caps
              color="primary"
              label="Rotate and escrow"
              type="submit"
              :loading="rotating"
            />
          </q-card-actions>
        </q-form>
      </q-card>
    </q-dialog>
  </div>
</template>

<script setup>
// BitLocker and FileVault recovery key escrow; LUKS is status only.
import { computed, ref, watch, onBeforeUnmount, onMounted } from "vue";
import { useQuasar } from "quasar";
import { useStore } from "vuex";
import {
  collectEncryption,
  fetchEncryption,
  revealRecoveryKey,
  rotateFileVaultKey,
} from "@/api/encryption";
import { relativeTime } from "@/utils/format";
import { notifySuccess } from "@/utils/notify";
import TabToolbar from "@/components/agents/TabToolbar.vue";
import EmptyState from "@/components/ui/EmptyState.vue";
import DialogHeader from "@/components/ui/DialogHeader.vue";
import RevealSecret from "@/components/vault/RevealSecret.vue";
import { withStepUp } from "@/components/vault/stepUp";

const KIND = { bitlocker: "BitLocker", filevault: "FileVault", luks: "LUKS" };
const NOTE = {
  linux:
    "Linux: LUKS volumes are listed as status only, their keys are not stored.",
  darwin:
    "macOS cannot hand out an existing personal recovery key. Rotate and escrow creates a new one and stores it here.",
  freebsd: "FreeBSD: disk encryption is not collected yet.",
};
const volumeColumns = [
  { name: "volume", label: "Volume", field: "volume", align: "left" },
  {
    name: "kind",
    label: "Kind",
    field: (r) => KIND[r.kind] ?? r.kind,
    align: "left",
  },
  {
    name: "protection",
    label: "Protection",
    field: "protection",
    align: "left",
  },
  {
    name: "percent",
    label: "Encrypted",
    field: "percent",
    format: (v) => (v === null || v === undefined ? "Not reported" : `${v} %`),
    align: "left",
  },
  { name: "escrow", label: "Key stored", field: "has_key", align: "left" },
];

const $q = useQuasar();
const store = useStore();
const selectedAgent = computed(() => store.state.selectedRow);
const plat = computed(() => store.state.agentPlatform);
const formatDate = computed(() => store.getters.formatDate);
const keyColumns = [
  {
    name: "kind",
    label: "Kind",
    field: (r) => KIND[r.kind] ?? r.kind,
    align: "left",
  },
  { name: "volume", label: "Volume", field: "volume", align: "left" },
  {
    name: "protector_id",
    label: "Protector",
    field: "protector_id",
    align: "left",
  },
  {
    name: "collected_at",
    label: "Stored",
    field: "collected_at",
    format: (v) => formatDate.value(v),
    align: "left",
  },
  { name: "status", label: "Status", field: "status", align: "left" },
  { name: "key", label: "Key", field: "id", align: "left" },
];

const volumes = ref([]);
const keys = ref([]);
const lastError = ref("");
const loading = ref(false);
const loaded = ref(false);
const collecting = ref(false);
const error = ref("");
let request = 0;

const availability = computed(() =>
  store.state.agentAvailability?.agent_id === selectedAgent.value
    ? store.state.agentAvailability
    : null,
);
// unknown counts as online, the server refuses an offline agent itself
const offline = computed(
  () => !!availability.value && availability.value.status !== "online",
);
const offlineReason = computed(
  () =>
    `Needs the agent online, last seen ${relativeTime(availability.value?.last_seen)}`,
);
const collectedAt = computed(() => volumes.value[0]?.collected_at);

function protectionMeta(value) {
  if (value === "on") return { label: "Protected", tone: "positive" };
  if (value === "off") return { label: "Not protected", tone: "negative" };
  return { label: "Unknown", tone: "neutral" };
}

function escrowDate(volume) {
  const key = keys.value.find(
    (k) =>
      k.status === "active" &&
      k.kind === volume.kind &&
      k.volume === volume.volume,
  );
  return key?.collected_at || volume.collected_at;
}

function apply(data) {
  volumes.value = data.volumes || [];
  keys.value = data.keys || [];
  lastError.value = data.error || "";
  loaded.value = true;
}

async function load() {
  const agent = selectedAgent.value;
  if (!agent) return;
  const mine = ++request;
  loading.value = true;
  try {
    const data = await fetchEncryption(agent);
    if (mine !== request) return;
    apply(data);
    error.value = "";
  } catch (e) {
    if (mine !== request) return;
    error.value =
      e?.response?.status === 403
        ? "Your role cannot view recovery keys for this device."
        : "The encryption status could not be loaded.";
  } finally {
    if (mine === request) loading.value = false;
  }
}

async function collect() {
  if (offline.value || collecting.value) return;
  const agent = selectedAgent.value;
  collecting.value = true;
  try {
    const data = await collectEncryption(agent);
    if (agent !== selectedAgent.value) return;
    request++;
    apply(data);
    error.value = "";
    notifySuccess("Encryption status collected");
  } catch {
    // the server's reason (offline, agent update, unsupported) is the toast
  } finally {
    collecting.value = false;
  }
}

const rotateOpen = ref(false);
const rotating = ref(false);
const rotateUser = ref("");
const rotatePassword = ref("");
const showPassword = ref(false);

function openRotate() {
  if (offline.value) return;
  rotateOpen.value = true;
}

function clearRotate() {
  rotateUser.value = "";
  rotatePassword.value = "";
  showPassword.value = false;
}

async function rotate() {
  const agent = selectedAgent.value;
  const payload = {
    username: rotateUser.value,
    password: rotatePassword.value,
  };
  rotating.value = true;
  const data = await withStepUp($q, (config) =>
    rotateFileVaultKey(agent, payload, config),
  );
  rotating.value = false;
  if (!data) return;
  rotateOpen.value = false;
  if (agent !== selectedAgent.value) return;
  request++;
  apply(data);
  notifySuccess("A new FileVault recovery key is stored");
}

watch(selectedAgent, () => {
  request++;
  rotateOpen.value = false;
  clearRotate();
  volumes.value = [];
  keys.value = [];
  lastError.value = "";
  loaded.value = false;
  error.value = "";
  load();
});
onMounted(load);
onBeforeUnmount(clearRotate);
</script>

<style scoped>
.enc-tab {
  display: flex;
  min-height: 100%;
  flex-direction: column;
}

.enc-tab__btn {
  padding: 2px 10px;
}

.enc-tab__btn--off {
  opacity: 0.55;
}

.enc-tab__when {
  font-size: var(--rmm-fs-xs);
}

.enc-tab__body {
  position: relative;
  min-height: 200px;
  flex: 1 1 auto;
  padding: 8px 12px 12px;
}

.enc-tab__note {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
}

.enc-tab__table {
  border: 1px solid var(--rmm-border);
  border-radius: var(--rmm-radius);
  background: var(--rmm-surface);
}

.enc-tab__table :deep(.q-table__top) {
  min-height: 40px;
  padding: 4px 12px;
}

.enc-tab__table :deep(.q-table__title) {
  font-size: var(--rmm-fs-md);
  font-weight: 600;
}
</style>
