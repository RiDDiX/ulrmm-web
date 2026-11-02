<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-table
    dense
    flat
    bordered
    class="rmm-table trust-matrix"
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
          aria-label="Status filter"
        >
          <q-chip
            clickable
            dense
            :outline="status !== ''"
            :color="status === '' ? 'primary' : undefined"
            :text-color="status === '' ? 'white' : undefined"
            :aria-pressed="status === ''"
            @click="setStatus('')"
            >All <span class="rmm-num q-ml-xs">{{ total }}</span></q-chip
          >
          <q-chip
            v-for="c in statusChips"
            :key="c.value"
            clickable
            dense
            :outline="status !== c.value"
            :color="status === c.value ? 'primary' : undefined"
            :text-color="status === c.value ? 'white' : undefined"
            :aria-pressed="status === c.value"
            @click="setStatus(c.value)"
            >{{ c.label }}
            <span class="rmm-num q-ml-xs">{{ c.count }}</span></q-chip
          >
        </div>
        <q-space />
        <span v-if="pinSeq !== null" class="rmm-muted" role="status"
          >Pin document <span class="rmm-num">{{ pinSeq }}</span></span
        >
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
        icon="verified_user"
        title="No agents"
        :text="
          search || status
            ? 'Nothing matches these filters.'
            : 'Agents appear here once they have checked in.'
        "
        @retry="reload"
      />
    </template>

    <template #body-cell-hostname="cell">
      <q-td :props="cell">
        <router-link
          class="trust-matrix__link"
          :to="{ name: 'Agent', params: { agent_id: cell.row.agent_id } }"
          >{{ cell.row.hostname || cell.row.agent_id }}</router-link
        >
        <div class="text-caption rmm-muted">
          {{ cell.row.client }} / {{ cell.row.site }}
        </div>
      </q-td>
    </template>

    <template #body-cell-status="cell">
      <q-td :props="cell">
        <span class="rmm-pill" :class="trustStatus(cell.row.status).cls">
          <q-icon
            v-if="trustStatus(cell.row.status).icon"
            :name="trustStatus(cell.row.status).icon"
            size="14px"
            class="q-mr-xs trust-pill__icon"
          />{{ trustStatus(cell.row.status).label }}
        </span>
      </q-td>
    </template>

    <template #body-cell-fingerprint="cell">
      <q-td :props="cell">
        <template v-if="cell.row.fingerprint">
          <span class="rmm-mono" :title="cell.row.fingerprint">{{
            shortFp(cell.row.fingerprint)
          }}</span>
          <q-btn
            dense
            flat
            round
            size="sm"
            icon="content_copy"
            :aria-label="`Copy the fingerprint of ${cell.row.hostname}`"
            @click="copyOutput(cell.row.fingerprint)"
          />
        </template>
        <span v-else class="rmm-muted">—</span>
      </q-td>
    </template>

    <template #body-cell-pin="cell">
      <q-td :props="cell">
        <span
          class="rmm-pill"
          :class="
            cell.row.pin_current ? 'rmm-pill--positive' : 'rmm-pill--warning'
          "
          >{{
            cell.row.pin_current ? "current" : `behind, seq ${cell.row.pin_seq}`
          }}</span
        >
      </q-td>
    </template>

    <template #body-cell-countdown="cell">
      <q-td
        :props="cell"
        :class="{
          'text-negative':
            cell.row.countdown_s !== null && cell.row.countdown_s < 0,
        }"
      >
        {{ countdownText(cell.row.countdown_s) }}
      </q-td>
    </template>

    <template #body-cell-identity="cell">
      <q-td :props="cell">
        <span
          class="rmm-pill"
          :class="identityState(cell.row.identity_state).cls"
          >{{ identityState(cell.row.identity_state).label }}</span
        >
      </q-td>
    </template>

    <template #body-cell-keystore="cell">
      <q-td :props="cell">
        <span
          :class="
            keyStore(cell.row.keystore).cls
              ? ['rmm-pill', keyStore(cell.row.keystore).cls]
              : 'rmm-muted'
          "
          :title="keyStore(cell.row.keystore).tip"
          >{{ keyStore(cell.row.keystore).label }}</span
        >
      </q-td>
    </template>

    <template #body-cell-actions="cell">
      <q-td :props="cell" class="text-right">
        <q-btn
          dense
          flat
          round
          size="sm"
          icon="more_vert"
          :aria-label="`Actions for ${cell.row.hostname}`"
          :loading="busy === cell.row.agent_id"
          :disable="!!busy"
        >
          <q-menu auto-close>
            <q-list dense style="min-width: 200px">
              <q-item
                clickable
                :to="{ name: 'Agent', params: { agent_id: cell.row.agent_id } }"
              >
                <q-item-section avatar
                  ><q-icon name="computer" size="xs"
                /></q-item-section>
                <q-item-section>Open device</q-item-section>
              </q-item>
              <q-separator />
              <q-item
                v-if="cell.row.identity_state === 'active'"
                clickable
                @click="confirmQuarantine(cell.row)"
              >
                <q-item-section avatar
                  ><q-icon name="gpp_bad" size="xs" color="negative"
                /></q-item-section>
                <q-item-section>Quarantine</q-item-section>
              </q-item>
              <q-item
                v-if="cell.row.identity_state === 'quarantined'"
                clickable
                @click="confirmRelease(cell.row)"
              >
                <q-item-section avatar
                  ><q-icon name="lock_open" size="xs"
                /></q-item-section>
                <q-item-section>Release</q-item-section>
              </q-item>
              <q-item
                v-if="cell.row.identity_state === 'quarantined'"
                clickable
                @click="confirmResetIdentity(cell.row)"
              >
                <q-item-section avatar
                  ><q-icon name="key" size="xs"
                /></q-item-section>
                <q-item-section>Reset identity</q-item-section>
              </q-item>
              <q-item
                v-if="cell.row.identity_state !== 'blocked'"
                clickable
                @click="confirmBlock(cell.row)"
              >
                <q-item-section avatar
                  ><q-icon name="block" size="xs" color="negative"
                /></q-item-section>
                <q-item-section>Block</q-item-section>
              </q-item>
            </q-list>
          </q-menu>
        </q-btn>
      </q-td>
    </template>
  </q-table>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useQuasar } from "quasar";
import type { QTableColumn } from "quasar";
import NoDataPanel from "@/core/ui/NoDataPanel.vue";
import ConfirmYesDialog from "@/components/agents/ConfirmYesDialog.vue";
import {
  blockAgent,
  fetchTrustMatrix,
  quarantineAgent,
  releaseAgent,
  resetAgentIdentity,
  type RotateWhat,
  type TrustRow,
} from "@/api/security";
import {
  ROTATE_LABEL,
  TRUST_STATUS,
  countdownText,
  identityState,
  keyStore,
  trustStatus,
} from "@/components/security/labels";
import { withStepUp } from "@/components/vault/stepUp";
import { relativeTime } from "@/utils/format";
import { copyOutput } from "@/utils/helpers";
import { notifySuccess } from "@/utils/notify";

const emit = defineEmits<{ denied: [] }>();
const $q = useQuasar();

const rows = ref<TrustRow[]>([]);
const total = ref(0);
const counts = ref<Record<string, number>>({});
const pinSeq = ref<number | null>(null);
const loading = ref(false);
const error = ref("");
const search = ref("");
const status = ref("");
const busy = ref("");
const pagination = ref({
  page: 1,
  rowsPerPage: 25,
  rowsNumber: 0,
  sortBy: null as string | null,
  descending: false,
});

const shortFp = (fp: string) =>
  fp.length > 20 ? `${fp.slice(0, 8)}…${fp.slice(-8)}` : fp;

const statusChips = computed(() =>
  Object.entries(counts.value)
    .filter(([, n]) => n > 0)
    .map(([value, count]) => ({
      value,
      count,
      label: trustStatus(value).label,
    }))
    .sort(
      (a, b) =>
        Object.keys(TRUST_STATUS).indexOf(a.value) -
        Object.keys(TRUST_STATUS).indexOf(b.value),
    ),
);

const columns: QTableColumn<TrustRow>[] = [
  { name: "hostname", label: "Agent", field: "hostname", align: "left" },
  { name: "status", label: "Status", field: "status", align: "left" },
  {
    name: "fingerprint",
    label: "Fingerprint",
    field: "fingerprint",
    align: "left",
  },
  { name: "pin", label: "Pin slot", field: "pin_seq", align: "left" },
  {
    name: "rotated_at",
    label: "Last rotation",
    field: "rotated_at",
    align: "left",
    format: (v: string | null) => (v ? relativeTime(v) : "Never"),
  },
  {
    name: "countdown",
    label: "Certificate",
    field: "countdown_s",
    align: "left",
  },
  {
    name: "identity",
    label: "Identity",
    field: "identity_state",
    align: "left",
  },
  {
    name: "keystore",
    label: "Key store",
    field: "keystore",
    align: "left",
  },
  {
    name: "pending",
    label: "Pending",
    field: "rotate_pending",
    align: "left",
    format: (v: RotateWhat[]) =>
      v.length ? v.map((w) => ROTATE_LABEL[w]).join(", ") : "—",
  },
  { name: "actions", label: "", field: "agent_id", align: "right" },
];

async function load(page: number, rowsPerPage: number) {
  loading.value = true;
  error.value = "";
  try {
    const data = await fetchTrustMatrix(
      {
        q: search.value || undefined,
        status: status.value || undefined,
        limit: rowsPerPage,
        offset: (page - 1) * rowsPerPage,
      },
      { silent: true },
    );
    rows.value = data.agents;
    total.value = data.total;
    counts.value = data.counts;
    pinSeq.value = data.pin_seq;
    pagination.value = {
      ...pagination.value,
      page,
      rowsPerPage,
      rowsNumber: status.value ? (data.counts[status.value] ?? 0) : data.total,
    };
  } catch (e) {
    rows.value = [];
    const code = (e as { response?: { status?: number } })?.response?.status;
    if (code === 403) emit("denied");
    error.value =
      code === 403
        ? "Your role cannot view Global Settings."
        : "The trust matrix could not be loaded.";
  } finally {
    loading.value = false;
  }
}

function onRequest(req: { pagination: { page: number; rowsPerPage: number } }) {
  load(req.pagination.page, req.pagination.rowsPerPage);
}

const reload = () => load(1, pagination.value.rowsPerPage);

function setStatus(value: string) {
  status.value = status.value === value ? "" : value;
  reload();
}

// typed confirmation first, then the console step-up on the server's ask
function emergency(
  row: TrustRow,
  dialog: {
    title: string;
    verb: string;
    ok: string;
    consequence: string;
    exact?: boolean;
  },
  call: (config: { silent: boolean }) => Promise<unknown>,
  done: string,
) {
  $q.dialog({
    component: ConfirmYesDialog,
    componentProps: {
      hostname: row.hostname,
      confirmText: dialog.exact ? row.hostname : "yes",
      actionVerb: dialog.verb,
      title: dialog.title,
      okLabel: dialog.ok,
      consequence: dialog.consequence,
    },
  }).onOk(async () => {
    busy.value = row.agent_id;
    try {
      if ((await withStepUp($q, call)) === null) return;
      notifySuccess(done);
      await load(pagination.value.page, pagination.value.rowsPerPage);
    } finally {
      busy.value = "";
    }
  });
}

function confirmQuarantine(row: TrustRow) {
  $q.dialog({
    title: `Quarantine ${row.hostname}`,
    message: "Reason, shown in the audit log",
    prompt: {
      model: "",
      type: "text",
      maxlength: 200,
      outlined: true,
      dense: true,
    },
    cancel: { label: "Cancel", flat: true },
    ok: { label: "Continue", color: "negative", noCaps: true },
  }).onOk((reason: string) =>
    emergency(
      row,
      {
        title: `Quarantine ${row.hostname}`,
        verb: "the quarantine",
        ok: "Quarantine",
        consequence:
          "The agent loses its NATS connection now. Its token and certificates are revoked; it stays cut off until you release it or reset its identity.",
      },
      (config) => quarantineAgent(row.agent_id, reason.trim(), config),
      `${row.hostname} is in quarantine`,
    ),
  );
}

function confirmRelease(row: TrustRow) {
  emergency(
    row,
    {
      title: `Release ${row.hostname}`,
      verb: "the release",
      ok: "Release",
      consequence:
        "The agent comes back with the same keys and gets a new token within 24 hours. If the keys may have been copied, reset the identity instead.",
    },
    (config) => releaseAgent(row.agent_id, config),
    `${row.hostname} was released`,
  );
}

function confirmResetIdentity(row: TrustRow) {
  emergency(
    row,
    {
      title: `Reset the identity of ${row.hostname}`,
      verb: "the identity reset",
      ok: "Reset identity",
      consequence:
        "The old keys stay refused. The agent has 24 hours to register new keys; a copy of the old configuration cannot.",
    },
    (config) => resetAgentIdentity(row.agent_id, config),
    `${row.hostname} may register new keys for 24 hours`,
  );
}

function confirmBlock(row: TrustRow) {
  emergency(
    row,
    {
      title: `Block ${row.hostname}`,
      verb: "the block",
      ok: "Block for good",
      consequence:
        "The agent is cut off for good. Only deleting the agent undoes this.",
      exact: true,
    },
    (config) => blockAgent(row.agent_id, config),
    `${row.hostname} is blocked`,
  );
}

defineExpose({ reload });

onMounted(reload);
</script>

<style scoped>
/* the rows scroll under the sticky header, toolbar and pager stay put */
.trust-matrix {
  max-height: max(360px, calc(100vh - 230px));
}

.trust-matrix__link {
  color: var(--rmm-text);
  font-weight: 600;
  text-decoration: none;
}

.trust-matrix__link:hover,
.trust-matrix__link:focus-visible {
  text-decoration: underline;
}

.trust-matrix :deep(.trust-pill--dark) {
  --rmm-pill-color: var(--rmm-text);
}

.trust-matrix :deep(.trust-pill--alert .trust-pill__icon) {
  animation: trust-pulse 1.2s ease-in-out infinite;
}

@keyframes trust-pulse {
  50% {
    opacity: 0.35;
  }
}

@media (prefers-reduced-motion: reduce) {
  .trust-matrix :deep(.trust-pill--alert .trust-pill__icon) {
    animation: none;
  }
}
</style>
