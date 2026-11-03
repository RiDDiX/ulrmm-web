<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-td class="rmm-ellipsis-td">
    <div class="check-more-info">
      <a
        v-if="hasRun"
        v-bind="LINK"
        @click.prevent="openHistory"
        @keydown.space.prevent="openHistory"
        >Run history</a
      >
      <a
        v-if="output"
        v-bind="LINK"
        :class="{ 'rmm-ellipsis-cell__text': output.clip }"
        @click.prevent="output.open"
        @keydown.space.prevent="output.open"
        >{{ output.text }}</a
      >
      <span v-else-if="plainText" class="rmm-ellipsis-cell__text">{{
        info
      }}</span>
    </div>
    <q-tooltip v-if="info">{{ info }}</q-tooltip>
  </q-td>
</template>

<script setup>
import { computed } from "vue";
import { useQuasar } from "quasar";
import ScriptOutput from "../checks/ScriptOutput.vue";
import EventLogCheckOutput from "../checks/EventLogCheckOutput.vue";
import CheckGraph from "../graphs/CheckGraph.vue";
import PreDialog from "@/components/ui/PreDialog.vue";

// the "More info" cell of the checks tab: run history, a link to the last
// output where there is one, else the result text
const props = defineProps({
  check: { type: Object, required: true },
});

const LINK = { href: "#", role: "button", class: "rmm-link" };
const FALLBACK = "Last Output";
const PING_DIALOG_STYLE = "width: 50vw; max-width: 60vw";
// kinds whose result text is shown as is; the second group only after a run
const TEXT_KINDS = [
  "diskspace",
  "cpuload",
  "memory",
  "security",
  "hwhealth",
  "metric",
];
const TEXT_KINDS_AFTER_RUN = ["winsvc", "systemd", "container"];

const $q = useQuasar();
const show = (component, componentProps) =>
  $q.dialog({ component, componentProps });

// the ping statistics lines, e.g. "4 packets transmitted, 4 received, 0% packet loss"
function pingSummary(text) {
  if (typeof text !== "string") return FALLBACK;
  const stats = text
    .split("\n")
    .filter((line) =>
      ["transmitted", "received", "packet loss"].every((word) =>
        line.includes(word),
      ),
    );
  return stats.length ? stats.join("\n") : FALLBACK;
}

// the start of stdout, or of stderr when stdout is empty
function outputStart(result) {
  const text = [result.stdout, result.stderr].find(
    (s) => typeof s === "string" && s.trim(),
  );
  return text ? text.substring(0, 60) : FALLBACK;
}

const result = computed(() => props.check.check_result);
const info = computed(() => result.value.more_info);
const hasRun = computed(() => !!result.value.id);

const output = computed(() => {
  if (!hasRun.value) return null;
  const check = props.check;
  const res = result.value;
  switch (check.check_type) {
    case "ping":
      return {
        text: pingSummary(res.more_info),
        clip: true,
        open: () =>
          show(PreDialog, {
            title: check.readable_desc,
            message: res.more_info,
            dialogStyle: PING_DIALOG_STYLE,
          }),
      };
    case "script":
      return {
        text: outputStart(res),
        clip: true,
        open: () => show(ScriptOutput, { scriptInfo: res }),
      };
    case "eventlog":
      return {
        text: FALLBACK,
        clip: false,
        open: () => show(EventLogCheckOutput, { evtLogData: check }),
      };
    default:
      return null;
  }
});

const plainText = computed(() => {
  const kind = props.check.check_type;
  if (TEXT_KINDS.includes(kind)) return true;
  return TEXT_KINDS_AFTER_RUN.includes(kind) && hasRun.value;
});

const openHistory = () => show(CheckGraph, { check: props.check });
</script>

<style scoped>
/* "Run history" never shrinks; the result beside it gets the rest of the
   column and is cut with an ellipsis */
.check-more-info {
  display: flex;
  gap: 12px;
}

.check-more-info > a:first-child {
  flex: none;
}

.check-more-info > .rmm-ellipsis-cell__text {
  min-width: 0;
}
</style>
