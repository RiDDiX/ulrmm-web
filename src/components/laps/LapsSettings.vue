<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <div>
    <SettingsPanelHeader
      title="Local admin"
      text="The server sets a random password on a local administrator account, stores it in the device vault and rotates it on a schedule."
    >
      <q-btn
        flat
        no-caps
        icon="add"
        label="Add site policy"
        :disable="!ready"
        @click="addSite"
      />
      <q-btn
        unelevated
        no-caps
        color="primary"
        label="Save"
        :disable="!ready"
        :loading="saving"
        @click="save"
      />
    </SettingsPanelHeader>
    <div v-if="loading" class="q-py-md rmm-muted" role="status">
      <q-spinner size="1em" class="q-mr-sm" />Loading...
    </div>
    <div v-else-if="!ready" class="q-py-md">
      <div class="rmm-muted q-mb-sm">{{ error }}</div>
      <q-btn
        dense
        no-caps
        outline
        color="primary"
        label="Retry"
        @click="load"
      />
    </div>
    <template v-else>
      <q-card
        v-for="(p, i) in policies"
        :key="p.site ?? 'global'"
        flat
        bordered
        class="q-mb-md"
      >
        <q-card-section class="row items-center q-pb-none">
          <div class="text-subtitle2">
            {{ p.site === null ? "All sites (global)" : siteName(p.site) }}
          </div>
          <q-space />
          <q-toggle v-model="p.enabled" label="Enabled" />
          <q-btn
            v-if="p.site !== null"
            flat
            dense
            round
            icon="delete"
            color="negative"
            :aria-label="`Remove the policy of ${siteName(p.site)}`"
            @click="policies.splice(i, 1)"
          />
        </q-card-section>
        <q-card-section class="row q-col-gutter-sm">
          <div class="col-12 col-sm-6">
            <q-input
              v-model="p.account"
              outlined
              dense
              label="Account"
              hint="Local account the server manages"
              :rules="[
                (v) =>
                  /^[a-z][a-z0-9_-]{0,19}$/.test(v) ||
                  'Lower case letters, digits, - _ (max 20), start with a letter',
              ]"
            />
          </div>
          <div class="col-12 col-sm-6">
            <q-input
              v-model.number="p.rotate_days"
              type="number"
              min="1"
              max="365"
              outlined
              dense
              label="Rotate every (days)"
              :rules="[inRange('rotate_days')]"
            />
          </div>
          <div class="col-12 col-sm-6">
            <q-input
              v-model.number="p.length"
              type="number"
              min="14"
              max="64"
              outlined
              dense
              label="Password length"
              :rules="[inRange('length')]"
            />
          </div>
          <div class="col-12 col-sm-6">
            <q-input
              v-model.number="p.rotate_after_reveal_hours"
              type="number"
              min="0"
              max="168"
              outlined
              dense
              label="Rotate after a reveal (hours)"
              :rules="[inRange('rotate_after_reveal_hours')]"
              hint="0 = not after reveals"
            />
          </div>
          <div class="col-12">
            <q-checkbox
              v-model="p.create_if_missing"
              label="Create the account when it does not exist"
            />
          </div>
        </q-card-section>
      </q-card>
      <div class="settings-hint">
        A site policy replaces the global one for that site. Windows, Linux and
        macOS devices are covered; rotation needs the device to be online.
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from "vue";
import { useQuasar } from "quasar";
import SettingsPanelHeader from "@/components/modals/coresettings/SettingsPanelHeader.vue";
import {
  fetchLapsPolicies,
  removeLapsPolicy,
  saveLapsPolicy,
} from "@/api/laps";
import { withStepUp } from "@/components/vault/stepUp";
import { fetchSites } from "@/api/clients";
import { notifyError, notifySuccess } from "@/utils/notify";

const $q = useQuasar();
const policies = ref([]);
const sites = ref([]);
const loading = ref(false);
const saving = ref(false);
const error = ref("");
// the server's bounds per number field
const RANGES = {
  rotate_days: [1, 365],
  length: [14, 64],
  rotate_after_reveal_hours: [0, 168],
};
const inRange = (key) => (v) =>
  (Number.isInteger(v) && v >= RANGES[key][0] && v <= RANGES[key][1]) ||
  `${RANGES[key][0]} to ${RANGES[key][1]}`;
const valid = (p) =>
  Object.keys(RANGES).every((k) => inRange(k)(p[k]) === true) &&
  /^[a-z][a-z0-9_-]{0,19}$/.test(p.account);
// site policies as loaded, to delete the ones removed in the form
let loadedSites = [];
const ready = computed(() => !error.value && !loading.value);

const blank = (site) => ({
  site,
  account: "ulrmm-admin",
  create_if_missing: true,
  rotate_days: 30,
  length: 24,
  rotate_after_reveal_hours: 4,
  enabled: true,
});

const siteName = (id) => {
  const s = sites.value.find((x) => x.id === id);
  return s
    ? `${s.client_name ? s.client_name + " / " : ""}${s.name}`
    : `Site ${id}`;
};

async function load() {
  loading.value = true;
  error.value = "";
  try {
    const [list, siteList] = await Promise.all([
      fetchLapsPolicies(),
      fetchSites().catch(() => []),
    ]);
    sites.value = Array.isArray(siteList) ? siteList : [];
    const rows = [list?.global, ...(list?.sites ?? [])]
      .filter(Boolean)
      .map((p) => ({ ...blank(p.site ?? null), ...p, site: p.site ?? null }));
    if (!rows.some((p) => p.site === null)) rows.unshift(blank(null));
    policies.value = rows;
    loadedSites = rows.filter((p) => p.site !== null).map((p) => p.site);
  } catch (e) {
    error.value =
      e?.response?.status === 403
        ? "Your role cannot edit these settings."
        : "The local admin policies could not be loaded.";
  }
  loading.value = false;
}

function addSite() {
  const used = new Set(policies.value.map((p) => p.site));
  const options = sites.value
    .filter((s) => !used.has(s.id))
    .map((s) => ({ label: siteName(s.id), value: s.id }));
  if (!options.length) {
    $q.dialog({ title: "Every site has a policy already", ok: true });
    return;
  }
  $q.dialog({
    title: "Policy for a site",
    options: { type: "radio", model: options[0].value, items: options },
    cancel: true,
    ok: "Add",
  }).onOk((site) => policies.value.push(blank(site)));
}

async function save() {
  if (!policies.value.every(valid)) {
    notifyError("Correct the marked fields first.");
    return;
  }
  saving.value = true;
  const keep = new Set(policies.value.map((p) => p.site));
  let done = true;
  for (const site of loadedSites.filter((s) => !keep.has(s))) {
    done = (await withStepUp($q, (c) => removeLapsPolicy(site, c))) !== null;
    if (!done) break;
  }
  for (const p of policies.value) {
    if (!done) break;
    // an untouched, never saved global policy stays unsaved
    if (p.site === null && !p.id && !p.enabled) continue;
    const body = {
      site: p.site,
      enabled: p.enabled,
      account: p.account,
      create_if_missing: p.create_if_missing,
      rotate_days: p.rotate_days,
      length: p.length,
      rotate_after_reveal_hours: p.rotate_after_reveal_hours,
    };
    done = (await withStepUp($q, (c) => saveLapsPolicy(body, c))) !== null;
  }
  saving.value = false;
  // a refused save keeps the form as typed; the toast names the problem
  if (!done) return;
  notifySuccess("Local admin policies saved");
  await load();
}

onMounted(load);
</script>
