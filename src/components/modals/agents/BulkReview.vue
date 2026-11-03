<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-card-section>
    <div class="bulk-section-title">Review and run</div>
    <div class="text-subtitle1 text-weight-medium">{{ label }}</div>
    <div class="rmm-kv q-mt-sm bulk-review__kv">
      <div>Target</div>
      <div>{{ targetText }}</div>
      <div>Action</div>
      <div>{{ actionText }}</div>
      <template v-if="agents.length">
        <div>Agents ({{ agents.length }})</div>
        <div>
          <span class="rmm-mono">{{ shownNames.join(", ") }}</span>
          <q-btn
            v-if="agents.length > PREVIEW"
            :label="
              showAll ? 'Show fewer' : `and ${agents.length - PREVIEW} more`
            "
            flat
            dense
            no-caps
            color="primary"
            class="q-ml-xs"
            @click="showAll = !showAll"
          />
        </div>
      </template>
    </div>
    <div v-if="!agents.length" class="q-mt-sm">
      No agents match the selected target and filters. Nothing will be sent.
    </div>
    <div class="text-body2 rmm-muted q-mt-sm">
      {{
        mode === "wake"
          ? "Wake-on-LAN goes to every agent listed, online or offline."
          : "Only agents that are online when you run this are addressed. Offline agents are skipped and do not run it later."
      }}
    </div>
    <div v-if="allOffline" class="q-mt-sm text-warning" role="status">
      All of these are offline. Nothing can be sent, and nothing runs later on
      check-in.
    </div>
    <div v-else-if="offlineCount" class="q-mt-sm text-warning" role="status">
      {{ offlineCount }} of these are offline. The server skips them; they do
      not run on next check-in.
    </div>
    <div v-if="nobodyLoggedIn" class="q-mt-sm text-warning" role="status">
      On {{ nobodyLoggedIn }} of these nobody is logged in. The server refuses
      them.
    </div>
    <div v-if="notArmed.length" class="q-mt-sm text-warning" role="status">
      {{ notArmed.length }} of these report no armed Wake-on-LAN card and may
      not wake from the network:
      <span class="rmm-mono">{{ notArmed.slice(0, PREVIEW).join(", ") }}</span
      ><span v-if="notArmed.length > PREVIEW">
        and {{ notArmed.length - PREVIEW }} more</span
      >
    </div>
  </q-card-section>
  <q-card-actions align="right">
    <q-btn flat label="Back" @click="$emit('back')" />
    <q-btn
      :label="label"
      :color="destructive ? 'negative' : 'primary'"
      :disable="loading || !agents.length || allOffline"
      :loading="loading"
      unelevated
      @click="$emit('run')"
    />
  </q-card-actions>
</template>

<script setup>
import { computed, ref } from "vue";
import { loggedInUser } from "@/utils/packages";
import { deviceName } from "@/utils/deviceName";

const props = defineProps({
  agents: { type: Array, required: true },
  mode: String,
  runAs: String,
  label: String,
  targetText: String,
  actionText: String,
  destructive: Boolean,
  loading: Boolean,
});
defineEmits(["back", "run"]);

const PREVIEW = 10;
const showAll = ref(false);

const shownNames = computed(() => {
  const names = props.agents.map(deviceName);
  return showAll.value ? names : names.slice(0, PREVIEW);
});

// wake goes to offline agents as well, the server does not skip them
const offlineCount = computed(() =>
  props.mode === "wake"
    ? 0
    : props.agents.filter((a) => a.status !== "online").length,
);
const allOffline = computed(
  () => offlineCount.value > 0 && offlineCount.value === props.agents.length,
);

// sleep: agents whose wol_armed is false or was never reported
const notArmed = computed(() =>
  props.mode === "suspend"
    ? props.agents.filter((a) => a.wol_armed !== true).map(deviceName)
    : [],
);

// run as user: online agents without a session are refused
const nobodyLoggedIn = computed(() =>
  props.mode === "package" && props.runAs === "user"
    ? props.agents.filter((a) => a.status === "online" && !loggedInUser(a))
        .length
    : 0,
);
</script>
