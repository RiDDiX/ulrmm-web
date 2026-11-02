<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <div>
    <q-banner
      v-if="updateRequired"
      dense
      rounded
      class="rmm-banner-warning q-ma-sm"
    >
      <template v-slot:avatar>
        <q-icon name="system_update" color="warning" />
      </template>
      Agent update required. This agent version cannot list or control services
      yet. Update the agent, then refresh.
    </q-banner>
    <q-banner
      v-else-if="error && services.length > 0"
      dense
      rounded
      class="rmm-banner-warning q-ma-sm"
    >
      <template v-slot:avatar>
        <q-icon name="warning_amber" color="warning" />
      </template>
      {{ error }} Showing the last successful result from
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
      dense
      table-class="table-bgcolor"
      class="remote-bg-tbl-sticky rmm-table"
      :style="{ 'max-height': `${$q.screen.height - 77}px` }"
      :rows="services"
      :columns="columns"
      :pagination="{ rowsPerPage: 0, sortBy: 'name', descending: false }"
      :filter="filter"
      :row-key="(row) => `${row.manager}:${row.name}`"
      binary-state-sort
      :rows-per-page-options="[0]"
      :loading="loading"
      v-sortable-headers
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
            <template v-slot:prepend>
              <q-icon name="search" />
            </template>
          </q-input>
        </div>
      </template>
      <template v-slot:no-data="{ filter: activeFilter }">
        <div v-if="!loading && !updateRequired" class="full-width">
          <EmptyState
            v-if="error"
            icon="error_outline"
            title="Services could not be loaded"
            :text="error"
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
      <template v-slot:header-cell-enabled="props">
        <q-th :props="props">
          {{ props.col.label }}
          <q-tooltip
            >Whether the service starts at boot. Unknown when the service
            manager does not say.</q-tooltip
          >
        </q-th>
      </template>
      <template v-slot:header-cell-pid="props">
        <q-th :props="props">
          {{ props.col.label }}
          <q-tooltip
            >Process ID, empty while the service is not running</q-tooltip
          >
        </q-th>
      </template>
      <template v-slot:header-cell-manager="props">
        <q-th :props="props">
          {{ props.col.label }}
          <q-tooltip
            >The service manager on the device: systemd, launchd, OpenRC or
            rc.d</q-tooltip
          >
        </q-th>
      </template>
      <template v-slot:body="props">
        <q-tr :props="props">
          <q-menu context-menu auto-close>
            <q-list dense style="min-width: 200px">
              <template v-for="a in actions" :key="a.action">
                <q-separator v-if="a.separate" />
                <q-item
                  clickable
                  :class="{ 'text-negative': a.negative }"
                  @click="confirmServiceAction(props.row, a)"
                >
                  <q-item-section avatar>
                    <q-icon
                      :name="a.icon"
                      :color="a.negative ? 'negative' : undefined"
                    />
                  </q-item-section>
                  <q-item-section>{{ a.label }}</q-item-section>
                </q-item>
              </template>
              <q-separator />
              <q-item clickable>
                <q-item-section>Close</q-item-section>
              </q-item>
            </q-list>
          </q-menu>
          <q-td key="name" :props="props" class="rmm-mono">{{
            props.row.name
          }}</q-td>
          <q-td key="description" :props="props" class="rmm-ellipsis-td">
            <span
              class="rmm-ellipsis-cell__text"
              :title="props.row.description"
              >{{ props.row.description }}</span
            >
          </q-td>
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
          <q-td
            key="enabled"
            :props="props"
            :class="{ 'rmm-muted': typeof props.row.enabled !== 'boolean' }"
            >{{ enabledLabel(props.row.enabled) }}</q-td
          >
          <q-td key="pid" :props="props" class="rmm-num">{{
            props.row.pid || ""
          }}</q-td>
          <q-td key="manager" :props="props">{{
            managerLabel(props.row.manager)
          }}</q-td>
          <!-- row actions button, mirrors the context menu above -->
          <q-td key="actions" :props="props" @click.stop>
            <RowActions :label="`Actions for ${props.row.name}`">
              <q-list dense style="min-width: 200px">
                <template v-for="a in actions" :key="a.action">
                  <q-separator v-if="a.separate" />
                  <q-item
                    clickable
                    v-close-popup
                    :class="{ 'text-negative': a.negative }"
                    @click="confirmServiceAction(props.row, a)"
                  >
                    <q-item-section avatar>
                      <q-icon
                        :name="a.icon"
                        :color="a.negative ? 'negative' : undefined"
                      />
                    </q-item-section>
                    <q-item-section>
                      <q-item-label>{{ a.label }}</q-item-label>
                      <q-item-label caption>{{ a.caption }}</q-item-label>
                    </q-item-section>
                  </q-item>
                </template>
              </q-list>
            </RowActions>
          </q-td>
        </q-tr>
      </template>
    </q-table>
  </div>
</template>

<script>
import { computed, ref, onMounted } from "vue";
import { useQuasar } from "quasar";
import { useStore } from "vuex";
import { fetchNixServices, sendNixServiceAction, nixError } from "@/api/nix";
import { fetchAgent } from "@/api/agents";
import { notifySuccess } from "@/utils/notify";
import { deviceName } from "@/utils/deviceName";
import { sortableHeaders } from "@/utils/sortableHeaders";
import { serviceStatusMeta } from "@/components/agents/remotebg/serviceStates";
import RowActions from "@/components/ui/RowActions.vue";
import EmptyState from "@/components/ui/EmptyState.vue";

const sortable = (name, label, extra = {}) => ({
  name,
  label,
  field: name,
  align: "left",
  sortable: true,
  ...extra,
});

const columns = [
  sortable("name", "Name"),
  sortable("description", "Description", { headerStyle: "width: 35%" }),
  sortable("status", "Status"),
  sortable("enabled", "Enabled", {
    field: (row) => enabledLabel(row.enabled),
  }),
  sortable("pid", "PID"),
  sortable("manager", "Manager", {
    field: (row) => managerLabel(row.manager),
  }),
  { name: "actions", label: "Actions", align: "right", field: () => "" },
];

const actions = [
  {
    action: "start",
    label: "Start",
    verb: "Start",
    icon: "play_arrow",
    caption: "Starts the service now",
  },
  {
    action: "restart",
    label: "Restart",
    verb: "Restart",
    icon: "restart_alt",
    caption: "Stops and starts the service",
  },
  {
    action: "stop",
    label: "Stop",
    verb: "Stop",
    icon: "stop",
    caption: "Stops the service now",
    negative: true,
  },
  {
    action: "enable",
    label: "Enable",
    verb: "Enable",
    icon: "toggle_on",
    caption: "Starts the service at boot",
    separate: true,
  },
  {
    action: "disable",
    label: "Disable",
    verb: "Disable",
    icon: "toggle_off",
    caption: "No longer starts the service at boot",
    negative: true,
  },
];

const managers = { systemd: "systemd", launchd: "launchd", openrc: "OpenRC" };

function enabledLabel(value) {
  if (value === true) return "Yes";
  if (value === false) return "No";
  return "Unknown";
}

function managerLabel(manager) {
  return managers[manager] || manager || "";
}

// the agent's own unit and the remote control agent
// FreeBSD rc.d spells the agent ulrmm_agent
const managementServices = ["ulrmm-agent", "ulrmm_agent", "meshagent"];

export default {
  name: "NixServicesManager",
  components: { RowActions, EmptyState },
  directives: { sortableHeaders },
  props: {
    agent_id: !String,
  },
  setup(props) {
    const $q = useQuasar();
    const store = useStore();
    const forbidden = "Your role cannot view services for this agent.";
    const formatDate = computed(() => store.getters.formatDate);
    const loading = ref(false);
    const error = ref("");
    const filter = ref("");
    const services = ref([]);
    const updateRequired = ref(false);
    const lastLoadedAt = ref(null);
    const hostname = ref("");

    async function getServices() {
      loading.value = true;
      try {
        const data = await fetchNixServices(props.agent_id);
        services.value = Array.isArray(data) ? data : [];
        error.value = "";
        updateRequired.value = false;
        lastLoadedAt.value = new Date();
      } catch (e) {
        // shown in the tab
        const err = nixError(e, forbidden);
        error.value = err.text;
        updateRequired.value = err.updateRequired;
      } finally {
        loading.value = false;
      }
    }

    function confirmServiceAction(service, a) {
      let message = `${service.name} on ${hostname.value}.`;
      if (a.action === "enable" || a.action === "disable")
        message += ` ${a.caption}.`;
      if (
        a.negative &&
        managementServices.includes(service.name.replace(/\.service$/i, ""))
      )
        message +=
          " This service carries remote management of this device. Without it the device stays unmanaged until it is recovered on site.";
      $q.dialog({
        title: `${a.verb} ${service.name}?`,
        message,
        cancel: true,
        persistent: true,
        ok: {
          label: a.verb,
          color: a.negative || a.action === "restart" ? "negative" : "primary",
          unelevated: true,
        },
      }).onOk(() => sendServiceAction(service, a.action));
    }

    async function sendServiceAction(service, action) {
      loading.value = true;
      try {
        notifySuccess(
          await sendNixServiceAction(props.agent_id, service.name, action),
        );
        await getServices();
      } catch {
        // axios toasts the error. The list loaded, so the agent is new
        // enough. A timeout here is usually the agent restarting its unit
      } finally {
        loading.value = false;
      }
    }

    onMounted(async () => {
      getServices();
      try {
        hostname.value = deviceName(await fetchAgent(props.agent_id));
      } catch (e) {
        console.error(e);
      }
    });

    return {
      services,
      filter,
      loading,
      error,
      updateRequired,
      lastLoadedAt,
      columns,
      actions,
      formatDate,
      getServices,
      confirmServiceAction,
      serviceStatusMeta,
      enabledLabel,
      managerLabel,
    };
  },
};
</script>

<style scoped>
.services-search {
  width: 260px;
}
</style>
