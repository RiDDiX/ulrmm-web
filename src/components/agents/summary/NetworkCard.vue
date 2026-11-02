<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <div
    v-if="info && (info.vlan_id || info.vlan_name || info.switch || info.ap)"
    class="col-12 col-sm-6 col-md-4"
  >
    <q-card flat class="rmm-card detail-card">
      <div class="rmm-card__header">
        <div class="rmm-card__title">Switch &amp; VLAN</div>
        <HelpTip
          text="Where the device sits in the network, from the UniFi or OPNsense sync (Global Settings > Network)"
        />
      </div>
      <div class="rmm-card__body rmm-kv">
        <span>VLAN</span>
        <span>{{ vlan || "—" }}</span>
        <template v-if="info.switch">
          <span>Switch / port</span>
          <span
            >{{ info.switch
            }}<template v-if="info.port"> / {{ info.port }}</template></span
          >
        </template>
        <template v-if="info.ap">
          <span>Access point</span>
          <span
            >{{ info.ap
            }}<template v-if="info.ssid">, {{ info.ssid }}</template></span
          >
        </template>
        <template v-else-if="info.ssid">
          <span>SSID</span>
          <span>{{ info.ssid }}</span>
        </template>
        <span>Source</span>
        <span>{{ SOURCES[info.source] || info.source || "—" }}</span>
      </div>
    </q-card>
  </div>
</template>

<script setup>
import { computed } from "vue";
import HelpTip from "@/components/ui/HelpTip.vue";

// network_info: {} or {mac, ip, vlan_id, vlan_name, switch, port, ap, ssid,
// source, last_seen}
const props = defineProps({ info: { type: Object, default: null } });

const SOURCES = { unifi: "UniFi", opnsense: "OPNsense" };

const vlan = computed(() => {
  const i = props.info;
  if (!i) return "";
  const id = i.vlan_id;
  if (i.vlan_name && id) return `${i.vlan_name} (${id})`;
  return i.vlan_name || (id ? `VLAN ${id}` : "");
});
</script>
