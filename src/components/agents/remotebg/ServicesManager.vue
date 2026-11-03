<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <EmptyState
    v-if="agentPlatform.toLowerCase() !== 'windows'"
    icon="desktop_windows"
    title="Windows only"
    text="Services can only be managed on Windows agents at this time."
  />
  <template v-else>
    <q-banner
      v-if="error && services.length > 0"
      dense
      rounded
      class="rmm-banner-warning q-mb-sm"
    >
      <template v-slot:avatar>
        <q-icon name="warning_amber" color="warning" />
      </template>
      {{ errorMessage }} Showing the last successful result from
      {{ formatDate(lastLoadedAt) }}.
      <template v-slot:action>
        <q-btn
          flat
          dense
          no-caps
          color="primary"
          label="Retry"
          @click="getServices"
        />
      </template>
    </q-banner>
    <q-table
      v-sortable-headers
      dense
      binary-state-sort
      row-key="display_name"
      table-class="table-bgcolor"
      class="remote-bg-tbl-sticky rmm-table"
      :style="{ 'max-height': `${$q.screen.height - 77}px` }"
      :columns="columns"
      :rows="services"
      :loading="loading"
      :filter="filter"
      :pagination="paging"
      :rows-per-page-options="[0]"
    >
      <template v-slot:top>
        <div class="rmm-toolbar full-width">
          <span class="rmm-card__title">Services</span>
          <span class="rmm-muted rmm-num">{{ services.length }}</span>
          <q-btn
            dense
            flat
            round
            @click="getServices"
            icon="refresh"
            aria-label="Refresh services"
          >
            <q-tooltip>Ask the agent for its current services</q-tooltip>
          </q-btn>
          <q-space />
          <q-input
            v-model="filter"
            outlined
            dense
            clearable
            placeholder="Search services"
            aria-label="Search services"
            class="services-search"
          >
            <template #prepend><q-icon name="search" /></template>
          </q-input>
          <export-table-btn
            class="q-ml-sm"
            :data="services"
            :columns="columns"
          />
        </div>
      </template>
      <template v-slot:no-data="{ filter: activeFilter }">
        <div v-if="!loading" class="full-width">
          <EmptyState
            v-if="error"
            icon="error_outline"
            title="Services could not be loaded"
            :text="errorMessage"
          >
            <q-btn
              outline
              no-caps
              color="primary"
              icon="refresh"
              label="Retry"
              @click="getServices"
            />
          </EmptyState>
          <EmptyState
            v-else-if="activeFilter"
            icon="filter_alt_off"
            title="No services match your search"
            text="Clear the search to see every service."
          />
          <EmptyState
            v-else
            icon="settings_suggest"
            title="No services found on this agent"
            text="Refresh to ask the agent again."
          />
        </div>
      </template>
      <template
        v-for="(tip, col) in headerTips"
        :key="col"
        #[`header-cell-${col}`]="props"
      >
        <q-th :props="props">
          {{ props.col.label }}
          <q-tooltip>{{ tip }}</q-tooltip>
        </q-th>
      </template>
      <template v-slot:body="props">
        <q-tr
          :props="props"
          style="cursor: pointer"
          @dblclick="showServiceDetail(props.row)"
        >
          <q-menu auto-close context-menu>
            <q-list dense style="min-width: 200px">
              <template v-for="(entry, i) in rowMenu" :key="entry.label">
                <q-separator v-if="i > 0 && entry.divider" />
                <q-item
                  clickable
                  :class="entry.cls"
                  @click="entry.run(props.row)"
                >
                  <q-item-section avatar>
                    <q-icon :name="entry.icon" :color="entry.iconColor" />
                  </q-item-section>
                  <q-item-section>{{ entry.label }}</q-item-section>
                </q-item>
              </template>
              <q-separator />
              <q-item clickable>
                <q-item-section>Close</q-item-section>
              </q-item>
            </q-list>
          </q-menu>
          <q-td key="display_name" :props="props">
            <span class="service-name">
              <q-icon name="fas fa-cogs" size="14px" />
              <span>{{ truncateText(props.row.display_name, 30) }}</span>
              <q-tooltip v-if="props.row.display_name.length > 30">{{
                props.row.display_name
              }}</q-tooltip>
            </span>
          </q-td>
          <q-td key="name" :props="props" class="rmm-mono">{{
            props.row.name
          }}</q-td>
          <q-td key="start_type" :props="props">{{
            startupLabel(props.row)
          }}</q-td>
          <q-td key="pid" :props="props" class="rmm-num">{{
            props.row.pid === 0 ? "" : props.row.pid
          }}</q-td>
          <q-td key="status" :props="props">
            <span
              class="rmm-pill"
              :class="serviceStatusMeta(props.row.status).cls"
            >
              {{ serviceStatusMeta(props.row.status).label }}
              <q-tooltip>{{
                serviceStatusMeta(props.row.status).tip
              }}</q-tooltip>
            </span>
          </q-td>
          <q-td key="username" :props="props">{{
            props.row.username ? props.row.username : "LocalSystem"
          }}</q-td>
          <!-- row actions button, mirrors the context menu above -->
          <q-td key="actions" :props="props" @click.stop>
            <RowActions :label="`Actions for ${props.row.display_name}`">
              <q-list dense style="min-width: 200px">
                <template v-for="(entry, i) in rowMenu" :key="entry.label">
                  <q-separator v-if="i > 0 && entry.divider" />
                  <q-item
                    v-close-popup
                    clickable
                    :class="entry.cls"
                    @click="entry.run(props.row)"
                  >
                    <q-item-section avatar>
                      <q-icon :name="entry.icon" :color="entry.iconColor" />
                    </q-item-section>
                    <q-item-section>{{ entry.label }}</q-item-section>
                  </q-item>
                </template>
              </q-list>
            </RowActions>
          </q-td>
        </q-tr>
      </template>
    </q-table>
  </template>
</template>

<script setup>
import { onMounted, ref, computed } from "vue";
import { useStore } from "vuex";
import { useQuasar } from "quasar";
import { fetchAgent } from "@/api/agents";
import { sendAgentServiceAction, getAgentServices } from "@/api/services";
import { deviceName } from "@/utils/deviceName";
import { truncateText } from "@/utils/format";
import { notifySuccess } from "@/utils/notify";
import ServiceDetail from "@/components/agents/remotebg/ServiceDetail.vue";
import ExportTableBtn from "@/components/ui/ExportTableBtn.vue";
import RowActions from "@/components/ui/RowActions.vue";
import EmptyState from "@/components/ui/EmptyState.vue";
import { sortableHeaders as vSortableHeaders } from "@/utils/sortableHeaders";
import { serviceStatusMeta } from "@/components/agents/remotebg/serviceStates";

defineOptions({ name: "ServicesManager" });
const props = defineProps({
  agent_id: { type: String, default: undefined },
  agentPlatform: { type: String, default: undefined },
});

const $q = useQuasar();
const store = useStore();
const formatDate = computed(() => store.getters.formatDate);

const sortableCol = (name, label) => ({
  name,
  label,
  field: name,
  align: "left",
  sortable: true,
});
const columns = [
  sortableCol("display_name", "Display Name"),
  sortableCol("name", "Name"),
  sortableCol("start_type", "Startup"),
  sortableCol("pid", "PID"),
  sortableCol("status", "Status"),
  sortableCol("username", "Log On As"),
  { name: "actions", label: "Actions", align: "right", field: () => "" },
];

const paging = { rowsPerPage: 0, sortBy: "display_name", descending: false };

const startupLabel = (row) =>
  row.start_type.toLowerCase() === "automatic" && row.autodelay
    ? `${row.start_type} (Delayed)`
    : `${row.start_type}`;

const headerTips = {
  start_type: "How Windows starts the service",
  pid: "Process ID, empty while the service is not running",
  username: "Account the service runs under",
};

const services = ref([]);
const filter = ref("");
const loading = ref(false);
const error = ref(null);
const lastLoadedAt = ref(null);
const hostname = ref("");

const errorMessage = computed(() => {
  if (!error.value) return "";
  return error.value?.response?.status === 403
    ? "Your role cannot view services for this agent."
    : "Services could not be loaded.";
});

// services that carry remote management of the device itself;
// the first entry must match AGENT_SVC_NAME on the server
const managementServices = ["ulrmm-agent", "mesh agent"];

async function getServices() {
  loading.value = true;
  try {
    services.value = await getAgentServices(props.agent_id);
    error.value = null;
    lastLoadedAt.value = new Date();
  } catch (e) {
    console.error(e);
    error.value = e;
  } finally {
    loading.value = false;
  }
}

async function guarded(job) {
  loading.value = true;
  try {
    await job();
  } catch (e) {
    console.error(e);
  } finally {
    loading.value = false;
  }
}

const sendServiceAction = (service, action) =>
  guarded(async () => {
    notifySuccess(
      await sendAgentServiceAction(props.agent_id, service.name, {
        sv_action: action,
      }),
    );
    await getServices();
  });

function confirmServiceAction(service, action) {
  const verb = action === "stop" ? "Stop" : "Restart";
  let message = `${service.name} on ${hostname.value}.`;
  if (managementServices.includes(service.name.toLowerCase()))
    message +=
      " This service carries remote management of this device. Stopping it ends this session and the device stays unmanaged until it is recovered on site or via Agent Recovery.";
  $q.dialog({
    title: `${verb} ${service.display_name}?`,
    message,
    cancel: true,
    persistent: true,
    ok: { label: verb, color: "negative" },
  }).onOk(() => sendServiceAction(service, action));
}

function showServiceDetail(service) {
  $q.dialog({
    component: ServiceDetail,
    componentProps: { service, agent_id: props.agent_id },
  }).onOk(getServices);
}

// shared by the context menu and the row actions button
const rowMenu = [
  {
    label: "Start",
    icon: "play_arrow",
    run: (row) => sendServiceAction(row, "start"),
  },
  {
    label: "Restart",
    icon: "restart_alt",
    run: (row) => confirmServiceAction(row, "restart"),
  },
  {
    label: "Stop",
    icon: "stop",
    iconColor: "negative",
    cls: "text-negative",
    divider: true,
    run: (row) => confirmServiceAction(row, "stop"),
  },
  {
    label: "Service Details",
    icon: "info_outline",
    divider: true,
    run: showServiceDetail,
  },
];

onMounted(async () => {
  if (props.agentPlatform !== "windows") return;
  getServices();
  try {
    hostname.value = deviceName(await fetchAgent(props.agent_id));
  } catch (e) {
    console.error(e);
  }
});
</script>

<style scoped>
.service-name {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.service-name .q-icon {
  color: var(--rmm-text-subtle);
}

.services-search {
  width: 260px;
}
</style>
