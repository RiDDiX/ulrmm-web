// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

import axios, { type AxiosRequestConfig, type AxiosResponse } from "axios";

/* eslint-disable @typescript-eslint/no-explicit-any */

type Config = AxiosRequestConfig & { silent?: boolean };

const body = <T>(response: AxiosResponse<T>) => response.data;

// axios bound to one path prefix; every call resolves to the response body
export function endpoint(prefix: string) {
  const at = (path: string) => `${prefix}${path}`;
  return {
    get: <T = any>(path: string, config?: Config) =>
      axios.get<T>(at(path), config).then(body),
    delete: <T = any>(path: string, config?: Config) =>
      axios.delete<T>(at(path), config).then(body),
    post: <T = any>(path: string, payload?: unknown, config?: Config) =>
      axios.post<T>(at(path), payload, config).then(body),
    put: <T = any>(path: string, payload?: unknown, config?: Config) =>
      axios.put<T>(at(path), payload, config).then(body),
    patch: <T = any>(path: string, payload?: unknown, config?: Config) =>
      axios.patch<T>(at(path), payload, config).then(body),
  };
}

export function logAndRethrow(...label: string[]) {
  return (e: unknown): never => {
    console.error(...label, e);
    throw e;
  };
}
