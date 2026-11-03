<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-dialog
    ref="dialogRef"
    aria-labelledby="agent-cert-title"
    @hide="onDialogHide"
  >
    <q-card class="q-dialog-plugin rmm-dialog--md">
      <DialogHeader
        title-id="agent-cert-title"
        :title="`Agent certificate: ${name}`"
        subtitle="The client certificate and identity key the agent presents to the RMM server"
      />
      <q-card-section class="q-gutter-y-sm">
        <div v-if="loading" class="rmm-muted" role="status">
          <q-spinner size="1em" class="q-mr-sm" />Loading...
        </div>
        <div v-else-if="error" class="q-py-sm">
          <div class="rmm-muted q-mb-sm">{{ error }}</div>
          <q-btn
            dense
            no-caps
            outline
            color="primary"
            label="Retry"
            @click="load"
          />
        </div>
        <template v-else>
          <div v-if="!active" class="agent-cert__none">
            <q-icon name="gpp_maybe" size="20px" class="q-mr-sm" />
            No active certificate. The agent asks for one on its own once
            certificates are on and its version supports them.
          </div>
          <dl v-else class="agent-cert__facts">
            <dt>State</dt>
            <dd>
              <span class="rmm-pill" :class="certState(active).cls">{{
                certState(active).label
              }}</span>
            </dd>
            <dt>Serial</dt>
            <dd class="rmm-mono">{{ active.serial }}</dd>
            <dt>Valid</dt>
            <dd>
              {{ when(active.not_before) }} to {{ when(active.not_after) }}
              <span class="rmm-muted"
                >({{ relativeTime(active.not_after) }})</span
              >
            </dd>
            <dt>Last seen</dt>
            <dd>
              {{
                active.last_seen
                  ? `${when(active.last_seen)} (${relativeTime(active.last_seen)})`
                  : "Not presented yet"
              }}
            </dd>
            <template v-if="active.fingerprint_sha256">
              <dt>SHA-256</dt>
              <dd class="rmm-mono agent-cert__fp">
                {{ active.fingerprint_sha256 }}
              </dd>
            </template>
          </dl>
          <template v-if="older.length">
            <div class="text-subtitle2 q-pt-sm">Earlier certificates</div>
            <q-list dense bordered separator class="rounded-borders">
              <q-item v-for="c in older" :key="c.serial">
                <q-item-section>
                  <q-item-label class="rmm-mono">{{ c.serial }}</q-item-label>
                  <q-item-label caption>
                    {{ certState(c).label }}
                    {{ c.revoked_at ? when(c.revoked_at) : when(c.not_after) }}
                  </q-item-label>
                </q-item-section>
              </q-item>
            </q-list>
          </template>
          <div class="text-subtitle2 q-pt-sm">Reset</div>
          <div class="text-caption rmm-muted">
            For an agent that lost its certificate, e.g. after a reinstall:
            revoking the active one lets the agent request a new one with its
            token. While the agent still presents the revoked certificate, the
            server refuses it. Needs a two-factor code.
          </div>

          <template v-if="ident">
            <div class="text-subtitle2 q-pt-md">Identity key</div>
            <div v-if="!ident.identity" class="agent-cert__none">
              <q-icon name="key_off" size="20px" class="q-mr-sm" />
              No identity key registered. Agents register one on their own once
              their version supports signed commands.
            </div>
            <dl v-else class="agent-cert__facts">
              <dt>State</dt>
              <dd>
                <span
                  class="rmm-pill"
                  :class="IDENTITY_STATE[ident.identity.state].cls"
                  >{{ IDENTITY_STATE[ident.identity.state].label }}</span
                >
              </dd>
              <dt>Key id</dt>
              <dd class="rmm-mono">{{ ident.identity.kid }}</dd>
              <dt>Registered</dt>
              <dd>
                {{ when(ident.identity.registered_at) }}
                <template v-if="ident.identity.rotated_at">
                  <span class="rmm-muted">, rotated</span>
                  {{ when(ident.identity.rotated_at) }}
                </template>
              </dd>
              <dt>Last handshake</dt>
              <dd>{{ ago(ident.identity.last_hs, "None yet") }}</dd>
              <dt>Pin document</dt>
              <dd class="rmm-num">{{ ident.identity.pin_seq }}</dd>
              <template v-if="ident.identity.rotate_pending.length">
                <dt>Rotation pending</dt>
                <dd>
                  {{
                    ident.identity.rotate_pending
                      .map((w) => ROTATE_LABEL[w])
                      .join(", ")
                  }}
                </dd>
              </template>
              <template v-if="ident.identity.state !== 'active'">
                <dt>Since</dt>
                <dd>{{ when(ident.identity.quarantined_at) }}</dd>
                <dt>Reason</dt>
                <dd>{{ ident.identity.reason || "None given" }}</dd>
              </template>
              <template v-if="releaseOpen">
                <dt>New keys until</dt>
                <dd>{{ ago(ident.identity.release_until, "") }}</dd>
              </template>
            </dl>
            <template v-if="ident.credential">
              <div class="text-subtitle2 q-pt-sm">Agent token</div>
              <dl class="agent-cert__facts">
                <dt>Kind</dt>
                <dd>
                  {{
                    ident.credential.kind === "family"
                      ? `Token family, generation ${ident.credential.generation}`
                      : "Legacy token without expiry"
                  }}
                </dd>
                <template v-if="ident.credential.revoked_at">
                  <dt>Revoked</dt>
                  <dd>{{ when(ident.credential.revoked_at) }}</dd>
                </template>
                <template v-else-if="ident.credential.kind === 'family'">
                  <dt>Access until</dt>
                  <dd>{{ ago(ident.credential.access_expires, "") }}</dd>
                  <dt>Refresh until</dt>
                  <dd>{{ ago(ident.credential.refresh_expires, "") }}</dd>
                  <dt>Last rotation</dt>
                  <dd>{{ ago(ident.credential.rotated_at, "Not yet") }}</dd>
                </template>
              </dl>
            </template>

            <div class="text-subtitle2 q-pt-sm">Emergency</div>
            <div class="text-caption rmm-muted">
              Quarantine cuts the agent off at once: its NATS login, token and
              certificates stop working. Release lets the same keys back in;
              reset makes the agent register new ones within 24 hours, for a
              device whose keys may have been copied. Block is final. Each asks
              for a two-factor code.
            </div>
            <q-input
              v-if="canQuarantine"
              v-model="reason"
              dense
              outlined
              maxlength="200"
              label="Reason for a quarantine"
              hint="Shown here and in the audit log"
            />
            <div class="row q-gutter-sm">
              <q-btn
                v-if="canQuarantine"
                dense
                no-caps
                unelevated
                color="negative"
                icon="gpp_bad"
                label="Quarantine"
                :loading="busy === 'quarantine'"
                :disable="!!busy"
                @click="confirmQuarantine"
              />
              <q-btn
                v-if="quarantined"
                dense
                no-caps
                outline
                color="primary"
                icon="lock_open"
                label="Release"
                :loading="busy === 'release'"
                :disable="!!busy"
                @click="confirmRelease"
              />
              <q-btn
                v-if="quarantined"
                dense
                no-caps
                outline
                color="primary"
                icon="key"
                label="Reset identity"
                :loading="busy === 'reset'"
                :disable="!!busy"
                @click="confirmResetIdentity"
              />
              <q-btn-dropdown
                v-if="ident.identity?.state === 'active'"
                dense
                no-caps
                outline
                color="primary"
                icon="autorenew"
                label="Rotate"
                :loading="busy === 'rotate'"
                :disable="!!busy"
              >
                <div class="q-pa-sm" style="min-width: 220px">
                  <q-option-group
                    v-model="rotateWhat"
                    type="checkbox"
                    dense
                    :options="ROTATE_OPTIONS"
                  />
                  <q-btn
                    v-close-popup
                    dense
                    no-caps
                    unelevated
                    color="primary"
                    class="full-width q-mt-sm"
                    label="Rotate selected"
                    :disable="!rotateWhat.length"
                    @click="confirmRotate"
                  />
                </div>
              </q-btn-dropdown>
              <q-btn
                v-if="ident.identity?.state !== 'blocked'"
                dense
                no-caps
                flat
                color="negative"
                icon="block"
                label="Block"
                :loading="busy === 'block'"
                :disable="!!busy"
                @click="confirmBlock"
              />
            </div>
          </template>
        </template>
      </q-card-section>
      <q-card-actions align="right">
        <q-btn v-close-popup flat label="Close" />
        <q-btn
          label="Reset certificate"
          icon="restart_alt"
          color="negative"
          no-caps
          unelevated
          :disable="loading || !!error || !active"
          :loading="resetting"
          @click="confirmReset"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useDialogPluginComponent, useQuasar } from "quasar";
import { useStore } from "vuex";
import DialogHeader from "@/components/ui/DialogHeader.vue";
import {
  blockAgent,
  certList,
  fetchAgentCert,
  fetchAgentIdentity,
  quarantineAgent,
  releaseAgent,
  resetAgentCert,
  resetAgentIdentity,
  rotateAgents,
  type AgentCert,
  type AgentIdentityReply,
  type IdentityState,
  type RotateWhat,
} from "@/api/security";
import ConfirmYesDialog from "@/components/agents/ConfirmYesDialog.vue";
import { withStepUp } from "@/components/vault/stepUp";
import { relativeTime } from "@/utils/format";
import { notifySuccess } from "@/utils/notify";

const props = defineProps<{ agentId: string; name: string }>();
defineEmits([...useDialogPluginComponent.emits]);
const { dialogRef, onDialogHide } = useDialogPluginComponent();
const $q = useQuasar();
const store = useStore();

const certs = ref<AgentCert[]>([]);
const loading = ref(true);
const error = ref("");
const resetting = ref(false);
// null while the server has no identity endpoint
const ident = ref<AgentIdentityReply | null>(null);
const reason = ref("");
const busy = ref("");
const rotateWhat = ref<RotateWhat[]>([]);

const IDENTITY_STATE: Record<IdentityState, { label: string; cls: string }> = {
  active: { label: "Active", cls: "rmm-pill--positive" },
  quarantined: { label: "Quarantined", cls: "rmm-pill--warning" },
  blocked: { label: "Blocked", cls: "rmm-pill--negative" },
};
const ROTATE_LABEL: Record<RotateWhat, string> = {
  session: "Encrypted session",
  cert: "Certificate",
  token: "Agent token",
  identity: "Identity key",
};
const ROTATE_OPTIONS = (Object.keys(ROTATE_LABEL) as RotateWhat[]).map(
  (value) => ({ value, label: ROTATE_LABEL[value] }),
);

const when = (v?: string | null) =>
  v ? (store.getters.formatDate(v) as string) : "";

function certState(c: AgentCert) {
  if (c.revoked_at) return { label: "Revoked", cls: "rmm-pill--neutral" };
  if (new Date(c.not_after).getTime() < Date.now())
    return { label: "Expired", cls: "rmm-pill--warning" };
  return { label: "Active", cls: "rmm-pill--positive" };
}

const active = computed(() =>
  certs.value.find((c) => certState(c).label === "Active"),
);
const older = computed(() => certs.value.filter((c) => c !== active.value));

const ago = (v: string | null | undefined, none: string) =>
  v ? `${when(v)} (${relativeTime(v)})` : none;
const quarantined = computed(
  () => ident.value?.identity?.state === "quarantined",
);
// an agent without an identity can still be cut off; the server then stores it blocked
const canQuarantine = computed(
  () => !!ident.value && (ident.value.identity?.state ?? "active") === "active",
);
const releaseOpen = computed(() => {
  const until = ident.value?.identity?.release_until;
  return !!until && new Date(until).getTime() > Date.now();
});

async function loadIdentity() {
  try {
    ident.value = await fetchAgentIdentity(props.agentId, { silent: true });
  } catch {
    ident.value = null;
  }
}

async function load() {
  loading.value = true;
  error.value = "";
  try {
    const [reply] = await Promise.all([
      fetchAgentCert(props.agentId),
      loadIdentity(),
    ]);
    certs.value = certList(reply);
  } catch (e) {
    error.value =
      (e as { response?: { status?: number } })?.response?.status === 403
        ? "Your role cannot view this agent."
        : "The certificate could not be loaded.";
  } finally {
    loading.value = false;
  }
}

function confirmReset() {
  $q.dialog({
    title: "Reset the certificate?",
    message: `The active certificate of ${props.name} is revoked now. The agent has to request a new one before the server accepts its certificate again.`,
    cancel: { label: "Cancel", flat: true },
    ok: { label: "Reset certificate", color: "negative", noCaps: true },
    persistent: true,
  }).onOk(reset);
}

async function reset() {
  resetting.value = true;
  try {
    const done = await withStepUp($q, (config: { silent: boolean }) =>
      resetAgentCert(props.agentId, config),
    );
    if (done === null) return;
    notifySuccess(`The certificate of ${props.name} was revoked`);
    await load();
  } finally {
    resetting.value = false;
  }
}

// typed confirmation first, then the console step-up on the server's ask
function emergency(
  what: string,
  dialog: {
    title: string;
    verb: string;
    ok: string;
    consequence: string;
    exact?: boolean;
  },
  call: (config: { silent: boolean }) => Promise<unknown>,
  done: string,
) {
  $q.dialog({
    component: ConfirmYesDialog,
    componentProps: {
      hostname: props.name,
      confirmText: dialog.exact ? props.name : "yes",
      actionVerb: dialog.verb,
      title: dialog.title,
      okLabel: dialog.ok,
      consequence: dialog.consequence,
    },
  }).onOk(async () => {
    busy.value = what;
    try {
      if ((await withStepUp($q, call)) === null) return;
      notifySuccess(done);
      await load();
    } finally {
      busy.value = "";
    }
  });
}

function confirmQuarantine() {
  const text = reason.value.trim();
  emergency(
    "quarantine",
    {
      title: `Quarantine ${props.name}`,
      verb: "the quarantine",
      ok: "Quarantine",
      consequence: ident.value?.identity
        ? "The agent loses its NATS connection now. Its token and certificates are revoked; it stays cut off until you release it or reset its identity."
        : "The agent loses its NATS connection now and its token and certificates are revoked. It has no identity key, so it cannot be released: only deleting the agent undoes this.",
    },
    (config) => quarantineAgent(props.agentId, text, config),
    `${props.name} is in quarantine`,
  );
}

function confirmRelease() {
  emergency(
    "release",
    {
      title: `Release ${props.name}`,
      verb: "the release",
      ok: "Release",
      consequence:
        "The agent comes back with the same keys and gets a new token within 24 hours. If the keys may have been copied, reset the identity instead.",
    },
    (config) => releaseAgent(props.agentId, config),
    `${props.name} was released`,
  );
}

function confirmResetIdentity() {
  emergency(
    "reset",
    {
      title: `Reset the identity of ${props.name}`,
      verb: "the identity reset",
      ok: "Reset identity",
      consequence:
        "The old keys stay refused. The agent has 24 hours to register new keys; a copy of the old configuration cannot.",
    },
    (config) => resetAgentIdentity(props.agentId, config),
    `${props.name} may register new keys for 24 hours`,
  );
}

function confirmBlock() {
  emergency(
    "block",
    {
      title: `Block ${props.name}`,
      verb: "the block",
      ok: "Block for good",
      consequence:
        "The agent is cut off for good. Only deleting the agent undoes this.",
      exact: true,
    },
    (config) => blockAgent(props.agentId, config),
    `${props.name} is blocked`,
  );
}

function confirmRotate() {
  const what = [...rotateWhat.value];
  emergency(
    "rotate",
    {
      title: `Rotate on ${props.name}`,
      verb: "the rotation",
      ok: "Rotate",
      consequence: `${what.map((w) => ROTATE_LABEL[w]).join(", ")}. The session is dropped at once; the agent renews the rest at its next check-in, pending items show here until then.`,
    },
    (config) =>
      rotateAgents({ scope: "agent", ids: [props.agentId], what }, config),
    "Rotation requested",
  );
}

onMounted(load);
</script>

<style scoped>
.agent-cert__none {
  display: flex;
  align-items: center;
  padding: 8px 10px;
  border: 1px solid var(--rmm-border);
  border-radius: var(--rmm-radius-sm);
  color: var(--rmm-text-muted);
  background: var(--rmm-surface-2);
}

.agent-cert__facts {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 4px 16px;
  margin: 0;
}

.agent-cert__facts dt {
  color: var(--rmm-text-muted);
}

.agent-cert__facts dd {
  margin: 0;
  min-width: 0;
}

.agent-cert__fp {
  overflow-wrap: anywhere;
}
</style>
