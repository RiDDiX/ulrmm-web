<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-dialog ref="dialogRef" aria-labelledby="pkg-title" @hide="onDialogHide">
    <q-card class="q-dialog-plugin" style="width: 90vw; max-width: 90vw">
      <DialogHeader
        title-id="pkg-title"
        title="Software catalog"
        subtitle="Installers and archives kept on the RMM server, and the baselines agents install from them"
      >
        <template #actions>
          <q-btn
            dense
            flat
            icon="refresh"
            :aria-label="REFRESH[tab].label"
            @click="refresh"
          >
            <q-tooltip>{{ REFRESH[tab].tip }}</q-tooltip>
          </q-btn>
        </template>
      </DialogHeader>
      <q-tabs
        v-model="tab"
        :no-caps="true"
        narrow-indicator
        align="left"
        indicator-color="primary"
        active-color="primary"
        :inline-label="true"
        :dense="true"
      >
        <q-tab name="packages" label="Packages" />
        <q-tab name="baselines" label="Baselines">
          <q-tooltip
            >Lists of software agents install after setup or through an
            automation policy</q-tooltip
          >
        </q-tab>
        <q-tab name="installs" label="Installs">
          <q-tooltip
            >The newest package installs you can see, with their
            result</q-tooltip
          >
        </q-tab>
      </q-tabs>
      <q-separator />
      <q-tab-panels
        v-model="tab"
        :animated="false"
        style="min-height: 65vh; max-height: 65vh"
      >
        <q-tab-panel name="packages" class="q-pa-sm">
          <q-table
            dense
            flat
            class="rmm-table"
            row-key="id"
            :rows="rows"
            :columns="columns"
            :virtual-scroll="true"
            hide-pagination
            :loading="loading"
            :pagination="{ rowsPerPage: 0 }"
            :style="{ maxHeight: '60vh' }"
          >
            <template #top>
              <div class="rmm-toolbar full-width">
                <q-btn
                  label="Upload package"
                  dense
                  unelevated
                  class="q-pl-sm q-pr-md"
                  :no-caps="true"
                  color="primary"
                  icon="upload"
                  @click="edit(null)"
                />
                <span class="rmm-muted text-caption">
                  Uploading and editing may ask for a 2FA code
                </span>
                <q-space />
                <span class="rmm-muted rmm-num">
                  {{ rows.length }}
                  {{ rows.length === 1 ? "package" : "packages" }}
                </span>
              </div>
            </template>
            <template #header-cell="props">
              <q-th :props="props">
                {{ props.col.label }}
                <q-tooltip v-if="HEADER_TIPS[props.col.name]">
                  {{ HEADER_TIPS[props.col.name] }}
                </q-tooltip>
              </q-th>
            </template>
            <template #no-data>
              <div
                v-if="!loading"
                class="full-width column flex-center q-gutter-sm q-py-md"
              >
                <template v-if="error">
                  <q-icon name="error_outline" color="negative" size="24px" />
                  <div>{{ error }}</div>
                </template>
                <EmptyState
                  v-else
                  class="full-width"
                  icon="inventory_2"
                  title="No packages yet"
                  text="Upload an installer to install it on agents."
                >
                  <q-btn
                    dense
                    outline
                    :no-caps="true"
                    color="primary"
                    icon="upload"
                    label="Upload package"
                    class="q-pl-sm q-pr-md"
                    @click="edit(null)"
                  />
                </EmptyState>
              </div>
            </template>
            <template #body-cell-name="props">
              <q-td :props="props">
                <div class="text-weight-medium">{{ props.value }}</div>
                <div
                  v-if="props.row.vendor || props.row.version"
                  class="text-caption rmm-muted"
                >
                  {{
                    [props.row.vendor, props.row.version]
                      .filter(Boolean)
                      .join(" · ")
                  }}
                </div>
              </q-td>
            </template>
            <template #body-cell-filename="props">
              <q-td :props="props">
                <span class="rmm-mono">{{ props.value }}</span>
                <span
                  v-if="props.row.file_missing"
                  class="rmm-pill rmm-pill--warning q-ml-sm"
                  >File missing
                  <q-tooltip
                    >The file is not on the server, e.g. after a restore from a
                    backup without large packages. Upload it again; installs of
                    this package fail until then.</q-tooltip
                  >
                </span>
              </q-td>
            </template>
            <template #body-cell-sha256="props">
              <q-td :props="props">
                <span class="rmm-mono">{{ props.value.slice(0, 12) }}…</span>
                <q-btn
                  dense
                  flat
                  round
                  size="sm"
                  icon="content_copy"
                  :aria-label="`Copy SHA-256 of ${props.row.name}`"
                  @click="copy(props.value)"
                >
                  <q-tooltip>Copy the full SHA-256 hash</q-tooltip>
                </q-btn>
              </q-td>
            </template>
            <template #body-cell-allow_unsigned="props">
              <q-td :props="props">
                <span v-if="props.value" class="rmm-pill rmm-pill--warning"
                  >Allowed</span
                >
                <span v-else class="rmm-muted">No</span>
                <q-tooltip>{{
                  props.value
                    ? "Installs even without a signature; tampered or untrusted signatures are still refused"
                    : "Installs only with a valid signature"
                }}</q-tooltip>
              </q-td>
            </template>
            <template #body-cell-default_args="props">
              <q-td :props="props">
                {{ props.value }}
                <q-tooltip v-if="props.value">{{ props.value }}</q-tooltip>
              </q-td>
            </template>
            <template #body-cell-actions="props">
              <q-td :props="props" auto-width>
                <q-btn
                  dense
                  flat
                  round
                  size="sm"
                  icon="edit"
                  :aria-label="`Edit ${props.row.name}`"
                  @click="edit(props.row)"
                >
                  <q-tooltip
                    >Edit name, arguments, timeout, detection and the other
                    settings</q-tooltip
                  >
                </q-btn>
                <q-btn
                  dense
                  flat
                  round
                  size="sm"
                  icon="delete"
                  color="negative"
                  :aria-label="`Delete ${props.row.name}`"
                  @click="remove(props.row)"
                >
                  <q-tooltip
                    >Delete the installer from the server; the history
                    stays</q-tooltip
                  >
                </q-btn>
              </q-td>
            </template>
          </q-table>
        </q-tab-panel>
        <q-tab-panel name="baselines" class="q-pa-sm">
          <BaselinesManager ref="baselines" />
        </q-tab-panel>
        <q-tab-panel name="installs" class="q-pa-none">
          <PackageInstalls ref="history" />
        </q-tab-panel>
      </q-tab-panels>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { onMounted, ref } from "vue";
import { useStore } from "vuex";
import { copyToClipboard, useDialogPluginComponent, useQuasar } from "quasar";
import DialogHeader from "@/components/ui/DialogHeader.vue";
import EmptyState from "@/components/ui/EmptyState.vue";
import PackageForm from "@/components/packages/PackageForm.vue";
import PackageInstalls from "@/components/packages/PackageInstalls.vue";
import BaselinesManager from "@/components/baselines/BaselinesManager.vue";
import { fetchPackages, removePackage } from "@/api/packages";
import { bytes2Human } from "@/utils/format";
import { notifyError, notifySuccess } from "@/utils/notify";
import { KIND_LABELS, PLAT_LABELS } from "@/utils/packages";

defineEmits([...useDialogPluginComponent.emits]);
const { dialogRef, onDialogHide } = useDialogPluginComponent();
const $q = useQuasar();
const store = useStore();

const tab = ref("packages");
const history = ref(null);
const baselines = ref(null);

const REFRESH = {
  packages: { label: "Refresh packages", tip: "Reload the package list" },
  baselines: { label: "Refresh baselines", tip: "Reload the baselines" },
  installs: {
    label: "Refresh install history",
    tip: "Reload the install history",
  },
};

function refresh() {
  if (tab.value === "packages") load();
  else if (tab.value === "baselines") baselines.value?.load();
  else history.value?.load();
}
const rows = ref([]);
const loading = ref(false);
const error = ref("");

const columns = [
  { name: "name", label: "Name", field: "name", align: "left", sortable: true },
  { name: "filename", label: "File", field: "filename", align: "left" },
  {
    name: "kind",
    label: "Kind",
    field: (r) => KIND_LABELS[r.kind] ?? r.kind,
    align: "left",
  },
  {
    name: "plat",
    label: "Platform",
    sortable: true,
    align: "left",
    field: (r) => PLAT_LABELS[r.plat] ?? r.plat,
  },
  {
    name: "size",
    label: "Size",
    align: "right",
    field: "size",
    format: (v) => bytes2Human(v),
    sortable: true,
  },
  { name: "sha256", label: "SHA-256", field: "sha256", align: "left" },
  {
    name: "allow_unsigned",
    label: "Unsigned",
    field: "allow_unsigned",
    align: "left",
  },
  {
    name: "default_args",
    label: "Arguments",
    // archives: the command, then its arguments
    field: (r) =>
      r.kind === "archive"
        ? [r.command, r.default_args].filter(Boolean).join(" ")
        : r.default_args,
    align: "left",
    classes: "rmm-ellipsis-td rmm-mono",
    style: "max-width: 240px",
  },
  {
    name: "timeout",
    label: "Timeout",
    field: "timeout",
    format: (v) => `${v} s`,
    align: "right",
  },
  {
    name: "uploaded",
    label: "Uploaded",
    field: (r) =>
      [r.created_by, r.created_time && store.getters.formatDate(r.created_time)]
        .filter(Boolean)
        .join(" · "),
    align: "left",
  },
  { name: "actions", label: "", field: "id", align: "right" },
];

const HEADER_TIPS = {
  kind: "Installer type, taken from the file extension",
  plat: "Only agents on this platform can install it",
  sha256: "Hash of the file; the agent checks it before installing",
  allow_unsigned: "Whether an installer without a signature may run",
  default_args:
    "Extra installer arguments for .exe and .msi; for archives the command and its arguments",
  timeout: "Longest time the download and install may take",
};

async function load() {
  loading.value = true;
  error.value = "";
  try {
    rows.value = await fetchPackages();
  } catch (e) {
    error.value =
      e?.response?.status === 403
        ? "Your role needs Manage Packages or Install Packages."
        : "The packages could not be loaded.";
  }
  loading.value = false;
}

function edit(pkg) {
  $q.dialog({ component: PackageForm, componentProps: { pkg } }).onOk(load);
}

function remove(pkg) {
  $q.dialog({
    title: `Delete ${pkg.name}?`,
    message:
      "The installer file is removed from the server. The install history keeps the package name. This cannot be undone.",
    cancel: { label: "Cancel", flat: true },
    ok: { label: "Delete", color: "negative" },
  }).onOk(async () => {
    try {
      await removePackage(pkg.id);
      notifySuccess(`${pkg.name} was deleted`);
    } catch {
      // toast from axios layer
    }
    load();
  });
}

function copy(text) {
  copyToClipboard(text)
    .then(() => notifySuccess("SHA-256 copied"))
    .catch(() => notifyError("Unable to copy to clipboard"));
}

onMounted(load);
</script>
