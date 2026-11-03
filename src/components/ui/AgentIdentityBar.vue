<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <div class="agent-identity-bar">
    <q-icon name="computer" size="18px" class="rmm-muted" />
    <span class="agent-identity-bar__host">{{ hostname || "—" }}</span>
    <span v-if="client || site" class="agent-identity-bar__scope rmm-muted">
      {{ [client, site].filter(Boolean).join(" / ") }}
    </span>
    <span
      v-if="status"
      class="rmm-pill"
      :class="`rmm-pill--${statusMeta.state}`"
    >
      {{ power?.label ?? statusMeta.label }}
      <q-tooltip v-if="power">{{ power.tip }}</q-tooltip>
    </span>
    <q-space />
    <span class="agent-identity-bar__tool rmm-muted">{{ tool }}</span>
  </div>
</template>

<script setup>
import { computed } from "vue";
import { agentStatusMeta, powerEventMeta } from "@/utils/format";

const props = defineProps({
  hostname: { type: String, default: "" },
  client: { type: String, default: "" },
  site: { type: String, default: "" },
  // omit to render no status pill (some pop-outs, e.g. WebVNC, have none)
  status: { type: String, default: "" },
  // planned_offline + power_event* of the agent, when the caller has them
  powerEvent: { type: Object, default: null },
  tool: { type: String, required: true },
});

const statusMeta = computed(() => agentStatusMeta(props.status));
const power = computed(() =>
  powerEventMeta({ ...props.powerEvent, status: props.status }),
);
</script>

<style scoped>
.agent-identity-bar {
  display: flex;
  min-height: 40px;
  align-items: center;
  gap: 10px;
  padding: 6px 12px;
  border-bottom: 1px solid var(--rmm-border);
  color: var(--rmm-text);
  background: var(--rmm-surface);
}

.agent-identity-bar__host {
  font-size: 0.92rem;
  font-weight: 500;
}

.agent-identity-bar__scope,
.agent-identity-bar__tool {
  font-size: var(--rmm-fs-sm);
}
</style>
