// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

// blocks and starter templates for the script builder.
// library conventions: exit 0 ok, 1 failed, 2 warning, 3 bad input
// or unsupported system. inputs come from the environment.
// PowerShell 5.1. POSIX sh passes shellcheck -s sh.
import type { AgentPlatformType } from "@/types/agents";
import type { ScriptShellType, ScriptVariable } from "@/types/scripts";

export interface ScriptBlock {
  id: string;
  shell: ScriptShellType;
  label: string;
  caption: string;
  code: string;
}

export type TemplateKind =
  | "blank"
  | "check"
  | "maintenance"
  | "install"
  | "collector";

export interface ScriptTemplate {
  id: string;
  shell: ScriptShellType;
  kind: TemplateKind;
  label: string;
  caption: string;
  body: string;
  variables: ScriptVariable[];
  timeout: number;
  platforms: AgentPlatformType[];
}

export const TEMPLATE_LANGUAGES: { shell: ScriptShellType; label: string }[] = [
  { shell: "powershell", label: "PowerShell" },
  { shell: "shell", label: "POSIX shell" },
  { shell: "python", label: "Python" },
  { shell: "cmd", label: "Batch" },
];

const PS_HEADER = `# What this script does, in one line.
# Variables: EXAMPLE_NAME (default: value)
# Exit codes: 0 ok, 1 failed, 2 warning, 3 bad input or unsupported system
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
`;

const SH_PATH = `PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
export PATH
set -u
`;

const SH_HEADER = `#!/bin/sh
# What this script does, in one line.
# Variables: EXAMPLE_NAME (default: value)
# Exit codes: 0 ok, 1 failed, 2 warning, 3 bad input or unsupported system
${SH_PATH}`;

const PY_HEADER = `#!/usr/bin/env python3
"""What this script does, in one line.

Variables: EXAMPLE_NAME (default: value)
Exit codes: 0 ok, 1 failed, 2 warning, 3 bad input or unsupported system
"""
import os
import sys
`;

const CMD_HEADER = `@echo off
setlocal EnableExtensions
rem What this script does, in one line.
rem Variables: EXAMPLE_NAME (default: value)
rem Exit codes: 0 ok, 1 failed, 2 warning, 3 bad input or unsupported system
`;

const PS_DOWNLOAD = `$url = 'https://example.com/setup.exe'
$publisher = 'Example Corporation'
if ($url -notmatch '^https://') {
    Write-Output "Only https downloads are allowed: $url"
    exit 3
}
[Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
$file = Join-Path ([IO.Path]::GetTempPath()) ([IO.Path]::GetFileName(([uri]$url).AbsolutePath))
try {
    Invoke-WebRequest -Uri $url -OutFile $file -UseBasicParsing
} catch {
    Write-Output "Download failed: $($_.Exception.Message)"
    exit 1
}
$sig = Get-AuthenticodeSignature -FilePath $file
$signer = ''
if ($sig.SignerCertificate) { $signer = $sig.SignerCertificate.GetNameInfo('SimpleName', $false) }
if ($sig.Status -ne 'Valid' -or $signer -ne $publisher) {
    Remove-Item -LiteralPath $file -Force -ErrorAction SilentlyContinue
    Write-Output "Signature check failed: status $($sig.Status), signer '$signer'"
    exit 1
}
`;

const SH_PKG = `# Package manager by capability; pkg_installed NAME, pkg_install NAME...
mgr=
for m in apt-get dnf yum zypper pacman apk; do
    if command -v "$m" >/dev/null 2>&1; then
        mgr=$m
        break
    fi
done
if [ -z "$mgr" ]; then
    echo "No supported package manager found (apt-get, dnf, yum, zypper, pacman, apk)"
    exit 3
fi

pkg_installed() {
    case $mgr in
    apt-get) dpkg -s "$1" >/dev/null 2>&1 ;;
    dnf | yum | zypper) rpm -q "$1" >/dev/null 2>&1 ;;
    pacman) pacman -Q "$1" >/dev/null 2>&1 ;;
    apk) apk info -e "$1" >/dev/null 2>&1 ;;
    esac
}

pkg_install() {
    case $mgr in
    apt-get) apt-get update -q >/dev/null && DEBIAN_FRONTEND=noninteractive apt-get install -y -q "$@" ;;
    dnf | yum) "$mgr" install -y -q "$@" ;;
    zypper) zypper --non-interactive --quiet install "$@" ;;
    pacman) pacman -S --noconfirm --needed "$@" ;;
    apk) apk add --quiet "$@" ;;
    esac
}
`;

const SCRIPT_BLOCKS: ScriptBlock[] = [
  {
    id: "ps-header",
    shell: "powershell",
    label: "Header with exit codes",
    caption: "Purpose, variables and exit codes; stop on errors",
    code: PS_HEADER,
  },
  {
    id: "ps-read-variable",
    shell: "powershell",
    label: "Read and validate a variable",
    caption: "Default when unset or empty, exit 3 on a bad value",
    code: `$days = 30
if ($env:MAX_AGE_DAYS) {
    if ($env:MAX_AGE_DAYS -notmatch '^\\d{1,4}$') {
        Write-Output "MAX_AGE_DAYS must be a whole number from 0 to 9999, got '$env:MAX_AGE_DAYS'"
        exit 3
    }
    $days = [int]$env:MAX_AGE_DAYS
}
`,
  },
  {
    id: "ps-require-admin",
    shell: "powershell",
    label: "Require elevation",
    caption: "Exit 3 unless running as SYSTEM or an administrator",
    code: `$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Output 'This script must run as SYSTEM or an administrator'
    exit 3
}
`,
  },
  {
    id: "ps-download",
    shell: "powershell",
    label: "Download and check the publisher",
    caption: "https with TLS 1.2, Authenticode signature must be valid",
    code: PS_DOWNLOAD,
  },
  {
    id: "ps-registry-set",
    shell: "powershell",
    label: "Set a registry value",
    caption: "Creates the key, reports the old value, idempotent",
    code: `$key = 'HKLM:\\SOFTWARE\\Example'
$name = 'Setting'
$value = 1
if (-not (Test-Path -LiteralPath $key)) { New-Item -Path $key -Force | Out-Null }
$current = (Get-ItemProperty -LiteralPath $key -Name $name -ErrorAction SilentlyContinue).$name
if ($current -eq $value) {
    Write-Output "$key\\$name is already $value"
} else {
    New-ItemProperty -LiteralPath $key -Name $name -Value $value -PropertyType DWord -Force | Out-Null
    Write-Output "$key\\$name set to $value (was '$current')"
}
`,
  },
  {
    id: "ps-service-running",
    shell: "powershell",
    label: "Ensure a service is running",
    caption: "Starts it when stopped, exit 1 when disabled or failing",
    code: `$serviceName = 'Spooler'
$svc = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
if (-not $svc) {
    Write-Output "Service $serviceName is not installed"
    exit 3
}
if ($svc.StartType -eq 'Disabled') {
    Write-Output "Service $serviceName is disabled"
    exit 1
}
if ($svc.Status -eq 'Running') {
    Write-Output "Service $serviceName is already running"
} else {
    try {
        Start-Service -Name $serviceName
        $svc.WaitForStatus('Running', [TimeSpan]::FromSeconds(30))
        Write-Output "Service $serviceName started"
    } catch {
        Write-Output "Could not start $($serviceName): $($_.Exception.Message)"
        exit 1
    }
}
`,
  },
  {
    id: "ps-per-user-registry",
    shell: "powershell",
    label: "Per-user registry loop",
    caption: "Every signed-in profile under HKEY_USERS",
    code: `$profiles = @(Get-CimInstance -ClassName Win32_UserProfile -Filter 'Special = FALSE AND Loaded = TRUE')
if (-not $profiles) { Write-Output 'No signed-in user profiles found' }
foreach ($p in $profiles) {
    $key = "Registry::HKEY_USERS\\$($p.SID)\\Software\\Example"
    if (-not (Test-Path -LiteralPath $key)) { New-Item -Path $key -Force | Out-Null }
    New-ItemProperty -LiteralPath $key -Name 'Setting' -Value 1 -PropertyType DWord -Force | Out-Null
    Write-Output "$($p.LocalPath): Software\\Example\\Setting = 1"
}
`,
  },
  {
    id: "sh-header",
    shell: "shell",
    label: "Header with PATH and set -u",
    caption: "Shebang, purpose, variables, exit codes",
    code: SH_HEADER,
  },
  {
    id: "sh-read-variable",
    shell: "shell",
    label: "Read and validate a variable",
    caption: "Default when unset or empty, exit 3 on a bad value",
    code: `max_age=\${MAX_AGE_DAYS:-30}
case $max_age in
'' | *[!0-9]*)
    echo "MAX_AGE_DAYS must be a whole number, got '$max_age'"
    exit 3
    ;;
esac
`,
  },
  {
    id: "sh-require-root",
    shell: "shell",
    label: "Root check",
    caption: "Exit 3 unless running as root",
    code: `if [ "$(id -u)" -ne 0 ]; then
    echo "This script must run as root"
    exit 3
fi
`,
  },
  {
    id: "sh-package-manager",
    shell: "shell",
    label: "Package manager and install helper",
    caption: "apt-get, dnf, yum, zypper, pacman or apk",
    code: SH_PKG,
  },
  {
    id: "sh-service-manager",
    shell: "shell",
    label: "Service manager detection",
    caption: "systemd or OpenRC; service_ctl start|stop|restart|enable NAME",
    code: `if command -v systemctl >/dev/null 2>&1 && [ -d /run/systemd/system ]; then
    init=systemd
elif command -v rc-service >/dev/null 2>&1; then
    init=openrc
else
    echo "No supported service manager found (systemd, OpenRC)"
    exit 3
fi

service_ctl() {
    case "$init:$1" in
    systemd:*) systemctl "$1" "$2" ;;
    openrc:enable) rc-update add "$2" default ;;
    openrc:*) rc-service "$2" "$1" ;;
    esac
}
`,
  },
  {
    id: "sh-download",
    shell: "shell",
    label: "Download with sha256 check",
    caption: "curl or wget, https only",
    code: `url=https://example.com/tool.tar.gz
sha256=0000000000000000000000000000000000000000000000000000000000000000
case $url in
https://*) ;;
*)
    echo "Only https downloads are allowed: $url"
    exit 3
    ;;
esac
tmp=$(mktemp) || exit 1
trap 'rm -f "$tmp"' EXIT
if command -v curl >/dev/null 2>&1; then
    curl -fsSL --proto '=https' -o "$tmp" "$url"
elif command -v wget >/dev/null 2>&1; then
    wget -q -O "$tmp" "$url"
else
    echo "Neither curl nor wget is installed (install curl)"
    exit 3
fi || {
    echo "Download failed: $url"
    exit 1
}
actual=$(sha256sum "$tmp" | cut -d ' ' -f 1)
if [ "$actual" != "$sha256" ]; then
    echo "Checksum mismatch for $url: $actual"
    exit 1
fi
`,
  },
  {
    id: "py-header",
    shell: "python",
    label: "Header with exit codes",
    caption: "Shebang, purpose, variables, exit codes",
    code: PY_HEADER,
  },
  {
    id: "py-read-variable",
    shell: "python",
    label: "Read and validate a variable",
    caption: "Default when unset or empty, exit 3 on a bad value",
    code: `raw = os.environ.get("MAX_AGE_DAYS") or "30"
if not raw.isdigit():
    print(f"MAX_AGE_DAYS must be a whole number, got {raw!r}")
    sys.exit(3)
max_age = int(raw)
`,
  },
  {
    id: "cmd-header",
    shell: "cmd",
    label: "Header with exit codes",
    caption: "echo off, purpose, variables, exit codes",
    code: CMD_HEADER,
  },
];

const v = (
  name: string,
  label: string,
  type: ScriptVariable["type"],
  extra: Partial<ScriptVariable> = {},
): ScriptVariable => ({ name, label, type, required: false, ...extra });

const SCRIPT_TEMPLATES: ScriptTemplate[] = [
  {
    id: "ps-blank",
    shell: "powershell",
    kind: "blank",
    label: "Blank",
    caption: "Header with exit codes",
    body: PS_HEADER,
    variables: [],
    timeout: 90,
    platforms: ["windows"],
  },
  {
    id: "ps-check",
    shell: "powershell",
    kind: "check",
    label: "Check with exit codes",
    caption: "Free space on the system drive; ok, warning or failing",
    timeout: 60,
    platforms: ["windows"],
    variables: [
      v("WARN_PERCENT", "Warn below free (%)", "integer", {
        default: "15",
        help: "Free space that counts as a warning",
      }),
      v("FAIL_PERCENT", "Fail below free (%)", "integer", {
        default: "5",
        help: "Free space that fails the check",
      }),
    ],
    body: `# Checks the free space on the system drive.
# Variables: WARN_PERCENT (default 15), FAIL_PERCENT (default 5)
# Exit codes: 0 ok, 1 failing, 2 warning, 3 bad input
function Get-Percent([string]$Name, [string]$Value, [int]$Default) {
    if (-not $Value) { return $Default }
    if ($Value -notmatch '^\\d{1,2}$') {
        Write-Output "$Name must be a whole number from 0 to 99, got '$Value'"
        exit 3
    }
    return [int]$Value
}
$warn = Get-Percent 'WARN_PERCENT' $env:WARN_PERCENT 15
$fail = Get-Percent 'FAIL_PERCENT' $env:FAIL_PERCENT 5
if ($fail -gt $warn) {
    Write-Output 'FAIL_PERCENT must not be above WARN_PERCENT'
    exit 3
}

$disk = Get-CimInstance -ClassName Win32_LogicalDisk -Filter "DeviceID = '$env:SystemDrive'"
if (-not $disk -or -not $disk.Size) {
    Write-Output "Could not read drive $env:SystemDrive"
    exit 1
}
$free = [math]::Round(100 * $disk.FreeSpace / $disk.Size, 1)
$freeGb = [math]::Round($disk.FreeSpace / 1GB, 1)
if ($free -lt $fail) {
    Write-Output "FAIL: $env:SystemDrive has $free% free ($freeGb GB)"
    exit 1
}
if ($free -lt $warn) {
    Write-Output "WARNING: $env:SystemDrive has $free% free ($freeGb GB)"
    exit 2
}
Write-Output "OK: $env:SystemDrive has $free% free ($freeGb GB)"
exit 0
`,
  },
  {
    id: "ps-maintenance",
    shell: "powershell",
    kind: "maintenance",
    label: "Maintenance action",
    caption: "Delete old files from the Windows temp folder, with dry run",
    timeout: 300,
    platforms: ["windows"],
    variables: [
      v("MAX_AGE_DAYS", "Older than (days)", "integer", {
        default: "7",
        help: "Files last written before this many days are removed",
      }),
      v("DRY_RUN", "Dry run", "checkbox", {
        default: "false",
        help: "Only count the files, delete nothing",
      }),
    ],
    body: `# Deletes files older than MAX_AGE_DAYS from the Windows temp folder.
# Variables: MAX_AGE_DAYS (default 7), DRY_RUN (default false)
# Exit codes: 0 ok, 3 bad input
$days = 7
if ($env:MAX_AGE_DAYS) {
    if ($env:MAX_AGE_DAYS -notmatch '^\\d{1,4}$') {
        Write-Output "MAX_AGE_DAYS must be a whole number, got '$env:MAX_AGE_DAYS'"
        exit 3
    }
    $days = [int]$env:MAX_AGE_DAYS
}
if ($env:DRY_RUN -and $env:DRY_RUN -notin 'true', 'false') {
    Write-Output "DRY_RUN must be true or false, got '$env:DRY_RUN'"
    exit 3
}
$dryRun = $env:DRY_RUN -eq 'true'

$folder = Join-Path $env:SystemRoot 'Temp'
$cutoff = (Get-Date).AddDays(-$days)
$files = @(Get-ChildItem -LiteralPath $folder -File -Recurse -Force -ErrorAction SilentlyContinue |
    Where-Object { $_.LastWriteTime -lt $cutoff })
$mb = [math]::Round(($files | Measure-Object -Property Length -Sum).Sum / 1MB, 1)
if ($dryRun) {
    Write-Output "Dry run: $($files.Count) files ($mb MB) older than $days days in $folder"
    exit 0
}
$skipped = 0
foreach ($f in $files) {
    try { Remove-Item -LiteralPath $f.FullName -Force -ErrorAction Stop } catch { $skipped++ }
}
Write-Output "Removed $($files.Count - $skipped) files older than $days days from $folder"
if ($skipped) { Write-Output "Skipped $skipped files that are in use" }
exit 0
`,
  },
  {
    id: "ps-install",
    shell: "powershell",
    kind: "install",
    label: "Software install",
    caption: "Vendor download, publisher check, silent install, idempotent",
    timeout: 900,
    platforms: ["windows"],
    variables: [
      v("EXTRA_ARGS", "Extra installer arguments", "string", {
        help: "Appended to the silent install arguments",
      }),
    ],
    body: `# Installs Example App from the vendor download after a publisher check.
# Variables: EXTRA_ARGS (default none)
# Exit codes: 0 installed or already present, 1 failed, 3 bad input
$displayName = 'Example App*'
$extra = "$env:EXTRA_ARGS"
if ($extra -match '[\\r\\n&|;<>]') {
    Write-Output 'EXTRA_ARGS contains characters that are not allowed'
    exit 3
}

$uninstall = 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',
    'HKLM:\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*'
$found = Get-ItemProperty -Path $uninstall -ErrorAction SilentlyContinue |
    Where-Object { $_.DisplayName -like $displayName } | Select-Object -First 1
if ($found) {
    Write-Output "$($found.DisplayName) $($found.DisplayVersion) is already installed"
    exit 0
}

${PS_DOWNLOAD}
if ($file -like '*.msi') {
    $proc = Start-Process -FilePath msiexec.exe -ArgumentList "/i \`"$file\`" /qn /norestart $extra" -Wait -PassThru
} else {
    # silent switch of the vendor's installer
    $proc = Start-Process -FilePath $file -ArgumentList "/S $extra" -Wait -PassThru
}
Remove-Item -LiteralPath $file -Force -ErrorAction SilentlyContinue
if ($proc.ExitCode -in 0, 3010) {
    Write-Output "Installed (exit code $($proc.ExitCode); 3010 means a reboot is pending)"
    exit 0
}
Write-Output "Installer failed with exit code $($proc.ExitCode)"
exit 1
`,
  },
  {
    id: "ps-collector",
    shell: "powershell",
    kind: "collector",
    label: "Collector for a custom field",
    caption: "Prints the BIOS serial number as the last line",
    timeout: 30,
    platforms: ["windows"],
    variables: [],
    body: `# Prints the BIOS serial number for a custom field.
# Exit codes: 0 ok, 1 not readable
$bios = Get-CimInstance -ClassName Win32_BIOS -ErrorAction SilentlyContinue
if (-not $bios -or -not $bios.SerialNumber) {
    Write-Output 'Serial number not available'
    exit 1
}
Write-Output $bios.SerialNumber.Trim()
`,
  },
  {
    id: "sh-blank",
    shell: "shell",
    kind: "blank",
    label: "Blank",
    caption: "Header with PATH and set -u",
    body: SH_HEADER,
    variables: [],
    timeout: 90,
    platforms: ["linux"],
  },
  {
    id: "sh-check",
    shell: "shell",
    kind: "check",
    label: "Check with exit codes",
    caption: "Used space of a mount point; ok, warning or failing",
    timeout: 60,
    platforms: ["linux"],
    variables: [
      v("MOUNT_POINT", "Mount point", "string", {
        default: "/",
        help: "Directory whose file system is checked",
      }),
      v("WARN_PERCENT", "Warn above used (%)", "integer", {
        default: "85",
        help: "Used space that counts as a warning",
      }),
      v("FAIL_PERCENT", "Fail above used (%)", "integer", {
        default: "95",
        help: "Used space that fails the check",
      }),
    ],
    body: `#!/bin/sh
# Checks the used space of a mount point.
# Variables: MOUNT_POINT (default /), WARN_PERCENT (default 85), FAIL_PERCENT (default 95)
# Exit codes: 0 ok, 1 failing, 2 warning, 3 bad input
${SH_PATH}
mount_point=\${MOUNT_POINT:-/}
warn=\${WARN_PERCENT:-85}
fail=\${FAIL_PERCENT:-95}
for value in "$warn" "$fail"; do
    case $value in
    '' | *[!0-9]*)
        echo "WARN_PERCENT and FAIL_PERCENT must be whole numbers, got '$value'"
        exit 3
        ;;
    esac
done
if [ "$fail" -gt 100 ] || [ "$warn" -gt "$fail" ]; then
    echo "Use 0-100 with WARN_PERCENT at or below FAIL_PERCENT"
    exit 3
fi
if [ ! -d "$mount_point" ]; then
    echo "Mount point $mount_point does not exist"
    exit 3
fi

used=$(df -P "$mount_point" | awk 'NR == 2 { sub(/%/, "", $5); print $5 }')
case $used in
'' | *[!0-9]*)
    echo "Could not read the usage of $mount_point"
    exit 1
    ;;
esac
if [ "$used" -ge "$fail" ]; then
    echo "FAIL: $mount_point is $used% full"
    exit 1
fi
if [ "$used" -ge "$warn" ]; then
    echo "WARNING: $mount_point is $used% full"
    exit 2
fi
echo "OK: $mount_point is $used% full"
`,
  },
  {
    id: "sh-maintenance",
    shell: "shell",
    kind: "maintenance",
    label: "Maintenance action",
    caption: "Delete old files from a directory, with dry run",
    timeout: 300,
    platforms: ["linux"],
    variables: [
      v("TARGET_DIR", "Directory", "string", {
        default: "/var/tmp",
        help: "Absolute path; system directories are refused",
      }),
      v("MAX_AGE_DAYS", "Older than (days)", "integer", {
        default: "30",
        help: "Files modified before this many days are removed",
      }),
      v("DRY_RUN", "Dry run", "checkbox", {
        default: "false",
        help: "Only count the files, delete nothing",
      }),
    ],
    body: `#!/bin/sh
# Deletes files older than MAX_AGE_DAYS from a directory (same file system only).
# Variables: TARGET_DIR (default /var/tmp), MAX_AGE_DAYS (default 30), DRY_RUN (default false)
# Exit codes: 0 ok, 1 some files could not be removed, 3 bad input
${SH_PATH}
dir=\${TARGET_DIR:-/var/tmp}
days=\${MAX_AGE_DAYS:-30}
dry_run=\${DRY_RUN:-false}
case $days in
'' | *[!0-9]*)
    echo "MAX_AGE_DAYS must be a whole number, got '$days'"
    exit 3
    ;;
esac
case $dry_run in
true | false) ;;
*)
    echo "DRY_RUN must be true or false, got '$dry_run'"
    exit 3
    ;;
esac
case $dir in
/ | /bin | /boot | /dev | /etc | /etc/* | /lib | /lib64 | /proc | /root | /sbin | /sys | /usr | /usr/*)
    echo "Refusing to clean $dir"
    exit 3
    ;;
/*) ;;
*)
    echo "The directory must be an absolute path, got '$dir'"
    exit 3
    ;;
esac
if [ ! -d "$dir" ]; then
    echo "Directory $dir does not exist"
    exit 3
fi

count=$(find "$dir" -xdev -type f -mtime +"$days" | wc -l)
if [ "$dry_run" = true ]; then
    echo "Dry run: $count files older than $days days in $dir"
    exit 0
fi
if ! find "$dir" -xdev -type f -mtime +"$days" -exec rm -f {} +; then
    echo "Some of $count files older than $days days could not be removed from $dir"
    exit 1
fi
echo "Removed $count files older than $days days from $dir"
`,
  },
  {
    id: "sh-install",
    shell: "shell",
    kind: "install",
    label: "Software install",
    caption: "Installs a package with the system package manager",
    timeout: 600,
    platforms: ["linux"],
    variables: [
      v("PACKAGE", "Package name", "string", {
        required: true,
        help: "Name in the distribution's repositories, e.g. curl",
      }),
    ],
    body: `#!/bin/sh
# Installs a package with the system package manager.
# Variables: PACKAGE (required)
# Exit codes: 0 installed or already present, 1 failed, 3 bad input or unsupported system
${SH_PATH}
pkg=\${PACKAGE:-}
case $pkg in
'' | -* | *[!A-Za-z0-9+._-]*)
    echo "PACKAGE must be a package name like curl, got '$pkg'"
    exit 3
    ;;
esac

${SH_PKG}
if pkg_installed "$pkg"; then
    echo "$pkg is already installed"
    exit 0
fi
if ! pkg_install "$pkg"; then
    echo "Installing $pkg with $mgr failed"
    exit 1
fi
echo "Installed $pkg with $mgr"
`,
  },
  {
    id: "sh-collector",
    shell: "shell",
    kind: "collector",
    label: "Collector for a custom field",
    caption: "Prints the operating system name as the last line",
    timeout: 30,
    platforms: ["linux"],
    variables: [],
    body: `#!/bin/sh
# Prints the operating system name from /etc/os-release for a custom field.
# Exit codes: 0 ok, 1 not readable
${SH_PATH}
name=$(sed -n 's/^PRETTY_NAME="\\{0,1\\}\\([^"]*\\)"\\{0,1\\}$/\\1/p' /etc/os-release 2>/dev/null)
if [ -z "$name" ]; then
    echo "Could not read /etc/os-release"
    exit 1
fi
echo "$name"
`,
  },
  {
    id: "py-blank",
    shell: "python",
    kind: "blank",
    label: "Blank",
    caption: "Header with exit codes",
    body: PY_HEADER,
    variables: [],
    timeout: 90,
    platforms: [],
  },
  {
    id: "py-check",
    shell: "python",
    kind: "check",
    label: "Check with exit codes",
    caption: "Used space of a path; ok, warning or failing",
    timeout: 60,
    platforms: [],
    variables: [
      v("CHECK_PATH", "Path", "string", {
        help: "Defaults to the root of the system drive",
      }),
      v("WARN_PERCENT", "Warn above used (%)", "integer", {
        default: "85",
        help: "Used space that counts as a warning",
      }),
      v("FAIL_PERCENT", "Fail above used (%)", "integer", {
        default: "95",
        help: "Used space that fails the check",
      }),
    ],
    body: `#!/usr/bin/env python3
"""Checks the used space of a path.

Variables: CHECK_PATH (default system root), WARN_PERCENT (default 85), FAIL_PERCENT (default 95)
Exit codes: 0 ok, 1 failing, 2 warning, 3 bad input
"""
import os
import shutil
import sys


def percent(name, raw, default):
    if not raw:
        return default
    if not raw.isdigit() or int(raw) > 100:
        print(f"{name} must be a whole number from 0 to 100, got {raw!r}")
        sys.exit(3)
    return int(raw)


path = os.environ.get("CHECK_PATH") or os.path.abspath(os.sep)
warn = percent("WARN_PERCENT", os.environ.get("WARN_PERCENT"), 85)
fail = percent("FAIL_PERCENT", os.environ.get("FAIL_PERCENT"), 95)
if warn > fail:
    print("WARN_PERCENT must not be above FAIL_PERCENT")
    sys.exit(3)
try:
    usage = shutil.disk_usage(path)
except OSError as e:
    print(f"Could not read {path}: {e.strerror}")
    sys.exit(3)

used = round(100 * usage.used / usage.total, 1)
if used >= fail:
    print(f"FAIL: {path} is {used}% full")
    sys.exit(1)
if used >= warn:
    print(f"WARNING: {path} is {used}% full")
    sys.exit(2)
print(f"OK: {path} is {used}% full")
`,
  },
  {
    id: "py-maintenance",
    shell: "python",
    kind: "maintenance",
    label: "Maintenance action",
    caption: "Delete old files from a directory, with dry run",
    timeout: 300,
    platforms: [],
    variables: [
      v("TARGET_DIR", "Directory", "string", {
        required: true,
        help: "Absolute path of the directory to clean",
      }),
      v("MAX_AGE_DAYS", "Older than (days)", "integer", {
        default: "30",
        help: "Files modified before this many days are removed",
      }),
      v("DRY_RUN", "Dry run", "checkbox", {
        default: "false",
        help: "Only count the files, delete nothing",
      }),
    ],
    body: `#!/usr/bin/env python3
"""Deletes files older than MAX_AGE_DAYS from a directory.

Variables: TARGET_DIR (required), MAX_AGE_DAYS (default 30), DRY_RUN (default false)
Exit codes: 0 ok, 1 some files could not be removed, 3 bad input
"""
import os
import sys
import time

target = os.environ.get("TARGET_DIR") or ""
raw_days = os.environ.get("MAX_AGE_DAYS") or "30"
dry_run = os.environ.get("DRY_RUN") or "false"
if not os.path.isabs(target) or not os.path.isdir(target):
    print(f"TARGET_DIR must be an existing absolute path, got {target!r}")
    sys.exit(3)
if not raw_days.isdigit():
    print(f"MAX_AGE_DAYS must be a whole number, got {raw_days!r}")
    sys.exit(3)
if dry_run not in ("true", "false"):
    print(f"DRY_RUN must be true or false, got {dry_run!r}")
    sys.exit(3)

cutoff = time.time() - int(raw_days) * 86400
count = failed = 0
for root, _dirs, files in os.walk(target):
    for name in files:
        path = os.path.join(root, name)
        try:
            if os.lstat(path).st_mtime >= cutoff:
                continue
            count += 1
            if dry_run == "false":
                os.remove(path)
        except OSError:
            failed += 1

if dry_run == "true":
    print(f"Dry run: {count} files older than {raw_days} days in {target}")
    sys.exit(0)
print(f"Removed {count - failed} files older than {raw_days} days from {target}")
if failed:
    print(f"{failed} files could not be removed")
    sys.exit(1)
`,
  },
  {
    id: "py-collector",
    shell: "python",
    kind: "collector",
    label: "Collector for a custom field",
    caption: "Prints the platform string as the last line",
    timeout: 30,
    platforms: [],
    variables: [],
    body: `#!/usr/bin/env python3
"""Prints the operating system and version for a custom field.

Exit codes: 0 ok
"""
import platform

print(platform.platform(terse=True))
`,
  },
  {
    id: "cmd-blank",
    shell: "cmd",
    kind: "blank",
    label: "Blank",
    caption: "Header with exit codes",
    body: CMD_HEADER,
    variables: [],
    timeout: 90,
    platforms: ["windows"],
  },
  {
    id: "cmd-check",
    shell: "cmd",
    kind: "check",
    label: "Check with exit codes",
    caption: "A Windows service is running",
    timeout: 60,
    platforms: ["windows"],
    variables: [
      v("SERVICE_NAME", "Service name", "string", {
        required: true,
        help: "Short name of the service, e.g. Spooler",
      }),
    ],
    body: `@echo off
setlocal EnableExtensions EnableDelayedExpansion
rem Checks that a Windows service is running.
rem Variables: SERVICE_NAME (required)
rem Exit codes: 0 running, 1 not running, 3 bad input
if not defined SERVICE_NAME (
    echo SERVICE_NAME is required
    exit /b 3
)
for /f "delims=ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_.-" %%c in ("!SERVICE_NAME!") do (
    echo SERVICE_NAME may only contain letters, digits, _ . and -
    exit /b 3
)
sc.exe query "%SERVICE_NAME%" >nul 2>&1
if errorlevel 1 (
    echo Service %SERVICE_NAME% is not installed
    exit /b 3
)
sc.exe query "%SERVICE_NAME%" | find "RUNNING" >nul
if errorlevel 1 (
    echo FAIL: service %SERVICE_NAME% is not running
    exit /b 1
)
echo OK: service %SERVICE_NAME% is running
exit /b 0
`,
  },
  {
    id: "cmd-collector",
    shell: "cmd",
    kind: "collector",
    label: "Collector for a custom field",
    caption: "Prints the Windows version as the last line",
    timeout: 30,
    platforms: ["windows"],
    variables: [],
    body: `@echo off
setlocal EnableExtensions
rem Prints the Windows version for a custom field.
rem Exit codes: 0 ok, 1 not readable
for /f "tokens=2 delims=[]" %%v in ('ver') do set "build=%%v"
if not defined build (
    echo Could not read the Windows version
    exit /b 1
)
echo %build:Version =%
exit /b 0
`,
  },
];

export function blocksFor(shell: ScriptShellType): ScriptBlock[] {
  return SCRIPT_BLOCKS.filter((b) => b.shell === shell);
}

export function templatesFor(shell: ScriptShellType): ScriptTemplate[] {
  return SCRIPT_TEMPLATES.filter((t) => t.shell === shell);
}

// builder row: variable, stable key for reordering, and whether
// the user typed the name (otherwise it tracks the label)
export interface BuilderVariable extends ScriptVariable {
  key: number;
  nameEdited: boolean;
}

let nextKey = 1;

export function toBuilderVariable(
  v: Partial<ScriptVariable> = {},
  nameEdited = true,
): BuilderVariable {
  return {
    name: v.name || "",
    label: v.label || "",
    type: v.type || "string",
    required: !!v.required,
    default: v.default || "",
    help: v.help || "",
    options: [...(v.options || [])],
    key: nextKey++,
    nameEdited,
  };
}
