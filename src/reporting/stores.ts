// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

import { computed, onMounted, ref, type Ref } from "vue";

import { notifySuccess } from "@/utils/notify";
import * as api from "@/reporting/api";

import type {
  EmailReportRequest,
  ImportReportTemplateRequest,
  ReportDataQuery,
  ReportDataQueryBody,
  ReportDependencies,
  ReportHistory,
  ReportHTMLTemplate,
  ReportHTMLTemplateBody,
  ReportSchedule,
  ReportScheduleBody,
  ReportTemplate,
  ReportTemplateBody,
  VariableAnalysis,
} from "@/reporting/types";

// Loading and error state for a group of requests. Every operation clears
// the error flag when it starts and sets it when it fails; isLoading stays
// true while any of them is in flight. HTTP errors are toasted by the axios
// interceptor, so operations resolve to false instead of toasting again.
export function useRequestState() {
  const pending = ref(0);
  const isLoading = computed(() => pending.value > 0);
  const isError = ref(false);

  async function track(request: () => Promise<unknown>): Promise<boolean> {
    let ok = true;
    isError.value = false;
    pending.value += 1;
    try {
      await request();
    } catch (e) {
      console.error(e);
      ok = false;
    } finally {
      pending.value -= 1;
    }
    isError.value = !ok;
    return ok;
  }

  return { isLoading, isError, track };
}

// A newer list load wins over an older one that answers late.
function useLatest() {
  let sequence = 0;
  return async function <T>(load: () => Promise<T>, apply: (data: T) => void) {
    const request = ++sequence;
    const data = await load();
    if (request === sequence) apply(data);
  };
}

function replaceById<T extends { id: number }>(list: Ref<T[]>, item: T) {
  const index = list.value.findIndex((entry) => entry.id === item.id);
  if (index !== -1) list.value[index] = item;
  else list.value.push(item);
}

function removeById<T extends { id: number }>(list: Ref<T[]>, id: number) {
  list.value = list.value.filter((entry) => entry.id !== id);
}

// report templates

export function useReportTemplates() {
  const templates = ref<ReportTemplate[]>([]);
  const { isLoading, isError, track } = useRequestState();
  const latest = useLatest();

  // with dependsOn: only templates that share one of the names
  function getReportTemplates(dependsOn: string[] = []) {
    return track(() =>
      latest(
        () => api.fetchReportTemplates(dependsOn),
        (data) => (templates.value = data),
      ),
    );
  }

  function addReportTemplate(template: ReportTemplateBody) {
    return track(async () => {
      templates.value.push(await api.saveReportTemplate(template));
      notifySuccess("The report template was added successfully");
    });
  }

  // silent: no toast, used by auto-save and apply
  function editReportTemplate(
    id: number,
    template: Partial<ReportTemplateBody>,
    { silent = false } = {},
  ) {
    return track(async () => {
      replaceById(templates, await api.editReportTemplate(id, template));
      if (!silent) notifySuccess("The report template was edited successfully");
    });
  }

  function deleteReportTemplate(id: number) {
    return track(async () => {
      await api.removeReportTemplate(id);
      removeById(templates, id);
      notifySuccess("The report template was successfully removed");
    });
  }

  function importReportTemplate(request: ImportReportTemplateRequest) {
    return track(async () => {
      replaceById(templates, await api.importReportTemplate(request));
      notifySuccess("Report Template was successfully imported.");
    });
  }

  return {
    templates,
    getReportTemplates,
    importReportTemplate,
    addReportTemplate,
    editReportTemplate,
    deleteReportTemplate,
    isLoading,
    isError,
  };
}

// The Reports Manager, editors and schedule forms share this list. Filtered
// lists (Run Report) and report pages create their own with
// useReportTemplates().
export const useReportTemplatesShared = useReportTemplates();

export function useReportTemplateDropdown({ onMount = true } = {}) {
  const { templates, isLoading, getReportTemplates } = useReportTemplatesShared;

  const reportTemplateOptions = computed(() =>
    templates.value.map((template) => ({
      label: template.name,
      value: template.id,
    })),
  );

  if (onMount) onMounted(() => getReportTemplates());

  return { reportTemplateOptions, isLoading, getReportTemplates };
}

// variable analysis for the template editor; kept apart so a background
// analysis does not show the template table as loading
function useVariableAnalysis() {
  const variableAnalysis = ref<VariableAnalysis>({});
  const { isLoading, isError, track } = useRequestState();
  const latest = useLatest();

  function getVariableAnalysis(
    variables: string,
    dependencies: ReportDependencies = {},
  ) {
    return track(() =>
      latest(
        () => api.analyzeReportVariables(variables, dependencies),
        (data) => (variableAnalysis.value = data),
      ),
    );
  }

  return { variableAnalysis, isLoading, isError, getVariableAnalysis };
}

export const useVariableAnalysisShared = useVariableAnalysis();

// base templates

function useReportHTMLTemplates() {
  const htmlTemplates = ref<ReportHTMLTemplate[]>([]);
  const { isLoading, isError, track } = useRequestState();
  const latest = useLatest();

  function getReportHTMLTemplates() {
    return track(() =>
      latest(
        () => api.fetchReportHTMLTemplates(),
        (data) => (htmlTemplates.value = data),
      ),
    );
  }

  function addReportHTMLTemplate(template: ReportHTMLTemplateBody) {
    return track(async () => {
      htmlTemplates.value.push(await api.saveReportHTMLTemplate(template));
      notifySuccess("HTML Template was added successfully");
    });
  }

  function editReportHTMLTemplate(
    id: number,
    template: Partial<ReportHTMLTemplateBody>,
  ) {
    return track(async () => {
      replaceById(
        htmlTemplates,
        await api.editReportHTMLTemplate(id, template),
      );
      notifySuccess("HTML Template was edited successfully");
    });
  }

  function deleteReportHTMLTemplate(id: number) {
    return track(async () => {
      await api.removeReportHTMLTemplate(id);
      removeById(htmlTemplates, id);
      notifySuccess("The HTML template was successfully removed");
    });
  }

  return {
    htmlTemplates,
    isLoading,
    isError,
    getReportHTMLTemplates,
    addReportHTMLTemplate,
    editReportHTMLTemplate,
    deleteReportHTMLTemplate,
  };
}

export const useReportHTMLTemplatesShared = useReportHTMLTemplates();

// data queries

function useReportDataQueries() {
  const dataQueries = ref<ReportDataQuery[]>([]);
  const { isLoading, isError, track } = useRequestState();
  const latest = useLatest();

  function getReportDataQueries() {
    return track(() =>
      latest(
        () => api.fetchReportDataQueries(),
        (data) => (dataQueries.value = data),
      ),
    );
  }

  function addReportDataQuery(query: ReportDataQueryBody) {
    return track(async () => {
      dataQueries.value.push(await api.saveReportDataQuery(query));
      notifySuccess("Data Query was added successfully");
    });
  }

  function editReportDataQuery(
    id: number,
    query: Partial<ReportDataQueryBody>,
  ) {
    return track(async () => {
      replaceById(dataQueries, await api.editReportDataQuery(id, query));
      notifySuccess("Data Query was edited successfully");
    });
  }

  function deleteReportDataQuery(id: number) {
    return track(async () => {
      await api.removeReportDataQuery(id);
      removeById(dataQueries, id);
      notifySuccess("The Data Query was successfully removed");
    });
  }

  return {
    dataQueries,
    isLoading,
    isError,
    getReportDataQueries,
    addReportDataQuery,
    editReportDataQuery,
    deleteReportDataQuery,
  };
}

export const useReportDataQueriesShared = useReportDataQueries();

// schedules

function useReportSchedules() {
  const schedules = ref<ReportSchedule[]>([]);
  const { isLoading, isError, track } = useRequestState();
  const latest = useLatest();

  function getReportSchedules() {
    return track(() =>
      latest(
        () => api.fetchReportSchedules(),
        (data) => (schedules.value = data),
      ),
    );
  }

  function addReportSchedule(schedule: ReportScheduleBody) {
    return track(async () => {
      schedules.value.push(await api.saveReportSchedule(schedule));
      notifySuccess("Report Schedule was added successfully");
    });
  }

  function updateSchedule(id: number, schedule: Partial<ReportScheduleBody>) {
    return track(async () => {
      replaceById(schedules, await api.editReportSchedule(id, schedule));
      notifySuccess("Report Schedule was updated successfully");
    });
  }

  function removeSchedule(id: number) {
    return track(async () => {
      await api.removeReportSchedule(id);
      removeById(schedules, id);
      notifySuccess("Report Schedule was deleted successfully");
    });
  }

  function runReportSchedule(id: number) {
    return track(async () => {
      try {
        await api.runReportSchedule(id);
      } finally {
        // the server stamps last_run on failed runs as well
        getReportSchedules();
      }
      notifySuccess(
        "Report Schedule was run. Check the Report History for the status.",
        4000,
      );
    });
  }

  // one-off run and email from the schedule form in email-only mode
  function emailReport(templateId: number, body: EmailReportRequest) {
    return track(async () => {
      const message =
        "Report was generated and the email is queued for delivery";
      await api.emailReport(templateId, body);
      notifySuccess(message, 4000);
    });
  }

  const state = { schedules, isLoading, isError };

  return {
    getReportSchedules,
    emailReport,
    ...state,
    runReportSchedule,
    addReportSchedule,
    editReportSchedule: updateSchedule,
    deleteReportSchedule: removeSchedule,
  };
}

export const useReportSchedulesShared = useReportSchedules();

// history

function useReportHistory() {
  const history = ref<ReportHistory[]>([]);
  const { isLoading, isError, track } = useRequestState();
  const latest = useLatest();

  function getReportHistory() {
    return track(() =>
      latest(
        () => api.fetchReportHistory(),
        (data) => (history.value = data),
      ),
    );
  }

  function deleteReportHistory(id: number) {
    return track(async () => {
      await api.removeReportHistory(id);
      removeById(history, id);
      notifySuccess("Report History entry was deleted successfully");
    });
  }

  return {
    history,
    isLoading,
    isError,
    getReportHistory,
    deleteReportHistory,
  };
}

export const useReportHistoryShared = useReportHistory();
