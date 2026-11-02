<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <div class="scroll" :style="{ 'max-height': tabHeight - 10 }">
    <EmptyState
      v-if="!info || info.length === 0"
      icon="inventory"
      title="Nothing collected for this category"
      text="Use Re-collect on the summary to ask the agent for fresh hardware details."
    />
    <template v-else>
      <div v-for="i in info" :key="i + uid()">
        <div v-for="j in i" :key="j + uid()" class="rmm-kv q-pa-sm">
          <template v-for="(v, k) in j" :key="v + uid()">
            <span>{{ k }}</span>
            <span class="wmi-detail__value">
              {{ formatWmiValue(v) }}
              <q-btn
                v-if="!!v"
                size="sm"
                class="q-ml-xs wmi-detail__copy"
                flat
                round
                dense
                icon="content_copy"
                :aria-label="`Copy ${k}`"
                @click="copyValueToClip(v)"
              >
                <q-tooltip>Copy value to clipboard</q-tooltip>
              </q-btn>
            </span>
          </template>
        </div>
        <q-separator v-if="info.length > 1" />
      </div>
    </template>
  </div>
</template>

<script>
import { copyToClipboard } from "quasar";
import { notifySuccess } from "@/utils/notify";
// composition imports
import { computed } from "vue";
import { useStore } from "vuex";
import { uid } from "quasar";
import EmptyState from "@/components/ui/EmptyState.vue";

// WMI's own datetime format: YYYYMMDDHHMMSS.ffffff+UUU (UUU = minutes from
// UTC); only the date/time part is parsed, the offset is dropped like the
// rest of this page already treats every other timestamp in local time
const WMI_DATETIME = /^(\d{14})\.\d{6}[+-]\d{1,4}$/;

export default {
  name: "WmiDetail",
  components: { EmptyState },
  props: { info: !Object },
  setup() {
    // setup vuex
    const store = useStore();
    const tabHeight = computed(() => store.state.tabHeight);

    function formatWmiValue(value) {
      if (typeof value !== "string") return value;
      const match = value.match(WMI_DATETIME);
      if (!match) return value;
      const [, s] = match;
      const parsed = new Date(
        `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T${s.slice(8, 10)}:${s.slice(10, 12)}:${s.slice(12, 14)}`,
      );
      return Number.isNaN(parsed.getTime())
        ? value
        : store.getters.formatDate(parsed);
    }

    function copyValueToClip(val) {
      copyToClipboard(val).then(() => {
        notifySuccess("Copied to clipboard");
      });
    }

    return {
      tabHeight,
      uid,
      formatWmiValue,
      copyValueToClip,
    };
  },
};
</script>

<style scoped>
.wmi-detail__value {
  min-width: 0;
  overflow-wrap: anywhere;
}

.wmi-detail__copy {
  color: var(--rmm-text-subtle);
}
</style>
