<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <div class="col-12 col-sm-6 col-md-4">
    <q-card flat class="rmm-card detail-card">
      <div class="rmm-card__header">
        <div class="rmm-card__title">Security</div>
        <HelpTip
          text="Antivirus, firewall and protection from the last report; add a Security check to alert"
        />
        <div v-if="collected" class="rmm-muted health-card__updated">
          {{ collected }}
        </div>
      </div>
      <div v-if="!hasHealth" class="rmm-card__body rmm-muted">
        Agent update required
      </div>
      <div v-else class="rmm-card__body rmm-kv">
        <span>Antivirus</span>
        <span>
          <span v-for="(a, i) in antivirus" :key="i" class="summary-list-item">
            {{ a.name }}
            <span class="rmm-pill" :class="a.state.cls">{{
              a.state.label
            }}</span>
            <span v-if="a.stale" class="rmm-pill rmm-pill--warning"
              >definitions outdated
              <q-tooltip
                >The antivirus reports that its virus definitions are out of
                date</q-tooltip
              ></span
            >
            <span v-if="a.version" class="rmm-muted"> {{ a.version }}</span>
          </span>
          <span v-if="!antivirus.length">None reported</span>
        </span>
        <template v-if="defender">
          <span class="health-card__label">
            Defender
            <HelpTip
              text="Defender mode and age of its virus definitions; a Security check alerts past its threshold"
            />
          </span>
          <span
            >{{ defender.mode || "—"
            }}<template v-if="defender.age !== null"
              >, signatures {{ defender.age }} day{{
                defender.age === 1 ? "" : "s"
              }}
              old</template
            ></span
          >
        </template>
        <span>Firewall</span>
        <span>
          <span class="rmm-pill" :class="firewall.state.cls">{{
            firewall.state.label
          }}</span>
          <span v-if="firewall.detail" class="rmm-muted">
            {{ firewall.detail }}</span
          >
        </span>
        <template v-for="p in platform" :key="p.name">
          <span>{{ p.name }}</span>
          <span
            ><span class="rmm-pill" :class="p.state.cls">{{
              p.state.label
            }}</span></span
          >
        </template>
        <template v-if="reportOnly">
          <span></span
          ><span class="rmm-muted"
            >Reported, not alerted on {{ reportOnly }}
            <q-tooltip
              >A Security check on {{ reportOnly }} lists these values but never
              fails</q-tooltip
            ></span
          >
        </template>
      </div>
    </q-card>
  </div>

  <div class="col-12 col-sm-6 col-md-4">
    <q-card flat class="rmm-card detail-card">
      <div class="rmm-card__header">
        <div class="rmm-card__title">Hardware health</div>
        <HelpTip
          text="Disk health, temperatures and battery wear; add a Hardware Health check to alert"
        />
      </div>
      <div v-if="!hasHealth" class="rmm-card__body rmm-muted">
        Agent update required
      </div>
      <div v-else class="rmm-card__body rmm-kv">
        <span>Disks</span>
        <span>
          <span v-for="(d, i) in disks" :key="i" class="summary-list-item">
            {{ d.name }}
            <span class="rmm-pill" :class="d.state.cls">{{
              d.state.label
            }}</span>
            <span class="rmm-muted"> {{ d.detail }}</span>
          </span>
          <span v-if="!disks.length">None reported</span>
        </span>
        <span>Battery</span>
        <span>{{ battery }}</span>
        <template v-if="temps.length">
          <span>Temperatures</span>
          <span>
            <span v-for="(t, i) in temps" :key="i" class="summary-list-item">
              {{ t }}
            </span>
          </span>
        </template>
        <template v-if="thermal">
          <span>Thermal pressure</span><span>{{ thermal }}</span>
        </template>
        <template v-if="sleepStates">
          <span>Sleep</span><span>{{ sleepStates }}</span>
        </template>
        <template v-if="errors.length">
          <span>Not collected</span>
          <span class="rmm-muted">
            {{ errors.length }} source{{ errors.length === 1 ? "" : "s" }}
            <q-icon name="info_outline" size="14px" />
            <q-tooltip>{{ errors.join("; ") }}</q-tooltip>
          </span>
        </template>
      </div>
    </q-card>
  </div>
</template>

<script>
import { computed } from "vue";
import { platformMeta, relativeTime } from "@/utils/format";
import { list, obj, str, num, onOff, pick } from "@/utils/health";
import HelpTip from "@/components/ui/HelpTip.vue";

const DISK = {
  ok: { label: "OK", cls: "rmm-pill--positive" },
  warning: { label: "warning", cls: "rmm-pill--warning" },
  failing: { label: "failing", cls: "rmm-pill--negative" },
};

const THERMAL = ["Nominal", "Moderate", "Heavy", "Trapping", "Sleeping"];

function limits(warn, crit) {
  const parts = [];
  if (num(warn) !== null) parts.push(`warn ${warn} °C`);
  if (num(crit) !== null) parts.push(`crit ${crit} °C`);
  return parts.length ? ` (${parts.join(", ")})` : "";
}

export default {
  name: "HealthCards",
  components: { HelpTip },
  props: {
    // agent health (untrusted, any shape)
    health: { type: null, default: null },
    plat: { type: String, default: "" },
  },
  setup(props) {
    const h = computed(() => obj(props.health));
    const hasHealth = computed(() => Object.keys(h.value).length > 0);

    // security check on linux and freebsd reports, no alert
    const reportOnly = computed(() =>
      ["linux", "freebsd"].includes(props.plat)
        ? platformMeta(props.plat).label
        : "",
    );

    const collected = computed(() =>
      num(h.value.ts) ? `Collected ${relativeTime(h.value.ts * 1000)}` : "",
    );

    const antivirus = computed(() =>
      list(h.value.av)
        .map(obj)
        .map((a) => ({
          name: str(a.name) || "Antivirus",
          state: onOff(a.enabled),
          stale: a.up_to_date === false,
          version: str(a.version),
        })),
    );

    const defender = computed(() => {
      if (
        props.plat !== "windows" ||
        !Object.keys(obj(h.value.defender)).length
      )
        return null;
      const d = obj(h.value.defender);
      return { mode: str(d.mode), age: num(d.sig_age_days) };
    });

    const firewall = computed(() => {
      const f = obj(h.value.firewall);
      const products = list(f.products)
        .map(obj)
        .map((p) => `${str(p.name)} ${p.enabled === true ? "on" : "off"}`);
      const profiles = Object.entries(obj(f.profiles))
        .slice(0, 8)
        .map(([k, v]) => `${str(k)} ${v === true ? "on" : "off"}`);
      return {
        state: onOff(f.enabled),
        detail: [...products, ...profiles].join(", "),
      };
    });

    const platform = computed(() => {
      const p = obj(h.value.platform);
      return [
        ["Gatekeeper", p.gatekeeper],
        ["SIP", p.sip],
        ["FileVault", p.filevault],
      ]
        .filter(([, v]) => typeof v === "boolean")
        .map(([name, v]) => ({ name, state: onOff(v) }));
    });

    const disks = computed(() =>
      list(h.value.disks)
        .map(obj)
        .map((d) => {
          const detail = [str(d.bus), str(d.media)].filter(
            (s) => s && s !== "unknown",
          );
          if (d.smart === "standby") detail.push("standby");
          if (num(d.temp_c) !== null)
            detail.push(
              `${d.temp_c} °C${limits(d.temp_warn_c, d.temp_crit_c)}`,
            );
          if (num(d.wear_pct) !== null) detail.push(`${d.wear_pct}% used`);
          if (num(d.poh) !== null) detail.push(`${d.poh} h`);
          return {
            name: str(d.name) || "Disk",
            state: pick(DISK, d.health, {
              label: "unknown",
              cls: "rmm-pill--neutral",
            }),
            detail: detail.join(", "),
          };
        }),
    );

    const battery = computed(() => {
      const b = obj(h.value.battery);
      if (!Object.keys(b).length) return "No battery";
      const parts = [];
      if (num(b.max_capacity_pct) !== null)
        parts.push(`${b.max_capacity_pct}% of design capacity`);
      if (num(b.cycles) !== null) parts.push(`${b.cycles} cycles`);
      if (str(b.condition)) parts.push(str(b.condition));
      return parts.join(", ") || "—";
    });

    const temps = computed(() =>
      list(h.value.temps)
        .map(obj)
        .filter((t) => num(t.c) !== null)
        .map((t) => `${str(t.name)}: ${t.c} °C${limits(t.warn_c, t.crit_c)}`),
    );

    const thermal = computed(() => {
      const p = num(h.value.thermal_pressure);
      return p === null ? "" : THERMAL[p] || String(p);
    });

    const sleepStates = computed(() => {
      const p = obj(h.value.power);
      const parts = [];
      if (p.s3 === true) parts.push("S3");
      if (p.modern_standby === true) parts.push("Modern Standby");
      return parts.join(", ");
    });

    const errors = computed(() =>
      list(h.value.errors).map(str).filter(Boolean),
    );

    return {
      hasHealth,
      reportOnly,
      collected,
      antivirus,
      defender,
      firewall,
      platform,
      disks,
      battery,
      temps,
      thermal,
      sleepStates,
      errors,
    };
  },
};
</script>

<style scoped>
.detail-card {
  height: 100%;
}

.health-card__updated {
  margin-left: auto;
  font-size: var(--rmm-fs-xs);
  white-space: nowrap;
}

.health-card__label {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.rmm-kv > span {
  min-width: 0;
  overflow-wrap: anywhere;
}

.summary-list-item {
  display: block;
}

.summary-list-item + .summary-list-item {
  margin-top: 4px;
}
</style>
