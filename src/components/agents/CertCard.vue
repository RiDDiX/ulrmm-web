<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <div v-if="shown" class="col-12 col-sm-6 col-md-4">
    <q-card flat class="rmm-card detail-card">
      <div class="rmm-card__header">
        <div class="rmm-card__title">Certificate</div>
        <HelpTip
          text="The client certificate and identity key this agent presents to the server"
        />
        <q-space />
        <router-link class="cert-card__link" :to="{ name: 'SecurityCenter' }"
          >Security Center</router-link
        >
      </div>
      <div v-if="failed" class="rmm-card__body rmm-muted">
        The certificate could not be loaded.
      </div>
      <div v-else class="rmm-card__body rmm-kv">
        <span>Status</span>
        <span :class="{ 'text-negative': cert.tone === 'negative' }">{{
          cert.text
        }}</span>
        <template v-if="active?.fingerprint_sha256">
          <span>SHA-256</span>
          <span class="rmm-mono cert-card__fp">{{
            active.fingerprint_sha256
          }}</span>
        </template>
        <span>Identity</span>
        <span>
          <span
            v-if="ident?.identity"
            class="rmm-pill"
            :class="IDENTITY_STATE[ident.identity.state].cls"
            >{{ IDENTITY_STATE[ident.identity.state].label }}</span
          >
          <span v-else class="rmm-muted">No identity key</span>
        </span>
        <template v-if="ident?.identity?.rotate_pending.length">
          <span>Pending</span>
          <span>{{
            ident.identity.rotate_pending.map((w) => ROTATE_LABEL[w]).join(", ")
          }}</span>
        </template>
      </div>
    </q-card>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useStore } from "vuex";
import HelpTip from "@/components/ui/HelpTip.vue";
import {
  certList,
  fetchAgentCert,
  fetchAgentIdentity,
  type AgentCert,
  type AgentIdentityReply,
} from "@/api/security";
import { IDENTITY_STATE, ROTATE_LABEL } from "@/components/security/labels";
import { relativeTime } from "@/utils/format";

const props = defineProps<{ agentId: string }>();
const store = useStore();

const certs = ref<AgentCert[]>([]);
const ident = ref<AgentIdentityReply | null>(null);
// no role for it => no card
const shown = ref(true);
const failed = ref(false);

const active = computed(() =>
  certs.value.find(
    (c) => !c.revoked_at && new Date(c.not_after).getTime() > Date.now(),
  ),
);
const cert = computed(() => {
  if (active.value)
    return {
      text: `Valid until ${store.getters.formatDate(active.value.not_after)} (${relativeTime(active.value.not_after)})`,
      tone: "",
    };
  const last = certs.value[0];
  if (!last) return { text: "No certificate", tone: "" };
  return {
    text: last.revoked_at
      ? `Revoked ${relativeTime(last.revoked_at)}`
      : `Expired ${relativeTime(last.not_after)}`,
    tone: "negative",
  };
});

watch(
  () => props.agentId,
  async (agentId) => {
    failed.value = false;
    try {
      const [reply, identity] = await Promise.all([
        fetchAgentCert(agentId),
        fetchAgentIdentity(agentId, { silent: true }).catch(() => null),
      ]);
      if (agentId !== props.agentId) return;
      certs.value = certList(reply);
      ident.value = identity;
      shown.value = true;
    } catch (e) {
      certs.value = [];
      const status = (e as { response?: { status?: number } })?.response
        ?.status;
      shown.value = status !== 403;
      failed.value = status !== 403;
    }
  },
  { immediate: true },
);
</script>

<style scoped>
.detail-card {
  height: 100%;
}

.rmm-kv > span {
  min-width: 0;
  overflow-wrap: anywhere;
}

.cert-card__fp {
  font-size: var(--rmm-fs-xs);
}

.cert-card__link {
  color: var(--q-primary);
  font-size: var(--rmm-fs-sm);
  text-decoration: none;
  white-space: nowrap;
}

.cert-card__link:hover,
.cert-card__link:focus-visible {
  text-decoration: underline;
}
</style>
