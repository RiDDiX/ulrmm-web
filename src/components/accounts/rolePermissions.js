// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

// Role flags in the order RolesForm lists them. needs: the read flag a write
// flag is useless without; serverOnly: not offered on hosted servers; pickers:
// the client and site lists that limit the role's scope.
export const ROLE_SECTIONS = [
  {
    title: "Reporting",
    text: "Reports, report templates and their generated history.",
    flags: [
      {
        key: "can_view_reports",
        label: "Reporting Viewer",
        hint: "View generated reports.",
      },
      {
        key: "can_manage_reports",
        label: "Reporting Manager",
        hint: "Create, edit, and generate reports.",
      },
    ],
  },
  {
    title: "Accounts",
    text: "Who can see and change user accounts and roles.",
    flags: [
      {
        key: "can_list_accounts",
        label: "List User Accounts",
        hint: "See the list of user accounts.",
      },
      {
        key: "can_manage_accounts",
        label: "Manage User Accounts",
        hint: "Create, edit, and delete user accounts.",
        needs: "can_list_accounts",
      },
      {
        key: "can_list_roles",
        label: "List Roles",
        hint: "See the list of roles.",
      },
      {
        key: "can_manage_roles",
        label: "Manage Roles",
        hint: "Create, edit, and delete roles.",
        needs: "can_list_roles",
      },
    ],
  },
  {
    title: "Agents",
    text: "What users can do on the agents inside this role's scope.",
    flags: [
      {
        key: "can_list_agents",
        label: "List Agents",
        hint: "See agents and their detail pages.",
      },
      {
        key: "can_list_agent_history",
        label: "List Agent History",
        hint: "View an agent's command and script run history.",
      },
      {
        key: "can_use_mesh",
        label: "Use MeshCentral",
        hint: "Take control, VNC, or open a remote background session.",
      },
      {
        key: "can_uninstall_agents",
        label: "Uninstall Agents",
        hint: "Remove the RMM agent from a device.",
      },
      {
        key: "can_update_agents",
        label: "Update Agents",
        hint: "Push agent version updates.",
      },
      {
        key: "can_edit_agent",
        label: "Edit Agents",
        hint: "Change an agent's settings, site, and patch policy.",
      },
      {
        key: "can_manage_procs",
        label: "Manage Processes",
        hint: "View and end running processes on an agent.",
      },
      {
        key: "can_view_eventlogs",
        label: "View Event Logs",
        hint: "Read an agent's Windows Event Log.",
      },
      {
        key: "can_send_cmd",
        label: "Send Command",
        hint: "Run a shell command on an agent.",
      },
      {
        key: "can_use_terminal",
        label: "Use Terminal",
        hint: "Open an interactive terminal session on an agent.",
      },
      {
        key: "can_reboot_agents",
        label: "Shutdown / Reboot / Sleep Agents",
        hint: "Reboot or shut down an agent, now or on a schedule, or put it to sleep. With Run Bulk Actions, also for many agents at once. Also sleep schedules under Maintenance & Power, and maintenance windows together with Wake-Up (WoL) Agents and Manage Patch Policies.",
      },
      {
        key: "can_send_wol",
        label: "Wake-Up (WoL) Agents",
        hint: "Send a Wake-on-LAN packet to an agent, from the server and from online agents on its network that this role can see. Also wake schedules under Maintenance & Power, and maintenance windows together with Shutdown / Reboot / Sleep Agents and Manage Patch Policies.",
      },
      {
        key: "can_install_agents",
        label: "Install Agents",
        hint: "Generate installers and enroll new agents.",
      },
      {
        key: "can_run_scripts",
        label: "Run Script",
        hint: "Run a saved script on an agent.",
      },
      {
        key: "can_run_bulk",
        label: "Bulk Actions",
        hint: "Run a command, script, or patch install across many agents.",
      },
      {
        key: "can_recover_agents",
        label: "Recover Agents",
        hint: "Trigger an agent's self-recovery.",
      },
      {
        key: "can_use_registry",
        label: "Use Registry",
        hint: "Read and edit an agent's Windows registry.",
      },
      {
        key: "can_manage_device_groups",
        label: "Manage Device Groups",
        hint: "Create, edit, and delete device groups and tags. Tagging a device needs Edit Agents.",
      },
      {
        key: "can_view_recovery_keys",
        label: "View Recovery Keys",
        hint: "See and reveal BitLocker and FileVault recovery keys, and rotate a FileVault key. Reveals need the 60-minute two-factor unlock.",
      },
    ],
  },
  {
    title: "Core",
    text: "Global Settings, notes, key store, API keys, URL actions, custom fields, schedules and server tools.",
    flags: [
      {
        key: "can_list_notes",
        label: "List Notes",
        hint: "See notes left on clients, sites, and agents.",
      },
      {
        key: "can_manage_notes",
        label: "Manage Notes",
        hint: "Add, edit, and delete notes.",
        needs: "can_list_notes",
      },
      {
        key: "can_view_credentials",
        label: "View Credentials",
        hint: "List vault credentials of clients, sites, and agents, and reveal a secret with the 60-minute two-factor unlock.",
      },
      {
        key: "can_manage_credentials",
        label: "Manage Credentials",
        hint: "Add, edit, and delete vault credentials.",
        needs: "can_view_credentials",
      },
      {
        key: "can_view_core_settings",
        label: "View Global Settings",
        hint: "See the Global Settings pages.",
      },
      {
        key: "can_edit_core_settings",
        label: "Edit Global Settings",
        hint: "Change Global Settings.",
        needs: "can_view_core_settings",
      },
      {
        key: "can_view_global_keystore",
        label: "View Global Key Store",
        hint: "See stored global key/value pairs used by scripts.",
      },
      {
        key: "can_edit_global_keystore",
        label: "Edit Global Key Store",
        hint: "Add, edit, and delete global key/value pairs.",
        needs: "can_view_global_keystore",
      },
      {
        key: "can_do_server_maint",
        label: "Do Server Maintenance",
        hint: "Run server maintenance tasks such as clearing old data.",
      },
      {
        key: "can_manage_server_updates",
        label: "Manage Server Updates and Backups",
        hint: "Update the RMM server from the dashboard, create, download and delete server backups and change the backup schedule. Needs the two-factor step-up. Backups hold both databases and all server secrets.",
      },
      {
        key: "can_list_api_keys",
        label: "List API Keys",
        hint: "See API keys.",
      },
      {
        key: "can_manage_api_keys",
        label: "Manage API Keys",
        hint: "Create, edit, and delete API keys.",
        needs: "can_list_api_keys",
      },
      {
        key: "can_run_urlactions",
        label: "Run URL Actions",
        hint: "Open a configured URL action from an agent.",
      },
      {
        key: "can_view_customfields",
        label: "View Custom Fields",
        hint: "See custom field definitions and their values.",
      },
      {
        key: "can_manage_customfields",
        label: "Edit Custom Fields",
        hint: "Create, edit, and delete custom fields.",
        needs: "can_view_customfields",
      },
      {
        key: "can_view_schedules",
        label: "List Schedules",
        hint: "See scheduled tasks.",
      },
      {
        key: "can_manage_schedules",
        label: "Manage Schedules",
        hint: "Create, edit, and delete schedules.",
        needs: "can_view_schedules",
      },
      {
        key: "can_use_webterm",
        label: "Use Server Web Terminal",
        hint: "Open a terminal session on the RMM server itself.",
        serverOnly: true,
      },
    ],
  },
  {
    title: "Checks",
    text: "Monitoring checks on agents and in policies.",
    flags: [
      {
        key: "can_list_checks",
        label: "List Checks",
        hint: "See checks and their results.",
      },
      {
        key: "can_manage_checks",
        label: "Manage Checks",
        hint: "Create, edit, and delete checks.",
        needs: "can_list_checks",
      },
      {
        key: "can_run_checks",
        label: "Run Checks",
        hint: "Run a check on demand.",
      },
    ],
  },
  {
    title: "Clients",
    text: "Clients, sites, deployment install links and network devices.",
    flags: [
      {
        key: "can_list_clients",
        label: "List Clients",
        hint: "See the client list.",
      },
      {
        key: "can_manage_clients",
        label: "Manage Clients",
        hint: "Create, edit, and delete clients.",
        needs: "can_list_clients",
      },
      {
        key: "can_list_sites",
        label: "List Sites",
        hint: "See the site list.",
      },
      {
        key: "can_manage_sites",
        label: "Manage Sites",
        hint: "Create, edit, and delete sites.",
        needs: "can_list_sites",
      },
      {
        key: "can_list_deployments",
        label: "List Deployments",
        hint: "See agent deployment install links.",
      },
      {
        key: "can_manage_deployments",
        label: "Manage Deployments",
        hint: "Create and delete deployment install links.",
        needs: "can_list_deployments",
      },
      {
        key: "can_list_network_devices",
        label: "List Network Devices",
        hint: "See network devices and their last check result.",
      },
      {
        key: "can_manage_network_devices",
        label: "Manage Network Devices",
        hint: "Add, edit, delete and test network devices. The server then pings and connects to addresses in its own networks.",
        needs: "can_list_network_devices",
      },
      {
        key: "can_run_network_discovery",
        label: "Run Network Discovery",
        hint: "Scan the server's own networks for devices and see the results. Adding a found device as a network device also needs Manage Network Devices.",
      },
    ],
  },
  {
    title: "Scope",
    text: "Limits which clients and sites this role can see and act on across every permission above. Leaving a list empty allows all clients or all sites.",
    pickers: [
      {
        field: "can_view_clients",
        label: "Allowed Clients",
        hint: "Empty means all clients are allowed",
      },
      {
        field: "can_view_sites",
        label: "Allowed Sites",
        hint: "Empty means all sites are allowed",
      },
    ],
  },
  {
    title: "Automation Policies",
    text: "Policies that push checks, tasks and settings to many agents at once.",
    flags: [
      {
        key: "can_list_automation_policies",
        label: "List Automation Policies",
        hint: "See automation policies.",
      },
      {
        key: "can_manage_automation_policies",
        label: "Manage Automation Policies",
        hint: "Create, edit, and delete automation policies.",
        needs: "can_list_automation_policies",
      },
    ],
  },
  {
    title: "Tasks",
    text: "Automated tasks that run scripts on a schedule or trigger.",
    flags: [
      {
        key: "can_list_autotasks",
        label: "List Tasks",
        hint: "See automated tasks.",
      },
      {
        key: "can_manage_autotasks",
        label: "Manage Tasks",
        hint: "Create, edit, and delete automated tasks.",
        needs: "can_list_autotasks",
      },
      {
        key: "can_run_autotasks",
        label: "Run Tasks",
        hint: "Run an automated task on demand.",
      },
    ],
  },
  {
    title: "Logs",
    text: "The audit log, the debug log and the queue of pending agent actions.",
    flags: [
      {
        key: "can_view_auditlogs",
        label: "View Audit Logs",
        hint: "See the audit log.",
      },
      {
        key: "can_view_debuglogs",
        label: "View Debug Logs",
        hint: "See the agent debug log.",
      },
      {
        key: "can_list_pendingactions",
        label: "List Pending Actions",
        hint: "See queued and pending agent actions.",
      },
      {
        key: "can_manage_pendingactions",
        label: "Manage Pending Actions",
        hint: "Cancel or retry pending actions.",
        needs: "can_list_pendingactions",
      },
    ],
  },
  {
    title: "Scripts",
    text: "The script library, and running scripts on the RMM server itself.",
    flags: [
      {
        key: "can_list_scripts",
        label: "List Scripts",
        hint: "See saved scripts.",
      },
      {
        key: "can_manage_scripts",
        label: "Manage Scripts",
        hint: "Create, edit, and delete scripts.",
        needs: "can_list_scripts",
      },
      {
        key: "can_run_server_scripts",
        label: "Run Scripts on the Server",
        hint: "Run a script on the RMM server itself, not an agent.",
        serverOnly: true,
      },
    ],
  },
  {
    title: "Alerts",
    text: "Alerts for offline agents, failing checks and tasks, and the templates that route them.",
    flags: [
      {
        key: "can_list_alerts",
        label: "List Alerts",
        hint: "See open and resolved alerts.",
      },
      {
        key: "can_manage_alerts",
        label: "Manage Alerts",
        hint: "Resolve, snooze, and delete alerts.",
        needs: "can_list_alerts",
      },
      {
        key: "can_list_alerttemplates",
        label: "List Alert Templates",
        hint: "See alert templates.",
      },
      {
        key: "can_manage_alerttemplates",
        label: "Manage Alert Templates",
        hint: "Create, edit, and delete alert templates.",
        needs: "can_list_alerttemplates",
      },
    ],
  },
  {
    title: "Windows Services",
    text: "Services on Windows agents.",
    flags: [
      {
        key: "can_manage_winsvcs",
        label: "Manage Windows Services",
        hint: "Start, stop, and edit Windows services on an agent.",
      },
    ],
  },
  {
    title: "Software",
    text: "Software installed on agents.",
    flags: [
      {
        key: "can_list_software",
        label: "List Software",
        hint: "See installed software on an agent.",
      },
      {
        key: "can_manage_software",
        label: "Manage Software",
        hint: "Install and uninstall software on an agent.",
        needs: "can_list_software",
      },
      {
        key: "can_view_vulnerabilities",
        label: "View Vulnerabilities",
        hint: "See known vulnerabilities in the updates, packages and apps of Windows, macOS, Linux and FreeBSD agents, ignore findings, and start a scan.",
      },
    ],
  },
  {
    title: "Software Packages",
    text: "Installer packages uploaded to the RMM server.",
    flags: [
      {
        key: "can_manage_packages",
        label: "Manage Packages",
        hint: "Upload, edit, and delete installer packages on the server. Uploads and edits need the 60-minute two-factor unlock.",
      },
      {
        key: "can_install_packages",
        label: "Install Packages",
        hint: "Install uploaded packages on agents as SYSTEM, root, or the logged-in user, and see the results. Bulk installs also need Bulk Actions.",
      },
    ],
  },
  {
    title: "OS Updates",
    text: "Windows Update on agents.",
    flags: [
      {
        key: "can_manage_winupdates",
        label: "Manage OS Updates",
        hint: "Approve, ignore, and install Windows updates on an agent.",
      },
    ],
  },
  {
    title: "Apps, Notifications and Integrations",
    text: "Third-party app updates, notification channels, local admin passwords and network integrations.",
    flags: [
      {
        key: "can_manage_app_updates",
        label: "Manage App Updates",
        hint: "Change the app update policy of devices and the global app update settings, and exclude apps from updates.",
      },
      {
        key: "can_manage_notifications",
        label: "Manage Notifications",
        hint: "Create and edit notification channels, routes and escalation, and send test messages.",
      },
      {
        key: "can_manage_laps",
        label: "Manage Local Admin",
        hint: "Set the local admin password rotation policy and rotate the password of a device now.",
      },
      {
        key: "can_manage_integrations",
        label: "Manage Integrations",
        hint: "Connect UniFi and OPNsense and run a sync.",
      },
    ],
  },
  {
    title: "Patches",
    text: "Patch approval, on-demand installs and patch policies.",
    flags: [
      {
        key: "can_view_patches",
        label: "View Patches",
        hint: "See patch records and host facts of devices in scope.",
      },
      {
        key: "can_approve_patches",
        label: "Approve Patches",
        hint: "Approve, reject, and re-open patches; set device holds.",
      },
      {
        key: "can_install_patches_now",
        label: "Install Patches Now",
        hint: "Scan, plan, and install on demand, outside the schedule.",
      },
      {
        key: "can_manage_patch_policies",
        label: "Manage Patch Policies",
        hint: "Create and edit patch policies and rings. Maintenance windows (Maintenance & Power) also need Wake-Up (WoL) Agents and Shutdown / Reboot / Sleep Agents.",
      },
      {
        key: "can_enable_unofficial_sources",
        label: "Enable Unofficial Sources",
        hint: "Switch on AUR and other unofficial providers. Granted to no role by default.",
      },
    ],
  },
];
