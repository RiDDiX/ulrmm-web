// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

import * as VueRouter from "vue-router";
import { useAuthStore } from "@/stores/auth";
import routes from "./routes";

const { createRouter, createWebHistory } = VueRouter;

// only resolves hrefs for modules outside components (the api helpers'
// pop-out window urls): import { router } from "@/router". Memory history
// gives the same hrefs and registers no window listeners
export const router = createRouter({
  routes,
  history: VueRouter.createMemoryHistory(
    import.meta.env.QUASAR_VUE_ROUTER_BASE,
  ),
});

function appHistory() {
  const base =
    import.meta.env.QUASAR_MODE === "ssr"
      ? undefined
      : import.meta.env.QUASAR_VUE_ROUTER_BASE;
  if (import.meta.env.QUASAR_SERVER) return VueRouter.createMemoryHistory(base);
  return import.meta.env.QUASAR_VUE_ROUTER_MODE === "history"
    ? createWebHistory(base)
    : VueRouter.createWebHashHistory(base);
}

// signed-out users go to the login and come back afterwards; the login
// page itself sends signed-in users to the dashboard
function authGuard(to) {
  const auth = useAuthStore();
  if (to.meta.requireAuth) {
    if (auth.loggedIn) return true;
    auth.next = to.fullPath;
    return { name: "Login" };
  }
  if (to.meta.requiresVisitor && auth.loggedIn) return { name: "Dashboard" };
  return true;
}

export default function () {
  const appRouter = createRouter({
    routes,
    history: appHistory(),
    scrollBehavior: () => ({ left: 0, top: 0 }),
  });
  appRouter.beforeEach(authGuard);
  return appRouter;
}
