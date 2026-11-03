// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

// The dashboard is released together with the server, from a second repository.
// This compares our package.json against the server's canonical VERSION file.
// The server tree is not always checked out next to this one, so without a path
// there is nothing to compare and the check passes.
import { readFileSync } from "node:fs";

const serverRepo = process.argv[2] || process.env.ULRMM_SERVER_REPO;
if (!serverRepo) {
  console.log("check:version: no server tree given, skipped");
  process.exit(0);
}

const web = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
).version;
const server = readFileSync(`${serverRepo}/VERSION`, "utf8").trim();

if (web !== server) {
  console.error(
    `check:version: package.json is ${web}, server VERSION is ${server}`,
  );
  process.exit(1);
}
console.log(`check:version: ${web} matches the server`);
