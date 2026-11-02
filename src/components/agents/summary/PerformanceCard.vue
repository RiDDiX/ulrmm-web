<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-card flat class="rmm-card performance-card">
    <div class="rmm-card__header">
      <div class="rmm-card__title">{{ title }}</div>
      <HelpTip v-if="help" :text="help" />
      <div v-if="updated" class="rmm-muted performance-card__updated">
        Updated {{ updated }}
      </div>
    </div>
    <div class="rmm-card__body performance-card__body">
      <div class="performance-card__ring" :style="ringStyle">
        <svg
          viewBox="0 0 44 44"
          aria-hidden="true"
          :class="strokeClass"
          :style="strokeStyle"
        >
          <circle class="performance-card__track" cx="22" cy="22" r="18" />
          <circle class="performance-card__value" cx="22" cy="22" r="18" />
        </svg>
        <strong class="rmm-num">{{ displayValue }}</strong>
      </div>

      <div class="performance-card__details">
        <svg
          v-if="sparklinePoints"
          class="performance-card__sparkline"
          :class="strokeClass"
          :style="strokeStyle"
          viewBox="0 0 120 32"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <polyline :points="sparklinePoints" />
        </svg>
        <div v-else class="performance-card__sparkline-empty rmm-muted">
          <span v-if="!message">Trend appears after the next sample</span>
        </div>
        <div v-if="context" class="performance-card__context">
          {{ context }}
        </div>
      </div>
    </div>

    <div v-if="message" class="performance-card__message">
      <span>{{ message }}</span>
      <q-btn
        v-if="retryable"
        outline
        dense
        no-caps
        color="primary"
        label="Retry"
        :loading="loading"
        @click="$emit('retry')"
      />
    </div>
    <q-inner-loading :showing="loading && value === null" color="primary" />
  </q-card>
</template>

<script setup>
import { computed } from "vue";
import HelpTip from "@/components/ui/HelpTip.vue";

const props = defineProps({
  title: { type: String, required: true },
  value: { type: Number, default: null },
  samples: { type: Array, default: () => [] },
  context: { type: String, default: "" },
  updated: { type: String, default: "" },
  message: { type: String, default: "" },
  retryable: Boolean,
  loading: Boolean,
  color: { type: String, default: "var(--rmm-accent)" },
  help: { type: String, default: "" },
});

defineEmits(["retry"]);

const percent = computed(() =>
  props.value === null ? 0 : Math.min(100, Math.max(0, props.value)),
);
const displayValue = computed(() =>
  props.value === null ? "—" : `${Math.round(props.value)}%`,
);
const ringStyle = computed(() => ({
  "--performance-offset": 113.1 - 1.131 * percent.value,
}));
// Quasar palette name (dashboard status colours) or a CSS colour.
// palette names only work via the text- class
const isCssColor = computed(() => /^(var\(|#|rgb|hsl)/.test(props.color));
const strokeClass = computed(() =>
  isCssColor.value ? undefined : `text-${props.color}`,
);
const strokeStyle = computed(() =>
  isCssColor.value ? { color: props.color } : undefined,
);
const sparklinePoints = computed(() => {
  if (props.samples.length < 2) return "";
  const denominator = props.samples.length - 1;
  return props.samples
    .map((sample, index) => {
      const x = (index / denominator) * 120;
      const y = 30 - (Math.min(100, Math.max(0, sample)) / 100) * 28;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
});
</script>

<style scoped>
.performance-card {
  min-height: 176px;
  height: 100%;
  position: relative;
}

.performance-card__updated {
  margin-left: auto;
  font-size: var(--rmm-fs-xs);
  white-space: nowrap;
}

.performance-card__body {
  display: flex;
  align-items: center;
  gap: 16px;
}

.performance-card__ring {
  width: 92px;
  height: 92px;
  flex: 0 0 92px;
  position: relative;
}

.performance-card__ring svg {
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}

.performance-card__ring circle {
  fill: none;
  stroke-width: 4;
}

.performance-card__track {
  stroke: var(--rmm-border);
}

.performance-card__value {
  stroke: currentColor;
  stroke-linecap: round;
  stroke-dasharray: 113.1;
  stroke-dashoffset: var(--performance-offset);
  transition: stroke-dashoffset 0.3s ease;
}

.performance-card__ring strong {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  font-size: 1.35rem;
  font-weight: 600;
}

.performance-card__details {
  min-width: 0;
  flex: 1;
}

.performance-card__sparkline {
  width: 100%;
  height: 42px;
}

.performance-card__sparkline polyline {
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 2;
  vector-effect: non-scaling-stroke;
}

.performance-card__sparkline-empty {
  height: 42px;
  display: flex;
  align-items: center;
  font-size: var(--rmm-fs-xs);
}

.performance-card__context {
  overflow: hidden;
  color: var(--rmm-text-muted);
  font-size: var(--rmm-fs-xs);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.performance-card__message {
  min-height: 34px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 4px 12px;
  border-top: 1px solid var(--rmm-border);
  color: var(--rmm-text-muted);
  background: var(--rmm-surface-2);
  font-size: var(--rmm-fs-xs);
}

@media (max-width: 520px) {
  .performance-card__body {
    align-items: flex-start;
  }

  .performance-card__ring {
    width: 74px;
    height: 74px;
    flex-basis: 74px;
  }
}
</style>
