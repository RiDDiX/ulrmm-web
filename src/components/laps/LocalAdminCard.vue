<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-card flat class="rmm-card local-admin">
    <div class="rmm-card__header">
      <div class="rmm-card__title">Local admin</div>
      <HelpTip
        text="A local administrator account whose password the server rotates and keeps in this vault. Policy: Global Settings > Local admin"
      />
    </div>
    <div v-if="loading" class="rmm-card__body rmm-muted" role="status">
      <q-spinner size="1em" class="q-mr-sm" />Loading...
    </div>
    <div v-else-if="failed" class="rmm-card__body rmm-muted">
      The local admin state could not be loaded.
      <q-btn flat dense no-caps color="primary" label="Retry" @click="load" />
    </div>
    <div v-else-if="!supported" class="rmm-card__body rmm-muted">
      Local admin rotation is not available for this platform.
    </div>
    <div v-else-if="!policy" class="rmm-card__body rmm-muted">
      No local admin policy covers this device. Enable one in Global Settings >
      Local admin.
    </div>
    <div v-else-if="!state" class="rmm-card__body rmm-muted">
      Not managed yet. The account is created at the next rotation once a policy
      covers this device, or rotate it now.
      <div v-if="canRotate" class="q-mt-sm">
        <q-btn
          unelevated
          dense
          no-caps
          color="primary"
          label="Rotate now"
          :loading="rotating"
          @click="rotate"
        />
      </div>
    </div>
    <div v-else class="rmm-card__body rmm-kv">
      <span>Account</span
      ><span class="rmm-mono">{{ state.account || "—" }}</span>
      <span>Last rotation</span
      ><span>{{
        state.last_rotation ? relativeTime(state.last_rotation) : "Never"
      }}</span>
      <span>Next rotation</span
      ><span>{{
        state.next_rotation ? formatDate(state.next_rotation) : "Not scheduled"
      }}</span>
      <template v-if="state.pending_at">
        <span>New password</span>
        <span class="text-warning"
          >Unconfirmed since {{ formatDate(state.pending_at) }}</span
        >
      </template>
      <template v-if="state.last_error">
        <span>Last error</span>
        <span class="text-negative">{{ state.last_error }}</span>
      </template>
      <span>Password</span>
      <span>
        <RevealSecret
          v-if="state.credential"
          :request="(config) => revealCredential(state.credential, config)"
          :label="`password of ${state.account}`"
        />
        <span v-else class="rmm-muted">Not stored yet</span>
      </span>
      <span></span>
      <span v-if="canRotate">
        <q-btn
          unelevated
          dense
          no-caps
          color="primary"
          label="Rotate now"
          :loading="rotating"
          @click="rotate"
        >
          <q-tooltip
            >Sets a new random password on the device and stores it
            here</q-tooltip
          >
        </q-btn>
      </span>
    </div>
  </q-card>
</template>

<script setup>
import { onMounted, ref, watch } from "vue";
import { useQuasar } from "quasar";
import { useStore } from "vuex";
import HelpTip from "@/components/ui/HelpTip.vue";
import RevealSecret from "@/components/vault/RevealSecret.vue";
import { withStepUp } from "@/components/vault/stepUp";
import { fetchLapsState, rotateLaps } from "@/api/laps";
import { revealCredential } from "@/api/vault";
import { relativeTime } from "@/utils/format";
import { notifySuccess } from "@/utils/notify";

const props = defineProps({ agentId: { type: String, required: true } });

const $q = useQuasar();
const store = useStore();
const formatDate = (v) => store.getters.formatDate(v);

// state.credential: id of the vault credential (null while unset)
const state = ref(null);
const policy = ref(null);
const supported = ref(true);
const canRotate = ref(false);
const loading = ref(false);
const failed = ref(false);
const rotating = ref(false);

async function fetchState() {
  const data = await fetchLapsState(props.agentId, { silent: true });
  state.value = data?.state ?? null;
  policy.value = data?.policy ?? null;
  supported.value = data?.supported !== false;
  canRotate.value = !!data?.can_rotate;
}

async function load() {
  loading.value = true;
  failed.value = false;
  try {
    await fetchState();
  } catch {
    state.value = null;
    failed.value = true;
  }
  loading.value = false;
}

// the server rotates in the background: poll until the state changes
async function rotate() {
  rotating.value = true;
  const before = state.value?.last_rotation ?? null;
  const beforeError = state.value?.last_error ?? "";
  const agentId = props.agentId;
  const r = await withStepUp($q, (config) => rotateLaps(agentId, config));
  if (r === null) {
    rotating.value = false;
    return;
  }
  notifySuccess(typeof r === "string" ? r : "Rotation started");
  for (let i = 0; i < 10 && agentId === props.agentId; i++) {
    await new Promise((resolve) => setTimeout(resolve, 3000));
    try {
      await fetchState();
    } catch {
      break;
    }
    if (
      (state.value?.last_rotation ?? null) !== before ||
      (state.value?.last_error ?? "") !== beforeError
    )
      break;
  }
  rotating.value = false;
}

watch(() => props.agentId, load);
onMounted(load);
</script>

<style scoped>
.local-admin {
  margin-bottom: var(--rmm-space-3, 12px);
}
</style>
