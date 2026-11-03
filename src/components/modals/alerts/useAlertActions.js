// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

import axios from "axios";
import { notifySuccess } from "@/utils/notify";
import ScriptOutput from "@/components/checks/ScriptOutput.vue";

// snooze, unsnooze and resolve for single rows and the bulk menu;
// reload runs after every change the server accepted
export function useAlertActions($q, reload) {
  async function send(request, done) {
    $q.loading.show();
    try {
      await request();
      reload();
      $q.loading.hide();
      notifySuccess(done);
    } catch {
      $q.loading.hide();
    }
  }

  function askDays(then) {
    $q.dialog({
      title: "Snooze Alert",
      message: "How many days to snooze alert? Whole days, 1 to 3650.",
      prompt: {
        type: "number",
        model: "",
        label: "Days",
        outlined: true,
        dense: true,
        // whole days, same range as the server (SNOOZE_DAYS_MAX)
        isValid: (days) =>
          Number.isInteger(Number(days)) && days >= 1 && days <= 3650,
      },
      cancel: true,
    }).onOk(then);
  }

  const update = (alert, change) =>
    axios.put(`alerts/${alert.id}/`, { id: alert.id, ...change });
  const updateMany = (alerts, change) =>
    axios.post("alerts/bulk/", { alerts: alerts.map((a) => a.id), ...change });

  function showOutput(alert, failure) {
    const prefix = failure ? "action_" : "resolved_action_";
    const field = (name) => alert[prefix + name];
    const scriptInfo = {
      readable_desc: `${alert.alert_type} ${failure ? "failure" : "resolved"} action results`,
      execution_time: field("execution_time"),
      retcode: field("retcode"),
      stdout: field("stdout"),
      errout: field("errout"),
      last_run: field("run"),
    };
    $q.dialog({ component: ScriptOutput, componentProps: { scriptInfo } });
  }

  // the buttons of one row, in display order; `when` hides the ones that
  // do not apply to that alert
  const rowActions = [
    {
      icon: "mdi-archive-alert",
      label: "Show failure action run results",
      tip: "Show the output of the action that ran when the alert started",
      when: (alert) => alert.action_run,
      run: (alert) => showOutput(alert, true),
    },
    {
      icon: "mdi-archive-check",
      label: "Show resolved action run results",
      tip: "Show the output of the action that ran when the alert resolved",
      when: (alert) => alert.resolved_action_run,
      run: (alert) => showOutput(alert, false),
    },
    {
      icon: "snooze",
      label: "Snooze alert",
      tip: "Snooze: hide this alert from the dashboard for some days",
      when: (alert) => !alert.resolved && !alert.snoozed,
      run: (alert) =>
        askDays((days) =>
          send(
            () => update(alert, { type: "snooze", snooze_days: days }),
            `The alert has been snoozed for ${days} days`,
          ),
        ),
    },
    {
      icon: "alarm_off",
      label: "Unsnooze alert",
      tip: "Unsnooze: show this alert again now",
      when: (alert) => !alert.resolved && alert.snoozed,
      run: (alert) =>
        send(
          () => update(alert, { type: "unsnooze" }),
          "The alert has been unsnoozed",
        ),
    },
    {
      icon: "flag",
      label: "Resolve alert",
      tip: "Resolve: mark it resolved; a new alert opens if it still fails",
      when: (alert) => !alert.resolved,
      run: (alert) =>
        send(
          () => update(alert, { type: "resolve" }),
          "The alert has been resolved",
        ),
    },
  ];

  const bulkActions = [
    {
      title: "Snooze alerts",
      icon: "alarm_off",
      caption: "Hide them from the dashboard for some days",
      run: (alerts) =>
        askDays((days) =>
          send(
            () =>
              updateMany(alerts, { bulk_action: "snooze", snooze_days: days }),
            `Alerts were snoozed for ${days} days`,
          ),
        ),
    },
    {
      title: "Resolve alerts",
      icon: "flag",
      caption: "Mark them resolved; resolve actions do not run",
      run: (alerts) =>
        send(
          () => updateMany(alerts, { bulk_action: "resolve" }),
          "Alerts were resolved",
        ),
    },
  ];

  return { rowActions, bulkActions };
}
