// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

import { inject } from "vue";
import { useStore } from "vuex";
import { useQuasar } from "quasar";
import { agentRebootNow, agentShutdown, agentSuspend } from "@/api/agents";
import { editAgent, fetchAgent, removeAgent } from "@/api/agents";
import { runWebVNC, sendAgentPing, wakeUpWOL } from "@/api/agents";
import { runAgentChecks } from "@/api/checks";
import { fetchScripts } from "@/api/scripts";
import { fetchAgentUpdates, runAgentUpdateInstall } from "@/api/winupdates";
import { runAgentUpdateScan } from "@/api/winupdates";
import { notifyError, notifySuccess } from "@/utils/notify";
import { KMS_ACTIVATION_FILE } from "@/utils/scriptLibrary";
import { installPrompt, rebootPrompt } from "@/utils/patchStatus";
import ConfirmYesDialog from "@/components/agents/ConfirmYesDialog.vue";
import RunScript from "@/components/modals/agents/RunScript.vue";

// what sleep adds to its warning, keyed by the wol_armed the agent reports
// from its nics (null: the agent does not report it yet)
const WOL_NOTES = new Map([
  [
    false,
    " Warning: no network card reports Wake-on-LAN as armed. Sleep tries to switch it on, but the device may not wake from the network.",
  ],
  [
    null,
    " Warning: the agent does not report Wake-on-LAN yet (agent update required).",
  ],
]);

// The flows behind the device action menu: dialogs, confirmations and the
// calls they end in. Failed calls are logged only.
export function useAgentMenuActions(props, title) {
  const quasar = useQuasar();
  const store = useStore();
  const refreshDashboard = inject("refreshDashboard");
  const agentId = () => props.agent.agent_id;

  // reloads: OK on the dialog refreshes the dashboard
  function open(component, componentProps, reloads = false) {
    const dialog = quasar.dialog({ component, componentProps });
    if (reloads) dialog.onOk(refreshDashboard);
    return dialog;
  }

  const ask = (options) =>
    quasar.dialog({ cancel: true, persistent: true, ...options });

  // typed confirmation for actions that take the device away
  const askTyped = (actionVerb, okLabel, details) =>
    open(ConfirmYesDialog, {
      hostname: title.value,
      actionVerb,
      okLabel,
      okColor: "negative",
      ...details,
    });

  const quietly = (work) => work().catch((e) => console.error(e));

  async function underSpinner(work) {
    quasar.loading.show();
    await quietly(work);
    quasar.loading.hide();
  }

  const runScript = (script) => open(RunScript, { agent: props.agent, script });

  function askVncPort() {
    ask({
      prompt: { model: "5900", type: "text" },
      title: "VNC Server Port",
      ok: { label: "Launch", color: "primary" },
      message: "Enter the VNC server port:",
    }).onOk((port) => runWebVNC(agentId(), port));
  }

  const activateKms = () =>
    quietly(async () => {
      const all = await fetchScripts({
        showCommunityScripts: true,
        showHiddenScripts: true,
      });
      const kms = all.find(
        (s) =>
          s.script_type === "builtin" && s.filename === KMS_ACTIVATION_FILE,
      );
      if (kms) runScript(kms.id);
      else
        notifyError(
          "The KMS activation script is not on the server yet. Sync the script library in the Script manager first.",
        );
    });

  const toggleMaintenance = () =>
    quietly(async () => {
      const agent = props.agent;
      await editAgent(agent.agent_id, {
        maintenance_mode: !agent.maintenance_mode,
      });
      const now = agent.maintenance_mode ? "disabled" : "enabled";
      notifySuccess(`Maintenance mode was ${now} on ${title.value}`);
      store.commit("setRefreshSummaryTab", true);
      refreshDashboard();
    });

  const runChecks = () =>
    quietly(async () => notifySuccess(await runAgentChecks(agentId())));

  const wakeUp = () =>
    quietly(async () => notifySuccess(await wakeUpWOL(agentId())));

  const scanPatches = () =>
    quietly(async () => {
      await runAgentUpdateScan(agentId());
      notifySuccess(`Scan will be run shortly on ${title.value}`);
    });

  // lists what the effective policy would install before asking
  async function installPatches() {
    const agent = props.agent;
    let plan = null;
    quasar.loading.show();
    try {
      const [updates, detail] = await Promise.all([
        fetchAgentUpdates(agent.agent_id),
        fetchAgent(agent.agent_id),
      ]);
      plan = installPrompt(
        updates,
        detail?.effective_patch_policy,
        agent.plat,
        title.value,
      );
    } catch (e) {
      console.error(e);
    } finally {
      quasar.loading.hide();
    }
    if (!plan) return;

    if (plan.count === 0) {
      quasar.dialog({
        title: `No approved updates for ${title.value}`,
        message: "There are no approved updates to install.",
        ok: { label: "Close" },
      });
      return;
    }
    // html also applies to the title, which installPrompt escapes
    ask({
      title: plan.title,
      message: plan.message,
      ok: plan.ok,
      html: true,
    }).onOk(() =>
      quietly(async () =>
        notifySuccess(await runAgentUpdateInstall(agent.agent_id)),
      ),
    );
  }

  function rebootNow() {
    const agent = props.agent;
    ask(rebootPrompt(agent, title.value)).onOk(() =>
      underSpinner(async () => {
        await agentRebootNow(agent.agent_id);
        notifySuccess(`${title.value} will now be restarted`);
      }),
    );
  }

  function shutdown() {
    askTyped("shutdown", "Shutdown", {
      title: `Shutdown ${title.value}`,
      consequence: `Powers off ${title.value}. It can only be started again at the console or via Wake-Up (WoL).`,
    }).onOk(() =>
      underSpinner(async () => {
        await agentShutdown(agentId());
        notifySuccess(`${title.value} will now be shutdown`);
      }),
    );
  }

  function suspend() {
    const note = WOL_NOTES.get(props.agent.wol_armed) ?? "";
    askTyped("sleep", "Sleep", {
      title: `Sleep ${title.value}`,
      consequence: `Puts ${title.value} to sleep after switching on Wake-on-LAN. It stays unreachable until Wake-Up (WoL) or someone at the device wakes it.${note}`,
    }).onOk(() =>
      underSpinner(async () => {
        await agentSuspend(agentId());
        notifySuccess(`${title.value} will now go to sleep`);
      }),
    );
  }

  function confirmRemoval() {
    const agent = props.agent;
    askTyped("removal", "Remove agent", {
      title: `Remove agent ${title.value}`,
      // typed is the reported hostname, not the display name
      confirmText: agent.hostname,
      requireTotp: true,
      consequence:
        "Uninstalls the agent from the device, removes it from remote control and permanently deletes its checks, tasks, history, notes and alerts from this server. This cannot be undone.",
    }).onOk((code) =>
      quietly(async () => {
        notifySuccess(await removeAgent(agent.agent_id, code));
        refreshDashboard(false, true);
      }),
    );
  }

  // a ping first, so an agent that cannot be reached is warned about
  async function startRemoval() {
    let reply = null;
    quasar.loading.show();
    try {
      reply = await sendAgentPing(agentId());
    } catch (e) {
      console.error(e);
      // no answer (network error, gateway): the agent cannot be confirmed
      // online. a 4xx is the server refusing, axios toasts it
      const status = e?.response?.status;
      if (!status || status >= 500) reply = { status: "offline" };
    } finally {
      quasar.loading.hide();
    }
    if (!reply) return;

    const state = reply.status;
    if (state !== "online" && state !== "offline") {
      notifyError("Something went wrong");
      return;
    }
    const prompt =
      state === "online"
        ? {
            title: `Remove agent ${title.value}?`,
            message: "The agent will be uninstalled from the device.",
            ok: { label: "Remove agent", color: "negative" },
          }
        : {
            title: "Agent offline",
            message: `${title.value} cannot be contacted. Would you like to remove it anyway? If so, the agent will need to be manually uninstalled from the computer; its uninstall code is in this menu until you remove it.`,
            ok: { label: "Remove anyway", color: "negative" },
          };
    ask(prompt).onOk(confirmRemoval);
  }

  return {
    open,
    runScript,
    askVncPort,
    activateKms,
    toggleMaintenance,
    runChecks,
    wakeUp,
    scanPatches,
    installPatches,
    rebootNow,
    shutdown,
    suspend,
    startRemoval,
  };
}
