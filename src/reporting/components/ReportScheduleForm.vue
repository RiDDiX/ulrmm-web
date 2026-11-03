<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-dialog ref="dialogRef" persistent @hide="onDialogHide">
    <q-card class="q-dialog-plugin rmm-dialog--md">
      <DialogHeader :title="title" close-tooltip="Close without saving" />
      <q-form @submit="submit">
        <div class="scroll" style="max-height: 70vh">
          <q-card-section class="q-gutter-y-sm">
            <div class="rmm-label">Report</div>
            <template v-if="!emailOnly">
              <q-input
                v-model="state.name"
                dense
                outlined
                label="Name"
                :rules="[required]"
              />
              <q-toggle v-model="state.enabled" dense label="Enabled">
                <q-tooltip>
                  Disabled schedules keep their settings but do not run
                </q-tooltip>
              </q-toggle>
            </template>
            <div class="row items-start no-wrap q-gutter-x-sm">
              <RmmSelect
                v-model="state.report_template"
                class="col"
                :options="reportTemplateOptions"
                label="Report Template"
                map-options
                filterable
                :loading="templatesLoading"
                :rules="[required]"
              />
              <q-btn
                v-if="dependsOn.length > 0"
                flat
                no-caps
                :color="missing.length > 0 ? 'warning' : 'primary'"
                :icon="missing.length > 0 ? 'warning' : undefined"
                label="Dependencies"
                style="margin-top: 2px"
                @click="editDependencies"
              >
                <q-tooltip>
                  {{
                    missing.length > 0
                      ? "This template needs values before it can run; set them here"
                      : "Change the client, site or agent values this report runs for"
                  }}
                </q-tooltip>
              </q-btn>
            </div>
            <div class="row items-center q-gutter-x-md">
              <span class="rmm-label">Format</span>
              <q-radio v-model="state.format" val="html" label="HTML" dense />
              <q-radio v-model="state.format" val="pdf" label="PDF" dense />
              <q-radio
                v-model="state.format"
                val="plaintext"
                label="Plain Text (or CSV)"
                dense
              />
            </div>
          </q-card-section>

          <q-card-section v-if="!emailOnly" class="q-gutter-y-sm">
            <div class="rmm-label">When</div>
            <div class="row items-start no-wrap q-gutter-x-sm">
              <RmmSelect
                v-model="state.schedule"
                class="col"
                :options="scheduleOptions"
                label="Schedule"
                map-options
                filterable
                hint="Its run times are managed in Global Settings > Schedules"
                hide-bottom-space
                :rules="[required]"
              />
              <q-btn
                flat
                no-caps
                color="primary"
                icon="fas fa-plus"
                label="Create new schedule"
                style="margin-top: 2px"
                @click="newSchedule"
              >
                <q-tooltip
                  >Open the schedule editor to add a new schedule</q-tooltip
                >
              </q-btn>
            </div>
            <RmmSelect
              v-model="state.timezone"
              :options="timezones"
              label="Timezone"
              filterable
              clearable
              :hint="`Time zone the schedule's run times are read in; blank uses ${defaultTimezone}`"
            />
          </q-card-section>

          <q-card-section class="q-gutter-y-sm">
            <div class="rmm-label">Email</div>
            <div v-if="!emailOnly" class="row items-center">
              <q-checkbox
                v-model="state.send_report_email"
                dense
                label="Send report via email"
              />
              <HelpTip
                text="When off, the report still runs and is kept in the run history, but no email goes out"
              />
            </div>
            <div class="row items-center q-gutter-x-xs">
              <span>Email recipients</span>
              <HelpTip :text="defaultRecipientsTip" />
              <q-space />
              <q-btn
                flat
                dense
                no-caps
                color="primary"
                icon="fas fa-plus"
                label="Add email"
                @click="addRecipient"
              />
            </div>
            <q-list v-if="state.email_recipients.length" dense bordered>
              <q-item v-for="email in state.email_recipients" :key="email">
                <q-item-section>{{ email }}</q-item-section>
                <q-item-section side>
                  <q-btn
                    flat
                    dense
                    round
                    size="sm"
                    color="negative"
                    icon="delete"
                    :aria-label="`Remove ${email}`"
                    @click="removeRecipient(email)"
                  >
                    <q-tooltip>Remove this recipient</q-tooltip>
                  </q-btn>
                </q-item-section>
              </q-item>
            </q-list>
            <div v-else class="rmm-muted text-caption">
              No recipients added yet. Emails will be sent to the default
              recipients from global settings. Adding recipients here will
              override those defaults.
            </div>
            <q-btn
              flat
              dense
              no-caps
              color="primary"
              icon="tune"
              label="Customize email content"
              @click="customizeEmail"
            >
              <q-tooltip
                >Subject, body and attachment name of the email</q-tooltip
              >
            </q-btn>
          </q-card-section>
        </div>

        <q-card-actions align="right">
          <q-btn flat no-caps label="Cancel" @click="onDialogCancel" />
          <q-btn
            v-bind="primaryBtn"
            type="submit"
            :label="emailOnly ? 'Send' : 'Save'"
            :loading="isLoading"
          />
        </q-card-actions>
      </q-form>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import { extend, useDialogPluginComponent, useQuasar } from "quasar";
import { fetchCoreSettings } from "@/api/core";
import { notifyWarning } from "@/utils/notify";
import { isValidEmail } from "@/utils/validation";
import RmmSelect from "@/components/ui/RmmSelect.vue";
import HelpTip from "@/components/ui/HelpTip.vue";
import DialogHeader from "@/components/ui/DialogHeader.vue";
import { useScheduleDropdown } from "@/core/settings/composables";
import ScheduleForm from "@/core/settings/components/ScheduleForm.vue";
import ReportEmailSettingsForm from "@/reporting/components/ReportEmailSettingsForm.vue";
import { promptDependencies } from "@/reporting/actions";
import {
  useReportSchedulesShared,
  useReportTemplateDropdown,
  useReportTemplatesShared,
} from "@/reporting/stores";
import { missingDependencies } from "@/reporting/utils";

import type {
  EmailSettings,
  ReportSchedule,
  ReportScheduleBody,
} from "@/reporting/types";

const props = defineProps<{
  emailOnly?: boolean;
  clone?: boolean;
  schedule?: ReportSchedule;
  // template id to preselect in the template dropdown
  reportTemplate?: number;
}>();

const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } =
  useDialogPluginComponent();
defineEmits([...useDialogPluginComponent.emits]);
const primaryBtn = { unelevated: true, "no-caps": true, color: "primary" };
const $q = useQuasar();
const { isLoading, addReportSchedule, editReportSchedule, emailReport } =
  useReportSchedulesShared;
const { templates } = useReportTemplatesShared;
const { reportTemplateOptions, isLoading: templatesLoading } =
  useReportTemplateDropdown();
const { scheduleOptions } = useScheduleDropdown();

const required = (value: unknown) => !!value || "*Required";

const editing = !!props.schedule && !props.clone;
const title = props.emailOnly
  ? "Email Report"
  : editing
    ? "Edit Report Schedule"
    : "Add Report Schedule";

function blankEmailSettings(): EmailSettings {
  const text = ["subject", "body", "attachment_name", "attachment_extension"];
  return {
    ...Object.fromEntries(text.map((key) => [key, ""])),
    include_report_link: false,
  } as EmailSettings;
}

function blankState(): ReportScheduleBody {
  return {
    name: "",
    enabled: true,
    format: "html",
    report_template: props.reportTemplate as number,
    email_recipients: [],
    send_report_email: true,
    schedule: null as unknown as number,
    dependencies: {},
    timezone: null,
    email_settings: blankEmailSettings(),
  };
}

function initialState(): ReportScheduleBody {
  if (!props.schedule) return blankState();
  const source: ReportSchedule = extend(true, {}, props.schedule);
  return {
    name: props.clone ? `${source.name} Copy` : source.name,
    enabled: source.enabled,
    format: source.format,
    report_template: source.report_template,
    schedule: source.schedule,
    send_report_email: source.send_report_email,
    email_recipients: source.email_recipients ?? [],
    dependencies: source.dependencies ?? {},
    timezone: source.timezone ?? null,
    email_settings: source.email_settings ?? {},
  };
}

const state = reactive<ReportScheduleBody>(initialState());

// looked up from the live list, so it is right once the list has loaded
const dependsOn = computed(
  () =>
    templates.value.find((template) => template.id === state.report_template)
      ?.depends_on ?? [],
);
const missing = computed(() =>
  missingDependencies(dependsOn.value, state.dependencies),
);

watch(
  () => state.report_template,
  () => (state.dependencies = {}),
);

async function editDependencies() {
  const values = await promptDependencies(dependsOn.value, state.dependencies);
  if (values) state.dependencies = values;
}

// core settings for time zones and default recipients

const timezones = ref<string[]>([]);
const defaultTimezone = ref("");
const defaultRecipients = ref<string[]>([]);

const defaultRecipientsTip = computed(() =>
  defaultRecipients.value.length
    ? `Default email recipients: ${defaultRecipients.value.join(", ")}`
    : "No email recipients configured",
);

onMounted(async () => {
  try {
    const settings = await fetchCoreSettings();
    timezones.value = settings.all_timezones ?? [];
    defaultTimezone.value = settings.default_time_zone ?? "";
    defaultRecipients.value = settings.email_alert_recipients ?? [];
  } catch (e) {
    console.error(e);
  }
});

// the shared list appends the created schedule, so it is picked here
function newSchedule() {
  $q.dialog({ component: ScheduleForm }).onOk(() => {
    const options = scheduleOptions.value;
    if (options.length) state.schedule = options[options.length - 1].value;
  });
}

function addRecipient() {
  $q.dialog({
    title: "Add email",
    prompt: { model: "", type: "email", isValid: isValidEmail },
    ok: { label: "Add" },
    cancel: true,
  }).onOk((email: string) => {
    const address = email.trim();
    if (!state.email_recipients.includes(address))
      state.email_recipients.push(address);
  });
}

function removeRecipient(email: string) {
  state.email_recipients = state.email_recipients.filter(
    (entry) => entry !== email,
  );
}

function customizeEmail() {
  $q.dialog({
    component: ReportEmailSettingsForm,
    componentProps: {
      emailSettings: state.email_settings,
      format: state.format,
    },
  }).onOk((settings: EmailSettings) => (state.email_settings = settings));
}

async function submit() {
  if (missing.value.length > 0) {
    notifyWarning(
      props.emailOnly
        ? "All required dependencies must be set before sending."
        : "All required dependencies must be set before saving.",
    );
    return;
  }

  let ok: boolean;
  if (props.emailOnly)
    ok = await emailReport(state.report_template, {
      format: state.format,
      email_recipients: state.email_recipients,
      dependencies: state.dependencies,
      email_settings: state.email_settings,
    });
  else if (editing)
    ok = await editReportSchedule(props.schedule!.id, { ...state });
  else ok = await addReportSchedule({ ...state });

  if (ok) onDialogOK();
}
</script>
