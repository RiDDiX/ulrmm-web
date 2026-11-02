<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-td v-if="!Object.keys(result).length">
    <q-icon size="1.3rem" name="hourglass_empty" class="rmm-muted">
      <q-tooltip>Waiting for the first result from the agent</q-tooltip>
    </q-icon>
    <span class="sr-only">Not run yet</span>
  </q-td>
  <q-td v-else-if="result.status === 'passing'">
    <q-icon size="1.3rem" :color="colors.positive" name="check_circle">
      <q-tooltip>{{ passingTip }}</q-tooltip>
    </q-icon>
    <span class="sr-only">Passing</span>
  </q-td>
  <q-td v-else-if="result.status === 'failing'">
    <q-icon size="1.3rem" :color="failure.color" :name="failure.icon">
      <q-tooltip>Failing with {{ failure.level }} severity</q-tooltip>
    </q-icon>
    <span class="sr-only">Failing, {{ failure.level }} severity</span>
  </q-td>
  <q-td v-else></q-td>
</template>

<script setup>
import { computed } from "vue";
import { useStore } from "vuex";

const props = defineProps({
  result: { type: Object, required: true },
  severity: String,
  passingTip: { type: String, required: true },
});

const store = useStore();
const colors = computed(() => ({
  info: store.state.dash_info_color,
  positive: store.state.dash_positive_color,
  warning: store.state.dash_warning_color,
  negative: store.state.dash_negative_color,
}));

// anything but info and warning counts as error
const failure = computed(() => {
  if (props.severity === "info")
    return { level: "info", icon: "info", color: colors.value.info };
  if (props.severity === "warning")
    return { level: "warning", icon: "warning", color: colors.value.warning };
  return { level: "error", icon: "error", color: colors.value.negative };
});
</script>
