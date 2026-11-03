// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

import { Notify } from "quasar";

function refuse(message: string) {
  Notify.create({ type: "negative", timeout: 2000, message });
  return false;
}

// at least one threshold set, and when both are set they must be ordered:
// warning below error, or above it for disk checks (they measure free space)
export function isValidThreshold(
  warning: number,
  error: number,
  diskcheck = false,
) {
  if ([warning, error].every((v) => v === 0)) {
    return refuse("Warning Threshold or Error Threshold need to be set");
  }
  if (warning > 0 && error > 0) {
    if (!diskcheck && warning > error) {
      return refuse("Warning Threshold must be less than Error Threshold");
    }
    if (diskcheck && warning < error) {
      return refuse("Warning Threshold must be more than Error Threshold");
    }
  }
  return true;
}

// a number or "*" for any event
export function validateEventID(val: number | "*") {
  if (val === null || val.toString().replace(/\s/g, "") === "") return false;
  return val === "*" || !isNaN(val);
}

// q-select @new-value handler: only whole numbers become return codes
export function validateRetcode(
  val: string,
  done: (item?: unknown, mode?: "add" | "add-unique" | "toggle") => void,
) {
  if (/^\d+$/.test(val)) done(val);
  else done();
}

// 1-3 digits plus a unit: s, m, h or d (either case)
export function validateTimePeriod(val: string) {
  return /^\d{1,3}[SsMmHhDd]$/.test(val);
}

const EMAIL_PATTERN =
  /^(?=[a-zA-Z0-9@._%+-]{6,254}$)[a-zA-Z0-9._%+-]{1,64}@(?:[a-zA-Z0-9-]{1,63}\.){1,8}[a-zA-Z]{2,63}$/;

export function isValidEmail(val: string) {
  return EMAIL_PATTERN.test(val);
}
