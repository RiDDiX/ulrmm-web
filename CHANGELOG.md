# Web interface changelog

## 2.08.11.2026 (2026-11-08)

- command output streams append line by line and keep the last 5000 lines, so a long run no longer freezes the tab
- security events: the live refresh keeps loaded pages and the rows on a failed tick
- download links from the server are opened only when they are web URLs; downloads share one helper
- ISO download progress ignores stale answers and backs off while the server is unreachable; the next agent update time no longer points into the past
- device table tooltips tolerate rows without checks; the dashboard socket reconnects with a growing, jittered delay
- the enrolment-only token is kept in memory until the login completes; the log viewer retries a failed load
- LAPS shows an unconfirmed password with its time and a reveal button

## 1.08.11.2026 (2026-11-08)

- version only, follows server 1.08.11.2026

## 5.07.11.2026 (2026-11-07)

- version only, follows server 5.07.11.2026

## 4.07.11.2026 (2026-11-07)

- version only, follows server 4.07.11.2026

## 3.07.11.2026 (2026-11-07)

- Update Center: a second update no longer shows the result of the previous run; the page waits until the new run is seen and reports a runner that never starts after 15 minutes
- after a sign-in the dashboard loads fresh, so the fleet counter and the live link work after a logout and a new login in the same tab
- device table: Uptime is empty for a device that has not reported a boot time yet (it showed 56 years); uptime is formatted the same way in the table, the device page, the container card and the network devices
- CSV export: a cell that starts with = + - @ gets a leading quote so a spreadsheet does not run it as a formula; files carry a byte order mark so Excel reads non-ASCII text
- the certificate banner is hidden while the server cannot tell the days left, instead of saying null days
- filter Offline 30+ days skips devices that never checked in; a search word that contains "is:" is kept as a word
- event log: a slow reply of the earlier log type no longer overwrites the one selected later
- processes, drivers and image library windows stop polling when they are closed during a request; image downloads stop polling when the deploy page is left
- vault secret fields tell the browser not to offer the saved login password
- login: a server that cannot be reached is reported as such instead of Bad credentials
- the first-run setup page opens for superusers only; a restricted role with no visible client sees an empty tree
- URL actions open web links only, like the support link
- patch approval sends at most eight requests at a time
- script upload reads the file once and refuses an empty body
- installed update schedule label: calendar days instead of 24-hour steps, so a DST night does not skip a day
- byte sizes use one formatter everywhere (one decimal, space before the unit)
- unit tests with vitest (`npm test`) for the CSV export, formatters, device filters, chunked upload, script variables, patch schedule and overview helpers; the typecheck now covers the whole app
- removed unused code: an old mixin file, a check script, dead helpers and the client-side copy of the overview layout validation

## 2.07.11.2026 (2026-11-07)

- version follows the server release, no interface change

## 1.07.11.2026 (2026-11-07)

- version follows the server release, no interface change

## 1.04.11.2026 (2026-11-04)

- SSO providers: adding, editing or deleting a provider asks for the two-factor code, like user and role changes

## 2.03.11.2026 (2026-11-03)

- Keep awake: on a Mac the dialog has a Stay awake on power switch that saves at once; the device menu and the device page show Awake on power while it is on

## 1.03.11.2026 (2026-11-03)

- Licenses: Activation column with the devices that activated a stored Microsoft key, the ones that did not, and the free seats; the tooltip lists each device with product, status and channel

## 3.02.11.2026 (2026-11-02)

- Import: the source for servers with the same REST API is called Compatible RMM server

## 2.02.11.2026 (2026-11-02)

- Global Settings > Import: sources, preview, import, device list with link and Send installer

## 1.02.11.2026 (2026-11-02)

- build tooling on @quasar/app-vite 3, Vite 8 and ESLint 9 (needs Node.js 24)
- minimatch 11.0.4 for GHSA-g3hv-75wg-m249

## 5.01.11.2026 (2026-11-01)

- version follows the server release, no interface change

## 4.01.11.2026 (2026-11-01)

- version follows the server hotfix, no interface change

## 3.01.11.2026 (2026-11-01)

- offline devices that announced a shutdown, restart or sleep show it next to the status ("Offline · Restarting") with who started it and when, in the device table, quick panel, summary, CSV export and the remote control pop-outs

## 2.01.11.2026 (2026-11-01)

- device list has separate Offline and Overdue tiles, both open the matching filter; offline is shown neutral, overdue red
- offline status reads neutral in the device table, summary, quick panel and overview widgets
- filter hints and the overdue time hint explain that overdue needs outage monitoring
- failed patch section explains when retries happen, the effective policy shows retry count and failure email
- Global Settings on phones uses a section picker above the panel instead of the tab rail, panel headers wrap their buttons

## 1.01.11.2026 (2026-11-01)

- two-factor code fields share one style with digits, label and hint centred, also in the error state
- step-up, reset 2FA and change-code prompts use that field and the same buttons
- pasted codes with spaces work at login, wrong codes show one message in the prompt
- Account menu Reset Password opens correctly
- rail entries align, the rail fits 768 to 900 px tall screens, mini rail menus open beside it
- Global Settings has a fixed height, tab rail and panel scroll independently, the footer stays visible
- dialogs keep 24 px under fields with hints, large dialogs are never narrower than medium ones
- device table checkbox column and device columns stay in view on horizontal scroll, headers stay on top
- device page tabs, drivers, SDIO approvals and deployments keep actions on screen
- workspace heading, clients panel and agent submenus fit on phones
- tables sorted by name open A to Z
- nested server errors show the first message instead of object Object
- branding loads again in the background when the first try times out
- low-contrast status chips use shared pills
- Add User works without email, stores Active and Deny Dashboard Logins, API key expiry can be cleared, user roles can be removed
- Global Settings retention gains a Patch History days field
- agent protection, SMS recipients, app updates, LAPS, notification routes and software uninstall check the server ranges at the field
- debug log Patching filter, audit log actions, baseline item Required and time limit, alert resolved actions and policy checkboxes are wired
- registry multi-string values keep commas, root hives cannot be renamed or deleted
- timeline type chips filter on the server, app actions are disabled on offline devices
- offline agent menu disables Reboot, failed pings before removal open the offline prompt
- remote background falls back to the agent platform and shows errors instead of spinning, terminal shortcuts open by click or keyboard
- image library accepts an expected SHA-256
- reports gain Download Report, a Run By column and readable formats
- credential and license forms show server errors at the field
- superusers show a Superuser pill, Recover all agents is hidden for other users

## 2.31.10.2026 (2026-10-31)

- no changes
- version follows the server

## 1.31.10.2026 (2026-10-31)

- components rebuilt with a new structure and the same behaviour: registry editor, terminal, roles form, login page, dashboard and main layout, agent table and agent menu, script editor and script manager, checks tab, Windows updates tab, alerts overview, report template form, audit log, Global Settings
- registry editor uses Material Design icons instead of image files
- Global Settings has the AI scripts tab again with OpenAI API key and model
- the snippet dialog asks to describe the script
- NVD notice in the vulnerabilities list and next to the NVD API key
- every build copies LICENSE, NOTICE and THIRD_PARTY_NOTICES to dist/licenses and the About dialog links them
- dompurify and @intlify/unplugin-vue-i18n removed, dotenv moved to devDependencies
- Cancel in the custom shell dialog returns to the last chosen shell
- audit log badge colours for agent installs and failed logins
- a failed settings save no longer sends a pending test email or SMS on the next save
- generated snippet code shows in the editor
- the overview filter reloads the agents after widening the scope
- search words like constructor stay search text
- a repeated search URL parameter no longer breaks the page
- disabled agent menu entries no longer open an empty submenu
- the wrong 'needs Reporting Viewer' warning for Reporting Manager is gone

## 2.29.10.2026 (2026-10-29)

- no changes
- version follows the server

## 1.29.10.2026 (2026-10-29)

- licensed under FSL-1.1-ALv2 with NOTICE.md and SPDX headers in every source file
- About dialog names the license FSL-1.1-ALv2
- components restructured without visible change
- own VS Code workspace settings
- README rewritten

## 1.27.10.2026 (2026-10-27)

- Deployment builder, Target step: every OS card shows whether its installation medium is cached, downloading (with percent and a progress bar), failed or missing, and offers the official images or an https URL for Windows media right on the card
- Deployment builder, full bootable ISO: when the base image is missing the step offers the download in place with a mirror picker or URL field; while it runs a progress card shows percent, transferred volume, rate and remaining time, then the SHA-256 check, and the build button unlocks the moment the image is ready. A switch starts the build automatically after the download
- Images page: downloads show the verifying state and keep refreshing until it is done

## 4.26.10.2026 (2026-10-26)

- Deployment builder reworked: the Policies step lays its cards out in two balanced columns with General and Software across the top, every control fills its card, long choices ellipsize with the full text in the dropdown, and settings an edition lacks are no longer shown as dead switches but as one "Not available" line per card with the reason behind a help icon
- Policies step: preset selects (Windows privacy) fill their switches and show Custom once a switch is changed; new checked catalog fields with sections and a filter; switches carry their help text inline
- Target step: OS cards carry proper names, edition chips show the release state (LTS, interim, end of life), and a row of official images fetches the installation media into the image library in one click
- Scope and Preview steps use the same card layout as the Policies step
- Dropdown options show their help text as a caption

## 3.26.10.2026 (2026-10-26)

- Images page in the main navigation: the image library lists the base installation media and the ISOs the deployment builder built, filtered by kind, with download, verify and delete per image
- Base images upload from the browser in parts with pause, resume and cancel, like software packages; the upload needs the two-factor unlock
- Built ISOs stay in the library until deleted and download through a short-lived link served by nginx instead of a blob in the browser
- The deployment builder picks only base images and opens the same library

## 2.26.10.2026 (2026-10-26)

- Deployment builder: choose between a full bootable ISO, an instant seed ISO and the agent-only installer. Seed ISOs download directly with their SHA-256; full ISOs build in the background with progress, then download with their hash
- ISO library dialog: register images from the server folder or an https URL, scan the folder, verify hashes, delete

## 1.26.10.2026 (2026-10-26)

- Reports and template previews render in a frame loaded from the API host instead of an inline document, so they keep working under the enforced Content-Security-Policy
- Trust matrix: key store column
- Report template variables: YAML flow mappings such as `{name: alpha, value: 3}` are no longer rewritten into broken strings

## 5.25.10.2026 (2026-10-25)

- Global Settings › Agent security: sec2 mode with coverage, command keys with rotation, pin promotion
- Agent certificate panel: identity (key id, state, last handshake, token generation and expiry) with quarantine, release, reset identity, block and rotate actions, each confirmed with two-factor authentication
- Security Center (rail link after Devices): rotation policies per global, client and site with limits and inheritance; trust matrix of every agent with status, fingerprint, pin slot, last rotation, certificate countdown, identity state and pending rotations, with filters, search, paging and the quarantine, release, reset identity and block actions; security events with a live toggle (every 15 s); force rotation by fleet, client, site or agent, command key rotation and pin promotion with result counts
- Device page: certificate card with validity, fingerprint, identity state and pending rotations
- Deployment builder: download progress for answer files and bundles

## 4.25.10.2026 (2026-10-25)

- Deployments: optional enrollment limit in the builder, enrollments and limit in Manage deployments, old deployment tokens shown as masked
- Checks that have never run show as pending (neutral) in the device list, the device page and its checks tiles
- Global Settings opens full screen on phones; the settings text wraps at the visible width
- The drag-and-drop lists load without eval (preparation for an enforced Content-Security-Policy); DOMPurify 3.4.17

## 3.25.10.2026 (2026-10-25)

- Global Settings › Agent security: the server's pin set with copy buttons, an editor for backup pins (one SHA-256 pin per line, saved with two-factor confirmation) and the security events with filters for severity and kind

## 2.25.10.2026 (2026-10-25)

- Deployment builder: dropdowns for every option the server lists (Windows release, display language, formats, keyboard, time zone, privacy level, Linux desktop, SSH sign-in), searchable for long lists; SSH key field for keys and the password only when the chosen sign-in uses them; the display language follows the region formats until it is picked; lifetimes of 90, 180 and 365 days

## 1.25.10.2026 (2026-10-25)

- Deployment builder (Agents › Deployment builder, and New deployment in Manage deployments): scope with client, site, agent type, automation policy, lifetime and software baselines; agent installers per platform and architecture or an unattended OS image per Windows edition or Linux distribution; policy options per target with the edition limits explained; preview of every generated file with secrets hidden, copy buttons for the install one-liners (Windows, Linux, and Linux with signature check), download of the answer file or a bundle
- Manage deployments shows name, policy and link, copies the link and reopens the builder
- Software catalog (formerly Software packages): archive packages with setup command, exit codes and detection rule; uploads of any size with progress, pause, resume and cancel; agent download progress for running installs
- Software baselines: lists of winget, Chocolatey, hosted and Linux packages, assigned to automation policies and deployments, with a status view per device and item; the device Software tab shows the device's baseline and retries failed items
- Global Settings › Agent security: client certificate mode, coverage and the devices without a certificate; the device menu shows its certificate and resets it
- `npm run typecheck` checks the new TypeScript components

## 1.24.10.2026 (2026-10-24)

- Right-click menus of the device list, the client tree, report templates, policies and scripts open vertically centered on the click and stay on screen; before, a tall menu could flip above the click and lose its top part

## 2.21.10.2026 (2026-10-21)

- FreeBSD as a platform: install dialog (64 bit and ARM 64 bit), icons, filters, group rules, scripts, tasks, bulk actions, shells, services and file logs, VuXML findings, default shell in Global Settings
- The systemd check is now "Service check" and also covers FreeBSD rc.d services
- TrueNAS SCALE devices show a TrueNAS badge; package updates point to TrueNAS instead of offering installs

## 1.21.10.2026 (2026-10-21)

- Policy status: agents without a result yet show "Awaiting First Synchronization" and "Awaiting Output", without an output link

## 7.20.10.2026 (2026-10-20)

- Toasts have one close button again; a server message is shown as sent, without a "Detail:" prefix
- SDIO approvals dialog: new "Newer drivers" tab with the newer drivers of all your devices, approve from there; index refresh shows its progress
- Drivers tab: the catalog check shows how many devices are done; SDIO downloads show their progress per device
- Overview: new "Actions" widget with pending actions and the ones completed in the last 24 hours, filterable by client
- Navigation: "Actions" entry with the number of pending actions; it opens the pending actions list
- Device page: "Actions" card with pending and recently completed actions; the "Pending actions" pill shows the count

## 6.20.10.2026 (2026-10-20)

- No changes here; version kept in step with the other components

## 5.20.10.2026 (2026-10-20)

- Drivers tab: "Newer in SDIO" column from the SDIO driver index, approval of a newer driver for every device with that hardware id, install job state per device; drivers from packs the SDIO mirror does not serve show as "BitTorrent only" and cannot be approved
- SDIO approvals dialog: index date and refresh, list of approved drivers with the number of devices, revoke

## 4.20.10.2026 (2026-10-20)

- No changes here; version kept in step with the other components

## 3.20.10.2026 (2026-10-20)

- Install software: choose Chocolatey, winget or both; search runs on the server; a source column and the winget catalog age
- Drivers tab: install a driver from an existing driver package or upload a new one; "Newer in catalog" column, catalog check and one-click install of a newer driver
- Pending actions list winget installs

## 2.20.10.2026 (2026-10-20)

- No changes here; version kept in step with the other components

## 1.20.10.2026 (2026-10-20)

- Vulnerabilities: "Needs update" is the default view, "No fix yet" a separate filter; counts come from the server; rows show the fixed version
- Device page: new Drivers tab for Windows (installed drivers, problem devices with the error meaning, refresh, removal of driver packages)
- Windows updates: driver updates carry a Driver label; patch policies have a "Driver updates" setting
- Software packages: .zip and .cab driver packages, installed as system

## 3.19.10.2026 (2026-10-19)

- Device overview: new cards for system state (units, mounts, time sync, RAID, sensors), network interfaces (state, speed, addresses, rates, errors) and containers and virtual machines; shown once the agent runs 1.19.10.2026
- Performance tab: metric history with a series picker and warning/error lines from matching metric checks
- New check dialogs: systemd unit, container, metric threshold; available on agents and in policies
- Global settings: metric history retention in days

## 2.19.10.2026 (2026-10-19)

- The Alerts entry in the side bar (the one with the alert count) opens the list of active alerts; alert templates stay under Settings > Alerts Manager

## 1.19.10.2026 (2026-10-19)

- Nearly every view and dialog rebuilt with the same look and behaviour: settings, alerts, automation, agent tabs, remote tools, checks, tasks, logs, scripts, reports and the shared code. Plain dialogs share one form renderer
- Audit log: client and site columns are no longer sortable; the object filter lists all stored types (global key store, LAPS policies, notification channels and routes, licenses, maintenance schedules, API keys, app update settings, software packages, report templates and history, UniFi controllers, OPNsense firewalls)
- Pending actions: the agent install entry is gone; completed entries cannot be cancelled
- API keys: the expiration hint says that an empty date means 90 days from now
- Password reset form says that the user's other sessions and API keys end on a reset; the session table shows the server's refusal text
- "Run task now" on policy tasks is hidden when the role may not run tasks
- Windows update entries link only to http(s) addresses; other support links show as text
- Agent install: Linux hint says that the script removes itself after the install
- Custom fields without a default value no longer throw an error in the agent and settings dialogs

## 3.18.10.2026 (2026-10-18)

- Roles: adding, saving and deleting a role asks for your current 2FA code
- Users: changing another user's role, active state or dashboard login, and adding a user with a role, asks for your current 2FA code
- Password and 2FA resets of other users ask for your current 2FA code; the password form shows a refusal in the form
- API keys: creating, editing or deleting a key of another user asks for your current 2FA code

## 2.18.10.2026 (2026-10-18)

- Audit log: object filter knows script snippets

## 1.18.10.2026 (2026-10-18)

- No changes here; version kept in step with the other components

## 2.17.10.2026 (2026-10-17)

- Backup download available to the role, not only superusers

## 1.17.10.2026 (2026-10-17)

- Update dialog behind the new-version notice and under Help > Server update, with the changes of the new version and a live update log
- Server Backups dialog under Settings: list, back up now, delete, download, schedule and retention
- Role editor: Manage Server Updates and Backups

## 1.14.10.2026 (2026-10-14)

- Sorting the process list by CPU orders by the number

## 1.13.10.2026 (2026-10-13)

- Saving or enabling a server-type alert template asks for the 2FA step-up
- Alert overview shows the snooze end date again
- Policy checks tab explains a refused policy outside the role's scope

## 2.11.10.2026 (2026-10-11)

- Registry editor: the key's default value can be read, set and deleted; path search pages through all results
- Terminal and command stream follow the single done event of the new agent

## 1.11.10.2026 (2026-10-11)

- About panel in the Help menu with versions, changelogs and donation links
- Single sign-on and reporting screens rebuilt with the same layout and functions; reporting menus follow the user's report permissions

## 3.09.10.2026 (2026-10-09)

- Patch source switch for Windows

## 2.09.10.2026 (2026-10-09)

- No changes here; version kept in step with the other components

## 1.09.10.2026 (2026-10-09)

- Apps tab, notifications, local admin, network, licenses and protection settings

## 2.08.10.2026 (2026-10-08)

- Harden auth storage, resets, API keys, reports and dependencies

## 1.08.10.2026 (2026-10-08)

- RustDesk versions, changelogs and auto-update switches

## 5.07.10.2026 (2026-10-07)

- No changes here; version kept in step with the other components

## 4.07.10.2026 (2026-10-07)

- Keep awake dialog and status pill

## 3.07.10.2026 (2026-10-07)

- No changes here; version kept in step with the other components

## 2.07.10.2026 (2026-10-07)

- Performance, timeline, groups, discovery, vulnerabilities, vault and encryption tabs, widget overview

## 1.07.10.2026 (2026-10-07)

- Rename devices and show the display name everywhere

## 1.06.10.2026 (2026-10-06)

- Script manager as a library, script builder and typed variables

## 1.27.09.2026 (2026-09-27)

- Devices workspace, split details, two-column login and dark sidebar
- Standalone device page, devices workspace, top bar and sidebar

## 2.26.09.2026 (2026-09-26)

- Live patches tab refresh and install already running warning

## 1.26.09.2026 (2026-09-26)

- Dashboard theme, tooltips, empty states and contrast
- Live agent status refresh and offline banner

## 3.25.09.2026 (2026-09-25)

- Software packages UI and text-only select labels

## 2.25.09.2026 (2026-09-25)

- No changes here; version kept in step with the other components

## 1.25.09.2026 (2026-09-25)

- Maintenance Windows, endpoint health, network monitors and RustDesk client updates

## 2.24.09.2026 (2026-09-24)

- No changes here; version kept in step with the other components

## 1.24.09.2026 (2026-09-24)

- First release under the UniversalLocal RMM name
