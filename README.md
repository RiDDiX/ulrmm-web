# UniversalLocal RMM Dashboard

[![Frontend Linting and Formatting](https://github.com/RiDDiX/ulrmm-web/actions/workflows/frontend-linting.yml/badge.svg)](https://github.com/RiDDiX/ulrmm-web/actions/workflows/frontend-linting.yml)
[![License](https://img.shields.io/badge/license-FSL--1.1--ALv2-blue)](LICENSE.md)
[![Security policy](https://img.shields.io/badge/security-policy-informational)](SECURITY.md)

The web dashboard of UniversalLocal RMM, built with Vue 3 and Quasar 2.
It is not deployed on its own: the server's `install.sh` and `update.sh` build it
from this repository (`npm ci && npm run build`) and serve `dist/`. Installation,
updates and operations are described in the
[server README](https://github.com/RiDDiX/ulrmm) (`../README.md` when this
repository is checked out inside the server repository).

## Highlights

- Sign-in with password plus TOTP code for local accounts; OpenID Connect
  single sign-on is available as well.
- Overview board (`/overview`): each user builds a personal board from 15
  widget types, saved per user, with one-click restore of the default board.
- Devices workspace (`/`): one table for every client and site with status,
  checks, patch state and tags, plus fleet health, a quick panel and a
  right-click action menu.
- Device page (`/agents/:agent_id`): opened by double-click, 17 tabs from
  overview and checks over patches, software, encryption, vault and
  vulnerabilities to performance, timeline, audit and notes.
- Remote tools in pop-out windows: take control of the desktop through
  MeshCentral, VNC or RustDesk (`/takecontrol`, `/webvnc`), or work in the
  background with a web terminal, process manager, services, event/system logs
  and registry editor (`/webterm`, `/remotebackground`).
- Security Center (`/security`): trust matrix with fingerprint, expiry and
  status per agent, rotation policies per client and site, security events kept
  90 days, and emergency actions (quarantine, block, reset identity).
- Image library (`/images`) and deployment builder: unattended answer files for
  Windows 10/11/Server, Ubuntu, Debian, RHEL/Rocky/Alma/Fedora, SUSE,
  Arch/CachyOS/EndeavourOS and Batocera, seed and full ISOs built on the
  server, base images downloaded with resume and SHA-256 check or uploaded in
  chunks and kept in a library.
- Update Center (`/updates`): signed server releases from GitHub, Gitea and any
  added repository, queried at once; Ed25519 manifest and SHA-256 tarball
  checks; a live stepper (pre-flight, download, verify, backup, apply,
  migration, restart, health) with rollback; an agent fleet card that starts
  the rollout to outdated agents.
- Reporting (`/reports/:id`): templates in Markdown or HTML with data queries,
  run on demand or on a schedule, previewed in a sandboxed frame.
- Scripts, checks, tasks and alerts: a library of 216 ready-made scripts plus
  own scripts with a Monaco editor and typed variables; checks, scheduled
  tasks and automation policies; alert templates with notification channels
  and routes.
- Settings: branding (product name, company, support URL, logo, favicon),
  roles with fine-grained permissions, groups and tags, LAPS, agent
  protection, network integrations (UniFi, OPNsense) and the RustDesk server.
- Light and dark mode per user.

## Version

The dashboard has the same version as the server: `version` in `package.json`
and the root `version` fields of `package-lock.json` must equal the server's
`VERSION` file (`X.DD.MM.YYYY`, stored without `v`, e.g. `1.01.10.2026`).

## Local development

Node 24 (CI uses node-version 24; the server installs Node 24.x).

```bash
cp .env.example .env    # DEV_URL: API for npm run serve, PROD_URL: API for builds
npm ci
npm run serve           # dev server on DEV_HOST:DEV_PORT, https if USE_HTTPS=true
npm run build           # production build in dist/
```

On the server the API address comes from `env-config.js`, which the install and
update scripts write next to the build.

## Gates

Before every commit:

```bash
npx prettier --check <changed and new files>
npm run lint -- --max-warnings=0
npm run build
npm run check:version -- <path to the server checkout>
```

## Screenshots

[![Overview board](https://raw.githubusercontent.com/RiDDiX/ulrmm/main/docs/showcase/overview.png)](https://github.com/RiDDiX/ulrmm/blob/main/docs/showcase/overview.png)

[![Devices workspace](https://raw.githubusercontent.com/RiDDiX/ulrmm/main/docs/showcase/devices.png)](https://github.com/RiDDiX/ulrmm/blob/main/docs/showcase/devices.png)

[![Device page](https://raw.githubusercontent.com/RiDDiX/ulrmm/main/docs/showcase/device-overview-windows.png)](https://github.com/RiDDiX/ulrmm/blob/main/docs/showcase/device-overview-windows.png)

More screenshots: [docs/SHOWCASE.md](https://github.com/RiDDiX/ulrmm/blob/main/docs/SHOWCASE.md).

## License and third-party software

Licensed under the Functional Source License, Version 1.1, ALv2 Future License
([LICENSE.md](LICENSE.md)); two years after a version is made available it is
also licensed under Apache-2.0. If you redistribute copies, modifications or
derivatives, include LICENSE.md or a link to it and keep the copyright notices,
[NOTICE.md](NOTICE.md) included.

The built dashboard contains third-party npm packages, fonts and icons, among
them Vue, Quasar, Monaco Editor, xterm.js, ApexCharts, Roboto, Material Icons,
Material Design Icons and Font Awesome Free. They keep their own licenses;
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) lists them with their license
texts. Every build copies that file, LICENSE.md and NOTICE.md to
`dist/licenses/`, and the About dialog links to them.

The dashboard is provided as is, without warranty, see LICENSE.md. Product names
shown in it, such as MeshCentral, RustDesk, UniFi, OPNsense, Windows and the
Linux distributions, are trademarks of their owners; the project is not
affiliated with or endorsed by them. Responsible use, outbound connections and
data protection are covered in the
[server README](https://github.com/RiDDiX/ulrmm#use-at-your-own-risk).
