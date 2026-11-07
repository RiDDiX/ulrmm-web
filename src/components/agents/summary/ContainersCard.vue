<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <div class="col-12">
    <q-card flat class="rmm-card detail-card">
      <div class="rmm-card__header">
        <div class="rmm-card__title">Containers and VMs</div>
        <span v-if="items.length" class="rmm-muted rmm-num">{{
          items.length
        }}</span>
        <HelpTip
          text="Containers and virtual machines on this host from the agent's last report; add a Container check to alert"
        />
        <span
          v-if="cluster"
          class="rmm-pill"
          :class="cluster.quorate ? 'rmm-pill--positive' : 'rmm-pill--negative'"
          >{{ cluster.quorate ? "quorate" : "no quorum" }}
          <q-tooltip
            >Cluster {{ cluster.name || "" }}: {{ cluster.online ?? "?" }} of
            {{ cluster.nodes ?? "?" }} nodes online</q-tooltip
          ></span
        >
        <span v-if="stale" class="rmm-pill rmm-pill--warning"
          >stale<q-tooltip
            >No report from the agent for over 20 minutes</q-tooltip
          ></span
        >
        <div v-if="updated" class="rmm-muted state-card__updated">
          {{ updated }}
        </div>
      </div>
      <q-banner
        v-for="s in failedSources"
        :key="s.kind"
        dense
        class="rmm-banner-warning"
      >
        <template #avatar>
          <q-icon name="warning_amber" color="warning" />
        </template>
        {{ s.text }}
      </q-banner>
      <div v-if="!items.length" class="rmm-card__body rmm-muted">
        No containers or VMs reported
      </div>
      <q-markup-table v-else flat dense class="rmm-table state-card__table">
        <thead>
          <tr>
            <th class="text-left">Kind</th>
            <th class="text-left">Name</th>
            <th class="text-left">Image</th>
            <th class="text-left">State</th>
            <th class="text-right">Restarts</th>
            <th class="text-right">CPU</th>
            <th class="text-right">Memory</th>
            <th class="text-right">Network in / out</th>
            <th class="text-right">Uptime</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="c in items" :key="`${c.kind}-${c.id || c.name}`">
            <td>
              {{ kindLabel(c.kind) }}
              <div v-if="c.node" class="rmm-muted">{{ c.node }}</div>
            </td>
            <td>
              {{ c.name || "—" }}
              <div v-if="c.id" class="rmm-mono rmm-muted">
                {{ String(c.id).slice(0, 12) }}
              </div>
            </td>
            <td class="rmm-mono state-card__image">{{ c.image || "—" }}</td>
            <td>
              <span class="rmm-pill" :class="stateClass(c.state)">{{
                c.state || "unknown"
              }}</span>
              <div v-if="c.status" class="rmm-muted">{{ c.status }}</div>
            </td>
            <td class="text-right rmm-num">
              <span :class="{ 'text-warning': c.restarts > 0 }">{{
                isNum(c.restarts) ? c.restarts : "—"
              }}</span>
            </td>
            <td class="text-right rmm-num">
              {{ isNum(c.cpu_pct) ? `${fmtNum(c.cpu_pct)}%` : "—" }}
            </td>
            <td class="text-right rmm-num">
              {{ fmtBytes(c.mem_used) }}
              <span
                v-if="isNum(c.mem_limit) && c.mem_limit"
                class="rmm-muted q-ml-xs"
                >of {{ fmtBytes(c.mem_limit) }}</span
              >
            </td>
            <td class="text-right rmm-num">
              {{ fmtBytes(c.net_rx) }} / {{ fmtBytes(c.net_tx) }}
            </td>
            <td class="text-right rmm-num">{{ durationText(c.uptime) }}</td>
          </tr>
        </tbody>
      </q-markup-table>
    </q-card>
  </div>
</template>

<script setup>
import { computed } from "vue";
import { obj, pick } from "@/utils/health";
import { arr, fmtNum, isNum } from "@/composables/agentState";
import { durationText, fmtBytes } from "@/utils/format";
import HelpTip from "@/components/ui/HelpTip.vue";

// the cleaned "containers" section of GET /metrics/<id>/state/
const props = defineProps({
  containers: { type: Object, required: true },
  updated: { type: String, default: "" },
  stale: Boolean,
});

const KIND_LABELS = {
  docker: "Docker",
  podman: "Podman",
  lxc: "LXC",
  lxd: "LXD",
  incus: "Incus",
  "pve-qemu": "Proxmox VM",
  "pve-lxc": "Proxmox CT",
  hyperv: "Hyper-V",
};

const doc = computed(() => obj(props.containers));
const items = computed(() =>
  arr(doc.value.items)
    .map(obj)
    .slice()
    .sort(
      (a, b) =>
        String(a.kind).localeCompare(String(b.kind)) ||
        String(a.name).localeCompare(String(b.name)),
    ),
);
const cluster = computed(() => {
  const c = obj(doc.value.cluster);
  return typeof c.quorate === "boolean" ? c : null;
});
const failedSources = computed(() =>
  Object.entries(obj(doc.value.sources))
    .filter(([, v]) => v === "denied" || v === "error")
    .map(([kind, v]) => ({
      kind,
      text:
        v === "denied"
          ? `${kindLabel(kind)}: the agent was denied access, so its list is missing`
          : `${kindLabel(kind)}: the list could not be read`,
    })),
);

const kindLabel = (kind) => pick(KIND_LABELS, kind, kind || "—");

function stateClass(state) {
  if (state === "running") return "rmm-pill--positive";
  if (state === "restarting" || state === "paused") return "rmm-pill--warning";
  return "rmm-pill--neutral";
}
</script>

<style scoped>
.detail-card {
  height: 100%;
}

.state-card__updated {
  margin-left: auto;
  font-size: var(--rmm-fs-xs);
  white-space: nowrap;
}

.state-card__table {
  max-height: 420px;
}

.state-card__image {
  max-width: 260px;
  white-space: normal;
  overflow-wrap: anywhere;
}
</style>
