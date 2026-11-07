<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-table
    v-sortable-headers
    row-key="id"
    class="remote-bg-tbl-sticky rmm-table"
    table-class="table-bgcolor"
    :filter="filter"
    :loading="loading"
    :rows="processes"
    :columns="columns"
    :pagination="{ sortBy: 'cpu_percent', descending: true, rowsPerPage: 0 }"
    :rows-per-page-options="[0]"
    :style="{ 'max-height': `${$q.screen.height - 77}px` }"
    binary-state-sort
    dense
  >
    <template #top>
      <div class="full-width">
        <q-banner v-if="pollError" dense class="rmm-banner-warning q-ma-sm">
          <template #avatar>
            <q-icon name="warning_amber" color="warning" />
          </template>
          The agent did not respond. Use Resume live refresh to try again.
        </q-banner>
        <div class="rmm-toolbar proc-bar">
          <q-btn
            v-if="isPolling"
            icon="pause"
            label="Stop live refresh"
            dense
            flat
            no-caps
            @click="stopPoll"
          >
            <q-tooltip>Stop asking the agent for new values</q-tooltip>
          </q-btn>
          <q-btn
            v-else
            icon="play_arrow"
            label="Resume live refresh"
            color="primary"
            dense
            flat
            no-caps
            @click="startPoll"
          >
            <q-tooltip
              >Ask the agent for the process list every
              {{ pollInterval }} s</q-tooltip
            >
          </q-btn>

          <div v-for="s in stats" :key="s.label" class="proc-bar__stat">
            <q-icon :name="s.icon" size="14px" />
            <span class="proc-bar__label">{{ s.label }}</span>
            <span class="rmm-num">{{ s.value }}</span>
            <q-tooltip>{{ s.hint }}</q-tooltip>
          </div>

          <q-space />

          <div class="proc-bar__interval">
            <span class="proc-bar__label">Refresh every</span>
            <q-btn
              icon="remove"
              size="sm"
              aria-label="Decrease refresh interval"
              dense
              flat
              round
              :disable="pollInterval === 1"
              @click="changeInterval(-1)"
            >
              <q-tooltip>{{
                pollInterval === 1
                  ? "Already at the shortest interval of 1 second"
                  : "Refresh more often (1 second shorter)"
              }}</q-tooltip>
            </q-btn>
            <span class="rmm-num proc-bar__seconds">{{ pollInterval }} s</span>
            <q-btn
              icon="add"
              size="sm"
              aria-label="Increase refresh interval"
              dense
              flat
              round
              @click="changeInterval(1)"
            >
              <q-tooltip>Refresh less often (1 second longer)</q-tooltip>
            </q-btn>
          </div>

          <q-input
            v-model="filter"
            class="proc-bar__search"
            placeholder="Search processes"
            aria-label="Search processes"
            outlined
            dense
            clearable
          >
            <template #prepend>
              <q-icon name="search" />
            </template>
          </q-input>
        </div>
      </div>
    </template>
    <template #no-data="{ filter: activeFilter }">
      <EmptyState
        v-if="!loading || processes.length > 0"
        class="full-width"
        :icon="activeFilter ? 'filter_alt_off' : 'memory'"
        :title="emptyTexts(activeFilter).title"
        :text="emptyTexts(activeFilter).text"
      />
    </template>
    <template #header-cell-pid="props">
      <q-th :props="props">
        {{ props.col.label }}
        <q-tooltip>Process ID</q-tooltip>
      </q-th>
    </template>
    <template #body="props">
      <q-tr :key="props.row.pid" :props="props" class="cursor-pointer">
        <q-menu context-menu auto-close @show="pausePoll" @hide="resumePoll">
          <q-list dense style="min-width: 200px">
            <q-item
              class="text-negative"
              clickable
              @click="confirmKill(props.row)"
            >
              <q-item-section side>
                <q-icon color="negative" size="xs" name="fas fa-trash-alt" />
              </q-item-section>
              <q-item-section>End Process</q-item-section>
            </q-item>
            <q-separator />
            <q-item clickable><q-item-section>Close</q-item-section></q-item>
          </q-list>
        </q-menu>
        <q-td
          v-for="cell in cellDefs"
          :key="cell.field"
          :class="cell.num ? 'rmm-num' : undefined"
          >{{ cell.show(props.row) }}</q-td
        >
        <!-- row actions button, mirrors the context menu above -->
        <q-td @click.stop>
          <q-btn
            icon="more_vert"
            size="sm"
            flat
            round
            dense
            :aria-label="`Actions for ${props.row.name}`"
            @click.stop
          >
            <q-tooltip>Actions for {{ props.row.name }}</q-tooltip>
            <q-menu
              anchor="bottom right"
              self="top right"
              @show="pausePoll"
              @hide="resumePoll"
            >
              <q-list dense style="min-width: 200px">
                <q-item
                  v-close-popup
                  clickable
                  class="text-negative"
                  @click="confirmKill(props.row)"
                >
                  <q-item-section side>
                    <q-icon
                      name="fas fa-trash-alt"
                      size="xs"
                      color="negative"
                    />
                  </q-item-section>
                  <q-item-section>
                    <q-item-label>End Process</q-item-label>
                    <q-item-label caption
                      >Asks for confirmation, then stops it on the
                      agent</q-item-label
                    >
                  </q-item-section>
                </q-item>
              </q-list>
            </q-menu>
          </q-btn>
        </q-td>
      </q-tr>
    </template>
  </q-table>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useQuasar } from "quasar";
import {
  fetchAgent,
  fetchAgentProcesses,
  killAgentProcess,
} from "@/api/agents";
import { fmtBytes } from "@/utils/format";
import { deviceName } from "@/utils/deviceName";
import { notifySuccess } from "@/utils/notify";
import { sortableHeaders as vSortableHeaders } from "@/utils/sortableHeaders";
import EmptyState from "@/components/ui/EmptyState.vue";

const props = defineProps({ agent_id: { type: String } });

const $q = useQuasar();

const sortCols = [
  ["name", "Name"],
  ["cpu_percent", "CPU", (a, b) => parseFloat(a) - parseFloat(b)],
  ["membytes", "Memory"],
  ["username", "User"],
  ["pid", "PID"],
];
const columns = [
  ...sortCols.map(([name, label, sort]) => ({
    name,
    label,
    field: name,
    align: "left",
    sortable: true,
    ...(sort ? { sort } : {}),
  })),
  { name: "actions", label: "Actions", align: "right", field: () => "" },
];

const cellDefs = [
  { field: "name", show: (r) => r.name },
  { field: "cpu_percent", num: true, show: (r) => `${r.cpu_percent}%` },
  { field: "membytes", num: true, show: (r) => fmtBytes(r.membytes) },
  { field: "username", show: (r) => r.username },
  { field: "pid", num: true, show: (r) => r.pid },
];

const processes = ref([]);
const filter = ref("");
const totalRam = ref(0);
const hostname = ref("");
const loading = ref(false);
const pollError = ref(false);

const pollInterval = ref(2);
const timer = ref(null);
// polling pauses while a row menu or the end-process confirm is open
const paused = ref(false);
let confirming = false;
const isPolling = computed(() => !!timer.value || paused.value);

const totalCpu = computed(() => {
  const list = processes.value;
  if (!Array.isArray(list)) return "0.00";
  let sum = 0;
  for (const p of list) {
    const n = parseFloat(p.cpu_percent);
    if (!isNaN(n)) sum += n;
  }
  return sum.toFixed(2);
});

const totalRamUsed = computed(() => {
  const list = processes.value;
  if (!Array.isArray(list)) return 0;
  return list.reduce((sum, p) => sum + p.membytes, 0);
});

const stats = computed(() => [
  {
    icon: "fas fa-microchip",
    label: "CPU",
    value: `${totalCpu.value}%`,
    hint: "Sum of the CPU use of every process on the agent (ignores the search)",
  },
  {
    icon: "fas fa-memory",
    label: "RAM",
    value: `${fmtBytes(totalRamUsed.value)}/${totalRam.value} GB`,
    hint: "Memory used by every process on the agent / memory installed",
  },
]);

function emptyTexts(searching) {
  if (searching) {
    return {
      title: "No processes match your search",
      text: "Clear the search to see every process.",
    };
  }
  if (pollError.value) {
    return {
      title: "No answer from the agent",
      text: "Use Resume live refresh to ask the agent again.",
    };
  }
  return {
    title: "No processes to show",
    text: "The list fills in as soon as the agent reports its processes.",
  };
}

async function loadProcesses() {
  loading.value = true;
  try {
    processes.value = await fetchAgentProcesses(props.agent_id);
    pollError.value = false;
  } catch (err) {
    console.error(err);
    // agent not answering: stop polling rather than toast on every retry
    pollError.value = true;
    stopPoll();
  }
  loading.value = false;
}

function startPoll() {
  stopPoll();
  loadProcesses();
  // skip a tick while the previous load or an end-process call still runs
  timer.value = setInterval(() => {
    if (!loading.value) loadProcesses();
  }, pollInterval.value * 1000);
}

function stopPoll() {
  paused.value = false;
  if (timer.value) {
    clearInterval(timer.value);
    timer.value = null;
  }
}

function pausePoll() {
  if (!timer.value) return;
  stopPoll();
  paused.value = true;
}

function resumePoll() {
  if (confirming || !paused.value) return;
  paused.value = false;
  startPoll();
}

function changeInterval(step) {
  if (step < 0 && pollInterval.value <= 1) return;
  pollInterval.value += step;
  if (isPolling.value) startPoll();
}

async function endProcess(pid) {
  loading.value = true;
  try {
    notifySuccess(await killAgentProcess(props.agent_id, pid));
    await loadProcesses();
  } catch (err) {
    console.error(err);
  } finally {
    loading.value = false;
  }
}

function confirmKill(proc) {
  confirming = true;
  $q.dialog({
    title: `End process ${proc.name}?`,
    message: `PID ${proc.pid}, user ${proc.username}, on ${hostname.value}.`,
    cancel: true,
    persistent: true,
    ok: { label: "End process", color: "negative" },
  })
    .onOk(() => endProcess(proc.pid))
    .onDismiss(() => {
      confirming = false;
      resumePoll();
    });
}

// closed while fetchAgent ran: do not start a poll nobody clears
let gone = false;

onMounted(async () => {
  try {
    const agent = await fetchAgent(props.agent_id);
    if (gone) return;
    totalRam.value = agent.total_ram;
    hostname.value = deviceName(agent);
    startPoll();
  } catch (err) {
    console.error(err);
    pollError.value = true;
  }
});

onBeforeUnmount(() => {
  gone = true;
  clearInterval(timer.value);
});
</script>

<style scoped>
.proc-bar {
  flex-wrap: wrap;
}
.proc-bar__stat,
.proc-bar__interval {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--rmm-text);
}
.proc-bar__stat {
  padding: 2px 8px;
  background: var(--rmm-surface-2);
  border: 1px solid var(--rmm-border);
  border-radius: var(--rmm-radius-sm);
}
.proc-bar__stat .q-icon {
  color: var(--rmm-text-subtle);
}
.proc-bar__label {
  font-size: var(--rmm-fs-xs);
  font-weight: 600;
  color: var(--rmm-text-muted);
}
.proc-bar__seconds {
  min-width: 32px;
  text-align: center;
}
.proc-bar__search {
  width: 240px;
}
</style>
