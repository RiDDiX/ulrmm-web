<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-list dense class="decision-menu">
    <q-item
      v-for="choice in DECISION_ORDER"
      :key="choice"
      v-close-popup
      clickable
      :active="current === choice"
      @click="emit('pick', choice)"
    >
      <q-item-section side>
        <q-icon
          size="xs"
          :name="decisionIcon(choice)"
          :color="decisionColor(choice, negative)"
        />
      </q-item-section>
      <q-item-section>
        <q-item-label>{{ decisionLabel(choice) }}</q-item-label>
        <q-item-label caption>{{ DECISION_HELP[choice] }}</q-item-label>
      </q-item-section>
    </q-item>
  </q-list>
</template>

<script setup>
// the decision list of one patch row: context menu and row actions button
import { computed } from "vue";
import { useStore } from "vuex";
import { DECISION_HELP, decisionLabel } from "@/utils/patchStatus";
import {
  DECISION_ORDER,
  decisionColor,
  decisionIcon,
} from "@/components/agents/patchDecision";

defineProps({ current: { type: String, default: null } });
const emit = defineEmits(["pick"]);

const vuex = useStore();
const negative = computed(() => vuex.state.dash_negative_color);
</script>

<style scoped>
.decision-menu {
  min-width: 260px;
  max-width: 320px;
}
</style>
