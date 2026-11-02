<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <div>
    <SettingsPanelHeader
      title="App updates"
      text="Keeps third-party apps current on Windows (winget) and macOS (Homebrew, Mac App Store). Linux and FreeBSD devices are not touched."
    >
      <q-btn
        unelevated
        no-caps
        color="primary"
        label="Save"
        :disable="!settings || !idsOk"
        :loading="saving"
        @click="save"
      />
    </SettingsPanelHeader>
    <div v-if="loading" class="q-py-md rmm-muted" role="status">
      <q-spinner size="1em" class="q-mr-sm" />Loading app update settings...
    </div>
    <div v-else-if="!settings" class="q-py-md">
      <div class="rmm-muted q-mb-sm">
        {{ errorText }}
      </div>
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
      <q-card-section>
        <q-toggle
          v-model="settings.enabled"
          label="Update apps automatically"
        />
        <div class="appupd-hint">
          Off by default. A device can override this on its Apps tab: device
          setting first, then this switch.
        </div>
      </q-card-section>
      <q-card-section class="row q-col-gutter-md">
        <div class="col-12 col-sm-6">
          <q-input
            v-model.number="settings.hour"
            outlined
            dense
            type="number"
            min="0"
            max="23"
            label="Hour of the day"
            hint="Each device's own time zone, 0 to 23. Offline devices are skipped"
            :rules="[
              (v) => (Number.isInteger(v) && v >= 0 && v <= 23) || '0 to 23',
            ]"
          />
        </div>
        <div class="col-12 col-sm-6">
          <q-input
            v-model.number="settings.max_per_run"
            outlined
            dense
            type="number"
            min="1"
            max="1000"
            label="Devices per run"
            hint="At most this many devices update in one run, 1 to 1000; the rest wait for the next day"
            :rules="[
              (v) =>
                (Number.isInteger(v) && v >= 1 && v <= 1000) || '1 to 1000',
            ]"
          />
        </div>
      </q-card-section>
      <q-card-section>
        <q-select
          v-model="settings.exclusions"
          outlined
          dense
          use-input
          use-chips
          multiple
          hide-dropdown-icon
          new-value-mode="add-unique"
          input-debounce="0"
          label="Never update these apps"
          hint="App ids on every device, e.g. Google.Chrome or firefox. Press Enter to add"
          :rules="[validIds]"
        />
      </q-card-section>
      <q-card-section>
        <div class="text-subtitle2">Site overrides</div>
        <div class="appupd-hint q-mb-sm">
          A site setting beats this switch; a device setting beats the site.
          Changes here apply at once.
        </div>
        <div
          v-for="site in settings.sites"
          :key="site.id"
          class="row items-center q-col-gutter-sm q-mb-xs"
        >
          <div class="col">{{ site.client_name }} / {{ site.name }}</div>
          <div class="col-auto appupd-policy">
            <q-select
              :model-value="site.app_updates"
              :options="POLICY_OPTIONS"
              emit-value
              map-options
              outlined
              dense
              options-dense
              :aria-label="`App updates for ${site.name}`"
              :disable="siteBusy === site.id"
              @update:model-value="setSite(site.id, $event)"
            />
          </div>
        </div>
        <div v-if="!settings.sites.length" class="rmm-muted q-mb-sm">
          No site has its own setting.
        </div>
        <div class="row items-center q-col-gutter-sm">
          <div class="col">
            <q-select
              v-model="newSite"
              :options="siteOptions"
              emit-value
              map-options
              outlined
              dense
              options-dense
              use-input
              input-debounce="0"
              label="Add a site"
              @focus="loadSites"
              @filter="filterSites"
            />
          </div>
          <div class="col-auto appupd-policy">
            <q-select
              v-model="newPolicy"
              :options="POLICY_OPTIONS.slice(1)"
              emit-value
              map-options
              outlined
              dense
              options-dense
              label="Setting"
            />
          </div>
          <div class="col-auto">
            <q-btn
              flat
              no-caps
              icon="add"
              label="Add"
              :disable="newSite == null"
              @click="addSite"
            />
          </div>
        </div>
      </q-card-section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import {
  fetchAppUpdateSettings,
  saveAppUpdateSettings,
  setSiteAppUpdatePolicy,
} from "@/api/appupdates";
import { fetchSites } from "@/api/clients";
import { POLICY_OPTIONS, type AppPolicy } from "@/utils/appupdates";
import { notifySuccess } from "@/utils/notify";
import SettingsPanelHeader from "@/components/modals/coresettings/SettingsPanelHeader.vue";

interface Settings {
  enabled: boolean;
  hour: number;
  max_per_run: number;
  exclusions: string[];
  sites: SitePolicy[];
}

interface SitePolicy {
  id: number;
  name: string;
  client_name: string;
  app_updates: AppPolicy;
}

interface SiteChoice {
  label: string;
  value: number;
}

const ID_RE = /^(?!-)[A-Za-z0-9._+@-]{1,128}$/;

const settings = ref<Settings | null>(null);
const loading = ref(false);
const saving = ref(false);
const errorText = ref("App update settings could not be loaded.");

const siteBusy = ref<number | null>(null);
const allSites = ref<SiteChoice[]>([]);
const siteFilter = ref("");
const newSite = ref<number | null>(null);
const newPolicy = ref<AppPolicy>("on");

const siteOptions = computed(() =>
  allSites.value.filter(
    (s) =>
      !settings.value?.sites.some((o) => o.id === s.value) &&
      s.label.toLowerCase().includes(siteFilter.value.toLowerCase()),
  ),
);

const idsOk = computed(() =>
  (settings.value?.exclusions ?? []).every((id) => ID_RE.test(id)),
);
const validIds = (list: string[]) =>
  (list ?? []).every((id) => ID_RE.test(id)) ||
  "Ids use letters, digits and . _ + @ - only";

async function load() {
  loading.value = true;
  try {
    const r = await fetchAppUpdateSettings();
    settings.value = {
      enabled: !!r?.enabled,
      hour: Number.isInteger(r?.hour) ? r.hour : 3,
      max_per_run: Number.isInteger(r?.max_per_run) ? r.max_per_run : 50,
      exclusions: Array.isArray(r?.exclusions) ? [...r.exclusions] : [],
      sites: Array.isArray(r?.sites) ? r.sites : [],
    };
  } catch (e) {
    settings.value = null;
    errorText.value =
      (e as { response?: { status?: number } })?.response?.status === 403
        ? "Your role cannot view the app update settings."
        : "App update settings could not be loaded.";
  } finally {
    loading.value = false;
  }
}

async function save() {
  if (!settings.value || !idsOk.value) return;
  saving.value = true;
  try {
    const { enabled, hour, max_per_run, exclusions } = settings.value;
    await saveAppUpdateSettings({ enabled, hour, max_per_run, exclusions });
    notifySuccess("App update settings saved");
    await load();
  } catch {
    // the response interceptor shows the error
  } finally {
    saving.value = false;
  }
}

async function loadSites() {
  if (allSites.value.length) return;
  try {
    const sites = await fetchSites();
    allSites.value = (Array.isArray(sites) ? sites : []).map(
      (s: { id: number; name: string; client_name: string }) => ({
        label: `${s.client_name} / ${s.name}`,
        value: s.id,
      }),
    );
  } catch {
    // the response interceptor shows the error
  }
}

function filterSites(val: string, update: (fn: () => void) => void) {
  update(() => {
    siteFilter.value = val;
  });
}

async function setSite(id: number, value: AppPolicy) {
  siteBusy.value = id;
  try {
    await setSiteAppUpdatePolicy(id, value);
    notifySuccess("Site setting saved");
    await reloadSites();
  } catch {
    // the response interceptor shows the error
  } finally {
    siteBusy.value = null;
  }
}

async function addSite() {
  if (newSite.value == null) return;
  await setSite(newSite.value, newPolicy.value);
  newSite.value = null;
}

// only the site list, so unsaved edits above survive
async function reloadSites() {
  const r = await fetchAppUpdateSettings();
  if (settings.value && Array.isArray(r?.sites)) settings.value.sites = r.sites;
}

onMounted(load);
</script>

<style scoped>
.appupd-policy {
  width: 200px;
}

.appupd-hint {
  margin-top: 4px;
  color: var(--rmm-text-muted);
  font-size: var(--rmm-fs-xs);
}
</style>
