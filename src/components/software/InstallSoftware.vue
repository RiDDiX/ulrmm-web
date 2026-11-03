<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-dialog ref="dialogRef" :aria-labelledby="titleId" @hide="onDialogHide">
    <q-card class="q-dialog-plugin rmm-dialog--lg">
      <DialogHeader
        title="Install software"
        :title-id="titleId"
        subtitle="Packages from the Chocolatey community repository and winget"
      />
      <q-card-section>
        <q-table
          class="remote-bg-tbl-sticky rmm-table"
          :rows="rows"
          v-bind="tableLook"
          :hide-bottom="rows.length > 0"
          :columns="columns"
          :row-key="(r) => `${r.source}|${r.id}`"
          v-model:pagination="pagination"
          table-class="table-bgcolor"
          :loading="loading"
          :rows-per-page-options="[0]"
        >
          <template #top>
            <div class="full-width">
              <div class="row items-center q-gutter-sm">
                <q-btn-toggle
                  v-model="source"
                  :options="SOURCE_OPTIONS"
                  dense
                  no-caps
                  unelevated
                  toggle-color="primary"
                  padding="3px 10px"
                  role="group"
                  aria-label="Package source"
                />
                <q-input
                  v-model="search"
                  class="install-software__search"
                  placeholder="Search packages"
                  aria-label="Search packages"
                  maxlength="100"
                  debounce="300"
                  outlined
                  dense
                  clearable
                >
                  <template #prepend>
                    <q-icon name="search" class="rmm-muted" />
                  </template>
                </q-input>
              </div>
              <div
                v-if="truncated || wingetNote"
                class="install-software__notes text-caption"
              >
                <div v-if="truncated" class="rmm-muted">
                  Showing {{ rows.length }} of {{ total }}, search to narrow
                </div>
                <div
                  v-if="wingetNote"
                  :class="wingetNote.warn ? 'text-warning' : 'rmm-muted'"
                  :title="wingetNote.title"
                  role="status"
                >
                  {{ wingetNote.text }}
                </div>
              </div>
            </div>
          </template>
          <template #loading>
            <q-inner-loading showing color="primary" />
          </template>
          <template #no-data>
            <div v-if="!loading" class="full-width text-center rmm-muted">
              {{
                search
                  ? "No packages match your search"
                  : "No packages in this catalog"
              }}
            </div>
          </template>
          <template #body="scope">
            <q-tr :props="scope">
              <q-td auto-width>
                <q-btn
                  icon="add"
                  color="primary"
                  :aria-label="`Install ${scope.row.name}`"
                  round
                  flat
                  dense
                  @click="installSoftware(scope.row)"
                >
                  <q-tooltip
                    >Install {{ scope.row.name }} on this agent</q-tooltip
                  >
                </q-btn>
              </q-td>
              <q-td>
                <a
                  :href="packageUrl(scope.row)"
                  target="_blank"
                  rel="noopener"
                  class="rmm-link"
                  >{{ scope.row.name }}</a
                >
                <q-tooltip>{{
                  scope.row.source === "winget"
                    ? "Open the manifest in the winget-pkgs repository"
                    : "Open the package page on chocolatey.org"
                }}</q-tooltip>
              </q-td>
              <q-td class="rmm-mono">{{ scope.row.id }}</q-td>
              <q-td :class="scope.row.version ? 'rmm-mono' : 'rmm-muted'">{{
                scope.row.version || "—"
              }}</q-td>
              <q-td>
                <span
                  class="rmm-pill"
                  :class="
                    scope.row.source === 'winget'
                      ? 'rmm-pill--info'
                      : 'rmm-pill--neutral'
                  "
                  >{{
                    SOURCE_LABELS[scope.row.source] ?? scope.row.source
                  }}</span
                >
              </q-td>
            </q-tr>
          </template>
        </q-table>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { computed, getCurrentInstance, ref, watch } from "vue";
import { useDialogPluginComponent, useQuasar } from "quasar";
import DialogHeader from "@/components/ui/DialogHeader.vue";
import { fetchSoftwareCatalog, installAgentSoftware } from "@/api/software";
import { relativeTime } from "@/utils/format";
import { notifySuccess } from "@/utils/notify";

const props = defineProps({ agent_id: null });
defineEmits([...useDialogPluginComponent.emits]);

const { dialogRef, onDialogHide } = useDialogPluginComponent();
const $q = useQuasar();
const titleId = `install-software-title-${getCurrentInstance()?.uid}`;

const SOURCE_LABELS = { choco: "Chocolatey", winget: "Winget" };
const SOURCE_OPTIONS = [
  { value: "all", label: "All" },
  { value: "choco", label: "Chocolatey" },
  { value: "winget", label: "Winget" },
];
const SOURCE_KEY = "rmm-install-software-source";

const columns = [
  { name: "install", align: "left", label: "Install", sortable: false },
  { name: "name", align: "left", label: "Name", field: "name", sortable: true },
  { name: "id", align: "left", label: "Id", field: "id", sortable: true },
  { name: "version", align: "left", label: "Version", field: "version" },
  { name: "source", align: "left", label: "Source", field: "source" },
];

function storedSource() {
  try {
    const v = localStorage.getItem(SOURCE_KEY);
    return SOURCE_OPTIONS.some((o) => o.value === v) ? v : "all";
  } catch {
    return "all";
  }
}

const source = ref(storedSource());
const search = ref("");
const rows = ref([]);
const total = ref(0);
const truncated = ref(false);
const winget = ref(null);
const loading = ref(false);
// the server orders by relevance; a header click still sorts locally
const pagination = ref({ rowsPerPage: 0, sortBy: null, descending: false });
const tableLook = {
  bordered: true,
  "binary-state-sort": true,
  dense: true,
  flat: true,
  "virtual-scroll": true,
};

const wingetNote = computed(() => {
  const w = winget.value;
  if (!w || source.value === "choco") return null;
  if (w.error)
    return {
      warn: true,
      text: `winget catalog unavailable: ${w.error}${w.count && w.updated ? ` (showing the one from ${relativeTime(w.updated)})` : ""}`,
      title: w.checked ? `Last checked ${relativeTime(w.checked)}` : "",
    };
  if (!w.count)
    return {
      warn: true,
      text: "The winget catalog has not been downloaded yet, try again in a few minutes",
      title: "",
    };
  return {
    warn: false,
    text: `winget catalog from ${relativeTime(w.updated)}`,
    title: w.checked ? `Last checked ${relativeTime(w.checked)}` : "",
  };
});

let seq = 0;
async function load() {
  const mine = ++seq;
  loading.value = true;
  try {
    const reply = await fetchSoftwareCatalog({
      source: source.value,
      search: (search.value || "").trim(),
    });
    if (mine !== seq) return;
    rows.value = Object.freeze(reply.rows ?? []);
    total.value = reply.total ?? rows.value.length;
    truncated.value = !!reply.truncated;
    winget.value = reply.winget ?? null;
  } catch (e) {
    if (mine === seq) rows.value = [];
    console.error(e);
  } finally {
    if (mine === seq) loading.value = false;
  }
}

watch(source, (v) => {
  try {
    localStorage.setItem(SOURCE_KEY, v);
  } catch {
    // private window: keep it for this dialog only
  }
});
watch([source, search], load, { immediate: true });

function packageUrl(row) {
  if (row.source === "winget") {
    const path = row.id.split(".").map(encodeURIComponent).join("/");
    return `https://github.com/microsoft/winget-pkgs/tree/master/manifests/${row.id[0].toLowerCase()}/${path}`;
  }
  return `https://community.chocolatey.org/packages/${encodeURIComponent(row.id)}`;
}

const TOAST_MS = 5000;

async function runInstall(row) {
  $q.loading.show();
  try {
    const result = await installAgentSoftware(props.agent_id, {
      name: row.id,
      source: row.source,
    });
    onDialogHide();
    notifySuccess(result, TOAST_MS);
  } catch (e) {
    console.error(e);
  } finally {
    $q.loading.hide();
  }
}

function installSoftware(row) {
  const label = SOURCE_LABELS[row.source] ?? row.source;
  const what = row.name === row.id ? row.id : `${row.name} (${row.id})`;
  $q.dialog({
    title: `Install ${what} from ${label}?`,
    cancel: true,
    persistent: true,
    ok: "Install",
  }).onOk(() => runInstall(row));
}
</script>

<style scoped>
.install-software__search {
  width: min(280px, 60vw);
}

.install-software__notes {
  margin-top: 6px;
}
</style>
