// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

export type ScheduleType = "daily" | "weekly" | "monthly";
export type MonthlyType = "days" | "weeks";

export interface Schedule {
  id: number;
  name: string;
  run_time: string;
  schedule_type: ScheduleType;
  monthly_type: MonthlyType;
  run_time_weekdays: number[];
  monthly_months_of_year: number[];
  monthly_days_of_month: number[];
  monthly_weeks_of_month: number[];
}
