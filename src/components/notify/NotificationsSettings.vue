<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <div>
    <SettingsPanelHeader
      title="Channels"
      :count="channels.length"
      text="Where notifications go: chat, push, webhook or email."
    >
      <q-btn
        unelevated
        no-caps
        color="primary"
        icon="add"
        label="Add channel"
        @click="editChannel(null)"
      />
    </SettingsPanelHeader>
    <q-table
      dense
      flat
      class="rmm-table"
      :rows="channels"
      :columns="channelColumns"
      row-key="id"
      hide-pagination
      :rows-per-page-options="[0]"
      :loading="loading"
    >
      <template #no-data>
        <div v-if="!loading" class="full-width q-py-md text-center rmm-muted">
          {{ error || "No channels yet. Add one, then route events to it." }}
          <q-btn
            v-if="error"
            flat
            dense
            no-caps
            color="primary"
            label="Retry"
            @click="load"
          />
        </div>
      </template>
      <template #body-cell-name="props">
        <q-td :props="props">
          <q-icon
            :name="CHANNEL_KINDS[props.row.kind]?.icon || 'notifications'"
            size="18px"
            class="q-mr-xs"
          />
          <span class="text-weight-medium">{{ props.row.name }}</span>
          <span class="rmm-muted"> · {{ kindLabel(props.row.kind) }}</span>
        </q-td>
      </template>
      <template #body-cell-enabled="props">
        <q-td :props="props">
          <span
            class="rmm-pill"
            :class="
              props.row.enabled ? 'rmm-pill--positive' : 'rmm-pill--neutral'
            "
            >{{ props.row.enabled ? "On" : "Off" }}</span
          >
        </q-td>
      </template>
      <template #body-cell-quiet="props">
        <q-td :props="props">
          <template v-if="props.row.quiet_start && props.row.quiet_end"
            >{{ props.row.quiet_start.slice(0, 5) }} -
            {{ props.row.quiet_end.slice(0, 5) }}</template
          >
          <span v-else class="rmm-muted">—</span>
        </q-td>
      </template>
      <template #body-cell-last="props">
        <q-td :props="props">
          <span v-if="props.row.last_error" class="rmm-pill rmm-pill--negative"
            >Error<q-tooltip max-width="420px">{{
              props.row.last_error
            }}</q-tooltip></span
          >
          <span v-else-if="props.row.last_sent">{{
            relativeTime(props.row.last_sent)
          }}</span>
          <span v-else class="rmm-muted">Never</span>
        </q-td>
      </template>
      <template #body-cell-actions="props">
        <q-td :props="props" auto-width>
          <q-btn
            flat
            dense
            no-caps
            size="sm"
            color="primary"
            label="Test"
            :loading="testing === props.row.id"
            :disable="!!testing"
            @click="test(props.row)"
          >
            <q-tooltip>Sends a test message through this channel</q-tooltip>
          </q-btn>
          <q-btn
            flat
            dense
            round
            size="sm"
            icon="edit"
            :aria-label="`Edit ${props.row.name}`"
            @click="editChannel(props.row)"
          />
          <q-btn
            flat
            dense
            round
            size="sm"
            icon="delete"
            color="negative"
            :aria-label="`Delete ${props.row.name}`"
            @click="deleteChannel(props.row)"
          />
        </q-td>
      </template>
    </q-table>

    <SettingsPanelHeader
      class="q-mt-lg"
      title="Routes"
      :count="routes.length"
      text="Which events reach which channels, with optional escalation."
    >
      <!-- a wrapper keeps the tooltip alive while the button is disabled -->
      <div>
        <q-btn
          unelevated
          no-caps
          color="primary"
          icon="add"
          label="Add route"
          :disable="!channels.length"
          @click="editRoute(null)"
        />
        <q-tooltip v-if="!channels.length"
          >Routes send events to channels. Add a channel first.</q-tooltip
        >
      </div>
    </SettingsPanelHeader>
    <q-table
      dense
      flat
      class="rmm-table"
      :rows="routes"
      :columns="routeColumns"
      row-key="id"
      hide-pagination
      :rows-per-page-options="[0]"
      :loading="loading"
    >
      <template #no-data>
        <div v-if="!loading" class="full-width q-py-md text-center rmm-muted">
          {{
            channels.length
              ? "No routes yet. Without a route, events are not sent to any channel."
              : "No routes yet. Add a channel first, then route events to it."
          }}
        </div>
      </template>
      <template #body-cell-severities="props">
        <q-td :props="props">
          <span v-if="!props.row.severities?.length" class="rmm-muted"
            >All</span
          >
          <span
            v-for="s in props.row.severities || []"
            :key="s"
            class="rmm-pill q-mr-xs"
            :class="SEVERITY_PILL[s] || 'rmm-pill--neutral'"
            >{{ s }}</span
          >
        </q-td>
      </template>
      <template #body-cell-sources="props">
        <q-td :props="props">
          <span v-if="!props.row.sources?.length" class="rmm-muted">All</span>
          <template v-else>{{
            props.row.sources.map(sourceLabel).join(", ")
          }}</template>
        </q-td>
      </template>
      <template #body-cell-channels="props">
        <q-td :props="props">{{
          channelNames(props.row.channels) || "—"
        }}</q-td>
      </template>
      <template #body-cell-escalation="props">
        <q-td :props="props">
          <template v-if="props.row.escalate_after_minutes"
            >After {{ props.row.escalate_after_minutes }} min to
            {{ channelNames(props.row.escalate_to) || "—" }}</template
          >
          <span v-else class="rmm-muted">Off</span>
        </q-td>
      </template>
      <template #body-cell-actions="props">
        <q-td :props="props" auto-width>
          <q-btn
            flat
            dense
            round
            size="sm"
            icon="edit"
            :aria-label="`Edit ${props.row.name}`"
            @click="editRoute(props.row)"
          />
          <q-btn
            flat
            dense
            round
            size="sm"
            icon="delete"
            color="negative"
            :aria-label="`Delete ${props.row.name}`"
            @click="deleteRoute(props.row)"
          />
        </q-td>
      </template>
    </q-table>

    <SettingsPanelHeader
      class="q-mt-lg"
      title="History"
      :count="history.length"
      text="The last 200 notifications."
    >
      <q-select
        v-model="sourceFilter"
        :options="[{ value: null, label: 'All sources' }, ...SOURCES]"
        emit-value
        map-options
        dense
        outlined
        options-dense
        style="min-width: 180px"
        aria-label="Filter history by source"
        @update:model-value="loadHistory"
      />
    </SettingsPanelHeader>
    <q-table
      dense
      flat
      class="rmm-table"
      row-key="id"
      :rows="history"
      :columns="historyColumns"
      virtual-scroll
      hide-pagination
      :pagination="{ rowsPerPage: 0 }"
      :rows-per-page-options="[0]"
      :style="{ maxHeight: '40vh' }"
    >
      <template #no-data>
        <div class="full-width q-py-md text-center rmm-muted">
          {{ historyError || "Nothing sent yet." }}
        </div>
      </template>
      <template #body-cell-sent_at="props">
        <q-td :props="props">
          {{ relativeTime(props.value) }}
          <q-tooltip>{{ formatDate(props.value) }}</q-tooltip>
        </q-td>
      </template>
      <template #body-cell-title="props">
        <q-td :props="props">
          <div class="history-clip">{{ props.value }}</div>
          <q-tooltip v-if="props.row.body" max-width="420px">{{
            props.row.body
          }}</q-tooltip>
        </q-td>
      </template>
      <template #body-cell-result="props">
        <q-td :props="props">
          <span
            class="rmm-pill"
            :class="STATE_PILL[props.row.state] || 'rmm-pill--neutral'"
            >{{ STATE_LABEL[props.row.state] || props.row.state
            }}<q-tooltip v-if="props.row.error" max-width="420px">{{
              props.row.error
            }}</q-tooltip></span
          >
          <span
            v-if="props.row.escalation_level"
            class="rmm-pill rmm-pill--warning q-ml-xs"
            >Escalation {{ props.row.escalation_level }}</span
          >
        </q-td>
      </template>
    </q-table>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from "vue";
import { useQuasar } from "quasar";
import { useStore } from "vuex";
import SettingsPanelHeader from "@/components/modals/coresettings/SettingsPanelHeader.vue";
import ChannelDialog from "@/components/notify/ChannelDialog.vue";
import RouteDialog from "@/components/notify/RouteDialog.vue";
import {
  fetchChannels,
  fetchRoutes,
  fetchNotifications,
  removeChannel,
  removeRoute,
  testChannel,
} from "@/api/notify";
import {
  CHANNEL_KINDS,
  SEVERITY_PILL,
  SOURCES,
  kindLabel,
  sourceLabel,
} from "@/utils/notifyChannels";
import { relativeTime } from "@/utils/format";
import { notifyError, notifySuccess } from "@/utils/notify";

const $q = useQuasar();
const store = useStore();
const formatDate = (v) => (v ? store.getters.formatDate(v) : "");

const channels = ref([]);
const routes = ref([]);
const history = ref([]);
const loading = ref(false);
const error = ref("");
const historyError = ref("");
const testing = ref(null);
const sourceFilter = ref(null);

const col = (name, label, extra = {}) => ({
  name,
  label,
  field: name,
  align: "left",
  ...extra,
});
const channelColumns = [
  col("name", "Name"),
  col("enabled", "Status"),
  col("quiet", "Quiet hours"),
  col("last", "Last sent"),
  { name: "actions", label: "", field: "id", align: "right" },
];
const routeColumns = [
  col("name", "Name"),
  col("severities", "Severities"),
  col("sources", "Sources"),
  col("channels", "Channels"),
  col("escalation", "Escalation"),
  { name: "actions", label: "", field: "id", align: "right" },
];
const historyColumns = [
  col("sent_at", "When", { field: (r) => r.sent_at || r.created }),
  col("source", "Source", { format: (v) => sourceLabel(v) }),
  col("severity", "Severity", {
    format: (v) => (v ? v.charAt(0).toUpperCase() + v.slice(1) : "—"),
  }),
  col("title", "Message"),
  col("channel_name", "Channel", {
    format: (v) => v || "—",
  }),
  col("result", "Result"),
];

const STATE_LABEL = {
  queued: "Queued",
  held: "Held (quiet hours)",
  sent: "Sent",
  failed: "Failed",
  dropped: "Dropped",
};
const STATE_PILL = {
  queued: "rmm-pill--info",
  held: "rmm-pill--warning",
  sent: "rmm-pill--positive",
  failed: "rmm-pill--negative",
  dropped: "rmm-pill--neutral",
};

const channelById = computed(
  () => new Map(channels.value.map((c) => [c.id, c.name])),
);
const channelNames = (ids) =>
  (ids || []).map((id) => channelById.value.get(id) || `#${id}`).join(", ");

function errText(e) {
  return e?.response?.status === 403
    ? "Your role cannot manage notifications."
    : "Notifications could not be loaded.";
}

async function loadHistory() {
  historyError.value = "";
  try {
    const rows = await fetchNotifications(
      sourceFilter.value ? { source: sourceFilter.value } : {},
    );
    history.value = Array.isArray(rows) ? rows : [];
  } catch (e) {
    history.value = [];
    historyError.value = errText(e);
  }
}

async function load() {
  loading.value = true;
  error.value = "";
  try {
    const [c, r] = await Promise.all([fetchChannels(), fetchRoutes()]);
    channels.value = Array.isArray(c) ? c : [];
    routes.value = Array.isArray(r) ? r : [];
  } catch (e) {
    error.value = errText(e);
  }
  loading.value = false;
  loadHistory();
}

function editChannel(channel) {
  $q.dialog({ component: ChannelDialog, componentProps: { channel } }).onOk(
    load,
  );
}

function editRoute(route) {
  $q.dialog({
    component: RouteDialog,
    componentProps: { route, channels: channels.value },
  }).onOk(load);
}

function deleteChannel(c) {
  $q.dialog({
    title: `Delete channel ${c.name}?`,
    message: "Routes that use it stop sending there.",
    cancel: true,
    ok: { label: "Delete", color: "negative" },
  }).onOk(async () => {
    try {
      await removeChannel(c.id);
      notifySuccess("Channel deleted");
      load();
    } catch {
      // the error toast comes from the axios boot
    }
  });
}

function deleteRoute(r) {
  $q.dialog({
    title: `Delete route ${r.name}?`,
    cancel: true,
    ok: { label: "Delete", color: "negative" },
  }).onOk(async () => {
    try {
      await removeRoute(r.id);
      notifySuccess("Route deleted");
      load();
    } catch {
      // the error toast comes from the axios boot
    }
  });
}

async function test(c) {
  testing.value = c.id;
  try {
    const r = await testChannel(c.id);
    if (!r?.ok) {
      notifyError(`Test failed: ${r.error || "the channel did not accept it"}`);
    } else {
      notifySuccess("Test message sent");
    }
  } catch {
    // the error toast comes from the axios boot
  }
  testing.value = null;
  load();
}

onMounted(load);
</script>

<style scoped>
.history-clip {
  max-width: 320px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
