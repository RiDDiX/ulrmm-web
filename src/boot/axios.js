// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

import axios from "axios";
import { Notify } from "quasar";
import { useAuthStore } from "@/stores/auth";
import { useDashboardStore } from "@/stores/dashboard";
import { humanizeFieldKey } from "@/utils/notify";

export const getBaseUrl = () =>
  import.meta.env.QUASAR_PROD ? window._env_.PROD_URL : import.meta.env.DEV_API;

// drop the request body on reject. console.error would print
// passwords and script inputs. callers use status and data
function withoutBody(error) {
  const config = error.config && { ...error.config, data: undefined };
  const response = error.response && { ...error.response, config };
  return { ...error, config, response };
}

const reject = (error) => Promise.reject(withoutBody(error));

const signedIn = () => useAuthStore().token != null;

// the dashboard store opens the dashinfo websocket with the current token
// when it is first created, so it must not be touched before login
function setOffline(value) {
  if (signedIn()) useDashboardStore().setOffline(value);
}

// no response, or 502/503 (504 on GET) with a token: unreachable.
// one banner instead of a toast. 504 on other methods stays an error.
function unreachable({ response, config }) {
  if (!response) return true;
  const { status } = response;
  const gateway =
    status === 502 ||
    status === 503 ||
    (status === 504 && config?.method === "get");
  return gateway && signedIn();
}

// a nested serializer's error ({ field: { 0: [msg] } }, [{}, { name: [msg] }])
// -> its first message
function firstMessage(value) {
  if (typeof value !== "object" || value === null) return value;
  for (const item of Object.values(value)) {
    const message = firstMessage(item);
    if (message != null && message !== "") return message;
  }
  return undefined;
}

// 4xx body -> one line: the server's sentence, or "Field: problem"
async function clientErrorText({ config, response: { data } }) {
  if (config.responseType === "blob") {
    return (await data.text()).replace(/^"|"$/g, "");
  }
  if (data.non_field_errors) return data.non_field_errors[0];
  if (typeof data === "string") return data;
  if (typeof data?.detail === "string") return data.detail;
  // a list body: ValidationError raised in a view, or many=True errors
  if (Array.isArray(data)) return firstMessage(data);
  if (typeof data === "object") {
    const [key, value] = Object.entries(data)[0] ?? [];
    const message = firstMessage(value);
    if (message != null) return `${humanizeFieldKey(key)}: ${message}`;
  }
  return undefined;
}

// the toast text, or undefined to stay quiet
async function errorText(error) {
  const { status, data } = error.response;
  if (status === 403) {
    // reads (and PATCH-based queries) fail quietly on a missing permission
    const method = error.config.method;
    return method === "get" || method === "patch" ? undefined : data.detail;
  }
  if (status >= 400 && status < 500) return clientErrorText(error);
  // 5xx and anything else: still a readable sentence, never a blank toast
  return `The server returned an error (${status}). Try again; if it keeps happening check the server log.`;
}

export default function ({ app, router }) {
  app.config.globalProperties.$axios = axios;
  axios.defaults.withCredentials = true;

  axios.interceptors.request.use((config) => {
    config.baseURL = getBaseUrl();
    const { token } = useAuthStore();
    if (token != null) config.headers.Authorization = `Token ${token}`;
    return config;
  });

  axios.interceptors.response.use(
    (response) => {
      setOffline(false);
      return response;
    },
    async (error) => {
      if (unreachable(error)) {
        setOffline(true);
        return reject(error);
      }

      // unauthorized: redirect only, no toast. noAuthRedirect callers
      // (the update log poll) handle the sign-out themselves.
      if (error.response.status === 401) {
        if (!error.config?.noAuthRedirect) router.push({ path: "/expired" });
        return reject(error);
      }
      if (error.config?.silent) return reject(error);

      const text = await errorText(error);
      if (text) {
        const { status, statusText } = error.response;
        Notify.create({
          color: "negative",
          message: text,
          caption: `${status}: ${statusText}`,
          timeout: 6000,
        });
      }
      return reject(error);
    },
  );
}
