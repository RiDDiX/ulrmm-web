// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

import { boot } from "quasar/wrappers";
import { store } from "./vuex";

import ReportsManager from "@/reporting/components/ReportsManager.vue";
import RunReportDialog from "@/reporting/components/RunReportDialog.vue";
import {
  reportingPerms,
  type ReportingPermsState,
} from "@/reporting/permissions";

const reportsManager = {
  name: "Reporting Manager",
  type: "dialog",
  component: ReportsManager,
};

const runReport = {
  name: "Run Report",
  type: "dialog",
  component: RunReportDialog,
  props: (id: string | number, type: string) => ({ id, type }),
};

const downloadReport = {
  name: "Download Report",
  type: "dialog",
  icon: "download",
  component: RunReportDialog,
  props: (id: string | number, type: string) => ({ id, type, download: true }),
};

export default boot(({ app }) => {
  const state = () => (store as { state: ReportingPermsState }).state;

  // getters read the store, so menus follow the role once dashinfo arrives
  const entries = <T>(...list: T[]): T[] =>
    reportingPerms(state()).view ? list : [];

  app.config.globalProperties.$integrations = {
    get fileBarIntegrations() {
      return entries(reportsManager);
    },
    get clientMenuIntegrations() {
      return entries(runReport, downloadReport);
    },
    get siteMenuIntegrations() {
      return entries(runReport, downloadReport);
    },
    get agentMenuIntegrations() {
      return entries(runReport, downloadReport);
    },
  };
});
