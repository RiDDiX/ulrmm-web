<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<script setup>
import {
  computed,
  onActivated,
  onBeforeUnmount,
  onDeactivated,
  onMounted,
  ref,
} from "vue";
import { useQuasar } from "quasar";
import { useStore } from "vuex";
import NoDataPanel from "@/core/ui/NoDataPanel.vue";
import { endpoint } from "@/api/http";
import { serverErrors, stepUpCall } from "@/components/vault/stepUp";
import { fmtBytes, NO_VALUE } from "@/utils/format";
import { notifyError, notifySuccess } from "@/utils/notify";
import { ALERT_KINDS, originLabel, runStatus, syncState } from "./backups";

const STATES = [
  { value: "stale", label: "Stale" },
  { value: "not_ready", label: "Not ready" },
  { value: "error", label: "Settings refused" },
  { value: "pending", label: "Pending" },
  { value: "legacy", label: "Older agent" },
  { value: "pending_confirmation", label: "Held change" },
];

// the fleet answer says whether the internal listener is available
const emit = defineEmits(["internal"]);
const $q = useQuasar();
const store = useStore();
const formatDate = computed(() => store.getters.formatDate);
const api = endpoint("/imaging");
const rows = ref([]);
const total = ref(0);
const counts = ref({});
const loading = ref(false);
const error = ref("");
const search = ref("");
const state = ref("");
const busy = ref(null);
const pagination = ref({ page: 1, rowsPerPage: 25, rowsNumber: 0 });
// only the newest request writes the table
let generation = 0;

const when = (value) => (value ? formatDate.value(value) : NO_VALUE);
const columns = [
  { name: "hostname", label: "Device", field: "hostname", align: "left" },
  { name: "policies", label: "Policies", field: "policies", align: "left" },
  { name: "sync", label: "Settings", field: "sync", align: "left" },
  { name: "ready", label: "Readiness", field: "ready", align: "left" },
  {
    name: "last_verified_at",
    label: "Last verified point",
    field: "last_verified_at",
    align: "left",
    format: when,
  },
  {
    name: "next_run",
    label: "Next backup",
    field: "next_run",
    align: "left",
    format: when,
  },
  {
    name: "stored_bytes",
    label: "Stored",
    field: "stored_bytes",
    align: "right",
    format: fmtBytes,
  },
  {
    name: "alerts",
    label: "Alerts",
    field: "alerts",
    align: "left",
    format: (v) =>
      v.length
        ? v.map((kind) => ALERT_KINDS[kind] ?? kind).join(", ")
        : NO_VALUE,
  },
  { name: "run", label: "Run", field: "run", align: "left" },
  { name: "hold", label: "Held change", field: "hold", align: "left" },
];

async function load(
  page = pagination.value.page,
  rowsPerPage = pagination.value.rowsPerPage,
  quiet = false,
) {
  const mine = ++generation;
  if (!quiet) loading.value = true;
  try {
    const data = await api.get("/fleet/", {
      params: {
        limit: rowsPerPage,
        offset: (page - 1) * rowsPerPage,
        state: state.value || undefined,
        q: search.value || undefined,
      },
      silent: true,
    });
    if (mine !== generation) return;
    rows.value = data.rows;
    total.value = data.counts.all ?? data.total;
    emit("internal", !!data.internal);
    counts.value = data.counts;
    error.value = "";
    pagination.value = {
      ...pagination.value,
      page,
      rowsPerPage,
      rowsNumber: state.value ? (data.counts[state.value] ?? 0) : data.total,
    };
  } catch (e) {
    if (mine !== generation) return;
    // a failed background refresh keeps the rows and shows the error line
    if (!quiet) rows.value = [];
    error.value =
      e?.response?.status === 403
        ? "Your role cannot view backups."
        : "The backup state could not be loaded.";
  } finally {
    if (mine === generation) loading.value = false;
  }
}

const reload = () => load(1);
function setState(value) {
  state.value = state.value === value ? "" : value;
  reload();
}
const onRequest = ({ pagination: p }) => load(p.page, p.rowsPerPage);

// fleet rows carry no field changes; the dialog links to the device tab,
// whose hold banner lists them
const decision = ref(null);
const decide = (row, action) => (decision.value = { row, action });
async function send() {
  const { row, action } = decision.value;
  busy.value = row.agent_id;
  try {
    // confirming a change of hooks needs the step-up; a cancelled prompt
    // leaves the hold pending
    const done = await stepUpCall($q, (config) =>
      api.post(
        `/holds/${row.hold.id}/confirm/`,
        { action, proposed_hash: row.hold.proposed_hash },
        config,
      ),
    );
    if (done === null) return;
    notifySuccess(
      action === "confirm" ? "Held change confirmed" : "Held change rejected",
    );
    decision.value = null;
    await load();
  } catch (e) {
    notifyError(serverErrors(e).message);
    if (e?.response?.status === 409) {
      decision.value = null;
      await load();
    }
  } finally {
    busy.value = null;
  }
}

// polls only while its tab is shown; the Backups page keeps it alive
let timer = null;
const stopPoll = () => clearInterval(timer);
onActivated(() => {
  stopPoll();
  timer = setInterval(() => {
    if (!document.hidden && !loading.value && !busy.value)
      load(undefined, undefined, true);
  }, 30_000);
});
onDeactivated(stopPoll);
onBeforeUnmount(stopPoll);
onMounted(reload);
</script>

<template>
  <q-table
    dense
    flat
    bordered
    class="rmm-table backup-fleet"
    row-key="agent_id"
    :rows="rows"
    :columns="columns"
    :loading="loading"
    :rows-per-page-options="[25, 50, 100]"
    :pagination="pagination"
    @request="onRequest"
    @update:pagination="(p) => (pagination = { ...pagination, ...p })"
  >
    <template #top>
      <div class="rmm-toolbar full-width wrap items-center">
        <q-input
          v-model="search"
          dense
          outlined
          clearable
          debounce="300"
          label="Search"
          placeholder="Hostname"
          style="min-width: 240px"
          @update:model-value="reload"
        >
          <template #prepend><q-icon name="search" /></template>
        </q-input>
        <div
          class="row q-gutter-xs items-center"
          role="group"
          aria-label="State filter"
        >
          <q-chip
            clickable
            dense
            :outline="state !== ''"
            :color="state === '' ? 'primary' : undefined"
            :text-color="state === '' ? 'white' : undefined"
            :aria-pressed="state === ''"
            @click="setState('')"
            >All <span class="rmm-num q-ml-xs">{{ total }}</span></q-chip
          >
          <q-chip
            v-for="c in STATES"
            :key="c.value"
            clickable
            dense
            :outline="state !== c.value"
            :color="state === c.value ? 'primary' : undefined"
            :text-color="state === c.value ? 'white' : undefined"
            :aria-pressed="state === c.value"
            @click="setState(c.value)"
            >{{ c.label }}
            <span class="rmm-num q-ml-xs">{{
              counts[c.value] ?? 0
            }}</span></q-chip
          >
        </div>
        <q-space />
        <span v-if="error && rows.length" class="text-negative" role="alert">{{
          error
        }}</span>
        <q-btn
          flat
          dense
          no-caps
          icon="refresh"
          label="Refresh"
          :loading="loading"
          @click="reload"
        />
      </div>
    </template>

    <template #no-data>
      <NoDataPanel
        :loading="loading"
        :error="error"
        icon="backup"
        title="No devices"
        text="No devices match."
        @retry="reload"
      />
    </template>

    <template #body-cell-hostname="cell">
      <q-td :props="cell">
        <router-link
          class="backup-fleet__link"
          :to="{
            name: 'Agent',
            params: { agent_id: cell.row.agent_id },
            query: { tab: 'images' },
          }"
          >{{ cell.row.hostname || cell.row.agent_id }}</router-link
        >
        <div class="text-caption rmm-muted">
          {{ cell.row.client }} / {{ cell.row.site }}
        </div>
      </q-td>
    </template>

    <template #body-cell-policies="cell">
      <q-td :props="cell">
        <div v-for="p in cell.row.policies" :key="p.id">
          {{ originLabel(p) }}
        </div>
        <span v-if="!cell.row.policies.length" class="rmm-muted"
          >Global default</span
        >
      </q-td>
    </template>

    <template #body-cell-sync="cell">
      <q-td :props="cell">
        <span class="rmm-pill" :class="syncState(cell.row.sync).cls">{{
          syncState(cell.row.sync).label
        }}</span>
      </q-td>
    </template>

    <template #body-cell-ready="cell">
      <q-td :props="cell">
        <span
          class="rmm-pill"
          :class="cell.row.ready ? 'rmm-pill--positive' : 'rmm-pill--warning'"
          >{{ cell.row.ready ? "Ready" : "Not ready" }}</span
        >
        <div v-if="!cell.row.ready" class="text-caption rmm-muted">
          {{ cell.row.not_ready_reason }}
        </div>
      </q-td>
    </template>

    <template #body-cell-run="cell">
      <q-td :props="cell">
        <template v-if="cell.row.run">
          <span class="rmm-pill" :class="runStatus(cell.row.run.status).cls">{{
            runStatus(cell.row.run.status).label
          }}</span>
          <span
            v-if="cell.row.run.step"
            class="text-caption rmm-muted q-ml-xs"
            >{{ cell.row.run.step }}</span
          >
        </template>
        <span v-else class="rmm-muted">{{ NO_VALUE }}</span>
      </q-td>
    </template>

    <template #body-cell-hold="cell">
      <q-td :props="cell">
        <template v-if="cell.row.hold">
          <span class="rmm-pill rmm-pill--warning">Waiting</span>
          <template v-if="cell.row.can_manage">
            <q-btn
              flat
              dense
              no-caps
              size="sm"
              label="Confirm"
              :aria-label="`Confirm the held change of ${cell.row.hostname}`"
              :loading="busy === cell.row.agent_id"
              :disable="!!busy"
              @click="decide(cell.row, 'confirm')"
            />
            <q-btn
              flat
              dense
              no-caps
              size="sm"
              label="Reject"
              :aria-label="`Reject the held change of ${cell.row.hostname}`"
              :disable="!!busy"
              @click="decide(cell.row, 'reject')"
            />
          </template>
        </template>
        <span v-else class="rmm-muted">{{ NO_VALUE }}</span>
      </q-td>
    </template>
  </q-table>
  <q-dialog
    :model-value="!!decision"
    :persistent="!!busy"
    @update:model-value="decision = null"
  >
    <q-card v-if="decision" class="q-pa-md" style="width: 480px">
      <h3 class="text-h6">
        {{ decision.action === "confirm" ? "Confirm" : "Reject" }} the held
        change of {{ decision.row.hostname }}?
      </h3>
      <p>
        The
        <router-link
          class="rmm-link"
          :to="{
            name: 'Agent',
            params: { agent_id: decision.row.agent_id },
            query: { tab: 'images' },
          }"
          >Backups tab of the device</router-link
        >
        lists every setting this change moves.
      </p>
      <q-card-actions align="right">
        <q-btn
          flat
          no-caps
          label="Cancel"
          :disable="!!busy"
          @click="decision = null"
        />
        <q-btn
          unelevated
          no-caps
          :color="decision.action === 'confirm' ? 'primary' : 'negative'"
          :label="decision.action === 'confirm' ? 'Confirm' : 'Reject'"
          :loading="!!busy"
          @click="send"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<style scoped>
.backup-fleet {
  max-height: max(360px, calc(100vh - 230px));
}

.backup-fleet__link {
  color: var(--rmm-text);
  font-weight: 600;
  text-decoration: none;
}

.backup-fleet__link:hover,
.backup-fleet__link:focus-visible {
  text-decoration: underline;
}
</style>
