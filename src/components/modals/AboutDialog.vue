<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-card class="rmm-dialog--md about-dialog" aria-labelledby="about-title">
    <DialogHeader
      title="About UniversalLocal RMM"
      subtitle="Versions, changes and how to support the project"
      title-id="about-title"
    />

    <q-card-section class="about-support">
      <div class="about-support__copy">
        <div class="text-subtitle1">Support UniversalLocal RMM</div>
        <div class="text-caption">
          UniversalLocal RMM is built and maintained by RiDDiX. If it helps you,
          a donation keeps it going. Companies can sponsor through GitHub
          Sponsors to get their feature requests prioritised.
        </div>
      </div>
      <div class="about-support__links">
        <q-btn
          v-for="link in donationLinks"
          :key="link.url"
          unelevated
          no-caps
          :color="link.color"
          :icon="link.icon"
          :label="link.label"
          :href="link.url"
          target="_blank"
          rel="noopener noreferrer"
        />
      </div>
    </q-card-section>

    <q-separator />

    <q-card-section>
      <div class="text-subtitle2 q-mb-sm">Versions</div>
      <q-markup-table flat dense bordered class="about-versions">
        <tbody>
          <tr v-for="c in components" :key="c.key">
            <td>{{ c.name }}</td>
            <td class="about-version">{{ c.version || "unknown" }}</td>
          </tr>
        </tbody>
      </q-markup-table>
    </q-card-section>

    <q-card-section class="q-pt-none">
      <div class="text-subtitle2 q-mb-sm">Changelog</div>
      <q-tabs
        v-model="tab"
        dense
        no-caps
        align="left"
        active-color="primary"
        indicator-color="primary"
      >
        <q-tab
          v-for="c in components"
          :key="c.key"
          :name="c.key"
          :label="c.name"
        />
      </q-tabs>
      <q-separator />
      <q-scroll-area class="about-changelog">
        <q-inner-loading :showing="loading" />
        <div v-if="!loading && !current.changelog.length" class="q-pa-md">
          No changelog found for this component.
        </div>
        <div
          v-for="r in visibleReleases"
          :key="r.version"
          class="about-release q-px-sm q-py-sm"
        >
          <div class="text-weight-medium">
            {{ r.version }}
            <span v-if="r.date" class="text-caption q-ml-sm">{{ r.date }}</span>
          </div>
          <ul class="q-my-xs">
            <li v-for="(item, i) in r.items" :key="i">{{ item }}</li>
          </ul>
        </div>
        <div v-if="current.changelog.length > shown" class="q-pa-sm">
          <q-btn
            flat
            dense
            no-caps
            color="primary"
            label="Show all releases"
            @click="shown = current.changelog.length"
          />
        </div>
      </q-scroll-area>
    </q-card-section>

    <q-separator />
    <q-card-section class="text-caption">
      UniversalLocal RMM, made by RiDDiX, licensed under FSL-1.1-ALv2 (<a
        class="rmm-link"
        href="/licenses/LICENSE.txt"
        target="_blank"
        rel="noopener noreferrer"
        >license text</a
      >). Third-party components keep their own licenses:
      <a
        class="rmm-link"
        href="/licenses/THIRD_PARTY_NOTICES.txt"
        target="_blank"
        rel="noopener noreferrer"
        >Open-source licenses</a
      >.
    </q-card-section>
  </q-card>
</template>

<script setup>
import { computed, onMounted, ref, watch } from "vue";
import DialogHeader from "@/components/ui/DialogHeader.vue";
import { fetchAbout } from "@/api/core";
import { parseChangelog } from "@/utils/changelog";
import { version as webVersion } from "../../../package.json";
import webChangelog from "../../../CHANGELOG.md?raw";

// fixed on purpose: these do not follow the branding settings
const donationLinks = [
  {
    label: "GitHub Sponsors",
    url: "https://github.com/sponsors/RiDDiX",
    icon: "favorite",
    color: "pink-7",
  },
  {
    label: "Ko-fi",
    url: "https://ko-fi.com/riddix",
    icon: "local_cafe",
    color: "blue-8",
  },
  {
    label: "PayPal",
    url: "https://www.paypal.me/RiDDiX93",
    icon: "payments",
    color: "indigo-8",
  },
];

const PAGE = 10;
const loading = ref(true);
const tab = ref("server");
const shown = ref(PAGE);
const server = ref([]);

const web = {
  key: "web",
  name: "Web interface",
  version: webVersion,
  changelog: parseChangelog(webChangelog),
};

const components = computed(() => {
  const list = [...server.value];
  const at = list.findIndex((c) => c.key === "server");
  list.splice(at + 1, 0, web);
  return list.length > 1 ? list : [web];
});

const current = computed(
  () =>
    components.value.find((c) => c.key === tab.value) || {
      changelog: [],
    },
);
const visibleReleases = computed(() =>
  current.value.changelog.slice(0, shown.value),
);

watch(tab, () => (shown.value = PAGE));

onMounted(async () => {
  try {
    const data = await fetchAbout();
    server.value = data.components || [];
  } catch {
    tab.value = "web";
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped>
.about-support {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
}

.about-support__copy {
  flex: 1 1 280px;
}

.about-support__links {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.about-version {
  font-family: var(--rmm-mono);
}

.about-changelog {
  height: 40vh;
}

.about-release + .about-release {
  border-top: 1px solid var(--rmm-border);
}
</style>
