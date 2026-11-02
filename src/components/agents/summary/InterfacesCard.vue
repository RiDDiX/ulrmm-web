<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <div class="col-12">
    <q-card flat class="rmm-card detail-card">
      <div class="rmm-card__header">
        <div class="rmm-card__title">Interfaces</div>
        <span v-if="ifaces.length" class="rmm-muted rmm-num">{{
          ifaces.length
        }}</span>
        <HelpTip
          text="Network interfaces from the agent's last report. Rates are per second between the last two reports"
        />
        <span v-if="stale" class="rmm-pill rmm-pill--warning"
          >stale<q-tooltip
            >No report from the agent for over 20 minutes</q-tooltip
          ></span
        >
        <div v-if="updated" class="rmm-muted state-card__updated">
          {{ updated }}
        </div>
      </div>
      <div v-if="!ifaces.length" class="rmm-card__body rmm-muted">
        No interfaces reported
      </div>
      <q-markup-table v-else flat dense class="rmm-table state-card__table">
        <thead>
          <tr>
            <th class="text-left">Name</th>
            <th class="text-left">State</th>
            <th class="text-left">Link</th>
            <th class="text-left">Addresses</th>
            <th class="text-right">Received</th>
            <th class="text-right">Sent</th>
            <th class="text-right">Errors</th>
            <th class="text-right">Drops</th>
            <th class="text-left">Member of / members</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="n in ifaces" :key="n.name">
            <td>
              <span class="rmm-mono">{{ n.name }}</span>
              <span v-if="n.kind" class="rmm-muted q-ml-xs">{{ n.kind }}</span>
            </td>
            <td>
              <span class="rmm-pill" :class="stateClass(n.state)">{{
                n.state || "unknown"
              }}</span>
            </td>
            <td class="rmm-num">
              {{ link(n) }}
              <div v-if="n.mac" class="rmm-mono rmm-muted">{{ n.mac }}</div>
            </td>
            <td class="rmm-mono">
              <div v-for="a in arr(n.addrs)" :key="a">{{ a }}</div>
              <span v-if="!arr(n.addrs).length" class="rmm-muted">—</span>
            </td>
            <td class="text-right rmm-num">{{ fmtRate(rate(n).rx_bps) }}</td>
            <td class="text-right rmm-num">{{ fmtRate(rate(n).tx_bps) }}</td>
            <td class="text-right rmm-num">
              <span :class="{ 'text-warning': rate(n).err_ps > 0 }">{{
                perSecond(rate(n).err_ps)
              }}</span>
              <q-tooltip
                >{{ total(n.rx_errors) }} received,
                {{ total(n.tx_errors) }} sent since boot</q-tooltip
              >
            </td>
            <td class="text-right rmm-num">
              <span :class="{ 'text-warning': rate(n).drop_ps > 0 }">{{
                perSecond(rate(n).drop_ps)
              }}</span>
              <q-tooltip
                >{{ total(n.rx_drops) }} received, {{ total(n.tx_drops) }} sent
                since boot</q-tooltip
              >
            </td>
            <td class="rmm-mono">
              <template v-if="n.master">{{ n.master }}</template>
              <template v-else-if="arr(n.members).length">{{
                arr(n.members).join(", ")
              }}</template>
              <span v-else class="rmm-muted">—</span>
            </td>
          </tr>
        </tbody>
      </q-markup-table>
    </q-card>
  </div>
</template>

<script setup>
import { computed } from "vue";
import { obj, pick } from "@/utils/health";
import { arr, fmtNum, fmtRate, isNum } from "@/composables/agentState";
import HelpTip from "@/components/ui/HelpTip.vue";

// the cleaned "net" section of GET /metrics/<id>/state/
const props = defineProps({
  net: { type: Object, required: true },
  updated: { type: String, default: "" },
  stale: Boolean,
});

const ifaces = computed(() =>
  arr(obj(props.net).ifaces)
    .map(obj)
    .filter((n) => n.name),
);

const STATES = { up: "rmm-pill--positive", down: "rmm-pill--warning" };
const stateClass = (state) => pick(STATES, state, "rmm-pill--neutral");

const rate = (n) => obj(n.rate);

function link(n) {
  const parts = [];
  if (isNum(n.speed_mbps) && n.speed_mbps > 0)
    parts.push(
      n.speed_mbps >= 1000
        ? `${fmtNum(n.speed_mbps / 1000)} Gb/s`
        : `${n.speed_mbps} Mb/s`,
    );
  if (n.duplex) parts.push(n.duplex);
  if (isNum(n.mtu)) parts.push(`MTU ${n.mtu}`);
  return parts.join(", ") || "—";
}

const perSecond = (v) => (isNum(v) ? `${fmtNum(v, 2)}/s` : "—");
const total = (v) => (isNum(v) ? v.toLocaleString("en") : "?");
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
  max-height: 360px;
}
</style>
