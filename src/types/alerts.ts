// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

export type AlertSeverity = "error" | "warning" | "info";
export type ActionType = "script" | "server" | "rest";

type Prefixed<P extends string, T> = {
  [K in keyof T as `${P}_${K & string}`]: T[K];
};

type ActionRef = { action?: number; action_rest?: number };
type ActionInput = { action_args: string[]; action_env_vars: string[] };

// what runs when an alert fires; the resolved_ copy runs when it clears
interface AlertAction extends ActionRef, ActionInput {
  action_type: ActionType;
  action_timeout: number;
}

// per source (agent_, check_, task_); null means "leave it to the source"
interface AlertDelivery {
  email_on_resolved: boolean;
  text_on_resolved: boolean;
  always_email: boolean | null;
  always_text: boolean | null;
  always_alert: boolean | null;
  periodic_alert_days: number;
  script_actions: boolean;
}

// checks and tasks pick the severities each channel reports
interface AlertSeverityFilter {
  email_alert_severity: AlertSeverity[];
  text_alert_severity: AlertSeverity[];
  dashboard_alert_severity: AlertSeverity[];
}

type Recipients = { email_recipients: string[]; text_recipients: string[] };

export interface AlertTemplate
  extends AlertAction,
    Recipients,
    Prefixed<"resolved", AlertAction>,
    Prefixed<"agent", AlertDelivery>,
    Prefixed<"check", AlertDelivery & AlertSeverityFilter>,
    Prefixed<"task", AlertDelivery & AlertSeverityFilter> {
  id: number;
  name: string;
  is_active: boolean;
  email_from: string;
}
