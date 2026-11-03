<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <div class="reveal-secret">
    <q-btn
      v-if="secret === null"
      flat
      dense
      no-caps
      no-wrap
      size="13px"
      color="primary"
      icon="visibility"
      label="Reveal"
      :loading="loading"
      :aria-label="`Reveal ${label}`"
      @click="reveal"
    >
      <q-tooltip
        >Loads the stored value for {{ HIDE_AFTER }} seconds. Needs a two-factor
        code once per hour; every reveal is audited.</q-tooltip
      >
    </q-btn>
    <template v-else>
      <span v-if="shown" class="reveal-secret__value rmm-mono">{{
        secret
      }}</span>
      <span
        v-else
        class="reveal-secret__value reveal-secret__mask"
        role="img"
        :aria-label="`${label}, masked`"
        >••••••••••••</span
      >
      <q-btn
        round
        flat
        dense
        size="sm"
        :icon="shown ? 'visibility_off' : 'visibility'"
        :aria-label="shown ? `Mask ${label}` : `Show ${label}`"
        @click="shown = !shown"
      >
        <q-tooltip>{{ shown ? "Mask the value" : "Show the value" }}</q-tooltip>
      </q-btn>
      <q-btn
        round
        flat
        dense
        size="sm"
        icon="content_copy"
        :aria-label="`Copy ${label}`"
        @click="copy"
      >
        <q-tooltip>Copy to the clipboard</q-tooltip>
      </q-btn>
      <q-btn
        round
        flat
        dense
        size="sm"
        icon="close"
        :aria-label="`Hide ${label}`"
        @click="clear"
      >
        <q-tooltip>Hide it now</q-tooltip>
      </q-btn>
      <span class="reveal-secret__timer rmm-muted rmm-num"
        >{{ left }} s<q-tooltip
          >Hidden again after {{ HIDE_AFTER }} seconds</q-tooltip
        ></span
      >
    </template>
  </div>
</template>

<script setup>
// In the DOM only after "Show". Cleared after HIDE_AFTER seconds,
// on "Hide", and when the component goes away.
import { ref, onBeforeUnmount } from "vue";
import { copyToClipboard, useQuasar } from "quasar";
import { notifyError, notifySuccess } from "@/utils/notify";
import { withStepUp } from "@/components/vault/stepUp";

const props = defineProps({
  // (axiosConfig) => Promise<string>
  request: { type: Function, required: true },
  // what is revealed, for labels: "password of Domain admin"
  label: { type: String, required: true },
});

const HIDE_AFTER = 60;
const $q = useQuasar();
const secret = ref(null);
const shown = ref(false);
const loading = ref(false);
const left = ref(HIDE_AFTER);
let timer;
let alive = true;

function clear() {
  window.clearInterval(timer);
  secret.value = null;
  shown.value = false;
}

async function reveal() {
  loading.value = true;
  const value = await withStepUp($q, props.request);
  loading.value = false;
  if (!alive || typeof value !== "string") return;
  secret.value = value;
  left.value = HIDE_AFTER;
  // by the clock, a background tab runs intervals late
  const hideAt = Date.now() + HIDE_AFTER * 1000;
  window.clearInterval(timer);
  timer = window.setInterval(() => {
    left.value = Math.ceil((hideAt - Date.now()) / 1000);
    if (left.value <= 0) clear();
  }, 1000);
}

function copy() {
  if (secret.value === null) return;
  copyToClipboard(secret.value)
    .then(() => notifySuccess("Copied to the clipboard"))
    .catch(() => notifyError("Unable to copy to the clipboard"));
}

onBeforeUnmount(() => {
  alive = false;
  clear();
});
</script>

<style scoped>
.reveal-secret {
  display: inline-flex;
  min-width: 0;
  max-width: 100%;
  align-items: center;
  gap: 2px;
}

.reveal-secret__value {
  min-width: 0;
  margin-right: 4px;
  overflow-wrap: anywhere;
}

.reveal-secret__mask {
  color: var(--rmm-text-muted);
  letter-spacing: 0.08em;
}

.reveal-secret__timer {
  margin-left: 4px;
  font-size: var(--rmm-fs-xs);
}
</style>
