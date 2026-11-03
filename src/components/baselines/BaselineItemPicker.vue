<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <div class="row q-col-gutter-sm items-start">
    <q-select
      v-model="source"
      class="col-12 col-sm-3"
      :options="sourceOptions"
      emit-value
      map-options
      dense
      outlined
      options-dense
      label="Source"
    />
    <div class="col-12 col-sm-9">
      <q-select
        v-if="source === 'winget' || source === 'choco'"
        :key="source"
        :model-value="null"
        :options="catalog"
        use-input
        hide-selected
        input-debounce="300"
        dense
        outlined
        options-dense
        :label="`Search ${SOURCE_META[source].label}`"
        :hint="catalogHint"
        :loading="searching"
        @filter="searchCatalog"
        @update:model-value="pickCatalog"
      >
        <template #option="scope">
          <q-item v-bind="scope.itemProps">
            <q-item-section>
              <q-item-label>{{ scope.opt.name }}</q-item-label>
              <q-item-label caption class="rmm-mono">{{
                scope.opt.id
              }}</q-item-label>
            </q-item-section>
            <q-item-section v-if="scope.opt.version" side>
              {{ scope.opt.version }}
            </q-item-section>
          </q-item>
        </template>
        <template #no-option>
          <q-item>
            <q-item-section class="rmm-muted">{{ noMatch }}</q-item-section>
          </q-item>
        </template>
      </q-select>
      <q-select
        v-else-if="source === 'package'"
        :model-value="null"
        :options="packageOptions"
        emit-value
        map-options
        dense
        outlined
        options-dense
        label="Hosted package"
        :hint="
          packagesError ||
          (packageOptions.length
            ? 'Packages and archives of the catalog for this platform'
            : 'No package for this platform in the catalog yet')
        "
        @update:model-value="pickPackage"
      />
      <div v-else class="row no-wrap items-start q-gutter-x-sm">
        <q-input
          v-model="linuxName"
          class="col"
          label="Package name"
          hint="As apt-get, dnf, zypper or pacman know it, e.g. htop"
          input-class="rmm-mono"
          maxlength="255"
          dense
          outlined
          :error="!!linuxError"
          :error-message="linuxError"
          @keydown.enter.prevent="addLinux"
        />
        <q-btn
          unelevated
          no-caps
          color="primary"
          label="Add"
          class="q-mt-xs"
          @click="addLinux"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// Adds one item to a baseline: a winget or Chocolatey catalog entry, a
// hosted package or a Linux package name.
import { computed, onMounted, ref, watch } from "vue";
import { fetchSoftwareCatalog } from "@/api/software";
import { fetchPackages } from "@/api/packages";
import {
  LINUX_PKG_RE,
  SOURCE_META,
  sourcesFor,
  type BaselineItem,
  type BaselineSource,
  type Plat,
} from "@/utils/baselines";

type CatalogRow = {
  source: string;
  id: string;
  name: string;
  version?: string;
};
type Package = { id: number; name: string; kind: string; plat: string };

const props = defineProps<{ plat: Plat }>();
const emit = defineEmits<{ add: [BaselineItem] }>();

const sourceOptions = computed(() =>
  sourcesFor(props.plat).map((s) => ({
    value: s,
    label: SOURCE_META[s].label,
  })),
);
const source = ref<BaselineSource>(sourcesFor(props.plat)[0]);
watch(
  () => props.plat,
  (plat) => {
    if (!sourcesFor(plat).includes(source.value))
      source.value = sourcesFor(plat)[0];
  },
);

const catalog = ref<CatalogRow[]>([]);
const searching = ref(false);
const noMatch = ref("Type at least two characters");
const catalogHint = ref("");
let seq = 0;

function searchCatalog(
  value: string,
  update: (fn: () => void) => void,
  abort: () => void,
) {
  const search = value.trim();
  if (search.length < 2) {
    update(() => {
      catalog.value = [];
      noMatch.value = "Type at least two characters";
    });
    return;
  }
  const mine = ++seq;
  searching.value = true;
  fetchSoftwareCatalog({ source: source.value, search })
    .then((reply: { rows?: CatalogRow[]; truncated?: boolean }) => {
      if (mine !== seq) return abort();
      update(() => {
        catalog.value = (reply.rows ?? []).filter(
          (r) => r.source === source.value,
        );
        noMatch.value = "Nothing found";
        catalogHint.value = reply.truncated
          ? "Only the best matches are shown; type more to narrow it down"
          : "";
      });
    })
    .catch(() => {
      if (mine !== seq) return abort();
      update(() => {
        catalog.value = [];
        noMatch.value = "The catalog could not be searched";
      });
    })
    .finally(() => {
      if (mine === seq) searching.value = false;
    });
}

function pickCatalog(row: CatalogRow | null) {
  if (!row) return;
  emit("add", {
    source: source.value,
    ref: row.id,
    name: row.name || row.id,
    detection: null,
  });
}

const packages = ref<Package[]>([]);
const packagesError = ref("");
const packageOptions = computed(() =>
  packages.value
    .filter((p) => p.plat === props.plat)
    .map((p) => ({ value: p.id, label: `${p.name} (${p.kind})` })),
);

function pickPackage(id: number | null) {
  const pkg = packages.value.find((p) => p.id === id);
  if (!pkg) return;
  emit("add", {
    source: "package",
    ref: String(pkg.id),
    name: pkg.name,
    detection: null,
  });
}

const linuxName = ref("");
const linuxError = ref("");

function addLinux() {
  const name = linuxName.value.trim();
  linuxError.value = LINUX_PKG_RE.test(name)
    ? ""
    : "Letters, digits and . + - _ @ : only, starting with a letter or digit";
  if (linuxError.value) return;
  emit("add", { source: "linux_pkg", ref: name, name, detection: null });
  linuxName.value = "";
}

onMounted(async () => {
  try {
    packages.value = await fetchPackages();
  } catch {
    packagesError.value = "The hosted packages could not be loaded";
  }
});
</script>
