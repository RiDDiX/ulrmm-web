<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<script setup>
import { computed, onMounted, ref } from "vue";
import { useStore } from "vuex";
import { endpoint } from "@/api/http";
import { serverErrors } from "@/components/vault/stepUp";
import { NO_VALUE } from "@/utils/format";

const props = defineProps({
  agentId: { type: String, required: true },
  // keep_last, gfs and timezone as they stand in the form
  config: { type: Object, required: true },
});
const emit = defineEmits(["close"]);
const store = useStore();
const formatDate = computed(() => store.getters.formatDate);
const api = endpoint("/imaging");
const reply = ref(null);
const error = ref("");

onMounted(async () => {
  try {
    reply.value = await api.post(
      "/retention/preview/",
      { agent_id: props.agentId, config: props.config },
      { silent: true },
    );
  } catch (e) {
    error.value = serverErrors(e).message;
  }
});
</script>

<template>
  <q-dialog :model-value="true" @update:model-value="emit('close')">
    <q-card class="q-pa-md" style="width: 760px; max-width: 94vw">
      <h3 class="text-h6">Retention preview</h3>
      <p v-if="error" class="text-negative" role="alert">{{ error }}</p>
      <p v-else-if="!reply" role="status">
        <q-spinner size="1em" class="q-mr-sm" />Computing...
      </p>
      <template v-else>
        <p class="rmm-muted">
          Periods are counted in {{ reply.timezone }}. Points marked delete are
          removed by the next retention pass.
        </p>
        <q-markup-table flat dense class="rmm-table" aria-label="Points">
          <thead>
            <tr>
              <th class="text-left">Point</th>
              <th class="text-left">Status</th>
              <th class="text-left">Kept by</th>
              <th class="text-left">Result</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="point in reply.points" :key="point.id">
              <td>
                {{ point.at ? formatDate(point.at) : NO_VALUE }}
              </td>
              <td>{{ point.status }}</td>
              <td class="retention-kept">
                {{ point.kept_by.join(", ") || NO_VALUE }}
              </td>
              <td>
                <span
                  class="rmm-pill"
                  :class="
                    point.action === 'keep'
                      ? 'rmm-pill--positive'
                      : 'rmm-pill--negative'
                  "
                  >{{ point.action === "keep" ? "Keep" : "Delete" }}</span
                >
              </td>
            </tr>
          </tbody>
        </q-markup-table>
        <p v-if="!reply.points.length" class="rmm-muted">No points yet.</p>
      </template>
      <q-card-actions align="right">
        <q-btn v-close-popup flat label="Close" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<style scoped>
/* the reasons wrap, so the Result column stays inside the dialog */
.retention-kept {
  white-space: normal;
  min-width: 160px;
}
</style>
