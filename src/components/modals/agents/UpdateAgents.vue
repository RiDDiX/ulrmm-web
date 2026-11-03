<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-card>
    <DialogHeader
      title-id="update-agents-title"
      title="Update agents"
      subtitle="Starts an agent update on the selected agents now"
    />

    <q-card-section class="q-pb-none">
      <q-banner dense class="bg-info">
        <template #avatar><q-icon name="info" /></template>
        {{ autoUpdateNote }}
      </q-banner>
    </q-card-section>

    <q-card-section v-if="version" class="q-pb-none">
      <div class="rmm-kv update-agents__kv">
        <div>Target version</div>
        <div class="rmm-mono">{{ version }}</div>
      </div>
      <div class="text-caption rmm-muted q-mt-xs">
        Agents that already run this version are skipped.
      </div>
    </q-card-section>

    <q-card-section v-show="version !== null">
      <div class="rmm-label">Select agents</div>
      <!-- same count and host list as the bulk action review -->
      <div v-if="picked.length" class="text-caption rmm-muted q-mt-xs">
        {{ picked.length }} selected:
        <span class="rmm-mono">{{ shownNames.join(", ") }}</span>
        <q-btn
          v-if="pickedNames.length > PREVIEW"
          :label="
            showAll ? 'Show fewer' : `and ${pickedNames.length - PREVIEW} more`
          "
          flat
          dense
          no-caps
          size="sm"
          @click="showAll = !showAll"
        />
      </div>

      <div class="row items-center q-gutter-sm q-my-sm">
        <q-input
          v-model="search"
          class="update-agents__search"
          placeholder="Search"
          aria-label="Search agents by hostname, client, site or ID"
          debounce="100"
          outlined
          dense
          clearable
        >
          <template #prepend>
            <q-icon name="search" />
          </template>
        </q-input>

        <div class="row items-center no-wrap">
          <q-checkbox
            v-model="selectAll"
            label="Select All"
            @update:model-value="toggleAll"
          />
          <HelpTip
            text="Selects every agent in the list below, as filtered by the search"
          />
        </div>

        <q-space />

        <q-btn
          v-show="picked.length !== 0"
          :label="`Update ${picked.length} agents`"
          color="primary"
          unelevated
          @click="update"
        />
      </div>

      <q-separator />

      <q-option-group
        v-if="agentOptions.length"
        v-model="picked"
        :options="agentOptions"
        type="checkbox"
        class="scroll"
        style="max-width: 40vw; max-height: 60vh"
        color="primary"
      />
      <EmptyState
        v-else
        icon="system_update"
        :title="search ? 'No agents match the search' : 'No agents'"
        :text="
          search
            ? 'Clear or change the search to see more agents.'
            : 'Agents you can manage show up here once they are installed.'
        "
      />
    </q-card-section>
  </q-card>
</template>

<script setup>
import { computed, onMounted, ref } from "vue";
import { useQuasar } from "quasar";
import axios from "axios";
import { notifySuccess } from "@/utils/notify";
import { deviceName } from "@/utils/deviceName";
import DialogHeader from "@/components/ui/DialogHeader.vue";
import EmptyState from "@/components/ui/EmptyState.vue";
import HelpTip from "@/components/ui/HelpTip.vue";

defineOptions({ name: "UpdateAgents" });
const emit = defineEmits(["close"]);

const autoUpdateNote =
  "If agent auto update is enabled in Global Settings, agents will " +
  "automatically self update at 35 min past the hour, every hour. " +
  "Use this tool to manually trigger an agent update cycle.";

const props = defineProps({
  // preselected in the fleet table; only agents that really need the update
  // (those in the fetched list) end up ticked
  initialAgentIds: { type: Array, default: () => [] },
});

const $q = useQuasar();
const PREVIEW = 10;

const version = ref(null);
const agents = ref([]);
const picked = ref([]);
const selectAll = ref(false);
const search = ref("");
const showAll = ref(false);

const visibleAgents = computed(() => {
  const term = search.value?.toLowerCase().trim();
  if (!term) return agents.value;
  return agents.value.filter((a) =>
    [deviceName(a), a.hostname, a.client, a.site, a.agent_id]
      .join(" ")
      .toLowerCase()
      .includes(term),
  );
});

const agentOptions = computed(() =>
  visibleAgents.value
    .map((a) => ({
      label: `${deviceName(a)} (${a.client} > ${a.site})`,
      value: a.agent_id,
    }))
    .sort((a, b) => a.label.localeCompare(b.label)),
);

const pickedNames = computed(() => {
  const names = new Map(agents.value.map((a) => [a.agent_id, deviceName(a)]));
  return picked.value.map((id) => names.get(id)).filter(Boolean);
});
const shownNames = computed(() =>
  showAll.value ? pickedNames.value : pickedNames.value.slice(0, PREVIEW),
);

function toggleAll() {
  picked.value = selectAll.value
    ? visibleAgents.value.map((a) => a.agent_id)
    : [];
}

async function load() {
  $q.loading.show();
  try {
    const { data } = await axios.get("/agents/versions/");
    version.value = data.versions[0];
    agents.value = data.agents;
    if (props.initialAgentIds.length) {
      const known = new Set(data.agents.map((a) => a.agent_id));
      picked.value = props.initialAgentIds.filter((id) => known.has(id));
    }
  } catch {
    // the interceptor reports it
  }
  $q.loading.hide();
}

async function update() {
  await axios.post("/agents/update/", { agent_ids: picked.value });
  emit("close");
  notifySuccess("Agents will now be updated");
}

onMounted(load);
</script>

<style scoped>
.update-agents__kv {
  grid-template-columns: max-content minmax(0, 1fr);
}

.update-agents__search {
  width: min(360px, 100%);
}
</style>
