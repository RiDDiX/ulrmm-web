// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

// Same format the server parses in core/about.py:
// "## <version> (<date>)" headings, "- " items below them.
const HEADING = /^##\s+(\S+)(?:\s+\((\d{4}-\d{2}-\d{2})\))?\s*$/;

export function parseChangelog(text) {
  const releases = [];
  for (const line of (text || "").split(/\r?\n/)) {
    const m = HEADING.exec(line);
    if (m) {
      releases.push({ version: m[1], date: m[2] || null, items: [] });
    } else if (releases.length && line.startsWith("- ")) {
      releases[releases.length - 1].items.push(line.slice(2).trim());
    }
  }
  return releases;
}
