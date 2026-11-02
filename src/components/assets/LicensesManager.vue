<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <div>
    <SettingsPanelHeader
      title="Licenses"
      :count="rows.length"
      text="Software licenses with seats, expiry and the devices that use them. Keys are encrypted and shown only after a two-factor code."
    >
      <q-btn
        v-if="canEdit"
        unelevated
        no-caps
        color="primary"
        icon="add"
        label="Add license"
        @click="edit(null)"
      />
    </SettingsPanelHeader>
    <q-table
      dense
      flat
      class="rmm-table"
      :row-key="(r) => r.id"
      :rows="rows"
      :columns="columns"
      :loading="loading"
      v-sortable-headers
      :virtual-scroll="true"
      hide-pagination
      binary-state-sort
      v-model:pagination="pagination"
      :rows-per-page-options="[0]"
    >
      <template #loading>
        <q-inner-loading showing color="primary" />
      </template>

      <template #no-data>
        <div v-if="!loading" class="full-width">
          <EmptyState
            v-if="error"
            icon="error_outline"
            title="Unable to load licenses"
            :text="errorText"
          >
            <q-btn
              outline
              dense
              no-caps
              color="primary"
              label="Retry"
              @click="load"
            />
          </EmptyState>
          <EmptyState
            v-else
            icon="badge"
            title="No licenses yet"
            text="Add a license to track its seats, expiry and the devices that use it."
          />
        </div>
      </template>

      <template #body-cell-seats="scope">
        <q-td :props="scope">
          <span class="rmm-num"
            >{{ scope.row.assigned }} /
            {{ scope.row.seats ?? "unlimited" }}</span
          >
          <span
            v-if="scope.row.over_seats"
            class="rmm-pill rmm-pill--negative q-ml-xs"
            >Over seats</span
          >
        </q-td>
      </template>

      <template #body-cell-expires="scope">
        <q-td :props="scope">
          <span class="rmm-num">{{ scope.row.expires || "—" }}</span>
          <span
            v-if="expiryPill(scope.row.expires).text"
            class="rmm-pill q-ml-xs"
            :class="`rmm-pill--${expiryPill(scope.row.expires).tone}`"
            >{{ expiryPill(scope.row.expires).text }}</span
          >
        </q-td>
      </template>

      <template #body-cell-key="scope">
        <q-td :props="scope">
          <RevealSecret
            v-if="scope.row.key_set"
            :request="(config) => revealLicenseKey(scope.row.id, config)"
            :label="`key of ${scope.row.name}`"
          />
          <span v-else class="rmm-muted">none stored</span>
        </q-td>
      </template>

      <template #body-cell-actions="scope">
        <q-td :props="scope" auto-width>
          <template v-if="canEdit">
            <q-btn
              flat
              round
              dense
              size="sm"
              icon="edit"
              :aria-label="`Edit ${scope.row.name}`"
              @click="edit(scope.row)"
            >
              <q-tooltip>Edit</q-tooltip>
            </q-btn>
            <q-btn
              flat
              round
              dense
              size="sm"
              icon="delete"
              :aria-label="`Delete ${scope.row.name}`"
              @click="remove(scope.row)"
            >
              <q-tooltip>Delete</q-tooltip>
            </q-btn>
          </template>
        </q-td>
      </template>
    </q-table>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useQuasar, type QTableColumn } from "quasar";
import { fetchLicenses, removeLicense, revealLicenseKey } from "@/api/assets";
import { expiryPill } from "@/utils/assets";
import { notifySuccess } from "@/utils/notify";
import { sortableHeaders as vSortableHeaders } from "@/utils/sortableHeaders";
import EmptyState from "@/components/ui/EmptyState.vue";
import SettingsPanelHeader from "@/components/modals/coresettings/SettingsPanelHeader.vue";
import RevealSecret from "@/components/vault/RevealSecret.vue";
import LicenseForm from "@/components/assets/LicenseForm.vue";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type License = Record<string, any>;

const $q = useQuasar();
const rows = ref<License[]>([]);
const loading = ref(false);
const error = ref<{ response?: { status?: number } } | null>(null);
const pagination = ref({ rowsPerPage: 0, sortBy: null, descending: false });
// the server refuses what the role cannot do; hide the buttons after a 403
const canEdit = ref(true);

const errorText = computed(() =>
  error.value?.response?.status === 403
    ? "Your role cannot view licenses."
    : "Licenses could not be loaded.",
);

const columns: QTableColumn<License>[] = [
  { name: "name", label: "Name", field: "name", align: "left", sortable: true },
  {
    name: "vendor",
    label: "Vendor",
    field: (r) => r.vendor || "—",
    align: "left",
    sortable: true,
  },
  { name: "seats", label: "Seats used", field: "assigned", align: "left" },
  {
    name: "expires",
    label: "Expires",
    field: "expires",
    align: "left",
    sortable: true,
  },
  { name: "key", label: "Key", field: "key_set", align: "left" },
  { name: "actions", label: "", field: "id", align: "right" },
];

async function load() {
  loading.value = true;
  try {
    const r = await fetchLicenses();
    rows.value = Array.isArray(r) ? r : [];
    error.value = null;
  } catch (e) {
    error.value = e as typeof error.value;
  } finally {
    loading.value = false;
  }
}

function edit(license: License | null) {
  $q.dialog({ component: LicenseForm, componentProps: { license } }).onOk(load);
}

function remove(license: License) {
  $q.dialog({
    title: "Delete license",
    message: `Delete ${license.name}? Its stored key is deleted too.`,
    cancel: true,
    persistent: true,
  }).onOk(async () => {
    try {
      await removeLicense(license.id);
      notifySuccess(`${license.name} was deleted`);
      await load();
    } catch (e) {
      if ((e as { response?: { status?: number } })?.response?.status === 403)
        canEdit.value = false;
    }
  });
}

onMounted(load);
</script>
