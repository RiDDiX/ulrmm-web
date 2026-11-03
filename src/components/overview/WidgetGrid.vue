<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <div>
    <div class="widget-grid">
      <WidgetCard
        v-for="(widget, index) in widgets"
        :key="widget.id"
        :widget="widget"
        :index="index"
        :count="widgets.length"
        :tick="tick"
        @move="(where) => move(widget, where)"
        @resize="(size) => update(resizeWidget(widgets, widget.id, size))"
        @remove="remove(widget, index)"
        @settings="(s) => update(setSettings(widgets, widget.id, s))"
      />
    </div>
    <div class="sr-only" aria-live="polite">{{ announcement }}</div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, ref } from "vue";
import { useQuasar } from "quasar";
import WidgetCard from "./WidgetCard.vue";
import {
  moveWidget,
  removeWidget,
  resizeWidget,
  setSettings,
  widgetMeta,
  type MoveTarget,
  type Widget,
} from "@/utils/overview";

const props = defineProps<{ widgets: Widget[]; tick: number }>();
const emit = defineEmits<{ "update:widgets": [widgets: Widget[]] }>();

const $q = useQuasar();
const announcement = ref("");

const label = (widget: Widget) => widgetMeta(widget.type)?.label || widget.type;

function update(widgets: Widget[]) {
  emit("update:widgets", widgets);
}

// the card is re-inserted by the move, so its button loses focus
function focusMove(id: string | undefined) {
  if (!id) return;
  nextTick(() =>
    document.querySelector<HTMLElement>(`[data-move="${id}"]`)?.focus(),
  );
}

function move(widget: Widget, where: MoveTarget) {
  const next = moveWidget(props.widgets, widget.id, where);
  if (next === props.widgets) return;
  update(next);
  const position = next.findIndex((w) => w.id === widget.id) + 1;
  announcement.value = `${label(widget)} moved to position ${position} of ${next.length}.`;
  focusMove(widget.id);
}

function remove(widget: Widget, index: number) {
  const apply = () => {
    const next = removeWidget(props.widgets, widget.id);
    update(next);
    announcement.value = `${label(widget)} removed.`;
    focusMove((next[index] ?? next[index - 1])?.id);
  };
  // the note text is only stored here
  if (widget.type === "notes" && String(widget.settings.text || "").trim()) {
    $q.dialog({
      title: "Remove this note?",
      message: "Its text is deleted with it.",
      cancel: { flat: true, noCaps: true, label: "Cancel" },
      ok: {
        unelevated: true,
        noCaps: true,
        color: "negative",
        label: "Remove",
      },
    }).onOk(apply);
  } else {
    apply();
  }
}
</script>

<style scoped>
.widget-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 16px;
}

/* under 1440 px a medium card is one of two columns, so two sit side by side */
@media (min-width: 600px) {
  .widget-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .widget-card--l {
    grid-column: span 2;
  }
}

@media (min-width: 1440px) {
  .widget-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
  .widget-card--m {
    grid-column: span 2;
  }
  .widget-card--l {
    grid-column: span 4;
  }
}
</style>
