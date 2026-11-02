// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

import axios from "axios";
import { date } from "quasar";
import {
  capitalize,
  elapsedText,
  formatAgentOptions,
  formatCustomFields,
  truncateText,
} from "@/utils/format";
import {
  notifyError,
  notifyInfo,
  notifySuccess,
  notifyWarning,
} from "@/utils/notify";

const DRF_LAYOUT = "MM DD YYYY HH:mm";

const sinceUnix = (unixtime) => elapsedText(Date.now() - unixtime * 1000);

const byLabel = (a, b) => a.label.localeCompare(b.label);

const scriptOption = (s) => ({
  label: s.name,
  value: s.id,
  timeout: s.default_timeout,
  args: s.args,
  env_vars: s.env_vars,
});

// scripts without a category go under "Unassigned"
function groupScripts(scripts) {
  const named = new Set(
    scripts.filter((s) => s.category).map((s) => s.category),
  );
  const categories = [...named];
  if (scripts.some((s) => !s.category)) categories.push("Unassigned");
  const inCategory = (cat) => (s) =>
    s.category === cat || (cat === "Unassigned" && !s.category);

  return categories
    .sort()
    .flatMap((cat) => [
      { category: cat },
      ...scripts.filter(inCategory(cat)).map(scriptOption).sort(byLabel),
    ]);
}

export default {
  methods: {
    bootTime: sinceUnix,
    alertTime: sinceUnix,
    notifySuccess(msg, timeout) {
      notifySuccess(msg, timeout);
    },
    notifyError(msg, timeout) {
      notifyError(msg, timeout);
    },
    notifyWarning(msg, timeout) {
      notifyWarning(msg, timeout);
    },
    notifyInfo(msg, timeout) {
      notifyInfo(msg, timeout);
    },
    unixToString(timestamp) {
      return timestamp
        ? date.formatDate(new Date(timestamp * 1000), "MMM-D-YYYY - HH:mm")
        : "";
    },
    dateStringToUnix(drfString) {
      if (!drfString) return 0;
      const parsed = date.extractDate(drfString, DRF_LAYOUT);
      return parseInt(date.formatDate(parsed, "X"));
    },
    formatDjangoDate(drfString) {
      if (!drfString) return "";
      const parsed = date.extractDate(drfString, DRF_LAYOUT);
      return date.formatDate(parsed, "MMM-DD-YYYY - HH:mm");
    },
    formatClientOptions(clients) {
      return clients.map(({ name, id, sites }) => ({
        label: name,
        value: id,
        sites,
      }));
    },
    formatSiteOptions(sites) {
      return sites.map(({ name, id }) => ({ label: name, value: id }));
    },
    capitalize,
    formatCustomFields,
    getCustomFields(model) {
      return axios.patch("/core/customfields/", { model });
    },
    getAgentCount(data, type, id) {
      if (type === "client") return data.find((c) => c.id === id).agent_count;
      const site = data.flatMap((c) => c.sites).find((s) => s.id === id);
      return site ? site.agent_count : 0;
    },
    async getScriptOptions(showCommunityScripts = false) {
      const { data } = await axios.get("/scripts/");
      return groupScripts(
        showCommunityScripts
          ? data
          : data.filter((s) => s.script_type !== "builtin"),
      );
    },
    async getAgentOptions(value_field = "agent_id") {
      const { data } = await axios.get("/agents/?detail=false");
      return formatAgentOptions(data, false, value_field);
    },
    truncateText(txt) {
      return truncateText(txt, 60) ?? "";
    },
  },
};
