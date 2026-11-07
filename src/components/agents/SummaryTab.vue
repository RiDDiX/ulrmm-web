<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <div v-if="!selectedAgent" class="q-pa-sm rmm-muted">No agent selected</div>
  <div v-else-if="!summary && loading" class="q-pa-md flex flex-center">
    <q-circular-progress indeterminate size="50px" color="primary" />
  </div>
  <div v-else-if="summary" class="device">
    <header class="device-hero" aria-label="Device summary">
      <nav class="device-hero__crumbs" aria-label="Breadcrumb">
        <!-- rel=opener so the new tab keeps the sessionStorage login -->
        <router-link
          class="rmm-link"
          :to="devicesLink"
          :target="isPopout ? '_blank' : undefined"
          :rel="isPopout ? 'opener' : undefined"
        >
          Devices
          <q-tooltip>Back to the fleet view</q-tooltip>
        </router-link>
        <template v-if="summary.client || summary.site_name">
          <q-icon name="chevron_right" size="14px" />
          <router-link
            class="rmm-link"
            :to="scopeLink"
            :target="isPopout ? '_blank' : undefined"
            :rel="isPopout ? 'opener' : undefined"
          >
            {{
              [summary.client, summary.site_name].filter(Boolean).join(" / ")
            }}
            <q-tooltip
              >Show the agents of this site in the fleet view</q-tooltip
            >
          </router-link>
        </template>
      </nav>

      <div class="device-hero__body">
        <div class="device-hero__identity">
          <div class="device-hero__title-row">
            <q-icon
              :name="platformIcon"
              size="22px"
              class="device-hero__platform"
            />
            <h1 class="device-hero__hostname" :title="deviceName(summary)">
              {{ deviceName(summary) }}
            </h1>
            <span
              class="rmm-pill device-hero__status"
              :style="{ '--rmm-pill-color': statusColor }"
            >
              {{ powerEvent?.label ?? statusMeta.label }}
              <q-tooltip>{{ statusTooltip }}</q-tooltip>
            </span>
            <q-badge v-if="summary.maintenance_mode" color="warning">
              Maintenance
              <q-tooltip>
                Maintenance mode is on — alerts from this agent are suppressed
              </q-tooltip>
            </q-badge>
            <span v-if="appliance" class="rmm-pill rmm-pill--neutral">
              {{ appliance.name }}
              <q-tooltip
                >{{ appliance.name }} {{ appliance.version }} appliance; its
                package updates are managed by {{ appliance.name }}</q-tooltip
              >
            </span>
          </div>
          <div v-if="summary.description" class="device-hero__description">
            {{ summary.description }}
          </div>
          <div class="device-hero__meta rmm-muted">
            <span v-if="deviceName(summary) !== summary.hostname">
              Hostname <span class="rmm-mono">{{ summary.hostname }}</span>
            </span>
            <span>{{ summary.operating_system || "Unknown OS" }}</span>
            <span>
              Agent <span class="rmm-mono">v{{ summary.version }}</span>
            </span>
            <span>
              Last seen {{ relativeTime(summary.last_seen) }}
              <q-tooltip>{{
                store.getters.formatDate(summary.last_seen)
              }}</q-tooltip>
            </span>
          </div>

          <!-- checks, reboot, patches, actions, notes, policy, RustDesk.
               Notes are their own request; the rest is on the summary. -->
          <div class="device-hero__strip">
            <router-link
              class="rmm-pill"
              :class="checksStrip.class"
              replace
              :to="tabLink('checks')"
            >
              {{ checksStrip.text }}
              <q-tooltip
                >Check results for this device — click to open the Checks
                tab</q-tooltip
              >
            </router-link>
            <span
              v-if="summary.tamper_alert"
              class="rmm-pill rmm-pill--negative"
            >
              <q-icon name="gpp_maybe" size="14px" />
              Tamper suspected
              <q-tooltip max-width="320px"
                >The agent stopped or went silent without a shutdown, update or
                uninstall, flagged
                {{ relativeTime(summary.tamper_alert.alert_time) }}. Check the
                device and the Timeline tab.</q-tooltip
              >
            </span>
            <span
              v-if="summary.needs_reboot"
              class="rmm-pill rmm-pill--warning"
            >
              Reboot pending
              <q-tooltip
                >The device reports that a restart is needed, usually to finish
                updates</q-tooltip
              >
            </span>
            <a
              v-if="awakeUntil || summary.keep_awake_ac"
              href="#"
              role="button"
              class="rmm-pill rmm-pill--neutral"
              @click.prevent="showKeepAwake"
              @keydown.space.prevent="showKeepAwake"
            >
              <q-icon name="coffee" size="14px" />
              {{ awakeUntil ? `Awake until ${awakeUntil}` : "Awake on power" }}
              <q-tooltip v-if="awakeUntil"
                >Sleep is held off until then, lid closed or not — click to
                change or turn off</q-tooltip
              >
              <q-tooltip v-else
                >Never sleeps on AC power, lid closed or not. Click to
                change</q-tooltip
              >
            </a>
            <span
              v-for="issue in healthIssues"
              :key="issue"
              class="rmm-pill rmm-pill--negative"
            >
              {{ issue }}
              <q-tooltip
                >From the agent's health report — see the Security and Hardware
                health cards</q-tooltip
              >
            </span>
            <span class="rmm-pill rmm-pill--neutral">
              {{
                summary.patches_last_installed
                  ? `Patches last installed ${relativeTime(summary.patches_last_installed)}`
                  : "Patches never installed"
              }}
              <router-link
                class="rmm-link q-ml-xs"
                replace
                :to="tabLink('patches')"
                >Open</router-link
              >
              <q-tooltip
                >Last patch install run — Open shows the Patches tab</q-tooltip
              >
            </span>
            <a
              href="#"
              role="button"
              class="rmm-pill rmm-pill--neutral"
              @click.prevent="showPendingActions"
              @keydown.space.prevent="showPendingActions"
            >
              <q-icon name="pending_actions" size="14px" />
              Pending actions<template v-if="pendingCount"
                >: {{ pendingCount }}</template
              >
              <q-tooltip
                >Show queued reboots, agent updates and installs for this
                device</q-tooltip
              >
            </a>
            <span v-if="notesCount" class="rmm-pill rmm-pill--info">
              <router-link class="rmm-link" replace :to="tabLink('notes')"
                >{{ notesCount }} note{{
                  notesCount === 1 ? "" : "s"
                }}</router-link
              >
              <q-tooltip>{{
                latestNote
                  ? `Latest note: ${latestNote}`
                  : "Click to open the Notes tab"
              }}</q-tooltip>
            </span>
            <span v-if="appUpdateCount" class="rmm-pill rmm-pill--info">
              <router-link class="rmm-link" replace :to="appUpdatesLink"
                >{{ appUpdateCount }} app update{{
                  appUpdateCount === 1 ? "" : "s"
                }}</router-link
              >
              <q-tooltip
                >Outdated apps found on this device — click to open the
                list</q-tooltip
              >
            </span>
            <span
              v-if="appliedPolicyNames.length"
              class="rmm-pill rmm-pill--neutral"
            >
              Policy: {{ appliedPolicyNames.join(", ") }}
              <a
                href="#"
                role="button"
                class="rmm-link q-ml-xs"
                @click.prevent="showAutomationManager"
                @keydown.space.prevent="showAutomationManager"
                >Open</a
              >
              <q-tooltip
                >Automation policies that add checks and tasks here — Open shows
                the Automation Manager</q-tooltip
              >
            </span>
            <span
              v-if="rustdesk?.installed"
              class="rmm-pill"
              :class="
                rustdesk.update_available
                  ? 'rmm-pill--warning'
                  : 'rmm-pill--neutral'
              "
            >
              <span>
                RustDesk
                <span class="rmm-mono">{{ rustdesk.rustdesk_id }}</span>
                <template v-if="rustdesk.update_available">
                  &middot; update available ({{ rustdesk.client_version }} →
                  {{ rustdesk.latest_version }})
                </template>
                <q-tooltip v-if="rustdesk.update_available"
                  >Update the client from Actions, RustDesk, Update
                  client</q-tooltip
                >
                <q-tooltip v-else>RustDesk ID of this device</q-tooltip>
              </span>
              <q-btn
                flat
                round
                dense
                size="xs"
                icon="content_copy"
                aria-label="Copy RustDesk ID"
                @click="copyOutput(rustdesk.rustdesk_id)"
              >
                <q-tooltip>Copy RustDesk ID</q-tooltip>
              </q-btn>
              <!-- agent can be offline -->
              <q-btn
                v-if="rustdesk.available && rustdesk.supported"
                flat
                round
                dense
                size="xs"
                icon="cast_connected"
                aria-label="Connect with RustDesk"
                @click="connectRustDesk"
              >
                <q-tooltip>Open a RustDesk session to this device</q-tooltip>
              </q-btn>
            </span>
            <span
              v-if="summary.alert_template"
              class="rmm-pill rmm-pill--neutral"
            >
              Alert template: {{ summary.alert_template.name }}
              <a
                href="#"
                role="button"
                class="rmm-link q-ml-xs"
                @click.prevent="showAlertsManager"
                @keydown.space.prevent="showAlertsManager"
                >Open</a
              >
              <q-tooltip
                >Decides who is notified and how — Open shows the Alerts
                Manager</q-tooltip
              >
            </span>
          </div>
        </div>

        <div class="device-hero__side">
          <div
            class="device-hero__actions"
            role="group"
            aria-label="Device actions"
          >
            <div class="device-hero__tools">
              <q-btn
                flat
                round
                dense
                icon="refresh"
                aria-label="Reload"
                :loading="loading"
                @click="getSummary"
              >
                <q-tooltip
                  >Reload the summary from the server; the agent is not
                  contacted</q-tooltip
                >
              </q-btn>
              <!-- stays focusable while offline so the reason is reachable;
                   refreshSummary itself refuses to run then -->
              <q-btn
                flat
                round
                dense
                icon="cloud_sync"
                aria-label="Re-collect"
                :aria-disabled="offline ? 'true' : undefined"
                :class="{ 'device-hero__tool--off': offline }"
                :loading="recollecting"
                @click="refreshSummary"
              >
                <q-tooltip v-if="offline"
                  >Re-collect: {{ offlineReason }}</q-tooltip
                >
                <q-tooltip v-else
                  >Re-collect: ask the agent to resend hardware, disk, health
                  and network details</q-tooltip
                >
              </q-btn>
              <q-btn
                v-if="!isPopout"
                flat
                round
                dense
                icon="open_in_new"
                aria-label="Popout"
                @click="openPopout"
              >
                <q-tooltip>Open this device in a separate window</q-tooltip>
              </q-btn>
            </div>
            <div>
              <q-btn
                outline
                dense
                no-caps
                icon="terminal"
                label="Terminal"
                class="device-hero__btn"
                :disable="offline"
                @click="runRemoteBackground(summary.agent_id, summary.plat)"
              />
              <q-tooltip v-if="offline">{{ offlineReason }}</q-tooltip>
              <q-tooltip v-else
                >Terminal, files, services and processes in a new
                window</q-tooltip
              >
            </div>
            <div>
              <q-btn
                outline
                dense
                no-caps
                icon="code"
                label="Run script"
                class="device-hero__btn"
                :disable="offline"
                @click="showRunScript"
              />
              <q-tooltip v-if="offline">{{ offlineReason }}</q-tooltip>
              <q-tooltip v-else
                >Run one of your scripts on this device</q-tooltip
              >
            </div>
            <div>
              <q-btn-dropdown
                outline
                dense
                no-caps
                label="Actions"
                class="device-hero__btn"
                no-route-dismiss
                v-model="actionsOpen"
              >
                <AgentActionMenu :agent="summary" />
              </q-btn-dropdown>
              <q-tooltip v-if="!actionsOpen"
                >Remote tools, scripts, patches, power and agent
                settings</q-tooltip
              >
            </div>
            <!-- MeshCentral-routed, works without the RMM agent -->
            <div>
              <q-btn
                unelevated
                dense
                no-caps
                color="primary"
                icon="computer"
                label="Remote control"
                class="device-hero__btn device-hero__primary"
                @click="runTakeControl(selectedAgent)"
              />
              <q-tooltip v-if="summary.status !== 'online'">{{
                meshOfflineWarning
              }}</q-tooltip>
              <q-tooltip v-else
                >Open a remote desktop session through MeshCentral in a new
                window</q-tooltip
              >
            </div>
          </div>

          <div class="device-hero__kpis" aria-label="Key figures">
            <router-link
              v-for="kpi in kpis"
              :key="kpi.label"
              class="device-kpi"
              replace
              :to="tabLink(kpi.tab)"
            >
              <span class="device-kpi__label">{{ kpi.label }}</span>
              <span class="device-kpi__value rmm-num" :style="kpi.style">{{
                kpi.value
              }}</span>
              <q-tooltip>{{ kpi.tip }}</q-tooltip>
            </router-link>
          </div>
        </div>
      </div>
      <q-inner-loading :showing="loading" color="primary" />
    </header>

    <SubTableTabs>
      <template #overview>
        <div class="device-overview q-pa-sm">
          <div class="row q-col-gutter-sm q-mt-none">
            <div class="col-12 col-sm-6 col-md-4">
              <PerformanceCard
                title="CPU"
                :value="perf?.cpu_percent ?? null"
                :samples="cpuSamples"
                :context="cpu"
                :updated="perfUpdated"
                :message="perfMessage"
                :retryable="perfRetryable"
                :loading="perfLoading"
                :color="perfBarColor(perf?.cpu_percent)"
                help="Live CPU use, sampled every 30 s while open. Warning from 80%, error from 95%"
                @retry="loadPerf"
              />
            </div>
            <div class="col-12 col-sm-6 col-md-4">
              <PerformanceCard
                title="Memory"
                :value="perf?.mem_percent ?? null"
                :samples="memorySamples"
                :context="memoryContext"
                :updated="perfUpdated"
                :message="perfMessage"
                :retryable="perfRetryable"
                :loading="perfLoading"
                :color="perfBarColor(perf?.mem_percent)"
                help="Live memory use, sampled every 30 s while open. Warning from 80%, error from 95%"
                @retry="loadPerf"
              />
            </div>
            <div class="col-12 col-sm-6 col-md-4">
              <q-card flat class="rmm-card summary-disks">
                <div class="rmm-card__header">
                  <div class="rmm-card__title">Disks</div>
                  <span v-if="disks.length" class="rmm-muted rmm-num">{{
                    disks.length
                  }}</span>
                  <HelpTip
                    text="Used space per volume from the last report. Warning from 80%, error from 95%"
                  />
                </div>
                <div class="rmm-card__body summary-disks__body">
                  <div v-if="!disks.length" class="rmm-muted">
                    No disks reported
                  </div>
                  <div
                    v-for="(disk, index) in disks"
                    :key="`${disk.device}-${index}`"
                    class="summary-disk"
                  >
                    <div class="summary-disk__heading">
                      <span class="rmm-mono">{{ disk.device }}</span>
                      <span class="rmm-num">{{ disk.percent }}% used</span>
                    </div>
                    <q-linear-progress
                      rounded
                      size="8px"
                      class="summary-disk__bar"
                      :value="Number(disk.percent) / 100"
                      :color="diskBarColor(Number(disk.percent))"
                      :aria-label="`${disk.device} ${disk.percent}% used`"
                    />
                    <div class="summary-disk__meta rmm-muted">
                      <span>{{ disk.fstype || "Disk" }}</span>
                      <span>{{ disk.free }} free of {{ disk.total }}</span>
                    </div>
                  </div>
                </div>
              </q-card>
            </div>
          </div>

          <div class="row q-col-gutter-sm q-mt-none">
            <div class="col-12 col-sm-6 col-md-4">
              <q-card flat class="rmm-card detail-card">
                <div class="rmm-card__header">
                  <div class="rmm-card__title">Hardware</div>
                </div>
                <div class="rmm-card__body rmm-kv">
                  <span>Make / model</span
                  ><span>{{ summary.make_model || "—" }}</span> <span>CPU</span
                  ><span>{{ cpu }}</span>
                  <span>RAM</span>
                  <span>{{
                    summary.total_ram ? `${summary.total_ram} GB` : "—"
                  }}</span>
                  <span>Physical disks</span>
                  <span>
                    <span
                      v-for="(disk, index) in summary.physical_disks || []"
                      :key="index"
                      class="summary-list-item"
                    >
                      {{ disk }}
                    </span>
                    <span v-if="!summary.physical_disks?.length">—</span>
                  </span>
                  <span>Graphics</span
                  ><span>{{ summary.graphics || "—" }}</span> <span>Serial</span
                  ><span class="rmm-mono">{{ serialNumber || "—" }}</span>
                </div>
              </q-card>
            </div>

            <div class="col-12 col-sm-6 col-md-4">
              <q-card flat class="rmm-card detail-card">
                <div class="rmm-card__header">
                  <div class="rmm-card__title">Network</div>
                </div>
                <div class="rmm-card__body rmm-kv">
                  <span>Public IP</span
                  ><span class="rmm-mono">{{ summary.public_ip || "—" }}</span>
                  <span>LAN IPs</span
                  ><span class="rmm-mono">{{ summary.local_ips || "—" }}</span>
                  <span class="summary-kv-label">
                    Wake-on-LAN
                    <HelpTip
                      text="Armed: wakes the device on a WoL packet (macOS: per power source). Sleep tries to arm it"
                    />
                  </span>
                  <span>
                    <span
                      v-for="(nic, index) in wakeNics"
                      :key="index"
                      class="summary-list-item"
                    >
                      <span class="rmm-mono">{{ nic.name }}</span>
                      <span class="rmm-pill q-ml-xs" :class="nic.cls">{{
                        nic.label
                      }}</span>
                    </span>
                    <span v-if="!wakeNics.length" class="rmm-muted"
                      >Agent update required</span
                    >
                  </span>
                </div>
              </q-card>
            </div>

            <NetworkCard :info="summary.network_info" />

            <AssetCard
              :agent="summary"
              @changed="getSummary({ silent: true })"
            />

            <HealthCards
              :health="summary.wmi_detail?.health"
              :plat="summary.plat"
            />
            <ScheduleCard :agent-id="summary.agent_id" />
            <CertCard :agent-id="summary.agent_id" />
            <ActionsCard
              :agent-id="summary.agent_id"
              :tick="actionsTick"
              @count="pendingCount = $event"
              @show="showPendingActions"
            />

            <div class="col-12 col-sm-6 col-md-4">
              <q-card flat class="rmm-card detail-card">
                <div class="rmm-card__header">
                  <div class="rmm-card__title">System</div>
                </div>
                <div class="rmm-card__body rmm-kv">
                  <span>Boot time</span><span>{{ bootTime }}</span>
                  <span>Uptime</span><span>{{ uptime }}</span>
                  <span>Logged in user</span
                  ><span>
                    <template v-if="loggedInUser.active">{{
                      loggedInUser.name
                    }}</template>
                    <template v-else-if="loggedInUser.name">
                      Nobody logged in
                      <span class="rmm-muted"
                        >(last: {{ loggedInUser.name }})</span
                      >
                    </template>
                    <template v-else>Nobody logged in</template>
                  </span>
                  <span>Timezone</span>
                  <span>{{ summary.timezone || "—" }}</span>
                </div>
              </q-card>
            </div>

            <div class="col-12 col-sm-6 col-md-4">
              <q-card flat class="rmm-card detail-card">
                <div class="rmm-card__header">
                  <div class="rmm-card__title">Checks status</div>
                  <HelpTip
                    text="Latest result of each check; warning and info are failing checks of lower severity, pending checks have no result yet"
                  />
                </div>
                <div class="rmm-card__body">
                  <div v-if="checksAwaiting" class="rmm-muted">
                    {{ summary.checks.total }} checks awaiting first
                    synchronization
                  </div>
                  <div v-else-if="!summary.checks.total" class="rmm-muted">
                    No checks yet — add one on the Checks tab or assign a policy
                  </div>
                  <div v-else class="checks-grid">
                    <div class="check-tile">
                      <strong
                        class="rmm-num"
                        :style="{ color: positiveColor }"
                        >{{ summary.checks.passing }}</strong
                      >
                      <span>Passing</span>
                    </div>
                    <div class="check-tile">
                      <strong
                        class="rmm-num"
                        :style="{ color: negativeColor }"
                        >{{ summary.checks.failing }}</strong
                      >
                      <span>Failing</span>
                    </div>
                    <div class="check-tile">
                      <strong
                        class="rmm-num"
                        :style="{ color: warningColor }"
                        >{{ summary.checks.warning }}</strong
                      >
                      <span>Warning</span>
                    </div>
                    <div class="check-tile">
                      <strong class="rmm-num" :style="{ color: infoColor }">{{
                        summary.checks.info
                      }}</strong>
                      <span>Info</span>
                    </div>
                    <div v-if="summary.checks.pending" class="check-tile">
                      <strong class="rmm-num">{{
                        summary.checks.pending
                      }}</strong>
                      <span>Pending</span>
                    </div>
                  </div>
                </div>
              </q-card>
            </div>

            <div v-if="customFields.length" class="col-12 col-sm-6 col-md-4">
              <q-card flat class="rmm-card detail-card">
                <div class="rmm-card__header">
                  <div class="rmm-card__title">Custom fields</div>
                  <HelpTip
                    text="Custom field values of this agent. Fields set to hide in the summary tab are left out"
                  />
                </div>
                <div class="rmm-card__body rmm-kv">
                  <template v-for="field in customFields" :key="field.id">
                    <span>{{ field.name }}</span
                    ><span>{{ field.value }}</span>
                  </template>
                </div>
              </q-card>
            </div>
          </div>

          <div class="row q-col-gutter-sm q-mt-none">
            <div v-if="stateMissing" class="col-12 col-sm-6 col-md-4">
              <q-card flat class="rmm-card detail-card">
                <div class="rmm-card__header">
                  <div class="rmm-card__title">
                    System state, interfaces and containers
                  </div>
                </div>
                <EmptyState
                  icon="system_update_alt"
                  title="Shown once the agent is updated"
                  text="Agent 1.19.10.2026 or newer reports units, file systems, interfaces and containers about every 5 minutes."
                />
              </q-card>
            </div>
            <SystemStateCard
              v-if="stateDoc?.system"
              :system="stateDoc.system"
              :updated="stateUpdated"
              :stale="stateStale"
            />
            <InterfacesCard
              v-if="stateDoc?.net"
              :net="stateDoc.net"
              :updated="stateUpdated"
              :stale="stateStale"
            />
            <ContainersCard
              v-if="stateDoc?.containers"
              :containers="stateDoc.containers"
              :updated="stateUpdated"
              :stale="stateStale"
            />
          </div>
        </div>
      </template>
    </SubTableTabs>
  </div>
  <div v-else class="q-pa-md">
    <EmptyState
      v-if="summaryErrorStatus === 404"
      icon="search_off"
      title="This device no longer exists"
      text="It was removed, or the link points to an agent that is gone."
    >
      <q-btn
        unelevated
        dense
        no-caps
        color="primary"
        label="Back to devices"
        :to="devicesLink"
      />
    </EmptyState>
    <EmptyState
      v-else-if="summaryErrorStatus === 403"
      icon="lock"
      title="No access to this device"
      text="Your role cannot view this agent."
    >
      <q-btn
        unelevated
        dense
        no-caps
        color="primary"
        label="Back to devices"
        :to="devicesLink"
      />
    </EmptyState>
    <EmptyState
      v-else
      icon="error_outline"
      title="Unable to load the device summary"
      text="The request failed. Check the connection and try again."
    >
      <q-btn
        outline
        dense
        no-caps
        color="primary"
        label="Retry"
        @click="getSummary"
      />
      <q-btn
        flat
        dense
        no-caps
        color="primary"
        label="Back to devices"
        :to="devicesLink"
      />
    </EmptyState>
  </div>
</template>

<script>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { colors, useQuasar, openURL } from "quasar";
import { useStore } from "vuex";
import { useRoute } from "vue-router";
import { useDashboardStore } from "@/stores/dashboard";
import { dashboardScopeRoute } from "@/utils/helpers";
import { deviceName } from "@/utils/deviceName";
import {
  DASHBOARD_REFRESH_INTERVAL,
  SILENT_REQUEST_CONFIG,
} from "@/constants/constants";
import { fetchAppUpdates } from "@/api/appupdates";
import { fetchAgentRustDesk } from "@/api/rustdesk";
import { fetchCustomFields } from "@/api/core";
import {
  fetchAgent,
  fetchAgentNotes,
  fetchAgentPerf,
  runTakeControl,
  runRemoteBackground,
  refreshAgentWMI,
} from "@/api/agents";
import { normalizeAppUpdates, pendingRows } from "@/utils/appupdates";
import { router } from "@/router";
import { copyOutput, getCenteredWindowOptions } from "@/utils/helpers";
import { notifySuccess } from "@/utils/notify";
import {
  agentStatusMeta,
  applianceOf,
  fmtBytes,
  platformMeta,
  powerEventMeta,
  relativeTime,
  uptimeText,
  usageLevel,
  MESH_OFFLINE_WARNING,
} from "@/utils/format";
import AgentActionMenu from "@/components/agents/AgentActionMenu.vue";
import KeepAwake from "@/components/modals/agents/KeepAwake.vue";
import PerformanceCard from "@/components/agents/summary/PerformanceCard.vue";
import HealthCards from "@/components/agents/summary/HealthCards.vue";
import ScheduleCard from "@/components/agents/summary/ScheduleCard.vue";
import ActionsCard from "@/components/agents/summary/ActionsCard.vue";
import AssetCard from "@/components/agents/summary/AssetCard.vue";
import NetworkCard from "@/components/agents/summary/NetworkCard.vue";
import SystemStateCard from "@/components/agents/summary/SystemStateCard.vue";
import CertCard from "@/components/agents/CertCard.vue";
import InterfacesCard from "@/components/agents/summary/InterfacesCard.vue";
import ContainersCard from "@/components/agents/summary/ContainersCard.vue";
import { useAgentState } from "@/composables/agentState";
import SubTableTabs from "@/components/SubTableTabs.vue";
import HelpTip from "@/components/ui/HelpTip.vue";
import EmptyState from "@/components/ui/EmptyState.vue";
import {
  healthIssues as findHealthIssues,
  list,
  obj,
  str,
  wolLabel,
} from "@/utils/health";
import PendingActions from "@/components/logs/PendingActions.vue";
import AutomationManager from "@/components/automation/AutomationManager.vue";
import AlertsManager from "@/components/AlertsManager.vue";
import RunScript from "@/components/modals/agents/RunScript.vue";
import RustDeskConnect from "@/components/modals/agents/RustDeskConnect.vue";

// key -> where a policy in applied_policies (agents/serializers.py
// get_applied_policies) was picked up from; several can apply at once, the
// checks/tasks from every one of them are merged on the device
const POLICY_SOURCE_LABEL = {
  agent_policy: "agent",
  site_policy: "site",
  client_policy: "client",
  default_policy: "default",
};

export default {
  name: "SummaryTab",
  components: {
    AgentActionMenu,
    PerformanceCard,
    HealthCards,
    ScheduleCard,
    CertCard,
    ActionsCard,
    AssetCard,
    NetworkCard,
    SystemStateCard,
    InterfacesCard,
    ContainersCard,
    SubTableTabs,
    HelpTip,
    EmptyState,
  },
  setup() {
    const store = useStore();
    const dashboardStore = useDashboardStore();
    const route = useRoute();
    const $q = useQuasar();
    const fromState = (key) => computed(() => store.state[key]);
    const selectedAgent = fromState("selectedRow");
    const refreshSummaryTab = fromState("refreshSummaryTab");
    const dash_info_color = fromState("dash_info_color");
    const dash_warning_color = fromState("dash_warning_color");
    const dash_negative_color = fromState("dash_negative_color");
    const dash_positive_color = fromState("dash_positive_color");

    // a pop-out window carries ?popout=1 (see openPopout / MainLayout);
    // it must not offer to spawn a pop-out of itself
    const isPopout = computed(() => route.query.popout === "1");

    const summary = ref(null);
    const summaryError = ref(null);
    const customFieldsDefinitions = ref([]);
    const notes = ref([]);
    // GET /agents/<id>/rustdesk/; null until answered or when the request
    // fails, so the strip simply shows no pill
    const rustdesk = ref(null);
    // outdated third-party apps (Windows, macOS); 0 when unknown
    const appUpdateCount = ref(0);
    const loading = ref(false);
    const recollecting = ref(false);
    const actionsOpen = ref(false);
    const perf = ref(null);
    const perfLoading = ref(false);
    const perfError = ref(null);
    const cpuSamples = ref([]);
    const memorySamples = ref([]);
    const agentState = useAgentState();
    const stateUpdated = computed(() =>
      agentState.state.value?.received
        ? `Reported ${relativeTime(agentState.state.value.received)}`
        : "",
    );
    let summaryRequest = 0;
    let summaryTimer;
    let perfGeneration = 0;
    let perfTimer;
    let perfInFlight = false;
    let perfQueued = false;
    let mounted = false;

    const statusMeta = computed(() => agentStatusMeta(summary.value.status));
    const statusColor = computed(() => {
      if (statusMeta.value.state === "neutral") return "var(--rmm-text-muted)";
      const source = {
        positive: dash_positive_color,
        warning: dash_warning_color,
        negative: dash_negative_color,
        info: dash_info_color,
      }[statusMeta.value.state];
      return foregroundColor(source.value);
    });
    const powerEvent = computed(() => powerEventMeta(summary.value));
    const statusTooltip = computed(() => {
      const lastSeen = relativeTime(summary.value.last_seen);
      if (powerEvent.value) return powerEvent.value.tip;
      if (summary.value.status === "online")
        return "The agent is connected and reporting";
      if (summary.value.status === "overdue")
        return `Missed its check-in, last seen ${lastSeen}; overdue alerts can fire`;
      return `The agent is not connected, last seen ${lastSeen}`;
    });
    const platformIcon = computed(() => platformMeta(summary.value.plat).icon);
    const appliance = computed(() => applianceOf(summary.value.wmi_detail));
    const meshOfflineWarning = MESH_OFFLINE_WARNING;
    const offline = computed(() => summary.value?.status !== "online");
    const offlineReason = computed(
      () =>
        `Needs the agent online, last seen ${relativeTime(summary.value?.last_seen)}`,
    );
    const infoColor = computed(() => foregroundColor(dash_info_color.value));
    const warningColor = computed(() =>
      foregroundColor(dash_warning_color.value),
    );
    const positiveColor = computed(() =>
      foregroundColor(dash_positive_color.value),
    );
    const negativeColor = computed(() =>
      $q.dark.isActive
        ? "var(--rmm-status-negative)"
        : foregroundColor(dash_negative_color.value),
    );
    const serialNumber = computed(() =>
      summary.value.plat === "windows"
        ? summary.value.wmi_detail?.bios?.[0]?.[0]?.SerialNumber
        : summary.value.wmi_detail?.serialnumber,
    );
    const cpu = computed(() => {
      const models = summary.value.cpu_model || [];
      if (!models.length) return "—";
      return models.length > 1 ? `${models.length}× ${models[0]}` : models[0];
    });
    const disks = computed(() => Object.values(summary.value.disks || {}));
    // per-nic from agent; mac womp is per machine
    const wakeNics = computed(() => {
      const wmi = obj(summary.value.wmi_detail);
      const power = obj(obj(wmi.health).power);
      if (!("health" in wmi)) return [];
      if (summary.value.plat === "darwin")
        return [
          ["AC power", power.womp_ac],
          ["Battery", power.womp_batt],
        ]
          .filter(([, v]) => typeof v === "boolean")
          .map(([name, v]) => ({ name, ...wolLabel(v ? "on" : "off") }));
      return list(wmi.nics)
        .map(obj)
        .map((n) => ({ name: str(n.name), ...wolLabel(n.wol) }));
    });
    const healthIssues = computed(() =>
      findHealthIssues(summary.value.wmi_detail?.health, summary.value.plat),
    );
    const customFields = computed(() =>
      (summary.value.custom_fields || []).flatMap((field) => {
        const definition = customFieldsDefinitions.value.find(
          (item) => item.id === field.field,
        );
        // value is a bool for checkbox fields and a list for multiple ones
        // (AgentCustomField.value)
        const { value } = field;
        const text =
          typeof value === "boolean"
            ? value
              ? "Yes"
              : "No"
            : Array.isArray(value)
              ? value.filter(Boolean).join(", ")
              : value;
        return definition && !definition.hide_in_summary && text?.length
          ? [{ id: field.id, name: definition.name, value: text }]
          : [];
      }),
    );
    const memoryContext = computed(() => {
      const stats = perf.value;
      if (!stats || (stats.mem_used === null && stats.mem_total === null))
        return "";
      return `${fmtBytes(stats.mem_used)} used of ${fmtBytes(stats.mem_total)}`;
    });
    // the server stamps collected_at on failed samples too (agents/views.py
    // perf), so a failure must not read as "Updated ... ago"
    const perfUpdated = computed(() =>
      perf.value?.collected_at && !perfError.value
        ? relativeTime(perf.value.collected_at)
        : "",
    );
    const perfMessage = computed(() => {
      if (summary.value.status !== "online" || perfError.value === "offline") {
        return "Live data needs the agent online";
      }
      if (perfError.value === "unreachable") return "The agent did not respond";
      if (perfError.value === "unparseable")
        return "The live response could not be read";
      if (perfError.value) return "Live data could not be loaded";
      return "";
    });
    // retrying only polls while the agent is online, so do not offer it otherwise
    const perfRetryable = computed(
      () =>
        Boolean(perfError.value) &&
        perfError.value !== "offline" &&
        summary.value?.status === "online",
    );
    const bootTime = computed(() =>
      summary.value.boot_time
        ? store.getters.formatDate(new Date(summary.value.boot_time * 1000))
        : "—",
    );
    const uptime = computed(() => uptimeText(summary.value.boot_time));
    const loggedInUser = computed(() => {
      const current = summary.value.logged_in_username;
      if (current && current !== "None") return { active: true, name: current };
      return { active: false, name: summary.value.last_logged_in_user || "" };
    });
    const summaryErrorStatus = computed(
      () => summaryError.value?.response?.status ?? null,
    );
    // no check has a result yet; older servers count those as passing and
    // leave out "pending"
    const checksAwaiting = computed(() => {
      const checks = summary.value.checks;
      if (checks.pending != null)
        return checks.total > 0 && checks.pending === checks.total;
      return (
        checks.total > 0 &&
        checks.passing === 0 &&
        checks.failing === 0 &&
        checks.warning === 0 &&
        checks.info === 0
      );
    });
    // the strip's health-at-a-glance pill: worst state first, same ranking
    // the fleet table icon uses (failing > warning > info > passing)
    const checksStrip = computed(() => {
      const checks = summary.value.checks;
      if (!checks.total)
        return { text: "No checks", class: "rmm-pill--neutral" };
      if (checksAwaiting.value)
        return { text: "Checks awaiting sync", class: "rmm-pill--neutral" };
      if (checks.failing > 0)
        return {
          text: `${checks.failing} check${checks.failing === 1 ? "" : "s"} failing`,
          class: "rmm-pill--negative",
          color: negativeColor.value,
        };
      if (checks.warning > 0)
        return {
          text: `${checks.warning} check${checks.warning === 1 ? "" : "s"} warning`,
          class: "rmm-pill--warning",
          color: warningColor.value,
        };
      if (checks.info > 0)
        return {
          text: `${checks.info} check${checks.info === 1 ? "" : "s"} info`,
          class: "rmm-pill--info",
        };
      if (checks.pending > 0)
        return {
          text: `${checks.passing} passing, ${checks.pending} pending`,
          class: "rmm-pill--neutral",
        };
      return {
        text: "All checks passing",
        class: "rmm-pill--positive",
        color: positiveColor.value,
      };
    });
    // CPU, memory, fullest disk, checks, patches, last seen. Each chip
    // opens the tab for that number. Values are already loaded.
    const kpis = computed(() => {
      const agent = summary.value;
      const checks = agent.checks || {};
      const worstDisk = disks.value.reduce(
        (top, disk) =>
          Number(disk.percent) > Number(top?.percent ?? -1) ? disk : top,
        null,
      );
      const percent = (value) =>
        typeof value === "number" ? `${Math.round(value)}%` : "—";
      const live = (text) => perfMessage.value || text;
      return [
        {
          label: "CPU",
          value: percent(perf.value?.cpu_percent),
          style: levelStyle(perf.value?.cpu_percent),
          tab: "overview",
          tip: live("Live CPU use, sampled every 30 s while open"),
        },
        {
          label: "Memory",
          value: percent(perf.value?.mem_percent),
          style: levelStyle(perf.value?.mem_percent),
          tab: "overview",
          tip: live(memoryContext.value),
        },
        {
          label: worstDisk ? `Disk ${worstDisk.device}` : "Disk",
          value: worstDisk ? `${worstDisk.percent}%` : "—",
          style: levelStyle(Number(worstDisk?.percent)),
          tab: "overview",
          tip: worstDisk
            ? `Fullest volume: ${worstDisk.free} free of ${worstDisk.total}`
            : "No disks reported",
        },
        {
          label: "Checks",
          value: checks.total ? `${checks.passing}/${checks.total}` : "—",
          style: { color: checksStrip.value.color },
          tab: "checks",
          tip: `${checksStrip.value.text} — open the Checks tab`,
        },
        {
          label: "Patches",
          value: agent.patches_last_installed
            ? relativeTime(agent.patches_last_installed)
            : "Never",
          style: {},
          tab: "patches",
          tip: "Last patch install run — open the Patches tab",
        },
        {
          label: "Last seen",
          value: relativeTime(agent.last_seen),
          style: { color: offline.value ? statusColor.value : undefined },
          tab: "history",
          tip: `${statusTooltip.value} — open the History tab`,
        },
      ];
    });
    const appliedPolicyNames = computed(() => {
      const policies = summary.value.applied_policies || {};
      return Object.entries(policies)
        .filter(([, policy]) => policy)
        .map(
          ([key, policy]) =>
            `${policy.name} (${POLICY_SOURCE_LABEL[key] || key})`,
        );
    });
    const notesCount = computed(() => notes.value.length);
    const latestNote = computed(() => {
      if (!notes.value.length) return "";
      const newest = [...notes.value].sort(
        (a, b) => new Date(b.entry_time) - new Date(a.entry_time),
      )[0];
      return newest?.note?.split("\n")[0] || "";
    });
    // the fleet view scoped to this device's site. "site" is the id, "client"
    // only a name; every agent has exactly one site, so the site is enough
    const scopeLink = computed(() =>
      summary.value.site
        ? { name: "Dashboard", query: { site: summary.value.site } }
        : { name: "Dashboard" },
    );
    // back to the fleet view in the scope the dashboard still holds
    const devicesLink = computed(() =>
      dashboardScopeRoute(store.state.selectedTree),
    );

    function paletteColor(value) {
      try {
        return colors.getPaletteColor(value);
      } catch {
        return value;
      }
    }

    // palette colors are picked for filled chips - warning and info are far too
    // light to be readable as text or thin strokes on the light surface
    function foregroundColor(value) {
      const color = paletteColor(value);
      if ($q.dark.isActive) return color;
      try {
        return colors.lighten(color, -45);
      } catch {
        return color;
      }
    }

    function diskBarColor(percent) {
      const level = usageLevel(percent);
      if (level === "negative") return dash_negative_color.value;
      return level ? dash_warning_color.value : dash_positive_color.value;
    }

    // CPU/memory rings use the disk bar colours; the card's neutral accent
    // until there is a sample
    function perfBarColor(percent) {
      return percent === null || percent === undefined
        ? undefined
        : diskBarColor(Number(percent));
    }

    // same thresholds as the bars, as a text colour for the KPI chips; below
    // warning the value keeps the plain text colour
    function levelStyle(percent) {
      const level = usageLevel(percent);
      if (!level) return {};
      return {
        color: level === "warning" ? warningColor.value : negativeColor.value,
      };
    }

    // the tab strip reads ?tab= (SubTableTabs); this keeps the scope/agent
    // already in the URL and only changes the tab
    function tabLink(tab) {
      return { query: { ...route.query, tab } };
    }
    // winget sits in the Patches tab on Windows, brew/mas in the Apps tab
    const appUpdatesLink = computed(() =>
      store.state.agentPlatform === "windows"
        ? { query: { ...route.query, tab: "patches", src: "winget" } }
        : tabLink("apps"),
    );

    // the Actions card reloads with every summary load and after the dialog
    const actionsTick = ref(0);
    const pendingCount = ref(0);

    function showPendingActions() {
      $q.dialog({
        component: PendingActions,
        componentProps: { agent: summary.value },
      }).onDismiss(() => actionsTick.value++);
    }

    const awakeUntil = computed(() => {
      const until = summary.value?.keep_awake_until;
      return until && new Date(until) > Date.now()
        ? store.getters.formatDate(until)
        : "";
    });

    function showKeepAwake() {
      $q.dialog({
        component: KeepAwake,
        componentProps: { agent: summary.value },
        // the new keep_awake_until is stored on the agent row; no re-collect
      }).onOk(() => getSummary({ silent: true }));
    }

    function showAutomationManager() {
      $q.dialog({ component: AutomationManager });
    }

    function showAlertsManager() {
      $q.dialog({ component: AlertsManager });
    }

    function showRunScript() {
      $q.dialog({
        component: RunScript,
        componentProps: { agent: summary.value },
      });
    }

    function connectRustDesk() {
      $q.dialog({
        component: RustDeskConnect,
        componentProps: { agent: summary.value, rustdesk: rustdesk.value },
      });
    }

    // a pop-out never offers to open a further pop-out (its own Popout
    // button is hidden via isPopout); ?popout=1 tells MainLayout to drop
    // the rail and "Back to dashboard" so the window is a focused device
    // view instead of a second full shell
    function openPopout() {
      const url = router.resolve(
        `/agents/${selectedAgent.value}?popout=1`,
      ).href;
      openURL(url, null, { ...getCenteredWindowOptions(1600, 900) });
    }

    function clearPerfTimer() {
      window.clearTimeout(perfTimer);
      perfTimer = undefined;
    }

    function clearSummaryTimer() {
      window.clearTimeout(summaryTimer);
      summaryTimer = undefined;
    }

    function summaryPollingBlocked() {
      return [403, 404].includes(summaryErrorStatus.value);
    }

    function scheduleSummary(delay = DASHBOARD_REFRESH_INTERVAL) {
      clearSummaryTimer();
      if (
        mounted &&
        !dashboardStore.isOffline &&
        !summaryPollingBlocked() &&
        document.visibilityState === "visible" &&
        selectedAgent.value
      ) {
        summaryTimer = window.setTimeout(
          () => void getSummary({ silent: true }),
          delay,
        );
      }
    }

    function canPoll() {
      return (
        mounted &&
        !dashboardStore.isOffline &&
        document.visibilityState === "visible" &&
        selectedAgent.value &&
        summary.value?.status === "online"
      );
    }

    function schedulePerf(delay = DASHBOARD_REFRESH_INTERVAL) {
      clearPerfTimer();
      if (canPoll()) perfTimer = window.setTimeout(loadPerf, delay);
    }

    function setPerfOffline() {
      perfGeneration += 1;
      perfQueued = false;
      perfLoading.value = false;
      perf.value = null;
      perfError.value = "offline";
      clearPerfTimer();
    }

    async function loadPerf() {
      if (!canPoll()) return;
      if (perfInFlight) {
        perfQueued = true;
        return;
      }

      const agentId = selectedAgent.value;
      const generation = perfGeneration;
      const startedAt = Date.now();
      perfInFlight = true;
      perfLoading.value = true;
      clearPerfTimer();
      try {
        const result = await fetchAgentPerf(agentId, SILENT_REQUEST_CONFIG);
        if (
          !mounted ||
          generation !== perfGeneration ||
          agentId !== selectedAgent.value
        ) {
          return;
        }

        perf.value = result;
        perfError.value = result?.error || (result ? null : "request");
        if (typeof result?.cpu_percent === "number") {
          cpuSamples.value = [...cpuSamples.value, result.cpu_percent].slice(
            -30,
          );
        }
        if (typeof result?.mem_percent === "number") {
          memorySamples.value = [
            ...memorySamples.value,
            result.mem_percent,
          ].slice(-30);
        }
      } catch (e) {
        // an aborted poll (the page is left) has no response and the card
        // already says when the agent did not answer
        if (e?.response) console.error(e);
        if (
          mounted &&
          generation === perfGeneration &&
          agentId === selectedAgent.value
        ) {
          perfError.value = "request";
        }
      } finally {
        perfInFlight = false;
        if (generation === perfGeneration) perfLoading.value = false;
        if (perfQueued && canPoll()) {
          perfQueued = false;
          void loadPerf();
        } else {
          perfQueued = false;
          schedulePerf(
            Math.max(0, DASHBOARD_REFRESH_INTERVAL - (Date.now() - startedAt)),
          );
        }
      }
    }

    function resetAgentState() {
      summaryRequest += 1;
      perfGeneration += 1;
      perfQueued = false;
      clearSummaryTimer();
      clearPerfTimer();
      summary.value = null;
      summaryError.value = null;
      store.commit("setAgentName", null);
      customFieldsDefinitions.value = [];
      notes.value = [];
      rustdesk.value = null;
      appUpdateCount.value = 0;
      perf.value = null;
      perfError.value = null;
      perfLoading.value = false;
      cpuSamples.value = [];
      memorySamples.value = [];
      agentState.reset();
    }

    async function getSummary(options = {}) {
      const silent = options?.silent === true;
      const lightweight = silent && summary.value !== null;
      const agentId = selectedAgent.value;
      if (!agentId) return;
      if (silent && loading.value) return;
      const request = ++summaryRequest;
      const previousStatus = summary.value?.status;
      if (!silent) loading.value = true;
      clearSummaryTimer();
      try {
        const config = silent ? SILENT_REQUEST_CONFIG : undefined;
        void agentState.load(agentId);
        const [agent, definitions, agentNotes, agentRustDesk, agentApps] =
          lightweight
            ? [await fetchAgent(agentId, {}, config)]
            : await Promise.all([
                fetchAgent(agentId, {}, config),
                fetchCustomFields({}, config),
                fetchAgentNotes(agentId, {}, config).catch(() => []),
                fetchAgentRustDesk(agentId, config).catch(() => null),
                fetchAppUpdates(agentId, { silent: true }).catch(() => null),
              ]);
        if (request !== summaryRequest || agentId !== selectedAgent.value)
          return;

        summary.value = agent || null;
        summaryError.value = null;
        actionsTick.value++;
        if (!lightweight) {
          customFieldsDefinitions.value = definitions || [];
          notes.value = agentNotes || [];
          rustdesk.value = agentRustDesk;
          appUpdateCount.value = agentApps
            ? pendingRows(normalizeAppUpdates(agentApps).rows).length
            : 0;
        }
        store.commit("setRefreshSummaryTab", false);
        if (!agent) return;

        store.commit("setAgentPlatform", agent.plat);
        store.commit("setAgentName", deviceName(agent));
        store.commit("setAgentAvailability", {
          agent_id: agent.agent_id,
          status: agent.status,
          last_seen: agent.last_seen,
        });
        if (!silent && agent.status === "online") {
          perfError.value = null;
          void loadPerf();
        } else if (!silent) {
          setPerfOffline();
        } else if (previousStatus !== agent.status) {
          if (agent.status === "online") {
            perfError.value = null;
            schedulePerf(0);
          } else {
            setPerfOffline();
          }
        }
      } catch (e) {
        console.error(e);
        const status = e?.response?.status;
        if (
          request === summaryRequest &&
          agentId === selectedAgent.value &&
          (!silent || [403, 404].includes(status))
        ) {
          if ([403, 404].includes(status)) {
            summary.value = null;
            store.commit("setAgentAvailability", null);
          }
          summaryError.value = e;
        }
      } finally {
        if (request === summaryRequest && agentId === selectedAgent.value) {
          loading.value = false;
          if (!summaryPollingBlocked()) scheduleSummary();
        }
      }
    }

    async function refreshSummary() {
      if (offline.value) return;
      const agentId = selectedAgent.value;
      recollecting.value = true;
      try {
        const result = await refreshAgentWMI(agentId);
        if (agentId === selectedAgent.value) await getSummary();
        notifySuccess(result);
      } catch (error) {
        console.error(error);
      } finally {
        recollecting.value = false;
      }
    }

    function handleVisibilityChange() {
      clearSummaryTimer();
      clearPerfTimer();
      if (document.visibilityState === "visible" && !summaryPollingBlocked()) {
        void getSummary({ silent: true });
        void loadPerf();
      }
    }

    // the poll is not rescheduled while offline, so resume it once the
    // backend is reachable again
    watch(
      () => dashboardStore.isOffline,
      (offline) => {
        if (offline) {
          perfGeneration += 1;
          perfQueued = false;
          perfLoading.value = false;
          clearPerfTimer();
        } else {
          scheduleSummary(0);
          schedulePerf(0);
        }
      },
    );

    watch(selectedAgent, (agentId) => {
      resetAgentState();
      if (agentId) void getSummary();
    });
    watch(refreshSummaryTab, (refresh) => {
      if (refresh && selectedAgent.value) void getSummary();
      else if (refresh) store.commit("setRefreshSummaryTab", false);
    });
    // the fleet table refresh updates store.state.agents but this page keeps
    // its own fetched copy; without this a reconnect can leave the header
    // saying offline (actions disabled) after the row itself has gone green.
    // silent getSummary, no loader.
    watch(
      () =>
        store.state.agents.find((a) => a.agent_id === selectedAgent.value)
          ?.status,
      (status) => {
        if (status && summary.value && status !== summary.value.status) {
          void getSummary({ silent: true });
        }
      },
    );

    onMounted(() => {
      mounted = true;
      document.addEventListener("visibilitychange", handleVisibilityChange);
      if (selectedAgent.value) void getSummary();
    });
    onBeforeUnmount(() => {
      mounted = false;
      summaryRequest += 1;
      perfGeneration += 1;
      perfQueued = false;
      clearSummaryTimer();
      clearPerfTimer();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    });

    return {
      deviceName,
      summary,
      summaryError,
      summaryErrorStatus,
      customFields,
      loading,
      recollecting,
      actionsOpen,
      selectedAgent,
      disks,
      wakeNics,
      healthIssues,
      statusColor,
      statusMeta,
      statusTooltip,
      powerEvent,
      platformIcon,
      appliance,
      meshOfflineWarning,
      offline,
      offlineReason,
      isPopout,
      serialNumber,
      cpu,
      bootTime,
      uptime,
      loggedInUser,
      checksAwaiting,
      checksStrip,
      kpis,
      appliedPolicyNames,
      notesCount,
      latestNote,
      rustdesk,
      appUpdateCount,
      connectRustDesk,
      copyOutput,
      scopeLink,
      devicesLink,
      perf,
      perfLoading,
      perfUpdated,
      perfMessage,
      perfRetryable,
      cpuSamples,
      memorySamples,
      memoryContext,
      stateDoc: agentState.state,
      stateMissing: agentState.missing,
      stateStale: agentState.stale,
      stateUpdated,
      infoColor,
      warningColor,
      positiveColor,
      negativeColor,
      store,
      getSummary,
      refreshSummary,
      loadPerf,
      relativeTime,
      diskBarColor,
      perfBarColor,
      tabLink,
      appUpdatesLink,
      showPendingActions,
      actionsTick,
      pendingCount,
      showKeepAwake,
      awakeUntil,
      showAutomationManager,
      showAlertsManager,
      showRunScript,
      openPopout,
      runRemoteBackground,
      runTakeControl,
    };
  },
};
</script>

<style scoped>
/* the page: hero on top, the tab strip and its panel take the rest */
.device {
  --rmm-radius: 12px;
  display: flex;
  min-width: 0;
  min-height: 0;
  flex: 1 1 auto;
  flex-direction: column;
  color: var(--rmm-text);
  background: var(--rmm-bg);
}

/* the hero does not shrink. On a short window it scrolls itself before
   the tabs drop below their minimum */
.device-hero {
  position: relative;
  max-height: 55vh;
  flex: 0 0 auto;
  overflow-y: auto;
  padding: 12px 20px 14px;
  border-bottom: 1px solid var(--rmm-border);
  background: var(
    --rmm-hero-bg,
    linear-gradient(
      135deg,
      color-mix(in srgb, var(--rmm-accent) 10%, var(--rmm-surface)),
      var(--rmm-surface) 65%
    )
  );
}

.device-hero__crumbs {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 2px;
  margin-bottom: 6px;
  color: var(--rmm-text-muted);
  font-size: var(--rmm-fs-xs);
}

.device-hero__crumbs .rmm-link {
  text-decoration: none;
}

.device-hero__body {
  display: flex;
  align-items: flex-start;
  gap: 16px 24px;
}

.device-hero__identity {
  min-width: 0;
  flex: 1 1 320px;
}

.device-hero__side {
  display: flex;
  min-width: 0;
  flex: 0 1 auto;
  flex-direction: column;
  align-items: flex-end;
  gap: 10px;
}

.device-hero__title-row {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 10px;
}

.device-hero__title-row > .rmm-pill,
.device-hero__title-row > .q-badge,
.device-hero__platform {
  flex-shrink: 0;
}

.device-hero__platform {
  color: var(--rmm-text-muted);
}

.device-hero__hostname {
  overflow: hidden;
  min-width: 0;
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.device-hero__status {
  font-weight: 600;
}

.device-hero__description {
  margin-top: 2px;
  color: var(--rmm-text-muted);
  font-size: var(--rmm-fs-md);
}

.device-hero__meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px 14px;
  margin-top: 6px;
  font-size: var(--rmm-fs-xs);
}

.device-hero__strip {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 10px;
}

.device-hero__strip a.rmm-pill {
  cursor: pointer;
  text-decoration: none;
  transition: background-color 0.15s ease-out;
}

.device-hero__strip a.rmm-pill:hover {
  background: color-mix(in srgb, var(--rmm-pill-color) 18%, transparent);
}

/* the hero gradient under the pill tint is darker than a plain surface;
   mixing in --rmm-text keeps the status text at 4.5:1 */
.device-hero__strip .rmm-pill {
  color: color-mix(
    in srgb,
    var(--rmm-pill-text, var(--rmm-pill-color)) 80%,
    var(--rmm-text)
  );
}

.device-hero__actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 8px;
}

.device-hero__tools {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 2px;
  border: 1px solid var(--rmm-border);
  border-radius: 999px;
  background: var(--rmm-surface);
}

.device-hero__tools :deep(.q-btn) {
  color: var(--rmm-text-muted);
}

.device-hero__tool--off {
  opacity: 0.55;
}

.device-hero__btn {
  min-height: 32px;
  padding: 2px 12px;
}

.device-hero__btn.q-btn--outline {
  color: var(--rmm-text);
  background: var(--rmm-surface);
}

.device-hero__btn.q-btn--outline::before {
  border-color: var(--rmm-border-strong);
}

.device-hero__primary {
  padding: 2px 14px;
}

.device-hero__kpis {
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 6px;
}

/* chip; click opens the tab for this metric */
.device-kpi {
  display: inline-flex;
  min-width: 88px;
  flex-direction: column;
  gap: 1px;
  padding: 5px 10px;
  border: 1px solid var(--rmm-border);
  border-radius: 8px;
  color: var(--rmm-text);
  background: var(--rmm-surface);
  text-decoration: none;
  transition:
    border-color 0.15s ease-out,
    transform 0.15s ease-out;
}

.device-kpi:hover {
  border-color: var(--rmm-border-strong);
  transform: translateY(-1px);
}

.device-kpi__label {
  color: var(--rmm-text-muted);
  font-size: var(--rmm-fs-xs);
  line-height: 1.2;
  white-space: nowrap;
}

.device-kpi__value {
  font-size: var(--rmm-fs-md);
  font-weight: 700;
  line-height: 1.3;
  white-space: nowrap;
}

/* overview cards lift 1px on hover */
.device-overview :deep(.rmm-card) {
  transition:
    transform 0.15s ease-out,
    box-shadow 0.15s ease-out;
}

.device-overview :deep(.rmm-card:hover) {
  box-shadow: 0 6px 16px -8px rgba(15, 23, 42, 0.28);
  transform: translateY(-1px);
}

.summary-disks {
  min-height: 176px;
}

/* scrolls with the list. hides the bottom shade once the last disk
   is in view, so the shade only shows while more disks sit below.
   Three disks fit whole: each is two lines of 1.125rem plus the 8px bar
   and its 4px margins, then two 12px gaps and the 12px padding */
.summary-disks__body {
  max-height: calc(3 * (2.25rem + 16px) + 48px);
  overflow-y: auto;
  background:
    linear-gradient(transparent, var(--rmm-surface) 50%) center bottom / 100%
      32px no-repeat local,
    linear-gradient(to top, var(--rmm-border-strong), transparent) center bottom /
      100% 16px no-repeat scroll;
}

.summary-disk + .summary-disk {
  margin-top: 12px;
}

.summary-disk__heading,
.summary-disk__meta {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: var(--rmm-fs-xs);
}

.summary-disk__heading {
  margin-bottom: 4px;
}

.summary-disk__meta {
  margin-top: 4px;
}

.summary-disk__bar :deep(.q-linear-progress__track) {
  background: var(--rmm-border-strong) !important;
  opacity: 1;
}

.detail-card {
  height: 100%;
}

.rmm-kv > span {
  min-width: 0;
  overflow-wrap: anywhere;
}

.summary-kv-label {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.summary-list-item {
  display: block;
}

.summary-list-item + .summary-list-item {
  margin-top: 4px;
}

.checks-grid {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(0, 1fr);
  gap: 6px;
}

.check-tile {
  min-width: 0;
  padding: 8px 4px;
  border: 1px solid var(--rmm-border);
  border-radius: var(--rmm-radius-sm);
  background: var(--rmm-surface-2);
  text-align: center;
}

.check-tile strong,
.check-tile span {
  display: block;
}

.check-tile strong {
  font-size: 1.15rem;
  font-weight: 600;
}

.check-tile span {
  color: var(--rmm-text-muted);
  font-size: var(--rmm-fs-xs);
}

@media (max-width: 1100px) {
  .device-hero__body {
    flex-direction: column;
    align-items: stretch;
  }

  /* the 320px basis is meant as a width; stacked it became the height */
  .device-hero__identity {
    flex-basis: auto;
  }

  .device-hero__side {
    align-items: flex-start;
  }

  .device-hero__actions,
  .device-hero__kpis {
    justify-content: flex-start;
  }
}

@media (max-width: 700px) {
  .device-hero {
    padding: 10px 12px 12px;
  }

  .device-hero__hostname {
    overflow-wrap: anywhere;
    white-space: normal;
  }
}

@media (max-width: 420px) {
  .rmm-kv {
    grid-template-columns: 1fr;
    gap: 3px;
  }

  .rmm-kv > :nth-child(even) {
    margin-bottom: 6px;
  }
}
</style>
