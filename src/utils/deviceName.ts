// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

// name shown in the dashboard: display name if one is set, else the hostname.
// hostname is the machine id (install, mesh links, API payloads).
const DISPLAY_NAME_MAX = 64;

interface Named {
  hostname?: string | null;
  display_name?: string | null;
  effective_name?: string | null;
}

export function deviceName(agent: Named | null | undefined): string {
  return (
    agent?.display_name?.trim() ||
    agent?.effective_name ||
    agent?.hostname ||
    ""
  );
}

// server rules: trimmed, 64 characters max, no control characters.
// Unicode format characters are refused there too. empty clears the name.
export function displayNameError(value: string | null | undefined) {
  const name = (value ?? "").trim();
  // code points, same count the server uses
  const length = Array.from(name).length;
  if (length > DISPLAY_NAME_MAX)
    return `At most ${DISPLAY_NAME_MAX} characters (${length} entered)`;
  if (/[\u0000-\u001f\u007f-\u009f]/.test(name))
    return "Control characters (tabs, line breaks) are not allowed";
  return null;
}
