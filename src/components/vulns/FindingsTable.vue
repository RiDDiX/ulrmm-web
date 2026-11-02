<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-table
    class="rmm-table findings-table"
    dense
    flat
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
    <template v-if="$slots.top" #top>
      <slot name="top" />
    </template>

    <template #loading>
      <q-inner-loading showing color="primary" />
    </template>

    <template #bottom>
      <span class="findings-table__notice">{{ NVD_NOTICE }}</span>
    </template>

    <template #no-data>
      <div v-if="!loading" class="full-width">
        <slot name="no-data" />
      </div>
    </template>

    <template #body="scope">
      <q-tr :props="scope">
        <q-td v-for="col in scope.cols" :key="col.name" :props="scope">
          <q-btn
            v-if="col.name === 'expand'"
            flat
            round
            dense
            size="sm"
            :icon="scope.expand ? 'expand_less' : 'expand_more'"
            :aria-expanded="scope.expand ? 'true' : 'false'"
            :aria-label="`Details of ${scope.row.vuln_id} in ${scope.row.package}`"
            @click="scope.expand = !scope.expand"
          >
            <q-tooltip>{{
              scope.expand
                ? "Hide details"
                : "Summary, score and fixed versions"
            }}</q-tooltip>
          </q-btn>
          <template v-else-if="col.name === 'level'">
            <SeverityPill :level="scope.row.level"
              >{{ severityMeta(scope.row.level).label
              }}<span v-if="scoreText(scope.row.score)" class="rmm-num">{{
                scoreText(scope.row.score)
              }}</span></SeverityPill
            >
            <q-tooltip>{{ severityTip(scope.row) }}</q-tooltip>
          </template>
          <router-link
            v-else-if="col.name === 'device'"
            class="rmm-link findings-table__device"
            :to="{
              name: 'Agent',
              params: { agent_id: scope.row.agent_id },
              query: { tab: 'vulnerabilities' },
            }"
            >{{ deviceName(scope.row) }}</router-link
          >
          <a
            v-else-if="col.name === 'vuln_id'"
            class="rmm-link rmm-mono findings-table__id"
            :href="advisoryUrl(scope.row.vuln_id, scope.row.source)"
            target="_blank"
            rel="noopener noreferrer"
            >{{ scope.row.vuln_id
            }}<span class="sr-only">
              (opens {{ sourceLabel(scope.row.source) }} in a new tab)</span
            ></a
          >
          <span
            v-else-if="col.name === 'platform'"
            class="rmm-pill rmm-pill--neutral"
            >{{ col.value || "—" }}</span
          >
          <span
            v-else-if="col.name === 'fixed' && !col.value"
            class="rmm-muted"
            >{{ scope.row.fix_available === false ? "No fix yet" : "—" }}</span
          >
          <span
            v-else-if="col.name === 'version' || col.name === 'fixed'"
            class="rmm-mono rmm-ellipsis-cell__text findings-table__version"
            :class="{ 'rmm-muted': !col.value }"
            :title="col.value || undefined"
            >{{ col.value || "—" }}</span
          >
          <span
            v-else-if="col.name === 'first_seen' || col.name === 'last_seen'"
            class="rmm-num"
            :title="formatDate(col.value)"
            >{{ relativeTime(col.value) }}</span
          >
          <span
            v-else-if="col.name === 'status'"
            class="rmm-pill"
            :class="`rmm-pill--${statusMeta(scope.row.status).tone}`"
            >{{ statusMeta(scope.row.status).label }}</span
          >
          <template v-else-if="col.name === 'actions'">
            <q-btn
              v-if="scope.row.status !== 'fixed'"
              flat
              round
              dense
              size="sm"
              :icon="scope.row.status === 'ignored' ? 'undo' : 'visibility_off'"
              :loading="busy === scope.row.id"
              :disable="busy !== null"
              :aria-label="`${scope.row.status === 'ignored' ? 'Reopen' : 'Ignore'} ${scope.row.vuln_id} in ${scope.row.package}`"
              @click="emit('toggle-ignore', scope.row)"
            >
              <q-tooltip>{{
                scope.row.status === "ignored"
                  ? "Reopen: count this finding as open again"
                  : "Ignore: leave it out of the open counts until reopened"
              }}</q-tooltip>
            </q-btn>
          </template>
          <span v-else>{{ col.value }}</span>
        </q-td>
      </q-tr>
      <q-tr v-if="scope.expand" :props="scope" class="findings-table__details">
        <q-td colspan="100%">
          <div class="finding-details">
            <p class="finding-details__summary">
              {{ scope.row.summary || "The advisory has no summary." }}
            </p>
            <dl class="finding-details__facts">
              <dt>Severity</dt>
              <dd>{{ severityTip(scope.row) }}</dd>
              <dt>Source</dt>
              <dd>{{ sourceLabel(scope.row.source) }}</dd>
              <dt>Ecosystem</dt>
              <dd>{{ scope.row.ecosystem || "—" }}</dd>
              <dt>Fixed in</dt>
              <dd :class="{ 'rmm-mono': fixedText(scope.row.fixed_in) }">
                {{
                  fixedText(scope.row.fixed_in) ||
                  "No fixed version published yet"
                }}
              </dd>
              <dt>Seen</dt>
              <dd>
                first {{ formatDate(scope.row.first_seen) }}, last
                {{ formatDate(scope.row.last_seen) }}
              </dd>
            </dl>
            <a
              class="rmm-link"
              :href="advisoryUrl(scope.row.vuln_id, scope.row.source)"
              target="_blank"
              rel="noopener noreferrer"
              >Read {{ scope.row.vuln_id }} on {{ sourceLabel(scope.row.source)
              }}<q-icon
                name="open_in_new"
                size="14px"
                class="q-ml-xs"
                aria-hidden="true"
            /></a>
          </div>
        </q-td>
      </q-tr>
    </template>
  </q-table>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useStore } from "vuex";
import type { QTableColumn } from "quasar";
import SeverityPill from "@/components/vulns/SeverityPill.vue";
import { deviceName } from "@/utils/deviceName";
import { relativeTime } from "@/utils/format";
import { sortableHeaders as vSortableHeaders } from "@/utils/sortableHeaders";
import {
  fixedText,
  fixedVersion,
  advisoryUrl,
  platformLabel,
  sourceLabel,
  scoreText,
  severityMeta,
  severityRank,
  statusMeta,
  NVD_NOTICE,
  type Finding,
} from "@/utils/vulns";

const props = withDefaults(
  defineProps<{
    rows: Finding[];
    loading?: boolean;
    showDevice?: boolean;
    // id of the finding whose ignore toggle is in flight
    busy?: number | null;
  }>(),
  { loading: false, showDevice: false, busy: null },
);
const emit = defineEmits<{ "toggle-ignore": [row: Finding] }>();

const store = useStore();
const formatDate = (value: string) =>
  value ? store.getters.formatDate(value) : "—";

const pagination = ref({ rowsPerPage: 0, sortBy: null, descending: false });

const ALL_COLUMNS: QTableColumn<Finding>[] = [
  { name: "expand", label: "", field: "id", align: "left" },
  {
    name: "level",
    label: "Severity",
    field: "level",
    align: "left",
    sortable: true,
    sort: (a, b) => severityRank(a) - severityRank(b),
  },
  {
    name: "device",
    label: "Device",
    field: (row) => deviceName(row),
    align: "left",
    sortable: true,
  },
  {
    name: "vuln_id",
    label: "Vulnerability",
    field: "vuln_id",
    align: "left",
    sortable: true,
  },
  {
    name: "platform",
    label: "Platform",
    field: (row) => platformLabel(row.plat),
    align: "left",
    sortable: true,
  },
  {
    name: "source",
    label: "Source",
    field: (row) => sourceLabel(row.source),
    align: "left",
    sortable: true,
  },
  {
    name: "package",
    label: "Package",
    field: "package",
    align: "left",
    sortable: true,
  },
  { name: "version", label: "Installed", field: "version", align: "left" },
  {
    name: "fixed",
    label: "Fixed in",
    field: (row) => fixedVersion(row),
    align: "left",
  },
  {
    name: "first_seen",
    label: "First seen",
    field: "first_seen",
    align: "left",
    sortable: true,
  },
  {
    name: "last_seen",
    label: "Last seen",
    sortable: true,
    align: "left",
    field: (row) => row.last_seen,
  },
  {
    name: "status",
    label: "Status",
    sortable: true,
    align: "left",
    field: (row) => row.status,
  },
  { name: "actions", label: "", field: "id", align: "right" },
];

const columns = computed(() =>
  props.showDevice
    ? ALL_COLUMNS
    : ALL_COLUMNS.filter(
        (col) => col.name !== "device" && col.name !== "platform",
      ),
);

function severityTip(row: Finding) {
  const parts = [severityMeta(row.level).label];
  const score = scoreText(row.score);
  if (score) parts.push(`CVSS 3 base score ${score}`);
  if (row.severity) parts.push(`rated ${row.severity} by the source`);
  return parts.join(", ");
}
</script>

<style scoped>
.findings-table :deep(.q-table__top) {
  padding: 0;
}

.findings-table :deep(.q-table__bottom) {
  min-height: 32px;
}

.findings-table__notice {
  color: var(--rmm-text-muted);
  font-size: var(--rmm-fs-xs);
}

.findings-table .severity-pill .rmm-num {
  margin-left: 6px;
  font-weight: 500;
}

.findings-table__id {
  white-space: nowrap;
}

.findings-table__device {
  font-weight: 600;
}

.findings-table__version {
  max-width: 170px;
}

.findings-table__details td {
  background: var(--rmm-surface-2);
  white-space: normal;
}

.finding-details {
  display: grid;
  max-width: 960px;
  gap: 8px;
  padding: 8px 4px 10px 40px;
}

.finding-details__summary {
  margin: 0;
  color: var(--rmm-text);
}

.finding-details__facts {
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr);
  gap: 4px 16px;
  margin: 0;
}

.finding-details__facts dt {
  color: var(--rmm-text-muted);
}

.finding-details__facts dd {
  margin: 0;
  overflow-wrap: anywhere;
}
</style>
