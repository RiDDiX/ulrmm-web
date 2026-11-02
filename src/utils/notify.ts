// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

import { Notify } from "quasar";

// errors need to stay up long enough to read the detail plus the status
// caption; success/warning/info stay at the quasar.config.js default. The
// close button comes from the defaults there; Quasar appends default actions
// to the ones passed here, so none are passed.
const ERROR_TIMEOUT = 6000;
const SHORT_TIMEOUT = 2000;

type Kind = "positive" | "negative" | "warning" | "info";

function show(type: Kind, message: string, timeout: number) {
  Notify.create({ type, message, timeout });
}

export function notifySuccess(msg: string, timeout = SHORT_TIMEOUT) {
  show("positive", msg, timeout);
}

export function notifyError(msg: string, timeout = ERROR_TIMEOUT) {
  show("negative", msg, timeout);
}

export function notifyWarning(msg: string, timeout = SHORT_TIMEOUT) {
  show("warning", msg, timeout);
}

export function notifyInfo(msg: string, timeout = SHORT_TIMEOUT) {
  show("info", msg, timeout);
}

// DRF serializer field name -> readable label: "non_field_errors" -> "Non field errors"
export function humanizeFieldKey(key: string): string {
  const spaced = key.replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
