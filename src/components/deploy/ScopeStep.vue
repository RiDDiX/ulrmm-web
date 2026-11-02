<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-form ref="form" class="deploy-step" @submit.prevent>
    <h2 id="deploy-step-1" tabindex="-1" class="deploy-step__title">Scope</h2>
    <p class="deploy-step__lead">
      Where new devices belong and what they get on enrollment. Next saves the
      deployment; its links carry a signed enrollment token until it expires.
    </p>

    <div class="deploy-stack">
      <section class="rmm-card" aria-labelledby="deploy-scope-where">
        <div class="rmm-card__header">
          <q-icon name="business" size="18px" aria-hidden="true" />
          <h3 id="deploy-scope-where" class="rmm-card__title">Deployment</h3>
        </div>
        <div class="rmm-card__body deploy-stack">
          <q-option-group
            v-model="s.mode"
            :options="MODES"
            aria-label="New or existing deployment"
            type="radio"
            inline
          />

          <template v-if="s.mode === 'existing'">
            <rmm-select
              v-model="s.existing"
              :options="existingOptions"
              :rules="[(v: number | null) => v != null || 'Pick a deployment']"
              label="Deployment"
              map-options
              filterable
              hide-bottom-space
              class="deploy-field--wide"
            >
              <template #no-option>
                <q-item>
                  <q-item-section class="rmm-muted">
                    No active deployments in your scope
                  </q-item-section>
                </q-item>
              </template>
            </rmm-select>
            <dl v-if="picked" class="rmm-kv deploy-summary">
              <dt>Client / site</dt>
              <dd>{{ picked.client_name }} / {{ picked.site_name }}</dd>
              <dt>Agent type</dt>
              <dd>{{ picked.mon_type }}</dd>
              <dt>Automation policy</dt>
              <dd>{{ picked.policy_name || "None" }}</dd>
              <dt>Expires</dt>
              <dd>{{ formatDate(picked.expiry) }}</dd>
              <template v-if="picked.legacy_token">
                <dt>Legacy token</dt>
                <dd>
                  <span class="rmm-mono">{{ picked.legacy_token }}</span>
                  <span class="rmm-muted q-ml-xs">not shown again</span>
                </dd>
              </template>
              <template v-if="enrollmentsText(picked)">
                <dt>Enrollments</dt>
                <dd>
                  {{ enrollmentsText(picked) }}
                  <span
                    v-if="enrollmentLimitReached(picked)"
                    class="rmm-pill rmm-pill--warning q-ml-xs"
                    >Limit reached</span
                  >
                </dd>
              </template>
              <dt>Windows options</dt>
              <dd>{{ enabledFlags(picked.install_flags) }}</dd>
            </dl>
          </template>

          <template v-else>
            <div class="deploy-grid">
              <rmm-select
                v-model="s.client"
                :options="clientOptions"
                :rules="[(v: number | null) => v != null || 'Pick a client']"
                label="Client"
                map-options
                filterable
                hide-bottom-space
                @update:model-value="pickClient"
              />
              <rmm-select
                v-model="s.site"
                :options="siteOptions"
                :rules="[(v: number | null) => v != null || 'Pick a site']"
                label="Site"
                map-options
                filterable
                hide-bottom-space
              />
              <q-input
                v-model="s.name"
                :rules="[(v: string) => nameError(v) || true]"
                label="Name (optional)"
                hint="Shown in the deployment list, e.g. Front desk laptops"
                maxlength="100"
                outlined
                dense
                stack-label
              />
              <rmm-select
                v-model="s.policy"
                :options="policyOptions"
                :disable="policies === null"
                :hint="
                  policies === null
                    ? 'Your role cannot list automation policies'
                    : 'Assigned to every agent that enrolls through this deployment'
                "
                label="Automation policy"
                map-options
                filterable
                clearable
              />
              <q-input
                v-model="s.maxEnrollments"
                :rules="[(v: string) => maxEnrollmentsError(v) || true]"
                label="Enrollment limit (optional)"
                hint="Devices that may enroll through this deployment; empty means no limit"
                inputmode="numeric"
                type="text"
                outlined
                dense
                stack-label
              />
            </div>
          </template>
        </div>
      </section>

      <section
        v-if="s.mode !== 'existing'"
        class="rmm-card"
        aria-labelledby="deploy-scope-enroll"
      >
        <div class="rmm-card__header">
          <q-icon name="how_to_reg" size="18px" aria-hidden="true" />
          <h3 id="deploy-scope-enroll" class="rmm-card__title">Enrollment</h3>
        </div>
        <div class="rmm-card__body deploy-stack">
          <div>
            <div id="deploy-agent-type" class="rmm-label">Agent type</div>
            <q-option-group
              v-model="s.agenttype"
              :options="AGENT_TYPES"
              aria-labelledby="deploy-agent-type"
              type="radio"
              inline
              @update:model-value="
                (v: string) => v === 'server' && (s.power = false)
              "
            />
          </div>

          <div>
            <div class="row items-center q-gutter-x-xs">
              <div id="deploy-ttl" class="rmm-label">Links valid for</div>
              <HelpTip
                text="After this time the links and the enrollment token stop working; deleting the deployment revokes them earlier"
              />
            </div>
            <q-option-group
              v-model="s.ttl"
              :options="TTL_CHOICES"
              aria-labelledby="deploy-ttl"
              type="radio"
              inline
            />
            <q-input
              v-if="s.ttl === 0"
              v-model="s.custom"
              :min="minCustom"
              :max="maxCustom"
              :rules="[(v: string) => customExpiryError(v) || true]"
              type="datetime-local"
              label="Valid until"
              class="deploy-field--date q-mt-sm"
              outlined
              dense
              stack-label
            />
          </div>

          <div>
            <div id="deploy-win-options" class="rmm-label">Windows options</div>
            <div
              role="group"
              aria-labelledby="deploy-win-options"
              class="column q-gutter-y-xs"
            >
              <div
                v-for="o in WINDOWS_OPTIONS"
                v-show="!o.workstationOnly || s.agenttype === 'workstation'"
                :key="o.key"
                class="row items-center no-wrap"
              >
                <q-checkbox v-model="s[o.key]" :label="o.label" dense />
                <HelpTip :text="o.help" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="rmm-card" aria-labelledby="deploy-scope-software">
        <div class="rmm-card__header">
          <q-icon name="inventory_2" size="18px" aria-hidden="true" />
          <h3 id="deploy-scope-software" class="rmm-card__title">Software</h3>
        </div>
        <div class="rmm-card__body">
          <rmm-select
            v-model="s.baselines"
            :options="baselineOptions"
            :disable="baselines === null"
            :error="!!baselineError"
            :error-message="baselineError"
            :hint="
              baselines === null
                ? 'Software baselines are not available to your role'
                : 'Software each enrolled agent installs after setup, checked until it is really installed'
            "
            label="Software baselines"
            class="deploy-field--wide"
            map-options
            multiple
            filterable
          />
        </div>
      </section>
    </div>
  </q-form>
</template>

<script setup lang="ts">
import { computed, ref, toRef } from "vue";
import { useStore } from "vuex";
import type { QForm } from "quasar";
import RmmSelect from "@/components/ui/RmmSelect.vue";
import HelpTip from "@/components/ui/HelpTip.vue";
import { platformMeta } from "@/utils/format";
import {
  TTL_CHOICES,
  customExpiryError,
  deploymentLabel,
  enrollmentLimitReached,
  enrollmentsText,
  expiryFromHours,
  isExpired,
  localInputValue,
  maxEnrollmentsError,
  nameError,
  type ScopeState,
} from "@/utils/deploy";
import type { Deployment, PolicyChoice } from "@/api/deploy";
import type { Baseline } from "@/utils/baselines";
import type { ClientWithSites } from "@/types/clients";

const props = defineProps<{
  state: ScopeState;
  clients: ClientWithSites[];
  deployments: Deployment[];
  // null: the role cannot list them
  policies: PolicyChoice[] | null;
  baselines: Baseline[] | null;
  baselineError: string;
}>();

const MODES = [
  { label: "New deployment", value: "new" },
  { label: "Existing deployment", value: "existing" },
];
const AGENT_TYPES = [
  { label: "Server", value: "server" },
  { label: "Workstation", value: "workstation" },
];
const WINDOWS_OPTIONS: {
  key: "rdp" | "ping" | "power";
  label: string;
  help: string;
  workstationOnly?: boolean;
}[] = [
  {
    key: "rdp",
    label: "Enable RDP",
    help: "Turns on Remote Desktop and its Windows firewall rule during install",
  },
  {
    key: "ping",
    label: "Enable Ping",
    help: "Enable ICMP echo requests in the local firewall, so the device answers ping",
  },
  {
    key: "power",
    label: "Disable sleep/hibernate",
    help: "Never sleeps, hibernates or turns off display/disk; fast startup and lid-close sleep off",
    workstationOnly: true,
  },
];

const store = useStore();
const formatDate = (value: string | null) => store.getters.formatDate(value);

const s = toRef(props, "state");
const form = ref<QForm | null>(null);

const clientOptions = computed(() =>
  props.clients.map((c) => ({ label: c.name, value: c.id })),
);
const siteOptions = computed(
  () =>
    props.clients
      .find((c) => c.id === s.value.client)
      ?.sites.map((site) => ({ label: site.name, value: site.id })) ?? [],
);
const existingOptions = computed(() =>
  props.deployments
    .filter((d) => !isExpired(d))
    .map((d) => ({ label: deploymentLabel(d), value: d.id })),
);
const picked = computed(() =>
  props.deployments.find((d) => d.id === s.value.existing),
);
const policyOptions = computed(() =>
  (props.policies ?? []).map((p) => ({
    label: p.active === false ? `${p.name} (inactive)` : p.name,
    value: p.id,
  })),
);
const baselineOptions = computed(() =>
  (props.baselines ?? []).map((b) => ({
    label: [
      b.name,
      b.plat && `(${platformMeta(b.plat).label})`,
      b.enabled === false && "(disabled)",
    ]
      .filter(Boolean)
      .join(" "),
    value: b.id,
  })),
);

const minCustom = localInputValue(new Date());
const maxCustom = localInputValue(expiryFromHours(30 * 24));

function pickClient(id: number | null) {
  s.value.site = props.clients.find((c) => c.id === id)?.sites[0]?.id ?? null;
}

function enabledFlags(flags: Record<string, boolean> | null) {
  const on = Object.keys(flags || {}).filter((key) => flags?.[key]);
  return on.length ? on.join(", ") : "none";
}

defineExpose({
  validate: async () => (await form.value?.validate()) ?? false,
});
</script>
