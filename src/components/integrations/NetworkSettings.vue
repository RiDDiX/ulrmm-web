<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <div>
    <SettingsPanelHeader
      title="Network"
      text="Reads VLANs, clients and switch ports from UniFi and OPNsense. Used by the device Network card and Discovery."
    >
      <q-btn
        flat
        no-caps
        icon="sync"
        label="Sync now"
        :loading="syncing === 'all'"
        :disable="!ready || !!syncing"
        @click="sync()"
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
        v-for="sec in sections"
        :key="sec.key"
        flat
        bordered
        class="q-mb-md"
      >
        <q-card-section class="row items-center q-pb-none">
          <div class="text-subtitle2">{{ sec.title }}</div>
          <q-space />
          <q-toggle v-model="forms[sec.key].enabled" label="Enabled" />
        </q-card-section>
        <q-card-section class="q-pt-xs rmm-muted text-caption">
          {{ sec.help }}
        </q-card-section>
        <q-card-section class="q-gutter-y-sm">
          <q-input
            v-model="forms[sec.key].url"
            outlined
            dense
            label="URL"
            hint="https only, e.g. https://192.168.1.1. If you change it, enter the secrets again"
            :error="!!errs[sec.key]?.url"
            :error-message="errs[sec.key]?.url"
          />
          <q-input
            v-if="sec.key === 'unifi'"
            v-model="forms.unifi.site"
            outlined
            dense
            label="Site"
            hint="UniFi site name, usually default"
            :error="!!errs.unifi.site"
            :error-message="errs.unifi.site"
          />
          <q-input
            v-if="sec.key === 'unifi'"
            v-model="forms.unifi.username"
            outlined
            dense
            label="Username"
            hint="A local read-only account; used with the password"
            autocomplete="off"
            :error="!!errs.unifi.username"
            :error-message="errs.unifi.username"
          />
          <template v-for="f in sec.secrets" :key="f.key">
            <SecretInput
              v-model="forms[sec.key][f.key]"
              :label="f.label"
              v-model:clear="forms[sec.key][`${f.key}_clear`]"
              :stored="!!saved[sec.key]?.[`${f.key}_set`]"
              :error="errs[sec.key]?.[f.key] ? true : undefined"
              :error-message="errs[sec.key]?.[f.key]"
            />
          </template>
          <q-toggle
            v-model="forms[sec.key].verify_tls"
            label="Verify the TLS certificate"
          />
        </q-card-section>
        <q-card-section class="row items-center q-gutter-sm">
          <q-btn
            outline
            dense
            no-caps
            class="q-px-sm"
            color="primary"
            label="Test and sync"
            :loading="!!syncing"
            :disable="!!syncing"
            @click="sync(sec.key)"
          >
            <q-tooltip
              >Syncs every enabled target with the saved settings, save
              first</q-tooltip
            >
          </q-btn>
          <span class="text-caption rmm-muted">
            <template v-if="saved[sec.key]?.last_sync"
              >Last sync {{ relativeTime(saved[sec.key].last_sync) }}</template
            >
            <template v-else>Never synced</template>
          </span>
          <span
            v-if="saved[sec.key]?.last_error"
            class="text-caption text-negative"
            >{{ saved[sec.key].last_error }}</span
          >
        </q-card-section>
        <q-card-section v-if="results[sec.key]" class="q-pt-none">
          <q-banner
            dense
            rounded
            :class="results[sec.key].ok ? 'bg-info' : 'rmm-banner-warning'"
            role="status"
          >
            {{ results[sec.key].text }}
          </q-banner>
        </q-card-section>
      </q-card>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import SettingsPanelHeader from "@/components/modals/coresettings/SettingsPanelHeader.vue";
import SecretInput from "@/components/ui/SecretInput.vue";
import {
  fetchIntegrationSettings,
  saveIntegrationSettings,
  syncIntegrations,
} from "@/api/integrations";
import { relativeTime } from "@/utils/format";
import { notifyError, notifySuccess } from "@/utils/notify";
import { SILENT_REQUEST_CONFIG } from "@/constants/constants";

const sections = [
  {
    key: "unifi",
    title: "UniFi",
    help: "UniFi OS console or Network application. Reads clients, VLANs and the port tables of switches and access points.",
    secrets: [
      { key: "password", label: "Password" },
      { key: "api_key", label: "API key (instead of username and password)" },
    ],
  },
  {
    key: "opnsense",
    title: "OPNsense",
    help: "Create an API key under System > Access > Users with read access to DHCP, interfaces and diagnostics. Reads DHCP leases, VLANs and the ARP table.",
    secrets: [
      { key: "api_key", label: "API key" },
      { key: "api_secret", label: "API secret" },
    ],
  },
];

const blank = () => ({
  enabled: false,
  url: "",
  site: "default",
  username: "",
  verify_tls: true,
  password: "",
  api_key: "",
  api_secret: "",
  password_clear: false,
  api_key_clear: false,
  api_secret_clear: false,
});

const saved = ref({});
const forms = reactive({ unifi: blank(), opnsense: blank() });
const results = reactive({});
// 400 {"unifi": {"password": ["text"]}} -> errs.unifi.password
const errs = reactive({ unifi: {}, opnsense: {} });
const loading = ref(false);
const saving = ref(false);
const syncing = ref("");
const error = ref("");
const ready = computed(() => !loading.value && !error.value);

async function load() {
  loading.value = true;
  error.value = "";
  try {
    const data = (await fetchIntegrationSettings()) || {};
    saved.value = { unifi: data.unifi || {}, opnsense: data.opnsense || {} };
    for (const key of ["unifi", "opnsense"]) {
      Object.assign(forms[key], blank(), saved.value[key], {
        password: "",
        api_key: "",
        api_secret: "",
      });
    }
  } catch (e) {
    error.value =
      e?.response?.status === 403
        ? "Your role cannot edit these settings."
        : "The network settings could not be loaded.";
  }
  loading.value = false;
}

// write-only secrets are sent only when typed or cleared
function payloadOf(key) {
  const f = forms[key];
  const out = {
    enabled: f.enabled,
    url: f.url.trim(),
    verify_tls: f.verify_tls,
  };
  if (key === "unifi") {
    out.site = f.site.trim() || "default";
    out.username = f.username.trim();
  }
  for (const s of sections.find((x) => x.key === key).secrets) {
    if (f[s.key]) out[s.key] = f[s.key];
    else if (f[`${s.key}_clear`]) out[s.key] = null;
  }
  return out;
}

async function save() {
  saving.value = true;
  errs.unifi = {};
  errs.opnsense = {};
  try {
    await saveIntegrationSettings(
      { unifi: payloadOf("unifi"), opnsense: payloadOf("opnsense") },
      SILENT_REQUEST_CONFIG,
    );
    notifySuccess("Network settings saved");
    await load();
  } catch (e) {
    const data = e?.response?.data;
    // fields without an input of their own (e.g. missing credentials) go
    // into the toast
    const loose = [];
    for (const sec of sections) {
      const atField = ["url", ...sec.secrets.map((s) => s.key)];
      if (sec.key === "unifi") atField.push("site", "username");
      for (const [field, v] of Object.entries(data?.[sec.key] ?? {})) {
        const text = String(Array.isArray(v) ? v[0] : v);
        if (atField.includes(field)) errs[sec.key][field] = text;
        else loose.push(`${sec.title}: ${text}`);
      }
    }
    const atFields =
      Object.keys(errs.unifi).length + Object.keys(errs.opnsense).length;
    if (loose.length) notifyError(loose.join(" "));
    else if (!atFields) notifyError("The network settings could not be saved.");
  }
  saving.value = false;
}

function describe(r) {
  if (!r) return { ok: false, text: "Not enabled, nothing was synced." };
  if (!r.ok) return { ok: false, text: String(r.error || "Failed") };
  return { ok: true, text: `${r.clients ?? 0} clients, ${r.vlans ?? 0} VLANs` };
}

// the response carries one result per enabled target
async function sync(key) {
  syncing.value = key || "all";
  try {
    const { results: found = {} } = await syncIntegrations();
    for (const k of ["unifi", "opnsense"])
      if (key ? k === key : found[k]) results[k] = describe(found[k]);
    notifySuccess("Sync finished");
  } catch {
    // the error toast comes from the axios boot
  }
  syncing.value = "";
  load();
}

onMounted(load);
</script>
