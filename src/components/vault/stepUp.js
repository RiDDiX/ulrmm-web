// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

import { ensureConsoleStepUp } from "@/composables/accounts";
import { notifyError } from "@/utils/notify";

function errorText(e) {
  const data = e.response.data;
  if (typeof data === "string" && !data.trimStart().startsWith("<")) {
    return data;
  }
  if (data?.detail) return data.detail;
  if (data && typeof data === "object") {
    const first = Object.values(data)[0];
    if (first) return String(Array.isArray(first) ? first[0] : first);
  }
  return `The server returned an error (${e.response.status}).`;
}

// like withStepUp, but other errors reach the caller untoasted, so a form
// can show field errors on its fields. null when the code prompt is cancelled.
export async function stepUpCall($q, call) {
  try {
    return await call({ silent: true });
  } catch (e) {
    if (e?.response?.status !== 403 || !e.response.data?.stepup) throw e;
  }
  let open = false;
  try {
    open = await ensureConsoleStepUp($q);
  } catch {
    open = false;
  }
  return open ? call({ silent: true }) : null;
}

const firstText = (v) =>
  Array.isArray(v) && typeof v[0] === "string" ? v[0] : v;

// 400 {"field": ["text"]} -> fields {field: "text"}; nested lists such as
// items stay lists. message is one line for a toast or a banner.
export function serverErrors(e) {
  const data = e?.response?.data;
  /** @type {Record<string, unknown>} */
  const fields = {};
  if (data && typeof data === "object" && !Array.isArray(data)) {
    for (const [key, value] of Object.entries(data)) {
      if (key !== "detail" && key !== "stepup") fields[key] = firstText(value);
    }
  }
  const message = e?.response
    ? errorText(e)
    : "The server could not be reached.";
  return { fields, message };
}

// call(config) skips the axios toast. 403 {"stepup": true} asks for the
// two-factor code (60 min terminal/files window) and retries once.
// Other errors are shown here. The rejection has no body, so a password
// is not logged. null on cancel or failure.
export async function withStepUp($q, call) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await call({ silent: true });
    } catch (e) {
      // offline banner and 401 redirect come from the axios boot
      if (!e?.response || e.response.status === 401) return null;
      if (
        attempt === 0 &&
        e.response.status === 403 &&
        e.response.data?.stepup
      ) {
        let open = false;
        try {
          open = await ensureConsoleStepUp($q);
        } catch {
          open = false;
        }
        if (open) continue;
        return null;
      }
      notifyError(errorText(e));
      return null;
    }
  }
  return null;
}
