// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

import { Dialog, exportFile } from "quasar";

import type { RouteLocationRaw } from "vue-router";

import { router } from "@/router";
import { notifyError } from "@/utils/notify";
import * as api from "@/reporting/api";
import {
  cleanFileName,
  historyFileName,
  missingDependencies,
  reportHistoryLocation,
  reportLocation,
  templateFileName,
} from "@/reporting/utils";
import ReportDependencyPrompt from "@/reporting/components/ReportDependencyPrompt.vue";

import type {
  ReportDependencies,
  ReportFormat,
  ReportHistory,
  ReportOutput,
  ReportTemplate,
} from "@/reporting/types";

// resolves to the merged values, or null when the prompt was closed
export function promptDependencies(
  dependsOn: string[],
  values: ReportDependencies = {},
): Promise<ReportDependencies | null> {
  return new Promise((resolve) => {
    let result: ReportDependencies | null = null;
    Dialog.create({
      component: ReportDependencyPrompt,
      componentProps: { dependsOn, values },
    })
      .onOk((data: ReportDependencies) => (result = data))
      .onDismiss(() => resolve(result));
  });
}

function promptFileName(name: string): Promise<string | null> {
  return new Promise((resolve) => {
    let result: string | null = null;
    Dialog.create({
      title: "Confirm File Name",
      prompt: {
        model: name,
        type: "text",
        isValid: (value: string) => value.trim() !== "",
      },
      cancel: true,
      persistent: true,
    })
      .onOk((value: string) => (result = value))
      .onDismiss(() => resolve(result));
  });
}

function save(fileName: string, data: Blob | string, mimeType?: string) {
  const status = exportFile(fileName, data, mimeType ? { mimeType } : {});
  if (status !== true) notifyError("The browser blocked the download.");
  return status === true;
}

const MIME_TYPES: Record<ReportFormat, string> = {
  pdf: "application/pdf",
  html: "text/html",
  plaintext: "text/plain",
};

function saveOutput(
  fileName: string,
  output: ReportOutput,
  format: ReportFormat,
) {
  return save(fileName, output, MIME_TYPES[format]);
}

// new tabs keep the opener, so the browser copies the session (and with it
// the sign-in) into the tab
function openInNewTab(location: RouteLocationRaw) {
  window.open(router.resolve(location).href, "_blank");
}

export function openReport(
  template: Pick<ReportTemplate, "id" | "depends_on">,
  format: ReportFormat,
  dependencies: ReportDependencies = {},
) {
  openInNewTab(
    reportLocation(template.id, format, template.depends_on, dependencies),
  );
}

export function openHistoryReport(id: number, format: ReportFormat) {
  openInNewTab(reportHistoryLocation(id, format));
}

// Asks for a file name and any missing values, runs the template and saves
// the result. A cancelled prompt ends the flow without a request.
export async function downloadReport(
  template: Pick<ReportTemplate, "id" | "name" | "depends_on">,
  format: ReportFormat,
  presets: ReportDependencies = {},
): Promise<boolean> {
  const fileName = await promptFileName(
    templateFileName(template.name, format),
  );
  if (!fileName) return false;

  let dependencies = { ...presets };
  const missing = missingDependencies(template.depends_on, dependencies);
  if (missing.length > 0) {
    const values = await promptDependencies(missing, dependencies);
    if (!values) return false;
    dependencies = values;
  }

  try {
    const output = await api.runReport(template.id, { format, dependencies });
    return saveOutput(fileName, output, format);
  } catch (e) {
    // the interceptor shows the server message
    console.error(e);
    return false;
  }
}

export async function downloadHistoryReport(
  history: Pick<ReportHistory, "id" | "report_template_name">,
  format: ReportFormat,
): Promise<boolean> {
  const fileName = await promptFileName(
    historyFileName(history.report_template_name, format),
  );
  if (!fileName) return false;

  try {
    const output = await api.runReportHistory(history.id, format);
    return saveOutput(fileName, output, format);
  } catch (e) {
    console.error(e);
    return false;
  }
}

export async function exportReportTemplate(
  template: Pick<ReportTemplate, "id" | "name">,
): Promise<boolean> {
  try {
    const data = await api.exportReportTemplate(template.id);
    return save(
      `${cleanFileName(template.name)}-export.json`,
      JSON.stringify(data, null, 2),
      "application/json",
    );
  } catch (e) {
    console.error(e);
    return false;
  }
}

// a folder arrives as a zip archive
export async function downloadReportAsset(node: {
  path: string;
  name: string;
}): Promise<boolean> {
  try {
    const blob = await api.downloadReportAsset(node.path);
    const zipped =
      blob.type === "application/zip" && !node.name.endsWith(".zip");
    return save(zipped ? `${node.name}.zip` : node.name, blob);
  } catch (e) {
    console.error(e);
    return false;
  }
}
