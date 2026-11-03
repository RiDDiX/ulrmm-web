<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <div class="col-12">
    <q-card flat class="rmm-card detail-card">
      <div class="rmm-card__header">
        <div class="rmm-card__title">System state</div>
        <HelpTip
          text="Service units, file systems, time sync, RAID and sensors from the agent's last report, sent about every 5 minutes"
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
      <div class="rmm-card__body state-card__grid">
        <section v-if="hasUnits">
          <div class="rmm-label q-mb-xs">Units</div>
          <div class="rmm-kv">
            <span>Service manager</span>
            <span>{{ system.manager || "—" }}</span>
            <template v-if="system.units_failed > 0">
              <span>Failed</span>
              <span>
                <span class="rmm-pill rmm-pill--negative">{{
                  system.units_failed
                }}</span>
                <span v-if="isNum(system.units_total)" class="rmm-muted">
                  of {{ system.units_total }} units</span
                >
              </span>
            </template>
          </div>
          <ul v-if="units.length" class="state-card__list" aria-label="Units">
            <li v-for="u in units" :key="u.name">
              <span class="rmm-mono">{{ u.name }}</span>
              <span class="rmm-pill" :class="unitClass(u)"
                >{{ u.active }}<template v-if="u.sub">/{{ u.sub }}</template>
              </span>
              <span v-if="u.enabled === true" class="rmm-muted">enabled</span>
              <div v-if="u.description" class="rmm-muted state-card__desc">
                {{ u.description }}
              </div>
            </li>
          </ul>
          <div v-else-if="!(system.units_failed > 0)" class="rmm-muted q-mt-xs">
            No failed or starting units<template
              v-if="isNum(system.units_total)"
            >
              ({{ system.units_total }} loaded)</template
            >
          </div>
        </section>

        <section v-if="time">
          <div class="rmm-label q-mb-xs">Time sync</div>
          <div class="rmm-kv">
            <span>State</span>
            <span
              ><span class="rmm-pill" :class="synced.cls">{{
                synced.label
              }}</span></span
            >
            <span>Source</span><span>{{ time.source || "—" }}</span>
            <template v-if="time.server">
              <span>Server</span><span class="rmm-mono">{{ time.server }}</span>
            </template>
            <span>Offset</span>
            <span class="rmm-num">{{
              isNum(time.offset_ms) ? `${fmtNum(time.offset_ms, 2)} ms` : "—"
            }}</span>
          </div>
        </section>

        <section v-if="mounts.length" class="state-card__wide">
          <div class="rmm-label q-mb-xs">File systems</div>
          <q-markup-table flat dense class="rmm-table state-card__table">
            <thead>
              <tr>
                <th class="text-left">Mount</th>
                <th class="text-left">Device</th>
                <th class="text-left">Type</th>
                <th class="text-right">Used</th>
                <th class="text-right">Inodes</th>
                <th class="text-left">Flags</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="m in mounts" :key="m.mount">
                <td class="rmm-mono">{{ m.mount }}</td>
                <td class="rmm-mono rmm-muted">{{ m.device || "—" }}</td>
                <td>{{ m.fs || "—" }}</td>
                <td class="text-right rmm-num">
                  <template v-if="m.stale">—</template>
                  <template v-else>
                    <span :class="levelClass(m.used_pct)">{{
                      fmtPct(m.used_pct)
                    }}</span>
                    <span class="rmm-muted"> of {{ fmtBytes(m.size) }}</span>
                  </template>
                </td>
                <td class="text-right rmm-num">
                  <span :class="levelClass(m.inode_pct)">{{
                    fmtPct(m.inode_pct)
                  }}</span>
                </td>
                <td>
                  <span v-if="m.stale" class="rmm-pill rmm-pill--negative"
                    >not responding<q-tooltip
                      >The file system did not answer in time; it is checked
                      again in 30 minutes</q-tooltip
                    ></span
                  >
                  <span v-if="m.ro" class="rmm-pill rmm-pill--warning"
                    >read-only</span
                  >
                </td>
              </tr>
            </tbody>
          </q-markup-table>
        </section>

        <section v-if="raid.length" class="state-card__wide">
          <div class="rmm-label q-mb-xs">RAID</div>
          <q-markup-table flat dense class="rmm-table state-card__table">
            <thead>
              <tr>
                <th class="text-left">Name</th>
                <th class="text-left">Kind</th>
                <th class="text-left">Level</th>
                <th class="text-left">State</th>
                <th class="text-right">Devices</th>
                <th class="text-right">Sync</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(r, i) in raid" :key="`${r.kind}-${r.name}-${i}`">
                <td class="rmm-mono">{{ r.name }}</td>
                <td>{{ r.kind }}</td>
                <td>{{ r.level || "—" }}</td>
                <td>
                  <span class="rmm-pill" :class="raidClass(r.health)">{{
                    r.health || "unknown"
                  }}</span>
                  <span v-if="r.state" class="rmm-muted q-ml-xs">{{
                    r.state
                  }}</span>
                </td>
                <td class="text-right rmm-num">
                  {{ isNum(r.devices) ? r.devices : "—"
                  }}<span v-if="r.failed" class="text-negative"
                    >, {{ r.failed }} failed</span
                  >
                </td>
                <td class="text-right rmm-num">{{ fmtPct(r.sync_pct) }}</td>
              </tr>
            </tbody>
          </q-markup-table>
        </section>

        <section v-if="sensors.length" class="state-card__wide">
          <div class="rmm-label q-mb-xs">Sensors</div>
          <q-markup-table flat dense class="rmm-table state-card__table">
            <thead>
              <tr>
                <th class="text-left">Sensor</th>
                <th class="text-left">Source</th>
                <th class="text-right">Value</th>
                <th class="text-right">Limits</th>
                <th class="text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(s, i) in sensors" :key="`${s.source}-${s.name}-${i}`">
                <td>{{ s.name }}</td>
                <td class="rmm-muted">{{ s.source }}</td>
                <td class="text-right rmm-num">
                  <span :class="sensorClass(s)"
                    >{{ fmtNum(s.value) }} {{ unitText(s.unit) }}</span
                  >
                </td>
                <td class="text-right rmm-num rmm-muted">
                  {{ limits(s) }}
                </td>
                <td class="rmm-muted">{{ s.status || "—" }}</td>
              </tr>
            </tbody>
          </q-markup-table>
        </section>

        <div v-if="empty" class="rmm-muted">Nothing reported</div>
      </div>
    </q-card>
  </div>
</template>

<script setup>
import { computed } from "vue";
import { obj, onOff, pick } from "@/utils/health";
import { arr, fmtBytes, fmtNum, fmtPct, isNum } from "@/composables/agentState";
import HelpTip from "@/components/ui/HelpTip.vue";

// the cleaned "system" section of GET /metrics/<id>/state/
const props = defineProps({
  system: { type: Object, required: true },
  updated: { type: String, default: "" },
  stale: Boolean,
});

const UNIT_RANK = { failed: 0, activating: 1, deactivating: 1, reloading: 1 };

const unitRank = (u) => pick(UNIT_RANK, u.active, 2);

const system = computed(() => obj(props.system));
const units = computed(() =>
  arr(system.value.units)
    .map(obj)
    .slice()
    .sort(
      (a, b) =>
        unitRank(a) - unitRank(b) ||
        String(a.name).localeCompare(String(b.name)),
    ),
);
const hasUnits = computed(
  () => !!system.value.manager || isNum(system.value.units_total),
);
const mounts = computed(() => arr(system.value.mounts).map(obj));
const raid = computed(() => arr(system.value.raid).map(obj));
const sensors = computed(() => arr(system.value.sensors).map(obj));
const time = computed(() => {
  const t = obj(system.value.time);
  return Object.keys(t).length ? t : null;
});
const synced = computed(() =>
  onOff(time.value?.synced, "synced", "not synced"),
);
const empty = computed(
  () =>
    !hasUnits.value &&
    !time.value &&
    !mounts.value.length &&
    !raid.value.length &&
    !sensors.value.length,
);

function unitClass(u) {
  if (u.active === "failed") return "rmm-pill--negative";
  if (u.active === "active") return "rmm-pill--positive";
  if (unitRank(u) === 1) return "rmm-pill--warning";
  return "rmm-pill--neutral";
}

// same limits as the disks card: warning from 80%, error from 95%
function levelClass(pct) {
  if (!isNum(pct)) return "";
  if (pct >= 95) return "text-negative";
  if (pct >= 80) return "text-warning";
  return "";
}

const RAID = {
  ok: "rmm-pill--positive",
  degraded: "rmm-pill--warning",
  failed: "rmm-pill--negative",
};
const raidClass = (health) => pick(RAID, health, "rmm-pill--neutral");

const unitText = (unit) => (unit === "C" ? "°C" : unit || "");

function limits(s) {
  const parts = [];
  if (isNum(s.warn)) parts.push(`warn ${fmtNum(s.warn)}`);
  if (isNum(s.crit)) parts.push(`crit ${fmtNum(s.crit)}`);
  return parts.join(", ") || "—";
}

// fans and voltages report their own status; only temps are compared here
function sensorClass(s) {
  if (s.kind !== "temp" || !isNum(s.value)) return "";
  if (isNum(s.crit) && s.value >= s.crit) return "text-negative";
  if (isNum(s.warn) && s.value >= s.warn) return "text-warning";
  return "";
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

.state-card__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 16px 24px;
}

.state-card__wide {
  grid-column: 1 / -1;
}

.state-card__list {
  max-height: 220px;
  margin: 8px 0 0;
  padding: 0;
  overflow-y: auto;
  list-style: none;
  font-size: var(--rmm-fs-sm);
}

.state-card__list li {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 2px 8px;
  padding: 4px 0;
}

.state-card__list li + li {
  border-top: 1px solid var(--rmm-border);
}

.state-card__desc {
  width: 100%;
  min-width: 0;
  overflow-wrap: anywhere;
  font-size: var(--rmm-fs-xs);
}

.state-card__table {
  max-height: 260px;
}

.state-card__table td {
  overflow-wrap: anywhere;
}
</style>
