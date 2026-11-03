<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-dialog
    ref="dialogRef"
    aria-labelledby="schedule-form-title"
    @hide="onDialogHide"
  >
    <q-card class="q-dialog-plugin rmm-dialog--lg">
      <DialogHeader
        title-id="schedule-form-title"
        :title="schedule ? `Edit ${schedule.name}` : 'New schedule'"
        subtitle="A maintenance window installs approved updates; sleep and wake schedules manage power"
      />
      <q-form @submit="submit">
        <q-card-section class="scroll" style="max-height: 72vh">
          <div class="row q-col-gutter-md">
            <div class="col-12 col-md-7 q-gutter-y-sm">
              <q-input
                v-model="form.name"
                label="Name"
                maxlength="255"
                dense
                outlined
                :rules="[(v) => !!v?.trim() || 'Required']"
              />
              <div>
                <div class="row items-center q-gutter-xs q-mb-xs">
                  <span id="schedule-kind-label" class="rmm-label">Kind</span>
                  <HelpTip
                    text="What the schedule does to its devices. Each kind needs the permissions named below."
                  />
                </div>
                <q-btn-toggle
                  v-model="form.kind"
                  :options="KIND_OPTIONS"
                  aria-label="Kind"
                  no-caps
                  unelevated
                  spread
                  toggle-color="primary"
                  class="schedule-toggle schedule-toggle--fit"
                />
                <div class="rmm-muted text-caption q-mt-xs">
                  {{ KIND_HINTS[form.kind] }}
                </div>
              </div>

              <div class="text-subtitle2 q-pt-sm">When</div>
              <div>
                <div class="row items-center q-gutter-xs q-mb-xs">
                  <span class="rmm-label">Repeat</span>
                  <HelpTip
                    text="Once runs on each picked date; the others repeat until the Until date, if set"
                  />
                </div>
                <q-btn-toggle
                  v-model="form.frequency"
                  :options="FREQUENCIES"
                  aria-label="Repeat"
                  no-caps
                  unelevated
                  spread
                  toggle-color="primary"
                  class="schedule-toggle"
                />
              </div>
              <div class="row q-col-gutter-sm">
                <q-input
                  v-model="form.run_time"
                  class="col-6"
                  type="time"
                  label="Start (device time zone)"
                  hint="Each device starts at this local time"
                  stack-label
                  dense
                  outlined
                  :rules="[(v) => !!v || 'Required']"
                />
                <q-input
                  v-model.number="form.duration"
                  class="col-6"
                  type="number"
                  :label="DURATION_LABELS[form.kind]"
                  :hint="DURATION_HINTS[form.kind]"
                  suffix="min"
                  min="5"
                  max="360"
                  dense
                  outlined
                  :rules="[(v) => (v >= 5 && v <= 360) || '5 to 360 minutes']"
                />
              </div>
              <div v-if="form.frequency === 'weekly'">
                <div class="rmm-label q-mb-xs">On these days</div>
                <q-option-group
                  v-model="form.weekdays"
                  :options="WEEKDAY_OPTIONS"
                  type="checkbox"
                  inline
                  dense
                />
              </div>
              <template v-if="form.frequency === 'monthly'">
                <q-option-group
                  v-model="monthlyMode"
                  :options="MONTHLY_MODES"
                  inline
                  dense
                />
                <q-input
                  v-if="monthlyMode === 'day'"
                  v-model.number="form.month_day"
                  type="number"
                  min="1"
                  max="31"
                  label="Day of the month"
                  hint="31 runs on the last day of shorter months"
                  dense
                  outlined
                />
                <div v-else class="row q-col-gutter-sm">
                  <q-select
                    v-model="form.month_week"
                    class="col-6"
                    :options="MONTH_WEEKS"
                    label="Week"
                    hint="Fourth and Last differ in months with five of that weekday"
                    emit-value
                    map-options
                    dense
                    outlined
                  />
                  <q-select
                    v-model="form.month_weekday"
                    class="col-6"
                    :options="WEEKDAY_OPTIONS"
                    label="Weekday"
                    emit-value
                    map-options
                    dense
                    outlined
                  />
                </div>
              </template>
              <div v-if="form.frequency !== 'once'">
                <div class="row items-center q-gutter-xs q-mb-xs">
                  <span class="rmm-label">Active between (optional)</span>
                  <HelpTip
                    text="No run starts before From or after Until; leave both empty for no limit"
                  />
                </div>
                <div class="row q-col-gutter-sm">
                  <q-input
                    v-model="form.start_date"
                    class="col-6"
                    type="date"
                    label="From"
                    stack-label
                    clearable
                    dense
                    outlined
                  />
                  <q-input
                    v-model="form.end_date"
                    class="col-6"
                    type="date"
                    label="Until"
                    stack-label
                    clearable
                    dense
                    outlined
                  />
                </div>
              </div>
              <div>
                <q-toggle v-model="form.enabled" label="Enabled" />
                <div class="rmm-muted text-caption">
                  Turned off, the schedule is kept but never runs.
                </div>
              </div>

              <div class="row items-center q-gutter-xs q-pt-sm">
                <span class="text-subtitle2">Targets</span>
                <HelpTip
                  text="All agents in these clients and sites plus picked agents, resolved at each run"
                />
              </div>
              <rmm-select
                v-model="form.clients"
                :options="clientOptions"
                label="Clients"
                multiple
                map-options
                filterable
              />
              <rmm-select
                v-model="form.sites"
                :options="siteOptions"
                label="Sites"
                multiple
                map-options
                filterable
              />
              <rmm-select
                v-model="form.agents"
                :options="agentOptions"
                label="Agents"
                multiple
                map-options
                filterable
              />
            </div>

            <div class="col-12 col-md-5 q-gutter-y-sm">
              <template v-if="form.frequency === 'once'">
                <div class="row items-center q-gutter-xs">
                  <span class="text-subtitle2">Dates</span>
                  <HelpTip
                    text="Pick one or more dates; the schedule runs once on each"
                  />
                </div>
                <q-date
                  v-model="form.dates"
                  multiple
                  minimal
                  mask="YYYY-MM-DD"
                  first-day-of-week="1"
                />
              </template>
              <template v-else>
                <div class="row items-center q-gutter-xs">
                  <span class="text-subtitle2">Skip these dates</span>
                  <HelpTip
                    text="Exceptions: no run starts on a date picked here, for example public holidays"
                  />
                </div>
                <q-date
                  v-model="form.excluded_dates"
                  multiple
                  minimal
                  mask="YYYY-MM-DD"
                  first-day-of-week="1"
                />
              </template>

              <div class="schedule-preview">
                <div class="text-subtitle2">Next runs</div>
                <div class="rmm-muted text-caption q-mb-xs">
                  In {{ preview.timezone || "the server time zone" }}. A device
                  with its own time zone runs at the same local time.
                </div>
                <div v-if="previewLoading" class="rmm-muted">
                  Calculating...
                </div>
                <ol v-else-if="preview.runs.length" class="q-pl-md q-my-none">
                  <li v-for="r in preview.runs" :key="r.start" class="rmm-num">
                    {{ formatRun(r.start, preview.timezone) }}
                  </li>
                </ol>
                <div v-else class="rmm-muted">
                  {{
                    previewReady ? "No upcoming runs" : "Complete the schedule"
                  }}
                </div>
              </div>
            </div>
          </div>
        </q-card-section>
        <DialogActions :loading="saving" @cancel="onDialogCancel" />
      </q-form>
    </q-card>
  </q-dialog>
</template>

<script setup>
import DialogActions from "@/components/ui/DialogActions.vue";
import { computed, onMounted, reactive, ref, watch } from "vue";
import { useDialogPluginComponent } from "quasar";
import DialogHeader from "@/components/ui/DialogHeader.vue";
import RmmSelect from "@/components/ui/RmmSelect.vue";
import HelpTip from "@/components/ui/HelpTip.vue";
import { previewSchedule, saveSchedule } from "@/api/maintenance";
import { useAgentDropdown } from "@/composables/agents";
import { useClientDropdown, useSiteDropdown } from "@/composables/clients";
import {
  KIND_OPTIONS,
  MONTH_WEEKS,
  WEEKDAYS,
  formatRun,
} from "@/utils/maintenance";
import { notifySuccess } from "@/utils/notify";

const props = defineProps({
  // null => new
  schedule: { type: Object, default: null },
});
defineEmits([...useDialogPluginComponent.emits]);
const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } =
  useDialogPluginComponent();

const KIND_HINTS = {
  maintenance:
    "Wakes every device, keeps it awake, scans and installs the approved updates. Afterwards only a device the window woke goes back to sleep, never a server, and only after 15 minutes without input. Needs Manage Patch Policies, Wake-Up (WoL) Agents and Shutdown / Reboot / Sleep Agents.",
  sleep:
    "Puts a device to sleep once it has had 15 minutes without input. Servers never sleep. Needs Shutdown / Reboot / Sleep Agents.",
  wake: "Sends Wake-on-LAN and keeps the device awake for the duration. Needs Wake-Up (WoL) Agents.",
};
const DURATION_LABELS = {
  maintenance: "Window length",
  sleep: "Keep trying for",
  wake: "Keep awake for",
};
const DURATION_HINTS = {
  maintenance: "How long the window stays open, 5 to 360 minutes",
  sleep: "How long to keep waiting for the device to be idle, 5 to 360 minutes",
  wake: "How long the device is kept awake, 5 to 360 minutes",
};
const FREQUENCIES = [
  { value: "once", label: "Once" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];
const MONTHLY_MODES = [
  { value: "day", label: "On a day of the month" },
  { value: "weekday", label: "On a weekday of the month" },
];
const WEEKDAY_OPTIONS = WEEKDAYS.map((label, value) => ({ label, value }));

// snapshot copy once on open
function initialForm() {
  const s = props.schedule;
  return {
    name: s?.name ?? "",
    kind: s?.kind ?? "maintenance",
    enabled: s?.enabled ?? true,
    frequency: s?.frequency ?? "weekly",
    run_time: (s?.run_time ?? "03:00").slice(0, 5),
    dates: [...(s?.dates ?? [])],
    weekdays: [...(s?.weekdays ?? [1])],
    month_day: s?.month_day ?? null,
    month_week: s?.month_week ?? 2,
    month_weekday: s?.month_weekday ?? 1,
    duration: s?.duration ?? 120,
    start_date: s?.start_date ?? null,
    end_date: s?.end_date ?? null,
    excluded_dates: [...(s?.excluded_dates ?? [])],
    agents: [...(s?.agents ?? [])],
    sites: [...(s?.sites ?? [])],
    clients: [...(s?.clients ?? [])],
  };
}
const form = reactive(initialForm());
const monthlyMode = ref(form.month_day ? "day" : "weekday");
const saving = ref(false);

const { agentOptions, getAgentOptions } = useAgentDropdown();
const { clientOptions, getClientOptions } = useClientDropdown();
const { siteOptions, getSiteOptions } = useSiteDropdown();

function payload() {
  const byDay = monthlyMode.value === "day";
  return {
    ...form,
    name: form.name.trim(),
    // q-date multiple can be null
    dates: form.dates || [],
    excluded_dates: form.excluded_dates || [],
    start_date: form.start_date || null,
    end_date: form.end_date || null,
    month_day: byDay ? form.month_day : null,
    month_week: byDay ? null : form.month_week,
    month_weekday: byDay ? null : form.month_weekday,
  };
}

// debounce: ask preview only when valid (no toast spam per key)
const previewReady = computed(() => {
  const p = payload();
  if (!p.run_time || !(p.duration >= 5 && p.duration <= 360)) return false;
  if (p.frequency === "once") return p.dates.length > 0;
  if (p.frequency === "weekly") return p.weekdays.length > 0;
  if (p.frequency === "monthly")
    return monthlyMode.value === "day"
      ? p.month_day >= 1 && p.month_day <= 31
      : p.month_week !== null && p.month_weekday !== null;
  return true;
});

const preview = reactive({ timezone: "", runs: [] });
const previewLoading = ref(false);
let previewTimer;
let previewGeneration = 0;

watch(
  [form, monthlyMode],
  () => {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(loadPreview, 400);
  },
  { deep: true, immediate: true },
);

async function loadPreview() {
  const generation = ++previewGeneration;
  if (!previewReady.value) {
    preview.runs = [];
    return;
  }
  previewLoading.value = true;
  try {
    const p = payload();
    // the serializer requires a name, which has no say in the next runs
    const data = await previewSchedule({
      ...p,
      name: p.name || "preview",
      agents: [],
      sites: [],
      clients: [],
    });
    if (generation !== previewGeneration) return;
    preview.timezone = data.timezone;
    preview.runs = data.runs;
  } catch {
    if (generation === previewGeneration) preview.runs = [];
  } finally {
    if (generation === previewGeneration) previewLoading.value = false;
  }
}

async function submit() {
  saving.value = true;
  try {
    await saveSchedule(props.schedule?.id, payload());
    notifySuccess(`${form.name.trim()} was saved`);
    onDialogOK();
  } catch {
    // the error toast comes from the axios boot
  }
  saving.value = false;
}

onMounted(() => {
  for (const load of [getSiteOptions, getClientOptions, getAgentOptions])
    load();
});
</script>

<style scoped>
.schedule-toggle {
  border: 1px solid var(--rmm-border-strong);
  border-radius: var(--rmm-radius-sm);
}

/* buttons grow from their label width, so "Maintenance window" stays on one line */
.schedule-toggle--fit :deep(.q-btn-item) {
  flex: 1 1 auto;
}

.schedule-preview {
  padding: 10px 12px;
  border: 1px solid var(--rmm-border);
  border-radius: var(--rmm-radius);
  background: var(--rmm-surface-2);
}
</style>
