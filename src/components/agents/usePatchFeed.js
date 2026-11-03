// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

import {
  computed,
  inject,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  watch,
} from "vue";
import { useStore } from "vuex";
import { useDashboardStore } from "@/stores/dashboard";
import {
  DASHBOARD_REFRESH_INTERVAL,
  SILENT_REQUEST_CONFIG,
} from "@/constants/constants";
import { fetchAgent } from "@/api/agents";
import {
  editAgentUpdate,
  fetchAgentUpdates,
  runAgentUpdateInstall,
  runAgentUpdateScan,
} from "@/api/winupdates";
import { applianceOf, relativeTime } from "@/utils/format";
import { notifyError, notifySuccess } from "@/utils/notify";
import { decisionLabel, getPatchState, willInstall } from "@/utils/patchStatus";

const menuOpen = () => document.querySelector(".q-menu") !== null;

// Patch list of the selected agent. A silent reload runs every dashboard
// interval (10 s while an install runs) and waits while a dialog or a menu
// is open, the page is hidden or the dashboard is offline. Replies for
// another agent or an outdated request are dropped.
// afterLoad(rows) runs after each accepted reply, onAgentChange when the
// selection moves to another agent.
export function usePatchFeed({ afterLoad, onAgentChange }) {
  const vuex = useStore();
  const dashboard = useDashboardStore();
  const refreshDashboard = inject("refreshDashboard");
  const agentId = computed(() => vuex.state.selectedRow);

  const rows = ref([]);
  const detail = ref(null);
  const busy = ref(false);
  const failure = ref(null);
  const loadedAt = ref(null);
  const dialogOpen = ref(false);
  // ids the Install click marked; cleared by the next successful load
  const installing = reactive(new Set());
  let generation = 0;
  let timer;
  let alive = false;

  const policy = computed(() => detail.value?.effective_patch_policy);
  const rowState = (row) =>
    getPatchState(row, installing.has(row.id), policy.value);
  const hasInstalling = computed(() =>
    rows.value.some((row) => rowState(row) === "installing"),
  );

  // scan, install and reboot need the device reachable; the SPA does not
  // decide that from a permission of its own
  const availability = computed(() =>
    vuex.state.agentAvailability?.agent_id === agentId.value
      ? vuex.state.agentAvailability
      : detail.value,
  );
  const online = computed(() => availability.value?.status === "online");
  const offlineReason = computed(
    () =>
      `Needs the agent online, last seen ${relativeTime(availability.value?.last_seen)}`,
  );
  // the server refuses package scan and install on an appliance
  const managedBy = computed(
    () => applianceOf(detail.value?.wmi_detail)?.name ?? "",
  );
  const failureText = computed(() => {
    if (!failure.value) return "";
    return failure.value?.response?.status === 403
      ? "Your role cannot view updates for this agent."
      : "Updates could not be loaded.";
  });

  function stopTimer() {
    window.clearTimeout(timer);
    timer = undefined;
  }

  const blocked = () => busy.value || dialogOpen.value || menuOpen();

  function scheduleRefresh(
    delay = hasInstalling.value ? 10_000 : DASHBOARD_REFRESH_INTERVAL,
  ) {
    stopTimer();
    const wanted =
      alive &&
      agentId.value &&
      !dashboard.isOffline &&
      document.visibilityState === "visible";
    if (wanted)
      timer = window.setTimeout(() => void load({ silent: true }), delay);
  }

  // no reload under an open dialog; the timer restarts once it is gone
  function trackDialog(dialog) {
    dialogOpen.value = true;
    stopTimer();
    dialog.onDismiss(() => {
      dialogOpen.value = false;
      scheduleRefresh();
    });
    return dialog;
  }

  async function load(options = {}) {
    const silent = options?.silent === true;
    const id = agentId.value;
    if (!id) return;
    if (silent && blocked()) {
      scheduleRefresh();
      return;
    }
    stopTimer();
    const mine = ++generation;
    const current = () => mine === generation && id === agentId.value;
    if (!silent) busy.value = true;
    try {
      const config = silent ? SILENT_REQUEST_CONFIG : undefined;
      // the detail only feeds the header strip; when it fails the list
      // still shows
      const [list, agent] = await Promise.all([
        fetchAgentUpdates(id, {}, config),
        fetchAgent(id, {}, config).catch((err) => {
          console.error(err);
          return null;
        }),
      ]);
      if (!current()) return;
      if (silent && (dialogOpen.value || menuOpen())) return;
      rows.value = list;
      detail.value = agent || (silent ? detail.value : null);
      if (agent) {
        const { agent_id, status, last_seen } = agent;
        vuex.commit("setAgentAvailability", { agent_id, status, last_seen });
      }
      failure.value = null;
      loadedAt.value = new Date();
      installing.clear();
      afterLoad(list);
    } catch (err) {
      console.error(err);
      // a failed silent reload keeps the last good list on screen
      if (current() && (!silent || loadedAt.value === null)) {
        failure.value = err;
      }
    } finally {
      if (current()) {
        if (!silent) busy.value = false;
        scheduleRefresh();
      }
    }
  }

  async function decide(ids, action) {
    generation += 1;
    stopTimer();
    busy.value = true;
    try {
      const outcomes = await Promise.allSettled(
        ids.map((id) => editAgentUpdate(id, { action })),
      );
      // rows change locally only when every request went through; after a
      // partial failure the list is reloaded to match the server
      const refused = outcomes.filter((o) => o.status === "rejected").length;
      if (refused > 0) {
        notifyError(`${refused} of ${ids.length} updates could not be changed`);
        await load();
        refreshDashboard();
        return;
      }
      const wanted = new Set(ids);
      const touched = rows.value.filter((row) => wanted.has(row.id));
      rows.value = rows.value.map((row) =>
        wanted.has(row.id) ? { ...row, action } : row,
      );
      const verb = decisionLabel(action);
      const [first] = touched;
      notifySuccess(
        touched.length === 1
          ? `${first.title || first.kb} marked ${verb}`
          : `${touched.length} updates marked ${verb}`,
      );
      refreshDashboard();
    } catch (err) {
      console.error(err);
    } finally {
      busy.value = false;
      scheduleRefresh();
    }
  }

  async function scan() {
    stopTimer();
    busy.value = true;
    try {
      notifySuccess(await runAgentUpdateScan(agentId.value));
    } catch (err) {
      console.error(err);
    }
    busy.value = false;
    scheduleRefresh();
  }

  async function install() {
    // the button is off while offline; a stray call still must not mark
    // rows "installing" when nothing was sent to the device
    if (!online.value) return;
    const marked = rows.value
      .filter(
        (row) =>
          rowState(row) !== "installing" && willInstall(row, policy.value),
      )
      .map((row) => row.id);
    marked.forEach((id) => installing.add(id));
    generation += 1;
    stopTimer();
    busy.value = true;
    try {
      notifySuccess(await runAgentUpdateInstall(agentId.value));
    } catch (err) {
      console.error(err);
      marked.forEach((id) => installing.delete(id));
    }
    busy.value = false;
    scheduleRefresh();
  }

  watch(agentId, (id) => {
    stopTimer();
    generation += 1;
    rows.value = [];
    detail.value = null;
    installing.clear();
    failure.value = null;
    loadedAt.value = null;
    onAgentChange();
    if (id) load();
  });

  watch(
    () => dashboard.isOffline,
    (offline) => {
      if (offline) stopTimer();
      else scheduleRefresh(0);
    },
  );

  function onVisibility() {
    stopTimer();
    if (document.visibilityState !== "visible") return;
    if (blocked()) scheduleRefresh();
    else void load({ silent: true });
  }

  onMounted(() => {
    alive = true;
    document.addEventListener("visibilitychange", onVisibility);
    if (agentId.value) load();
  });

  onBeforeUnmount(() => {
    alive = false;
    generation += 1;
    stopTimer();
    document.removeEventListener("visibilitychange", onVisibility);
  });

  return {
    agentId,
    rows,
    detail,
    busy,
    failure,
    failureText,
    loadedAt,
    installing,
    policy,
    rowState,
    hasInstalling,
    online,
    offlineReason,
    managedBy,
    trackDialog,
    load,
    decide,
    scan,
    install,
  };
}
