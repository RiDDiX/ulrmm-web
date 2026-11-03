// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

import { computed, onMounted } from "vue";

import { useScheduleShared } from "./api";

// schedule picker options; loads the list when the component mounts
export function useScheduleDropdown() {
  const { schedules, getSchedules } = useScheduleShared;

  const scheduleOptions = computed(() =>
    schedules.value.map(({ id, name }) => ({ label: name, value: id })),
  );

  onMounted(getSchedules);

  return { scheduleOptions };
}
