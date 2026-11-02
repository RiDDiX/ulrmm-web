<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-card flat class="rmm-card">
    <div class="rmm-card__header">
      <div class="rmm-card__title">Emergency actions</div>
      <HelpTip
        text="Each action asks for a typed confirmation and a two-factor code. Agents pick up rotations at their next check-in"
      />
    </div>
    <div class="rmm-card__body">
      <q-banner
        v-if="result"
        dense
        rounded
        class="rmm-banner-warning q-mb-md"
        role="status"
      >
        <template #avatar><q-icon name="check_circle" /></template>
        {{ result }}
      </q-banner>
      <div class="emergency-grid">
        <div class="emergency-item">
          <q-btn
            unelevated
            no-caps
            color="negative"
            icon="autorenew"
            label="Force rotation"
            :loading="busy === 'rotate'"
            :disable="!!busy"
            @click="openRotate"
          />
          <div class="text-caption rmm-muted">
            Drops sessions and renews certificates, tokens or identity keys for
            the fleet, a client, a site or one agent.
          </div>
        </div>
        <div class="emergency-item">
          <q-btn
            outline
            no-caps
            color="primary"
            icon="key"
            label="Rotate command key"
            :loading="busy === 'cmdkey'"
            :disable="!!busy"
            @click="confirmRotateKey"
          />
          <div class="text-caption rmm-muted">
            A new signing key goes out with the pin document and becomes current
            once every agent knows it, at the latest after 24 hours.
          </div>
        </div>
        <div class="emergency-item">
          <q-btn
            outline
            no-caps
            color="primary"
            icon="published_with_changes"
            label="Promote backup pins"
            :loading="busy === 'pins'"
            :disable="!!busy"
            @click="confirmPromote"
          />
          <div class="text-caption rmm-muted">
            After the server certificate moved onto a backup pin: clears the old
            backup pins and sends agents a new pin document.
          </div>
        </div>
      </div>
    </div>

    <q-dialog v-model="rotateOpen" aria-labelledby="force-rotate-title">
      <q-card class="q-dialog-plugin rmm-dialog--md">
        <DialogHeader
          title-id="force-rotate-title"
          title="Force rotation"
          subtitle="The session is dropped at once; the rest is renewed at the next check-in"
        />
        <q-card-section class="q-gutter-y-md">
          <div class="row q-col-gutter-sm">
            <div class="col-12 col-sm-5">
              <RmmSelect
                v-model="scope"
                map-options
                :options="SCOPE_OPTIONS"
                label="Scope"
              />
            </div>
            <div
              v-if="scope === 'client' || scope === 'site'"
              class="col-12 col-sm-7"
            >
              <RmmSelect
                v-model="targetId"
                map-options
                filterable
                :options="targetOptions"
                :label="scope === 'site' ? 'Site' : 'Client'"
              />
            </div>
            <div v-else-if="scope === 'agent'" class="col-12 col-sm-7">
              <q-input
                v-model="agentId"
                dense
                outlined
                label="Agent id"
                input-class="rmm-mono"
              />
            </div>
          </div>
          <div>
            <div class="text-caption rmm-muted">What to rotate</div>
            <q-option-group
              v-model="what"
              type="checkbox"
              dense
              inline
              :options="ROTATE_OPTIONS"
            />
          </div>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat no-caps label="Cancel" v-close-popup />
          <q-btn
            unelevated
            no-caps
            color="negative"
            label="Rotate"
            :disable="!rotateReady"
            @click="confirmRotate"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-card>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useQuasar } from "quasar";
import DialogHeader from "@/components/ui/DialogHeader.vue";
import HelpTip from "@/components/ui/HelpTip.vue";
import RmmSelect from "@/components/ui/RmmSelect.vue";
import ConfirmYesDialog from "@/components/agents/ConfirmYesDialog.vue";
import { fetchClients } from "@/api/clients";
import {
  promotePins,
  rotateAgents,
  rotateCommandKey,
  type RotateWhat,
} from "@/api/security";
import { ROTATE_LABEL, ROTATE_OPTIONS } from "@/components/security/labels";
import { withStepUp } from "@/components/vault/stepUp";
import { SILENT_REQUEST_CONFIG } from "@/constants/constants";
import type { ClientWithSites } from "@/types/clients";

type Scope = "all" | "client" | "site" | "agent";

const SCOPE_OPTIONS: { value: Scope; label: string }[] = [
  { value: "all", label: "Whole fleet" },
  { value: "client", label: "Client" },
  { value: "site", label: "Site" },
  { value: "agent", label: "One agent" },
];

const emit = defineEmits<{ done: [] }>();
const $q = useQuasar();

const busy = ref<"" | "rotate" | "cmdkey" | "pins">("");
const result = ref("");
const clients = ref<ClientWithSites[]>([]);

const rotateOpen = ref(false);
const scope = ref<Scope>("all");
const targetId = ref<number | null>(null);
const agentId = ref("");
const what = ref<RotateWhat[]>(["session"]);

watch(scope, () => (targetId.value = null));

const targetOptions = computed(() =>
  scope.value === "client"
    ? clients.value.map((c) => ({ value: c.id, label: c.name }))
    : clients.value.flatMap((c) =>
        c.sites.map((s) => ({ value: s.id, label: `${c.name} / ${s.name}` })),
      ),
);
const targetName = computed(() => {
  if (scope.value === "all") return "every agent";
  if (scope.value === "agent") return `agent ${agentId.value.trim()}`;
  return (
    targetOptions.value.find((o) => o.value === targetId.value)?.label ?? ""
  );
});
const rotateReady = computed(
  () =>
    what.value.length > 0 &&
    (scope.value === "all" ||
      (scope.value === "agent"
        ? !!agentId.value.trim()
        : targetId.value !== null)),
);

// the server answers with counts, e.g. {"agents": 12, "queued": 12}
function countText(reply: unknown, fallback: string) {
  if (!reply || typeof reply !== "object") return fallback;
  const parts = Object.entries(reply as Record<string, unknown>)
    .filter(([, v]) => typeof v === "number")
    .map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`);
  return parts.length ? `${fallback} (${parts.join(", ")})` : fallback;
}

async function run(
  which: "rotate" | "cmdkey" | "pins",
  call: (config: { silent: boolean }) => Promise<unknown>,
  done: string,
) {
  busy.value = which;
  result.value = "";
  try {
    const reply = await withStepUp($q, call);
    if (reply === null) return;
    result.value = countText(reply, done);
    emit("done");
  } finally {
    busy.value = "";
  }
}

function openRotate() {
  rotateOpen.value = true;
}

function confirmRotate() {
  const picked = [...what.value];
  const payload = {
    scope: scope.value,
    ids:
      scope.value === "all"
        ? []
        : scope.value === "agent"
          ? [agentId.value.trim()]
          : [targetId.value as number],
    what: picked,
  };
  const name = targetName.value;
  rotateOpen.value = false;
  $q.dialog({
    component: ConfirmYesDialog,
    componentProps: {
      hostname: name,
      confirmText: scope.value === "all" ? "rotate everything" : "yes",
      actionVerb: "the rotation",
      title: `Rotate on ${name}`,
      okLabel: "Rotate",
      consequence: `${picked.map((w) => ROTATE_LABEL[w]).join(", ")}. The session is dropped at once; agents renew the rest at their next check-in, pending items show in the trust matrix until then.`,
    },
  }).onOk(() =>
    run(
      "rotate",
      (config) => rotateAgents(payload, config),
      `Rotation requested for ${name}`,
    ),
  );
}

function confirmRotateKey() {
  $q.dialog({
    title: "Rotate the command key?",
    message:
      "A new signing key is made and sent to the agents with the pin document. It becomes current once every agent knows it, at the latest after 24 hours.",
    cancel: { label: "Cancel", flat: true },
    ok: { label: "Rotate command key", color: "primary", noCaps: true },
    persistent: true,
  }).onOk(() => run("cmdkey", rotateCommandKey, "A new command key was made"));
}

function confirmPromote() {
  $q.dialog({
    title: "Promote the pins?",
    message:
      "The old backup pins are cleared and agents get a new pin document. The server refuses this unless its current certificate chain contains one of the backup pins.",
    cancel: { label: "Cancel", flat: true },
    ok: { label: "Promote pins", color: "primary", noCaps: true },
    persistent: true,
  }).onOk(() => run("pins", promotePins, "The pins were promoted"));
}

onMounted(async () => {
  try {
    clients.value = await fetchClients(SILENT_REQUEST_CONFIG);
  } catch {
    clients.value = [];
  }
});
</script>

<style scoped>
.emergency-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 16px;
}

.emergency-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: flex-start;
}

.emergency-item .q-btn {
  min-height: 42px;
}
</style>
