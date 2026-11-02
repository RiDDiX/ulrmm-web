// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

// service state as the agent reports it: label, pill, tooltip
const serviceStates = {
  running: {
    label: "Running",
    cls: "rmm-pill--positive",
    tip: "The service is running",
  },
  stopped: {
    label: "Stopped",
    cls: "rmm-pill--neutral",
    tip: "The service is not running",
  },
  failed: {
    label: "Failed",
    cls: "rmm-pill--negative",
    tip: "The service stopped with an error",
  },
  start_pending: {
    label: "Starting",
    cls: "rmm-pill--info",
    tip: "Windows is starting the service",
  },
  stop_pending: {
    label: "Stopping",
    cls: "rmm-pill--info",
    tip: "Windows is stopping the service",
  },
  continue_pending: {
    label: "Resuming",
    cls: "rmm-pill--info",
    tip: "Windows is resuming the paused service",
  },
  pause_pending: {
    label: "Pausing",
    cls: "rmm-pill--info",
    tip: "Windows is pausing the service",
  },
  paused: {
    label: "Paused",
    cls: "rmm-pill--warning",
    tip: "The service is paused",
  },
  unknown: {
    label: "Unknown",
    cls: "rmm-pill--neutral",
    tip: "The agent could not read the service state",
  },
};

export function serviceStatusMeta(status) {
  return (
    serviceStates[status] || {
      label: status || "Unknown",
      cls: "rmm-pill--neutral",
      tip: "The agent could not read the service state",
    }
  );
}
