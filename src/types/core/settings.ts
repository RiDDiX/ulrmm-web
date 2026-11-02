// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

type TimeZones = { default_time_zone: string; all_timezones: string[] };
type LoginRules = { sso_enabled: boolean; block_local_user_logon: boolean };

// the part of /core/settings/ the SPA reads directly
export interface CoreSetting extends TimeZones, LoginRules {
  email_alert_recipients: string[];
}
