// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

import { computed, type Ref } from "vue";
import { useStore } from "vuex";
import { useRoute } from "vue-router";
import { useMeta } from "quasar";
import { useBrandingStore } from "@/stores/branding";
import { dashboardScopeRoute } from "@/utils/helpers";
import { deviceName } from "@/utils/deviceName";

type TreeNode = { raw: string; label: string; children?: TreeNode[] };
type Crumb = { label: string; to?: ReturnType<typeof dashboardScopeRoute> };

// workspace pages outside the device views, by route name, as the sidebar
// names them
const PAGES: Record<string, string> = {
  Overview: "Overview",
  SecurityCenter: "Security",
  ImageLibrary: "Images",
  updates: "Updates",
};

// Where the operator is: the breadcrumb trail, the way back to the
// dashboard and the window title. Read from the store, so the header and
// the dashboard name the same scope and device.
export function usePageContext(isPopout: Ref<boolean>) {
  const store = useStore();
  const route = useRoute();
  const branding = useBrandingStore();

  // the tree scope alone; the dashboard highlights the same node, this is
  // the only place outside the tree that names it
  const scopeName = computed(() => {
    const raw = store.state.selectedTree;
    if (!raw) return "All clients";
    const nodes: TreeNode[] = store.state.tree;
    const client = nodes.find(
      (c) => c.raw === raw || c.children?.some((s) => s.raw === raw),
    );
    const site = client?.children?.find((s) => s.raw === raw);
    return [client?.label, site?.label].filter(Boolean).join(" / ");
  });

  // the open device by name; a pop-out never loads the agent table, so the
  // summary's name stands in
  const deviceTitle = computed(() => {
    const id = store.state.selectedRow;
    if (!id) return "";
    const agent = store.state.agents.find(
      (a: { agent_id: string }) => a.agent_id === id,
    );
    return deviceName(agent) || store.state.agentName || "Agent details";
  });

  // the device is added to the scope rather than replacing it; a pop-out
  // has no tree, so no scope either
  const contextTitle = computed(() => {
    if (!deviceTitle.value) return scopeName.value;
    if (!store.state.tree.length) return deviceTitle.value;
    return `${scopeName.value} / ${deviceTitle.value}`;
  });

  // the dashboard in the scope the store still holds while a device is open
  const dashboardRoute = computed(() =>
    dashboardScopeRoute(store.state.selectedTree),
  );

  // Workspace / scope [/ device] on the dashboard, Devices / device on the
  // device page, where the first crumb leads back
  const crumbs = computed<Crumb[]>(() => {
    const page = PAGES[String(route.name)];
    if (page) return [{ label: "Workspace" }, { label: page }];
    switch (route.name) {
      case "Dashboard": {
        const trail: Crumb[] = [
          { label: "Workspace" },
          { label: scopeName.value },
        ];
        if (deviceTitle.value) trail.push({ label: deviceTitle.value });
        return trail;
      }
      default:
        return [
          {
            label: "Devices",
            to: isPopout.value ? undefined : dashboardRoute.value,
          },
          { label: deviceTitle.value || "Agent details" },
        ];
    }
  });

  // scope or device in the window title tells pop-outs and history entries
  // apart
  useMeta(() => {
    const product = branding.productName;
    const page = PAGES[String(route.name)];
    if (page) return { title: `${page} · ${product}` };
    const where = contextTitle.value;
    return {
      title: store.state.selectedRow
        ? `${where} · ${product}`
        : `Dashboard · ${where} · ${product}`,
    };
  });

  return { crumbs, dashboardRoute };
}
