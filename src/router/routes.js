// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

import { reportHistoryRouteProps, reportRouteProps } from "@/reporting/utils";
import { useAuthStore } from "@/stores/auth";

function signedIn(path, name, component, extra = {}) {
  return { path, name, component, meta: { requireAuth: true }, ...extra };
}

const routes = [
  {
    path: "/",
    name: "MainLayout",
    component: () => import("@/layouts/MainLayout.vue"),
    children: [
      signedIn(
        "agents/:agent_id",
        "Agent",
        () => import("@/views/AgentView.vue"),
      ),
      signedIn("", "Dashboard", () => import("@/views/DashboardView.vue")),
      signedIn(
        "overview",
        "Overview",
        () => import("@/views/OverviewView.vue"),
      ),
      signedIn(
        "security",
        "SecurityCenter",
        () => import("@/views/SecurityCenterView.vue"),
      ),
      signedIn(
        "images",
        "ImageLibrary",
        () => import("@/views/ImageLibraryView.vue"),
      ),
      signedIn(
        "updates",
        "updates",
        () => import("@/views/UpdateCenterView.vue"),
      ),
    ],
  },
  signedIn("/setup", "InitialSetup", () => import("@/views/InitialSetup.vue")),
  // 2fa enrolment runs in a dialog on the sign-in form now, so an old link
  // or bookmark lands there instead of on a dead page
  { path: "/totp_setup", redirect: { name: "Login" } },

  // pop-out windows
  signedIn(
    "/takecontrol/:agent_id",
    "TakeControl",
    () => import("@/views/TakeControl.vue"),
  ),
  signedIn(
    "/webvnc/:agent_id/:port",
    "VNC",
    () => import("@/views/WebVNC.vue"),
  ),
  signedIn("/webterm", "WebTerm", () => import("@/views/WebTerminal.vue")),
  signedIn(
    "/remotebackground/:agent_id",
    "RemoteBackground",
    () => import("@/views/RemoteBackground.vue"),
  ),

  {
    path: "/login",
    name: "Login",
    component: () => import("@/views/LoginView.vue"),
    meta: { requiresVisitor: true },
  },
  // single sign-on lands here after the provider round trip, with or
  // without a dashboard token, so neither guard applies
  {
    path: "/account/provider/callback",
    name: "ProviderCallback",
    component: () => import("@/sso/ProviderCallback.vue"),
  },
  {
    path: "/expired",
    name: "SessionExpired",
    component: () => import("@/views/SessionExpired.vue"),
    // the page to return to after signing in again
    beforeEnter: (_, from) => {
      useAuthStore().next = from.fullPath;
    },
  },

  // emailed run links end in a slash before the query; the router accepts
  // both forms. Must stay ahead of /reports/:id
  signedIn(
    "/reports/history/:id",
    "ReportHistory",
    () => import("@/reporting/views/ReportHistoryView.vue"),
    { props: reportHistoryRouteProps },
  ),
  signedIn(
    "/reports/:id",
    "Report",
    () => import("@/reporting/views/ReportView.vue"),
    { props: reportRouteProps },
  ),

  { path: "/:catchAll(.*)", component: () => import("@/views/NotFound.vue") },
];

export default routes;
