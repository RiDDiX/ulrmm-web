// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

import axios from "axios";
import { Dark, LoadingBar, Screen } from "quasar";
import { createStore } from "vuex";
import { SILENT_REQUEST_CONFIG } from "@/constants/constants";
import { formatDate } from "@/utils/format";

// /agents/ loads can overlap (tree clicks, tab switches, silent polling);
// only the newest one for the current scope may write the table
const agentLoads = { latest: 0, inFlight: 0, mutation: 0 };

// state key -> [initial value, mutation that just stores its payload]
const FIELDS = {
  tree: [[], null],
  treeReady: [false, null],
  agents: [[], null],
  // http status of the last failed /agents/ or /clients/ load, null when ok
  agentsError: [null, "setAgentsError"],
  treeError: [null, "setTreeError"],
  selectedTree: ["", "setSelectedTree"],
  selectedRow: [null, null],
  agentPlatform: ["windows", "setAgentPlatform"],
  agentName: [null, "setAgentName"],
  agentAvailability: [null, "setAgentAvailability"],
  agentTableLoading: [false, "AGENT_TABLE_LOADING"],
  needrefresh: [false, "SET_REFRESH_NEEDED"],
  refreshSummaryTab: [false, "setRefreshSummaryTab"],
  tableHeight: ["300px", null],
  tabHeight: ["300px", null],
  // user preferences
  showCommunityScripts: [false, "setShowCommunityScripts"],
  agentDblClickAction: ["", "SET_AGENT_DBLCLICK_ACTION"],
  agentUrlAction: [null, "SET_URL_ACTION"],
  defaultAgentTblTab: [null, "SET_DEFAULT_AGENT_TBL_TAB"],
  clientTreeSort: ["alphafail", "SET_CLIENT_TREE_SORT"],
  clearSearchWhenSwitching: [false, "setClearSearchWhenSwitching"],
  dateFormat: ["MMM-DD-YYYY - HH:mm", "setDateFormat"],
  dash_info_color: ["info", "setDashInfoColor"],
  dash_positive_color: ["positive", "setDashPositiveColor"],
  dash_negative_color: ["negative", "setDashNegativeColor"],
  dash_warning_color: ["warning", "setDashWarningColor"],
  issuesUrl: [null, "SET_ISSUES_URL"],
  hosted: [false, "SET_HOSTED"],
  currentVersion: [null, "setCurrentVersion"],
  latestVersion: [null, "setLatestVersion"],
  aiScriptsEnabled: [false, "setAiScriptsEnabled"],
  run_cmd_placeholder_text: [
    {
      cmd: "rmdir /S /Q C:\\Windows\\System32",
      powershell: "Remove-Item -Recurse -Force C:\\Windows\\System32",
      shell: "rm -rf --no-preserve-root /",
    },
    "setRunCmdPlaceholders",
  ],
  server_scripts_enabled: [true, "setServerScriptsEnabled"],
  web_terminal_enabled: [true, "setWebTerminalEnabled"],
  sso_enabled: [false, "setSSOEnabled"],
  block_local_user_logon: [false, "setBlockLocalUserLogon"],
  // effective reporting flags from dashinfo; null until a server
  // sends them, and the UI then leaves the decision to the server
  reporting_perms: [{ view: null, manage: null }, null],
  // dashboard server update and backup management (role flag)
  can_manage_server_updates: [false, null],
  // "run task now" on policy tasks (role flag)
  can_run_autotasks: [false, null],
  // built-in superuser or a superuser role
  is_superuser: [false, null],
};

const initialState = () =>
  Object.fromEntries(
    Object.entries(FIELDS).map(([key, [value]]) => [
      key,
      structuredClone(value),
    ]),
  );

// dashinfo field -> mutation, committed on every load
const DASHINFO_ALWAYS = [
  ["version", "setCurrentVersion"],
  ["latest_version", "setLatestVersion"],
  ["dbl_click_action", "SET_AGENT_DBLCLICK_ACTION"],
  ["url_action", "SET_URL_ACTION"],
  ["show_community_scripts", "setShowCommunityScripts"],
  ["hosted", "SET_HOSTED"],
  ["issues_url", "SET_ISSUES_URL"],
  ["ai_scripts_enabled", "setAiScriptsEnabled"],
  ["run_cmd_placeholder_text", "setRunCmdPlaceholders"],
  ["server_scripts_enabled", "setServerScriptsEnabled"],
  ["web_terminal_enabled", "setWebTerminalEnabled"],
  ["sso_enabled", "setSSOEnabled"],
  ["block_local_user_logon", "setBlockLocalUserLogon"],
  ["can_manage_server_updates", "setServerUpdatePerm"],
  ["can_run_autotasks", "setRunAutotasksPerm"],
  ["is_superuser", "setSuperuser"],
];

// user preferences, applied unless the caller keeps the current ones
const DASHINFO_PREFS = [
  ["clear_search_when_switching", "setClearSearchWhenSwitching"],
  ["default_agent_tbl_tab", "SET_DEFAULT_AGENT_TBL_TAB"],
  ["client_tree_sort", "SET_CLIENT_TREE_SORT"],
];

const DASH_COLORS = [
  ["dash_info_color", "setDashInfoColor"],
  ["dash_positive_color", "setDashPositiveColor"],
  ["dash_negative_color", "setDashNegativeColor"],
  ["dash_warning_color", "setDashWarningColor"],
];

function availabilityOf(agent) {
  const { agent_id, status, last_seen } = agent;
  return { agent_id, status, last_seen };
}

function agentsQuery(state) {
  const params = [];
  if (state.defaultAgentTblTab !== "mixed") {
    params.push(`monitoring_type=${state.defaultAgentTblTab}`);
  }
  const id = state.selectedTree.split("|")[1];
  if (state.selectedTree.includes("Client")) params.push(`client=${id}`);
  else if (state.selectedTree.includes("Site")) params.push(`site=${id}`);
  return params.length ? `?${params.join("&")}` : "";
}

const agentScope = (state) =>
  `${state.defaultAgentTblTab}\n${state.selectedTree}`;

// maintenance wins over failing checks; healthy nodes get no colour
function treeColor({ maintenance_mode, failing_checks }) {
  if (maintenance_mode) return "green";
  if (failing_checks.error) return "negative";
  if (failing_checks.warning) return "warning";
  return undefined;
}

const NODE_KIND = {
  Client: { header: "root", icon: "business" },
  Site: { header: "generic", icon: "apartment", selectable: true },
};

function treeNode(kind, entity, extra) {
  const color = treeColor(entity);
  return {
    label: entity.name,
    id: entity.id,
    raw: `${kind}|${entity.id}`,
    ...NODE_KIND[kind],
    ...extra,
    ...(color && { color }),
  };
}

const buildTree = (clients) =>
  clients.map((client) =>
    treeNode("Client", client, {
      children: client.sites.map((site) => treeNode("Site", site, { site })),
      client,
    }),
  );

const isFailing = (node) =>
  node.color === "negative" || node.color === "warning";

export default function () {
  const mutations = Object.fromEntries(
    Object.entries(FIELDS)
      .filter(([, [, setter]]) => setter)
      .map(([key, [, setter]]) => [
        setter,
        (state, value) => {
          state[key] = value;
        },
      ]),
  );

  Object.assign(mutations, {
    setActiveRow(state, agent_id) {
      state.selectedRow = agent_id;
      const agent = state.agents.find((row) => row.agent_id === agent_id);
      state.agentAvailability = agent ? availabilityOf(agent) : null;
    },
    setAgents(state, agents) {
      state.agents = agents;
      const agent = agents.find((row) => row.agent_id === state.selectedRow);
      if (agent) state.agentAvailability = availabilityOf(agent);
      else if (state.selectedRow) state.agentAvailability = null;
    },
    setAgentDisplayName(state, { agent_id, display_name }) {
      const agent = state.agents.find((row) => row.agent_id === agent_id);
      if (agent) agent.display_name = display_name;
    },
    destroySubTable(state) {
      state.selectedRow = null;
      state.agentAvailability = null;
    },
    loadTree(state, nodes) {
      state.tree = nodes;
      state.treeReady = true;
    },
    SET_SPLITTER(state, val) {
      // toolbar 50px, file bar 40px, agent filter tabs and spacing 78px
      state.tableHeight = `${Screen.height - 50 - 40 - 78 - val}px`;
      // q-tabs are 37px, plus the separator under them and the 10px of
      // padding the lower pane keeps clear of the drag handle
      state.tabHeight = `${val - 48}px`;
    },
    setServerUpdatePerm(state, value) {
      state.can_manage_server_updates = value === true;
    },
    setRunAutotasksPerm(state, value) {
      state.can_run_autotasks = value === true;
    },
    setSuperuser(state, value) {
      state.is_superuser = value === true;
    },
    setReportingPerms(state, { view, manage }) {
      const flag = (v) => (typeof v === "boolean" ? v : null);
      state.reporting_perms = { view: flag(view), manage: flag(manage) };
    },
  });

  const saveUiPref = (body) => axios.patch("/accounts/users/ui/", body);

  const actions = {
    setShowCommunityScripts({ commit }, show) {
      saveUiPref({ show_community_scripts: show }).then(() =>
        commit("setShowCommunityScripts", show),
      );
    },
    // clearSelection also drops the selected client/site and the open agent
    refreshDashboard({ state, commit, dispatch }, clearSelection = false) {
      if (clearSelection || !state.selectedTree) commit("setSelectedTree", "");
      if (clearSelection) commit("destroySubTable");
      dispatch("getDashInfo", false);
      ["loadAgents", "loadTree"].forEach((action) => dispatch(action));
    },
    async loadAgents({ state, commit }, { silent = false } = {}) {
      if (silent && agentLoads.inFlight) return;

      const request = ++agentLoads.latest;
      const mutation = agentLoads.mutation;
      const scope = agentScope(state);
      agentLoads.inFlight += 1;
      if (!silent) commit("AGENT_TABLE_LOADING", true);

      const stale = () =>
        request !== agentLoads.latest || scope !== agentScope(state);
      try {
        const { data } = await axios.get(
          `/agents/${agentsQuery(state)}`,
          silent ? SILENT_REQUEST_CONFIG : undefined,
        );
        if (stale() || (silent && mutation !== agentLoads.mutation)) return;
        commit("setAgents", data);
        commit("setAgentsError", null);
      } catch (e) {
        console.error(e);
        if (silent || stale()) return;
        // never leave the previous scope's rows on screen
        commit("setAgents", []);
        commit("setAgentsError", e?.response?.status || "request");
      } finally {
        agentLoads.inFlight -= 1;
        if (!silent && request === agentLoads.latest) {
          commit("AGENT_TABLE_LOADING", false);
        }
      }
    },
    invalidateAgentsRequest() {
      agentLoads.mutation += 1;
    },
    async getDashInfo({ commit }, edited = true) {
      const { data } = await axios.get("/core/dashinfo/");
      const apply = (pairs) =>
        pairs.forEach(([field, name]) => commit(name, data[field]));

      apply(DASH_COLORS);
      if (edited) {
        LoadingBar.setDefaults({ color: data.loading_bar_color });
        apply(DASHINFO_PREFS);
      }
      Dark.set(data.dark_mode);
      apply(DASHINFO_ALWAYS);
      commit("setReportingPerms", {
        view: data.can_view_reports,
        manage: data.can_manage_reports,
      });
      // null (never set) and "" both mean the Global Settings default
      commit("setDateFormat", data.date_format || data.default_date_format);
    },
    loadTree({ commit, state }) {
      const router = this.$router;
      setTimeout(async () => {
        try {
          const { data } = await axios.get("/clients/");
          if (data.length === 0) router.push({ name: "InitialSetup" });

          commit("setTreeError", null);
          const nodes = buildTree(data).sort((a, b) =>
            a.label.localeCompare(b.label),
          );
          commit(
            "loadTree",
            state.clientTreeSort === "alphafail"
              ? [
                  ...nodes.filter(isFailing),
                  ...nodes.filter((n) => !isFailing(n)),
                ]
              : nodes,
          );
        } catch (e) {
          console.error(e);
          commit("setTreeError", e?.response?.status || "request");
          state.treeReady = true;
        }
      }, 150);
    },
    async checkVer({ commit }, { silent = false } = {}) {
      try {
        const { data: version } = await axios.get(
          "/core/version/",
          silent ? SILENT_REQUEST_CONFIG : undefined,
        );
        const known = localStorage.getItem("rmmver");
        if (!known) {
          localStorage.setItem("rmmver", version);
        } else if (known !== version) {
          localStorage.setItem("rmmver", "0.0.1");
          commit("SET_REFRESH_NEEDED", true);
        }
        return true;
      } catch {
        return false;
      }
    },
    reload() {
      localStorage.removeItem("rmmver");
      location.reload();
    },
  };

  return createStore({
    state: initialState,
    getters: {
      selectedAgentId: (state) => state.selectedRow,
      showCommunityScripts: (state) => state.showCommunityScripts,
      allClientsSelected: (state) => !state.selectedTree,
      formatDate: (state) => (date) =>
        formatDate(date, state.dateFormat || undefined),
    },
    mutations,
    actions,
  });
}
