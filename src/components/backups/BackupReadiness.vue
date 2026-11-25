<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<script setup>
import { ref } from "vue";
import { endpoint } from "@/api/http";
import { serverErrors } from "@/components/vault/stepUp";
import { copyOutput } from "@/utils/helpers";
import { notifyError, notifySuccess } from "@/utils/notify";
import { CHECK_STATE } from "./backups";

const props = defineProps({
  agentId: { type: String, required: true },
  checks: { type: Array, default: () => [] },
  ready: Boolean,
  notReadyReason: { type: String, default: "" },
  canManage: Boolean,
});
const emit = defineEmits(["requested"]);
const api = endpoint("/imaging");
const sending = ref(false);

const state = (check) =>
  CHECK_STATE[check.state] ?? {
    label: check.state,
    icon: "help",
    color: "grey",
  };
// a non-blocking check that is not met only warns
const color = (check) =>
  ["ok", "fixed"].includes(check.state) || check.blocking
    ? state(check).color
    : "warning";

async function checkNow() {
  sending.value = true;
  try {
    await api.post(`/agents/${props.agentId}/check/`, {}, { silent: true });
    notifySuccess("Readiness check requested. The list updates shortly.");
    emit("requested");
  } catch (e) {
    notifyError(serverErrors(e).message);
  } finally {
    sending.value = false;
  }
}
</script>

<template>
  <section aria-labelledby="backup-readiness-title" class="q-mt-md">
    <div class="row items-center q-gutter-sm">
      <h4 id="backup-readiness-title" class="rmm-label q-my-none">Readiness</h4>
      <span
        class="rmm-pill"
        :class="ready ? 'rmm-pill--positive' : 'rmm-pill--warning'"
        >{{ ready ? "Ready" : "Not ready" }}</span
      >
      <q-btn
        v-if="canManage"
        flat
        dense
        no-caps
        icon="fact_check"
        label="Check now"
        :loading="sending"
        @click="checkNow"
      />
    </div>
    <p v-if="!ready && notReadyReason" class="q-my-xs">
      {{ notReadyReason }}
    </p>
    <ul class="backup-checks">
      <li v-for="c in checks" :key="`${c.source}:${c.id}`">
        <q-icon
          :name="state(c).icon"
          :color="color(c)"
          class="q-mr-xs"
          aria-hidden="true"
        />
        <span class="sr-only">{{ state(c).label }}:</span>
        <div>
          <div>
            {{ c.detail || c.id }}
            <span class="rmm-muted text-caption"
              >· {{ state(c).label
              }}<template
                v-if="c.blocking && !['ok', 'fixed'].includes(c.state)"
              >
                · blocks backups</template
              ></span
            >
          </div>
          <div v-if="c.fix" class="row items-center no-wrap">
            <code class="rmm-mono">{{ c.fix }}</code>
            <q-btn
              v-if="['manual', 'missing'].includes(c.state)"
              round
              dense
              flat
              size="sm"
              icon="content_copy"
              :aria-label="`Copy the step for ${c.id}`"
              @click="copyOutput(c.fix)"
            />
          </div>
        </div>
      </li>
    </ul>
    <p v-if="!checks.length" class="rmm-muted">No checks reported yet.</p>
  </section>
</template>

<style scoped>
.backup-checks {
  margin: 8px 0;
  padding: 0;
  list-style: none;
}

.backup-checks li {
  display: flex;
  align-items: flex-start;
  gap: 2px;
  padding: 2px 0;
}
</style>
