// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

import { isValidEmail } from "@/utils/validation";
import { NVD_NOTICE } from "@/utils/vulns";

// Blocks of the Global Settings form tabs, drawn by SettingsFields.vue. They
// are built once; anything that changes at runtime (option lists, hosted
// mode, a disabled input) is a function the renderer calls.

const DATE_TOKENS_URL =
  "https://quasar.dev/quasar-utils/date-utils#format-for-display";
const MODEL_DOCS_URL = "https://platform.openai.com/docs/models";

const E164_HELP =
  "Use E.164 format: must have the <b>+</b> symbol and <span class='text-negative'>country code</span>, followed by the <span class='text-positive'>phone number</span> e.g. <b>+<span class='text-negative'>1</span><span class='text-positive'>2131231234</span></b>";

const kindOf =
  (kind) =>
  (key, label, hint, more = {}) => ({ kind, key, label, hint, ...more });
const checkbox = kindOf("check");
const input = kindOf("input");
const radio = kindOf("radio");
const secret = (key, label, more = {}) => ({
  kind: "secret",
  key,
  label,
  ...more,
});
const select = (key, label, hint, options, props = {}) => ({
  kind: "select",
  key,
  label,
  hint,
  options,
  props,
});
const heading = (label, hint) => ({
  kind: "group",
  key: `@${label}`,
  label,
  hint,
});
const note = (key, hint) => ({ kind: "note", key, hint });
const choice = (label, value = label.toLowerCase()) => ({ label, value });

const between = (min, max, message) => [
  (v) => (Number.isInteger(v) && v >= min && v <= max) || message,
];
const days = (key, label, hint, more = {}) =>
  input(key, `${label} (days)`, hint, {
    number: true,
    rules: between(0, Infinity, "Whole number of days, 0 disables"),
    props: { type: "number", min: "0" },
    ...more,
  });

const terminal = (os, name, example, ...shells) =>
  radio(`default_shell_${os}`, `${name} Default Terminal`, undefined, {
    options: [...shells, "Custom"].map((label) => choice(label)),
    customPath: `Full path, e.g. ${example}`,
  });

const LOG_LEVELS = ["Info", "Warning", "Error", "Critical"].map((label) =>
  choice(label),
);
const CLEARABLE = { clearable: true };

// ctx: draft (ref of the settings), selfHosted(), timezones(), policies(),
// templates(), confirmMeshSync(value), resetPatchPolicy()
export function coreSettingsForms(ctx) {
  const selfHosted = { when: ctx.selfHosted };
  const withLogin = { showIf: () => ctx.draft.value.smtp_requires_auth };

  const general = [
    heading("Agents"),
    checkbox(
      "agent_auto_update",
      "Enable agent automatic self update",
      "Every hour at 35 minutes past, outdated agents update to the agent version of this server.",
    ),
    checkbox(
      "enable_server_scripts",
      "Enable server side scripts",
      "Lets scripts run on the RMM server itself: alert actions, Run Script on the server and script test runs.",
      selfHosted,
    ),
    checkbox(
      "enable_server_webterminal",
      "Enable web terminal",
      "Lets users whose role has Use Server Web Terminal open a shell on the RMM server.",
      selfHosted,
    ),

    heading("Defaults"),
    {
      kind: "tz",
      key: "default_time_zone",
      label: "Default agent timezone",
      hint: "Used by agents that have no timezone of their own",
      options: ctx.timezones,
      props: { filterable: true },
    },
    input(
      "date_format",
      "Default date format",
      "Quasar date tokens, e.g. MMM-DD-YYYY - HH:mm; each user can override it in Preferences",
      {
        link: {
          url: DATE_TOKENS_URL,
          aria: "Open the date format reference",
          tip: "Opens the list of date format tokens in a new tab",
        },
      },
    ),
    select(
      "server_policy",
      "Default server policy",
      "Applied to every server unless its client, site or agent blocks policy inheritance",
      ctx.policies,
      CLEARABLE,
    ),
    select(
      "workstation_policy",
      "Default workstation policy",
      "Applied to every workstation unless its client, site or agent blocks policy inheritance",
      ctx.policies,
      CLEARABLE,
    ),
    select(
      "alert_template",
      "Default alert template",
      "Used for agents that get no alert template from a policy, site or client",
      ctx.templates,
      CLEARABLE,
    ),

    heading("Notifications"),
    {
      kind: "checks",
      key: "@notify-levels",
      label: "Send email, SMS and web hook alert actions for",
      hint: "Error alerts are not affected by these boxes; alert templates still decide which severities are sent.",
      items: [
        {
          key: "notify_on_info_alerts",
          label: "Informational Alerts",
          class: "q-mr-md",
        },
        { key: "notify_on_warning_alerts", label: "Warning Alerts" },
      ],
    },
    select(
      "agent_debug_level",
      "Agent debug level",
      "Only messages at this level or more severe are written to the debug log",
      LOG_LEVELS,
    ),
    days(
      "clear_faults_days",
      "Clear faults of offline agents after",
      "Resets failing checks and resolves alerts of agents offline this long; 0 turns it off",
    ),

    heading(
      "Terminals",
      "What opens when you start a remote terminal on an agent.",
    ),
    radio("terminal_mode", "Terminal Experience", undefined, {
      tip: "The new terminal needs agent 2.11.0 or later; older agents fall back to the legacy one",
      options: [
        choice("Use new terminal", "new"),
        choice("Use legacy terminal", "legacy"),
      ],
    }),
    terminal(
      "windows",
      "Windows",
      "C:\\Program Files\\PowerShell\\7\\pwsh.exe",
      "CMD",
      "PowerShell",
    ),
    terminal("linux", "Linux", "/usr/bin/fish", "Bash"),
    terminal("darwin", "macOS", "/bin/zsh", "Bash"),
    terminal("freebsd", "FreeBSD", "/usr/local/bin/zsh", "sh", "Bash"),

    heading("Maintenance"),
    {
      kind: "action",
      key: "@reset-patch-policy",
      label: "Reset Patch Policy on Agents",
      hint: "Removes every agent's patch policy overrides. This cannot be undone.",
      button: "Reset…",
      run: ctx.resetPatchPolicy,
    },
  ];

  const email = [
    {
      kind: "recipients",
      key: "email_alert_recipients",
      addLabel: "Add email",
      noun: "address",
      emptyText: "No recipients yet. Add an email address to receive alerts.",
      ask: () => ({
        title: "Add email",
        prompt: { model: "", type: "email", isValid: (v) => isValidEmail(v) },
      }),
    },
    heading("SMTP Settings"),
    input("smtp_from_email", "From email", undefined, {
      rules: [(v) => isValidEmail(v) || "Invalid email"],
    }),
    input(
      "smtp_from_name",
      "From name",
      "Sender name shown in the mail client; leave empty to show only the address",
    ),
    input(
      "smtp_host",
      "Host",
      "Host name of the SMTP server, e.g. smtp.example.com",
    ),
    input(
      "smtp_port",
      "Port",
      "465 connects with TLS; other ports such as 587 upgrade with STARTTLS when authentication is on",
      {
        number: true,
        rules: [(v) => (v > 0 && v <= 65535) || "Invalid Port"],
        props: { type: "number" },
      },
    ),
    checkbox(
      "smtp_requires_auth",
      "My Server Requires Authentication",
      "Turn off for a relay that accepts mail from this server without a login.",
      { props: { class: "q-pa-none" } },
    ),
    input("smtp_host_user", "Username", undefined, withLogin),
    secret("smtp_host_password", "Password", withLogin),
  ];

  const sms = [
    {
      kind: "recipients",
      key: "sms_alert_recipients",
      mono: true,
      addLabel: "Add number",
      noun: "number",
      emptyText: "No recipients yet. Add a phone number to receive alerts.",
      ask: () => ({
        title: "Add number",
        message: E164_HELP,
        html: true,
        prompt: { model: "", isValid: (v) => /^\+[1-9]\d{6,14}$/.test(v) },
      }),
    },
    heading("Twilio Settings"),
    input(
      "twilio_number",
      "Twilio Number",
      "The Twilio number messages are sent from, in E.164 format",
      { props: { placeholder: "+12131231234" } },
    ),
    input(
      "twilio_account_sid",
      "Twilio Account SID",
      "Starts with AC; shown on the Twilio console dashboard",
    ),
    secret("twilio_auth_token", "Twilio Auth Token"),
  ];

  const mesh = [
    input(
      "mesh_username",
      "Username",
      "MeshCentral admin account the RMM signs in with",
      {
        ...selfHosted,
        rules: [
          (v) =>
            !v || v === v.toLowerCase() || "Username must be all lowercase",
        ],
      },
    ),
    input(
      "mesh_site",
      "Mesh Site",
      "Address of the MeshCentral server, e.g. https://mesh.example.com",
      selfHosted,
    ),
    secret("mesh_token", "Mesh Token", selfHosted),
    input(
      "mesh_device_group",
      "Mesh Device Group Name",
      "MeshCentral device group that newly installed agents join",
      selfHosted,
    ),
    checkbox(
      "sync_mesh_with_rmm",
      "Sync MeshCentral permissions with RMM roles",
      "Recommended. When off, every user gets full MeshCentral rights regardless of their role here.",
      { ...selfHosted, onChange: ctx.confirmMeshSync },
    ),
    input(
      "mesh_company_name",
      "Company Name",
      "Added after each user's name in remote sessions, e.g. John Doe - Example Inc.",
      { section: "row items-center" },
    ),
  ];

  const retention = [
    days(
      "check_history_prune_days",
      "Check History",
      "Stored results of every check run, used by the history graphs; 0 keeps them",
    ),
    days(
      "metric_history_days",
      "Metric History",
      "Performance and metric samples behind the Performance tab charts and metric checks; pruned once a day, 1 to 365",
      {
        rules: between(1, 365, "Whole number of days from 1 to 365"),
        props: { type: "number", min: "1", max: "365" },
      },
    ),
    days(
      "resolved_alerts_prune_days",
      "Resolved Alerts",
      "Alerts that were resolved; open alerts are never removed; 0 keeps them",
    ),
    days(
      "agent_history_prune_days",
      "Agent History",
      "Commands and scripts run on agents, as shown in agent history; 0 keeps them",
    ),
    days(
      "debug_log_prune_days",
      "Debug Logs",
      "Entries in the debug log; 0 keeps them",
    ),
    days(
      "audit_log_prune_days",
      "Audit Logs",
      "Record of user and API actions in the audit log; 0 keeps them",
    ),
    days(
      "report_history_prune_days",
      "Report History",
      "Generated reports kept in report history; 0 keeps them",
    ),
    days(
      "patch_event_prune_days",
      "Patch History",
      "Approval, install and state changes of every patch; the oldest events go first so the hash chain stays verifiable; 0 keeps them",
    ),
  ];

  const protection = [
    checkbox(
      "tamper_watch",
      "Watch for tampering",
      "Every 5 minutes, agents that are offline and whose last timeline event was not a shutdown, suspend or reboot are flagged once with a Tamper suspected pill, an alert and a notification. A service stopped by hand is reported when the agent starts again.",
    ),
    input(
      "tamper_offline_minutes",
      "Offline for (minutes)",
      "How long an agent has to be unreachable before it is flagged, 5 to 1440",
      {
        number: true,
        rules: between(5, 1440, "Whole number of minutes from 5 to 1440"),
        props: () => ({
          type: "number",
          min: "5",
          max: "1440",
          disable: !ctx.draft.value.tamper_watch,
        }),
      },
    ),
    note(
      "@uninstall-note",
      "Manual uninstalls need the per-agent uninstall code (agent menu > Uninstall code). Signing the Windows agent needs a code signing certificate that you provide.",
    ),
  ];

  const vulns = [
    secret("nvd_api_key", "NVD API key"),
    note("@nvd-notice", NVD_NOTICE),
    {
      kind: "secrets",
      key: "@dell",
      hint: "Dell TechDirect warranty lookups. Only needed for Dell devices.",
      items: [
        secret("dell_api_client_id", "Dell TechDirect client ID"),
        secret("dell_api_client_secret", "Dell TechDirect client secret"),
      ],
    },
  ];

  const ai = [
    secret("ai_api_key", "OpenAI API key"),
    input("ai_model", "Model", "OpenAI model that writes the drafts", {
      link: {
        url: MODEL_DOCS_URL,
        aria: "Open the OpenAI model list",
        tip: "Opens the list of OpenAI models in a new tab",
      },
    }),
  ];

  return [
    {
      name: "general",
      title: "General",
      text: "Defaults for agents, alert notifications and remote terminals.",
      blocks: general,
    },
    {
      name: "emailalerts",
      title: "Email Alerts",
      text: "Who receives alert emails and the SMTP server that sends them.",
      blocks: email,
    },
    {
      name: "smsalerts",
      title: "SMS Alerts",
      text: "Who receives alert text messages and the Twilio account that sends them.",
      blocks: sms,
    },
    {
      name: "meshcentral",
      title: "MeshCentral",
      text: "How the RMM connects to MeshCentral for remote control, file transfer and remote background.",
      blocks: mesh,
    },
    {
      name: "retention",
      title: "Retention",
      text: "An hourly cleanup deletes records older than these limits.",
      blocks: retention,
    },
    {
      name: "protection",
      title: "Agent protection",
      text: "Raises an alert when an agent disappears without a shutdown, update or uninstall.",
      blocks: protection,
    },
    {
      name: "vulns",
      title: "Vulnerabilities",
      text: "Linux packages are checked against OSV.dev, FreeBSD packages with pkg audit against VuXML, Windows updates against Microsoft MSRC and known third-party apps against the NVD. An NVD API key is optional: without one the NVD allows 5 requests per 30 seconds, with one 50, so a large fleet is checked faster. Request one for free at nvd.nist.gov/developers/request-an-api-key.",
      blocks: vulns,
    },
    {
      name: "aiscripts",
      title: "AI script drafts",
      text: "The script and snippet editors can ask OpenAI for a first draft. The prompt you type is sent to OpenAI with this API key.",
      blocks: ai,
    },
  ];
}
