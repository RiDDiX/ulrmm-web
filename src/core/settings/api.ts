// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

import { ref } from "vue";
import axios, { type AxiosResponse } from "axios";

import { notifySuccess } from "@/utils/notify";

import type { Schedule } from "./types";

const SCHEDULES = "/core/schedules/";

function useSchedule() {
  const schedules = ref<Schedule[]>([]);
  const isLoading = ref(false);
  const isError = ref(false);

  // flags the request state around one call; onDone runs on success only
  async function track<T>(
    request: () => Promise<AxiosResponse<T>>,
    onDone: (data: T) => void,
  ) {
    isLoading.value = true;
    isError.value = false;
    try {
      const { data } = await request();
      onDone(data);
    } catch {
      isError.value = true;
    } finally {
      isLoading.value = false;
    }
  }

  const getSchedules = () =>
    track<Schedule[]>(
      () => axios.get(SCHEDULES),
      (data) => {
        schedules.value = data;
      },
    );

  const addSchedule = (schedule: Schedule) =>
    track<Schedule>(
      () => axios.post(SCHEDULES, schedule),
      (created) => {
        schedules.value.push(created);
        notifySuccess("Schedule was added successfully.");
      },
    );

  const editSchedule = (id: number, schedule: Schedule) =>
    track<Schedule>(
      () => axios.put(`${SCHEDULES}${id}/`, schedule),
      (saved) => {
        const at = schedules.value.findIndex((s) => s.id === saved.id);
        if (at !== -1) schedules.value[at] = saved;
        notifySuccess("Schedule was modified successfully.");
      },
    );

  const deleteSchedule = (id: number) =>
    track<unknown>(
      () => axios.delete(`${SCHEDULES}${id}/`),
      () => {
        schedules.value = schedules.value.filter((s) => s.id !== id);
        notifySuccess("Schedule successfully deleted.");
      },
    );

  const actions = { getSchedules, addSchedule, editSchedule, deleteSchedule };
  return { ...actions, schedules, isError, isLoading };
}

export const useScheduleShared = useSchedule();
