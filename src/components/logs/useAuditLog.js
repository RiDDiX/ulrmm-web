// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

import { computed, onMounted, reactive, ref, watch } from "vue";
import { fetchAuditLog } from "@/api/logs";
import { useClientDropdown } from "@/composables/clients";
import { useAgentDropdown } from "@/composables/agents";
import { useUserDropdown } from "@/composables/accounts";

const toOptions = (labels) =>
  Object.entries(labels).map(([value, label]) => ({ value, label }));

const AGENT_ACTIONS = toOptions({
  add: "Add Object",
  modify: "Modify Object",
  execute_command: "Execute Command",
  execute_script: "Execute Script",
  remote_session: "Remote Session",
  url_action: "URL Action",
  view: "View Object",
});

// only offered on the global log, after the agent actions
const GLOBAL_ACTIONS = toOptions({
  agent_install: "Agent Installs",
  bulk_action: "Bulk Actions",
  delete: "Delete Object",
  failed_login: "Failed User login",
  login: "User Login",
  check_run: "Check Run",
  task_run: "Task Run Results",
});

const OBJECTS = toOptions({
  agent: "Agent",
  automatedtask: "Automated Task",
  bulk: "Bulk Actions",
  coresettings: "Core Settings",
  check: "Check",
  client: "Client",
  policy: "Policy",
  site: "Site",
  script: "Script",
  scriptsnippet: "Script Snippet",
  user: "User",
  winupdatepolicy: "Patch Policy",
  alerttemplate: "Alert Template",
  role: "Role",
  urlaction: "URL Action",
  keystore: "Global Key Store",
  customfield: "Custom Field",
  schedule: "Schedule",
  reportschedule: "Report Schedule",
  networkdevice: "Network Device",
  tag: "Tag",
  devicegroup: "Device Group",
  credential: "Credential",
  document: "Document",
  discovery: "Discovery",
  globalkvstore: "Global Key Value Store",
  lapspolicy: "LAPS Policy",
  channel: "Notification Channel",
  route: "Notification Route",
  license: "License",
  maintenanceschedule: "Maintenance Schedule",
  apikey: "API Key",
  baseline: "Software Baseline",
  appupdatesettings: "App Update Settings",
  softwarepackage: "Software Package",
  reporttemplate: "Report Template",
  reporthtmltemplate: "Report HTML Template",
  reportdataquery: "Report Data Query",
  reporthistory: "Report History",
  unificontroller: "UniFi Controller",
  opnsensefirewall: "OPNsense Firewall",
});

// numeric values, so no object map here
const PERIODS = [
  [1, "1 Day Ago"],
  [7, "1 Week Ago"],
  [30, "30 Days Ago"],
  [90, "3 Months Ago"],
  [180, "6 Months Ago"],
  [365, "1 Year Ago"],
  [0, "Everything"],
].map(([value, label]) => ({ value, label }));

export const SCOPES = [
  { label: "Clients", value: "clients" },
  { label: "Agents", value: "agents" },
];

const filled = (list) => !!list && list.length > 0;

// agents win over clients; the server reads one of the two
function auditQuery(chosen, pagination) {
  const query = { pagination };
  if (filled(chosen.agents)) query.agentFilter = chosen.agents;
  else if (filled(chosen.clients)) query.clientFilter = chosen.clients;
  if (filled(chosen.users)) query.userFilter = chosen.users;
  if (chosen.time) query.timeFilter = chosen.time;
  if (filled(chosen.actions)) query.actionFilter = chosen.actions;
  if (filled(chosen.objects)) query.objectFilter = chosen.objects;
  return query;
}

// agentId is read once: an agent tab never turns into the global log
export function useAuditLog(agentId) {
  const clientList = useClientDropdown();
  const agentList = useAgentDropdown();
  const userList = useUserDropdown();

  const entries = ref([]);
  const busy = ref(false);
  const ran = ref(false);
  const failure = ref("");
  const scope = ref("clients");
  const chosen = reactive({
    time: 7,
    agents: agentId ? [agentId] : null,
    clients: null,
    objects: null,
    actions: null,
    users: null,
  });
  const paging = ref({
    page: 1,
    rowsNumber: null,
    rowsPerPage: 25,
    sortBy: "entry_time",
    descending: true,
  });

  const actionChoices = agentId
    ? [...AGENT_ACTIONS]
    : [...AGENT_ACTIONS, ...GLOBAL_ACTIONS];

  const fields = computed(() => {
    const many = { clearable: true, outlined: true, multiple: true };
    const searchable = { ...many, mapOptions: true, filterable: true };
    const scoped = !agentId;
    return [
      {
        key: "agents",
        label: "Agent",
        shown: scoped && scope.value === "agents",
        options: agentList.agentOptions.value,
        attrs: searchable,
      },
      {
        key: "clients",
        label: "Clients",
        shown: scoped && scope.value === "clients",
        options: clientList.clientOptions.value,
        attrs: searchable,
      },
      {
        key: "users",
        label: "Users",
        shown: true,
        options: userList.userOptions.value,
        attrs: many,
      },
      {
        key: "actions",
        label: "Action",
        shown: true,
        options: actionChoices,
        attrs: { ...many, mapOptions: true },
      },
      {
        key: "objects",
        label: "Object",
        shown: scoped,
        options: OBJECTS,
        attrs: { ...many, mapOptions: true },
      },
      {
        key: "time",
        label: "Time",
        shown: true,
        options: PERIODS,
        attrs: { outlined: true, mapOptions: true },
      },
    ].filter((field) => field.shown);
  });

  async function load() {
    busy.value = true;
    failure.value = "";
    ran.value = true;
    try {
      const reply = await fetchAuditLog(auditQuery(chosen, paging.value));
      entries.value = reply.audit_logs;
      paging.value.rowsNumber = reply.total;
    } catch (err) {
      failure.value =
        err?.response?.status === 403
          ? "Your role cannot view audit logs."
          : "Audit logs could not be loaded.";
    }
    busy.value = false;
  }

  // server-side paging: copy what the table asked for, then reload
  function changePage({ pagination }) {
    const { page, rowsPerPage, sortBy, descending } = pagination;
    Object.assign(paging.value, { page, rowsPerPage, sortBy, descending });
    load();
  }

  watch(scope, () => {
    chosen.agents = null;
    chosen.clients = null;
  });

  onMounted(() => {
    userList.getUserOptions(true);
    if (agentId) {
      load();
    } else {
      clientList.getClientOptions();
      agentList.getAgentOptions();
    }
  });

  return {
    entries,
    busy,
    ran,
    failure,
    scope,
    chosen,
    paging,
    fields,
    load,
    changePage,
  };
}
