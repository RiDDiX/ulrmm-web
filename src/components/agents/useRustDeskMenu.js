// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

import { computed, ref } from "vue";
import { useStore } from "vuex";
import { useQuasar } from "quasar";
import {
  deployAgentRustDesk,
  fetchAgentRustDesk,
  updateAgentRustDesk,
} from "@/api/rustdesk";
import { notifySuccess } from "@/utils/notify";
import RustDeskConnect from "@/components/modals/agents/RustDeskConnect.vue";

// The RustDesk submenu. The server reports what RustDesk can do on the
// device; the rows only explain why an action is greyed out.
export function useRustDeskMenu(props, { title, isOffline, onlineTip }) {
  const quasar = useQuasar();
  const store = useStore();
  const info = ref(null);
  const failed = ref(false);

  const unusable = computed(() => {
    const status = info.value;
    if (failed.value) return "RustDesk status could not be loaded";
    if (!status) return "Checking RustDesk status...";
    if (!status.available) return "RustDesk is not set up in Global Settings";
    if (status.supported) return null;
    return props.agent.plat === "linux"
      ? "No graphical session on this Linux device"
      : "RustDesk is not supported on this platform";
  });
  // installing and updating go through the agent, connecting does not
  const viaAgent = computed(() =>
    isOffline.value ? onlineTip.value : unusable.value,
  );
  const noConnect = computed(() => {
    if (unusable.value) return unusable.value;
    return info.value.installed
      ? null
      : "RustDesk is not installed on this device - use Install or reconfigure";
  });

  async function refresh() {
    try {
      info.value = await fetchAgentRustDesk(props.agent.agent_id);
    } catch (e) {
      console.error(e);
      failed.value = true;
    }
  }

  function connect(justInstalled = false) {
    const componentProps = {
      agent: props.agent,
      rustdesk: info.value,
      justInstalled,
    };
    quasar.dialog({ component: RustDeskConnect, componentProps });
  }

  const ask = (options) =>
    quasar.dialog({ cancel: true, persistent: true, ...options });

  function install() {
    const agentId = props.agent.agent_id;
    ask({
      title: `Install or reconfigure RustDesk on ${title.value}?`,
      message: `The RustDesk client is installed on ${title.value} if it is missing (an installed client keeps its version, see Update client), configured against this server and given a new random permanent password. A password set earlier stops working.`,
      ok: { label: "Install", color: "primary" },
    }).onOk(async () => {
      quasar.loading.show({
        message: `Setting up RustDesk on ${title.value}...`,
      });
      let ready = false;
      try {
        const deployed = await deployAgentRustDesk(agentId);
        store.commit("setRefreshSummaryTab", true);
        // read back for the new id and the installer links
        info.value = await fetchAgentRustDesk(agentId).catch(() => ({
          ...info.value,
          ...deployed,
          installed: true,
        }));
        ready = true;
      } catch (e) {
        console.error(e);
      }
      quasar.loading.hide();
      if (ready) connect(true);
    });
  }

  function update() {
    const agentId = props.agent.agent_id;
    const { client_version: from, latest_version: to } = info.value;
    ask({
      title: `Update RustDesk on ${title.value}?`,
      message: `The RustDesk client on ${title.value} is updated from ${from} to ${to} and restarts. This is refused while a RustDesk session is open on the device. ID, server settings and permanent password stay the same.`,
      ok: { label: "Update", color: "primary" },
    }).onOk(async () => {
      quasar.loading.show({
        message: `Updating RustDesk on ${title.value}...`,
      });
      try {
        const updated = await updateAgentRustDesk(agentId);
        store.commit("setRefreshSummaryTab", true);
        info.value = await fetchAgentRustDesk(agentId).catch(() => ({
          ...info.value,
          ...updated,
          update_available: false,
        }));
        notifySuccess(
          `RustDesk on ${title.value} is now ${updated.client_version}`,
        );
      } catch (e) {
        console.error(e);
      } finally {
        quasar.loading.hide();
      }
    });
  }

  const entries = computed(() => {
    const list = [
      {
        id: "connect",
        label: "Connect",
        caption: "Open a session in the RustDesk client",
        aria: "Connect with RustDesk",
        reason: noConnect.value,
        run: () => connect(),
      },
      {
        id: "install",
        label: "Install or reconfigure",
        caption: "Installs if missing and sets a new password",
        aria: "Install or reconfigure RustDesk",
        reason: viaAgent.value,
        run: install,
      },
    ];
    const status = info.value;
    if (status?.update_available) {
      list.push({
        id: "update",
        label: `Update client (${status.client_version} → ${status.latest_version})`,
        aria: "Update the RustDesk client",
        reason: viaAgent.value,
        run: update,
      });
    }
    // the tooltip shows the reason whenever there is one
    return list.map(({ reason, ...entry }) => ({
      ...entry,
      disable: !!reason,
      gate: { offline: true, offlineTip: reason },
    }));
  });

  return { entries, refresh };
}
