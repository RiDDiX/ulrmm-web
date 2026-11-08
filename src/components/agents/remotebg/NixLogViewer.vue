<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <div class="nix-logs" :style="{ height: `${$q.screen.height - 77}px` }">
    <div class="rmm-toolbar nix-logs__toolbar">
      <span class="rmm-card__title">Logs</span>
      <span class="rmm-muted rmm-num"
        >{{ lines.length }} {{ lines.length === 1 ? "line" : "lines" }}</span
      >
      <q-btn
        dense
        flat
        round
        icon="refresh"
        aria-label="Refresh logs"
        @click="load(true)"
      >
        <q-tooltip>Read the log from the agent again</q-tooltip>
      </q-btn>
      <q-space />
      <q-select
        v-model="source"
        :options="sourceOptions"
        emit-value
        map-options
        dense
        options-dense
        outlined
        label="Source"
        class="nix-logs__source"
      />
      <q-input
        v-if="source === 'file'"
        v-model="path"
        dense
        outlined
        label="File"
        class="nix-logs__path rmm-mono"
        :error="!pathValid"
        error-message="Use a file below /var/log/"
        hide-bottom-space
        @keyup.enter="load()"
        @blur="load()"
      />
      <template v-else>
        <q-input
          v-model="unit"
          dense
          outlined
          clearable
          label="Unit"
          :placeholder="unitPlaceholder"
          class="nix-logs__unit"
          @keyup.enter="load()"
          @blur="load()"
          @clear="clearUnit"
        />
        <q-select
          v-model="priority"
          :options="priorityOptions"
          emit-value
          map-options
          dense
          options-dense
          outlined
          label="Priority"
          class="nix-logs__priority"
        />
        <q-select
          v-model="since"
          :options="sinceOptions"
          emit-value
          map-options
          dense
          options-dense
          outlined
          label="Time range"
          class="nix-logs__since"
        />
      </template>
      <q-select
        v-model="count"
        :options="countOptions"
        emit-value
        map-options
        dense
        options-dense
        outlined
        label="Lines"
        class="nix-logs__count"
      />
      <div class="nix-logs__follow">
        <q-toggle v-model="follow" dense label="Follow" />
        <q-tooltip>Read the log again every 10 seconds</q-tooltip>
      </div>
      <q-btn
        dense
        flat
        round
        icon="content_copy"
        aria-label="Copy log lines"
        :disable="lines.length === 0"
        @click="copyLines"
      >
        <q-tooltip>Copy the lines shown to the clipboard</q-tooltip>
      </q-btn>
    </div>
    <q-linear-progress
      indeterminate
      color="primary"
      class="nix-logs__progress"
      :class="{ 'nix-logs__progress--idle': !loading }"
    />
    <q-banner
      v-if="updateRequired"
      dense
      rounded
      class="rmm-banner-warning q-ma-sm"
    >
      <template v-slot:avatar>
        <q-icon name="system_update" color="warning" />
      </template>
      Agent update required. This agent version cannot read logs yet. Update the
      agent, then refresh.
    </q-banner>
    <q-banner
      v-else-if="error && lines.length > 0"
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
          @click="load(true)"
        />
      </template>
    </q-banner>
    <div v-if="truncated && lines.length > 0" class="nix-logs__note">
      The agent shortened the output. Narrow the filters to see less at once.
    </div>
    <q-virtual-scroll
      v-if="lines.length > 0"
      ref="scroller"
      v-slot="{ item, index }"
      :items="lines"
      :virtual-scroll-item-size="20"
      class="nix-logs__list"
      role="region"
      aria-label="Log lines"
      tabindex="0"
    >
      <div
        :key="index"
        class="nix-logs__line"
        :class="[
          levelOf(item.priority).cls,
          { 'nix-logs__line--raw': !item.ts && !item.unit },
        ]"
      >
        <template v-if="item.ts || item.unit">
          <span class="nix-logs__ts">{{ logTime(item.ts) }}</span>
          <span class="nix-logs__level">{{
            levelOf(item.priority).label
          }}</span>
          <span class="nix-logs__unit-name" :title="item.unit">{{
            item.unit
          }}</span>
        </template>
        <span class="nix-logs__message">{{ item.message }}</span>
      </div>
    </q-virtual-scroll>
    <template v-else-if="!loading && !updateRequired">
      <EmptyState
        v-if="error"
        icon="error_outline"
        title="The log could not be loaded"
        :text="error"
      >
        <q-btn
          outline
          no-caps
          color="primary"
          icon="refresh"
          label="Retry"
          @click="load(true)"
        />
      </EmptyState>
      <EmptyState
        v-else-if="lastLoadedAt"
        icon="article"
        title="No log lines"
        :text="
          source === 'file'
            ? 'The agent found no lines in this file.'
            : 'Nothing matches in this time range. Pick a longer range or clear the unit and priority filters.'
        "
      />
    </template>
  </div>
</template>

<script>
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  toRefs,
  watch,
} from "vue";
import { copyToClipboard, date } from "quasar";
import { useStore } from "vuex";
import { fetchNixLogs, nixError } from "@/api/nix";
import { notifyError, notifySuccess } from "@/utils/notify";
import EmptyState from "@/components/ui/EmptyState.vue";

const FOLLOW_MS = 10000;

const LEVELS = [
  "Emergency",
  "Alert",
  "Critical",
  "Error",
  "Warning",
  "Notice",
  "Info",
  "Debug",
];
const SHORT = [
  "EMERG",
  "ALERT",
  "CRIT",
  "ERROR",
  "WARN",
  "NOTICE",
  "INFO",
  "DEBUG",
];

const priorityOptions = [{ label: "Any priority", value: null }].concat(
  LEVELS.map((name, n) => ({
    label: n === 0 ? "Emergency (0)" : `${name} or more severe (0-${n})`,
    value: n,
  })),
);

const sinceOptions = [
  { label: "Last 15 minutes", value: 15 },
  { label: "Last hour", value: 60 },
  { label: "Last 6 hours", value: 360 },
  { label: "Last 24 hours", value: 1440 },
  { label: "Last 7 days", value: 10080 },
  { label: "Any time", value: null },
];

const countOptions = [50, 100, 200, 500, 1000, 2000].map((n) => ({
  label: `${n} lines`,
  value: n,
}));

function levelOf(priority) {
  const n = priority === null || priority === "" ? NaN : Number(priority);
  if (!Number.isInteger(n) || n < 0 || n > 7) return { label: "", cls: "" };
  const cls =
    n <= 3
      ? "nix-logs__line--error"
      : n === 4
        ? "nix-logs__line--warning"
        : n === 5
          ? "nix-logs__line--notice"
          : n === 7
            ? "nix-logs__line--debug"
            : "";
  return { label: SHORT[n], cls };
}

// epoch seconds, ms, us or ns as digits, otherwise a date string
function logTime(ts) {
  const s = String(ts ?? "");
  const d = /^\d{10,19}$/.test(s)
    ? new Date(Number(s.slice(0, 13).padEnd(13, "0")))
    : new Date(s);
  return isNaN(d) ? s : date.formatDate(d, "YYYY-MM-DD HH:mm:ss");
}

export default {
  name: "NixLogViewer",
  components: { EmptyState },
  props: {
    agent_id: !String,
    agentPlatform: !String,
  },
  setup(props) {
    const formatDate = computed(() => useStore().getters.formatDate);

    // a popout per device: the platform does not change while it is open
    const plat = toRefs(props).agentPlatform.value;
    const darwin = plat === "darwin";
    // freebsd: log files only, no journal or unified log
    const sourceOptions = [
      darwin
        ? { label: "Unified log", value: "unified" }
        : { label: "Journal", value: "journal" },
      { label: "Log file", value: "file" },
    ].filter((o) => plat !== "freebsd" || o.value === "file");
    const unitPlaceholder =
      darwin || plat === "freebsd" ? "sshd" : "ssh.service";

    const source = ref(sourceOptions[0].value);
    const unit = ref("");
    const priority = ref(null);
    const since = ref(60);
    const count = ref(200);
    const path = ref(
      { darwin: "/var/log/system.log", freebsd: "/var/log/messages" }[plat] ??
        "/var/log/syslog",
    );
    const follow = ref(false);

    const lines = ref([]);
    const truncated = ref(false);
    const loading = ref(false);
    const error = ref("");
    const updateRequired = ref(false);
    const lastLoadedAt = ref(null);
    const scroller = ref(null);

    const pathValid = computed(
      () => /^\/var\/log\/.+/.test(path.value) && !path.value.includes(".."),
    );

    function params() {
      const p = { source: source.value, lines: count.value };
      if (source.value === "file") {
        p.path = path.value;
        return p;
      }
      const u = (unit.value || "").trim();
      if (u) p.unit = u;
      if (priority.value !== null) p.priority = priority.value;
      if (since.value !== null) p.since = since.value;
      return p;
    }

    let lastKey = "";
    let seq = 0;

    // force reloads the same request; without it only a changed filter does
    async function load(force = false, poll = false) {
      if (source.value === "file" && !pathValid.value) return;
      const p = params();
      const key = JSON.stringify(p);
      if (!force && key === lastKey) return;
      const changed = key !== lastKey;
      // a new filter must not show the previous rows under its labels
      if (changed) {
        lines.value = [];
        truncated.value = false;
        error.value = "";
        lastLoadedAt.value = null;
      }
      const mine = ++seq;
      const el = scroller.value?.$el;
      const atEnd =
        !poll || !el || el.scrollTop + el.clientHeight >= el.scrollHeight - 24;
      loading.value = true;
      try {
        const data = await fetchNixLogs(props.agent_id, p);
        if (mine !== seq) return;
        // only a loaded filter counts as shown, so a failed one is fetched again
        lastKey = key;
        lines.value = Array.isArray(data?.lines) ? data.lines : [];
        truncated.value = data?.truncated === true;
        error.value = "";
        updateRequired.value = false;
        lastLoadedAt.value = new Date();
        // newest lines are at the bottom; stay there unless the user scrolled up
        if (atEnd && lines.value.length) {
          await nextTick();
          scroller.value?.scrollTo(lines.value.length - 1, "end");
        }
      } catch (e) {
        if (mine !== seq) return;
        const err = nixError(e, "Your role cannot view logs for this agent.");
        error.value = err.text;
        updateRequired.value = err.updateRequired;
        follow.value = false;
      } finally {
        if (mine === seq) loading.value = false;
      }
    }

    function clearUnit() {
      unit.value = "";
      load();
    }

    watch([source, priority, since, count], () => load());

    let timer = null;
    watch(follow, (on) => {
      clearInterval(timer);
      timer = null;
      if (!on) return;
      load(true);
      timer = setInterval(() => {
        if (!document.hidden && !loading.value) load(true, true);
      }, FOLLOW_MS);
    });

    function copyLines() {
      const text = lines.value
        .map((l) =>
          [logTime(l.ts), levelOf(l.priority).label, l.unit, l.message]
            .filter(Boolean)
            .join(" "),
        )
        .join("\n");
      copyToClipboard(text)
        .then(() => notifySuccess(`Copied ${lines.value.length} lines`))
        .catch(() => notifyError("The browser did not allow copying"));
    }

    onMounted(() => load());
    onBeforeUnmount(() => clearInterval(timer));

    return {
      unitPlaceholder,
      sourceOptions,
      priorityOptions,
      sinceOptions,
      countOptions,
      source,
      unit,
      priority,
      since,
      count,
      path,
      pathValid,
      follow,
      lines,
      truncated,
      loading,
      error,
      updateRequired,
      lastLoadedAt,
      scroller,
      formatDate,
      load,
      clearUnit,
      copyLines,
      levelOf,
      logTime,
    };
  },
};
</script>

<style scoped>
.nix-logs {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.nix-logs__toolbar {
  flex-wrap: wrap;
}

.nix-logs__source {
  width: 150px;
}

.nix-logs__path {
  width: 240px;
}

.nix-logs__unit {
  width: 180px;
}

.nix-logs__priority {
  width: 230px;
}

.nix-logs__since {
  width: 160px;
}

.nix-logs__count {
  width: 120px;
}

.nix-logs__follow {
  display: inline-flex;
  padding: 0 4px;
}

.nix-logs__progress {
  flex: 0 0 2px;
  height: 2px;
}

.nix-logs__progress--idle {
  visibility: hidden;
}

.nix-logs__note {
  padding: 4px 12px;
  color: var(--rmm-text-muted);
  font-size: var(--rmm-fs-xs);
}

.nix-logs__list {
  flex: 1 1 auto;
  min-height: 0;
  background: var(--rmm-surface);
  font-family: var(--rmm-mono);
  font-size: 12.5px;
  line-height: 20px;
}

/* the global focus ring sits outside and would be clipped here */
.nix-logs__list:focus-visible {
  outline-offset: -2px;
}

.nix-logs__line {
  display: grid;
  grid-template-columns: 19ch 6ch minmax(0, 18ch) minmax(0, 1fr);
  gap: 12px;
  padding: 0 12px;
  color: var(--rmm-text);
}

/* plain file lines carry only the text */
.nix-logs__line--raw {
  grid-template-columns: minmax(0, 1fr);
}

.nix-logs__line:hover {
  background: var(--rmm-surface-2);
}

.nix-logs__ts,
.nix-logs__unit-name {
  color: var(--rmm-text-muted);
}

.nix-logs__unit-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.nix-logs__level {
  font-weight: 600;
}

.nix-logs__message {
  min-width: 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.nix-logs__line--error .nix-logs__level,
.nix-logs__line--error .nix-logs__message {
  color: var(--rmm-status-negative);
}

.nix-logs__line--warning .nix-logs__level,
.nix-logs__line--warning .nix-logs__message {
  color: var(--rmm-status-warning);
}

.nix-logs__line--notice .nix-logs__level {
  color: var(--rmm-status-info);
}

.nix-logs__line--debug .nix-logs__level,
.nix-logs__line--debug .nix-logs__message {
  color: var(--rmm-text-muted);
}
</style>
