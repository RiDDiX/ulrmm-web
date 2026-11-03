// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

import APIKeysTable from "@/components/core/APIKeysTable.vue";
import LicensesManager from "@/components/assets/LicensesManager.vue";
import ImportSettings from "@/components/importers/ImportSettings.vue";
import NetworkSettings from "@/components/integrations/NetworkSettings.vue";
import LapsSettings from "@/components/laps/LapsSettings.vue";
import AppUpdatesForm from "@/components/modals/coresettings/AppUpdatesForm.vue";
import BrandingForm from "@/components/modals/coresettings/BrandingForm.vue";
import CustomFields from "@/components/modals/coresettings/CustomFields.vue";
import KeyStoreTable from "@/components/modals/coresettings/KeyStoreTable.vue";
import RustDeskForm from "@/components/modals/coresettings/RustDeskForm.vue";
import URLActionsTable from "@/components/modals/coresettings/URLActionsTable.vue";
import NotificationsSettings from "@/components/notify/NotificationsSettings.vue";
import AgentSecurityForm from "@/components/security/AgentSecurityForm.vue";
import ScheduleTable from "@/core/settings/components/ScheduleTable.vue";
import SSOProvidersTable from "@/sso/SSOProvidersTable.vue";

// The Global Settings rail, top to bottom. `form` tabs edit the shared
// settings object and save from the footer (blocks in coreSettingsSchema.js);
// the others render `pane`, which saves on its own. `ownSave` panes keep
// Enter from submitting the settings form, `note` is their footer text.
export const SETTINGS_TABS = [
  { name: "general", label: "General", form: true },
  {
    name: "branding",
    label: "Branding",
    pane: BrandingForm,
    ownSave: true,
    note: "Branding saves through its own Save button above.",
  },
  { name: "emailalerts", label: "Email Alerts", form: true },
  { name: "smsalerts", label: "SMS Alerts", form: true },
  { name: "meshcentral", label: "MeshCentral", form: true },
  {
    name: "rustdesk",
    label: "RustDesk",
    pane: RustDeskForm,
    ownSave: true,
    note: "RustDesk saves through its own Save button above.",
  },
  { name: "customfields", label: "Custom Fields", pane: CustomFields },
  { name: "keystore", label: "Key Store", pane: KeyStoreTable },
  {
    name: "urlactions",
    label: "URL Actions",
    pane: URLActionsTable,
    props: { type: "web" },
  },
  {
    name: "webhooks",
    label: "Web Hooks",
    pane: URLActionsTable,
    props: { type: "rest" },
  },
  { name: "retention", label: "Retention", form: true },
  { name: "apikeys", label: "API Keys", pane: APIKeysTable },
  { name: "sso", label: "Single Sign-On (SSO)", pane: SSOProvidersTable },
  { name: "schedules", label: "Schedules", pane: ScheduleTable },
  {
    name: "appupdates",
    label: "App updates",
    pane: AppUpdatesForm,
    ownSave: true,
    note: "App updates save through their own Save button above.",
  },
  { name: "vulns", label: "Vulnerabilities", form: true },
  {
    name: "licenses",
    label: "Licenses",
    pane: LicensesManager,
    ownSave: true,
  },
  {
    name: "notifications",
    label: "Notifications",
    pane: NotificationsSettings,
    ownSave: true,
  },
  {
    name: "localadmin",
    label: "Local admin",
    pane: LapsSettings,
    ownSave: true,
    note: "Local admin saves through its own Save button above.",
  },
  {
    name: "network",
    label: "Network",
    pane: NetworkSettings,
    ownSave: true,
    note: "Network saves through its own Save button above.",
  },
  {
    name: "import",
    label: "Import",
    pane: ImportSettings,
    ownSave: true,
    note: "Import sources save through their own Save button above.",
  },
  { name: "protection", label: "Agent protection", form: true },
  {
    name: "agentsecurity",
    label: "Agent security",
    pane: AgentSecurityForm,
    ownSave: true,
    note: "Agent security saves through its own Save button above.",
  },
  { name: "aiscripts", label: "AI scripts", form: true },
];

export const SETTINGS_PANES = SETTINGS_TABS.filter((t) => t.pane);

export const PANE_NOTE = "Entries on this tab are saved individually.";
