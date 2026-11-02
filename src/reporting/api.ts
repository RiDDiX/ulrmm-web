// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

import axios from "axios";

import { notifyError } from "@/utils/notify";
import { assetNameRule } from "@/reporting/utils";

import type {
  AssetNode,
  AssetTreeNode,
  EmailReportRequest,
  ImportReportTemplateRequest,
  ReportDataQuery,
  ReportDataQueryBody,
  ReportDependencies,
  ReportFormat,
  ReportHistory,
  ReportHTMLTemplate,
  ReportHTMLTemplateBody,
  ReportOutput,
  ReportPreviewDebug,
  ReportSchedule,
  ReportScheduleBody,
  ReportTemplate,
  ReportTemplateBody,
  ReportTemplateExport,
  RunReportPreviewRequest,
  RunReportRequest,
  UploadAssetsResponse,
  VariableAnalysis,
} from "@/reporting/types";

const baseUrl = "/reporting";

// A pdf is shown through a blob URL in an unsandboxed frame, so only a
// response the server marked as pdf is accepted, and the blob is retyped so
// the browser never sniffs it as a document of our origin.
function asPdf(data: unknown): Blob {
  if (
    !(data instanceof Blob) ||
    !data.type.toLowerCase().startsWith("application/pdf")
  ) {
    notifyError("The server did not return a PDF document.");
    throw new Error("unexpected pdf response type");
  }
  return new Blob([data], { type: "application/pdf" });
}

function asText(data: unknown): string {
  return typeof data === "string" ? data : "";
}

// pdf needs a blob response; html and plaintext come back as a JSON string
async function postForOutput(
  url: string,
  format: ReportFormat,
  payload: object,
): Promise<ReportOutput> {
  if (format === "pdf") {
    const { data } = await axios.post(url, payload, { responseType: "blob" });
    return asPdf(data);
  }
  const { data } = await axios.post(url, payload);
  return asText(data);
}

// An html report is shown from a single use URL on the API, which serves it
// with the report frame policy. The dashboard itself allows no inline script.
export async function reportFrameUrl(html: string): Promise<string> {
  const { data } = await axios.post(`${baseUrl}/frame/`, {
    html,
    format: "html",
  });
  return data.url;
}

// report templates

export async function fetchReportTemplates(
  dependsOn: string[] = [],
): Promise<ReportTemplate[]> {
  const params = new URLSearchParams();
  for (const name of dependsOn) params.append("dependsOn[]", name);
  const { data } = await axios.get(`${baseUrl}/templates/`, { params });
  return data;
}

export async function saveReportTemplate(
  template: ReportTemplateBody,
): Promise<ReportTemplate> {
  const body = { ...template };
  delete body.id;
  const { data } = await axios.post(`${baseUrl}/templates/`, body);
  return data;
}

export async function editReportTemplate(
  id: number,
  template: Partial<ReportTemplateBody>,
): Promise<ReportTemplate> {
  const { data } = await axios.put(`${baseUrl}/templates/${id}/`, template);
  return data;
}

export async function removeReportTemplate(id: number) {
  const { data } = await axios.delete(`${baseUrl}/templates/${id}/`);
  return data;
}

export function runReport(
  id: number,
  request: RunReportRequest,
): Promise<ReportOutput> {
  return postForOutput(
    `${baseUrl}/templates/${id}/run/`,
    request.format,
    request,
  );
}

export async function exportReportTemplate(
  id: number,
): Promise<ReportTemplateExport> {
  const { data } = await axios.post(`${baseUrl}/templates/${id}/export/`);
  return data;
}

export async function emailReport(id: number, request: EmailReportRequest) {
  const { data } = await axios.post(
    `${baseUrl}/templates/${id}/email/`,
    request,
  );
  return data;
}

// debug answers {template, variables} for html and plaintext
export async function previewReport(
  request: RunReportPreviewRequest,
): Promise<ReportOutput | ReportPreviewDebug> {
  const url = `${baseUrl}/templates/preview/`;
  if (!request.debug) return postForOutput(url, request.format, request);

  const { data } = await axios.post(url, request);
  return {
    template: asText(data?.template),
    variables:
      data?.variables && typeof data.variables === "object"
        ? data.variables
        : {},
  };
}

// an empty body means nothing resolved
export async function analyzeReportVariables(
  variables: string,
  dependencies: ReportDependencies = {},
): Promise<VariableAnalysis> {
  const { data } = await axios.post(`${baseUrl}/templates/preview/analysis/`, {
    variables,
    dependencies,
  });
  return data && typeof data === "object" ? data : {};
}

export async function importReportTemplate(
  request: ImportReportTemplateRequest,
): Promise<ReportTemplate> {
  const { data } = await axios.post(`${baseUrl}/templates/import/`, request);
  return data;
}

// assets

// path is relative to the asset root; a leading slash is allowed
export async function fetchReportAssets(path: string): Promise<AssetNode[]> {
  const { data } = await axios.get(`${baseUrl}/assets/`, {
    params: { path },
  });
  return data;
}

export async function fetchReportAssetTree(
  onlyFolders = false,
): Promise<AssetTreeNode[]> {
  const { data } = await axios.get(`${baseUrl}/assets/all/`, {
    params: onlyFolders ? { onlyFolders: true } : {},
  });
  return data;
}

// The server is the real check for names and paths. This refuses obvious
// separators before a request goes out.
function checkAssetName(name: string) {
  const result = assetNameRule(name);
  if (result !== true) {
    notifyError(result);
    throw new Error("invalid asset name");
  }
}

// answers the new relative path
export async function renameReportAsset(
  path: string,
  newName: string,
): Promise<string> {
  checkAssetName(newName);
  const { data } = await axios.put(`${baseUrl}/assets/rename/`, {
    path,
    newName,
  });
  return data;
}

// answers the created relative path, which the server may adjust on a clash
export async function createReportAssetFolder(
  parentPath: string,
  name: string,
): Promise<string> {
  checkAssetName(name);
  const { data } = await axios.post(`${baseUrl}/assets/newfolder/`, {
    path: `${parentPath}/${name}`,
  });
  return data;
}

// folders are removed with everything in them
export async function removeReportAssets(paths: string[]) {
  const { data } = await axios.post(`${baseUrl}/assets/delete/`, { paths });
  return data;
}

export async function uploadReportAssets(
  files: File[],
  parentPath: string,
): Promise<UploadAssetsResponse> {
  const form = new FormData();
  for (const file of files) {
    checkAssetName(file.name);
    form.append(file.name, file);
  }
  form.append("parentPath", parentPath);
  const { data } = await axios.post(`${baseUrl}/assets/upload/`, form);
  return data;
}

// a folder arrives as a zip archive
export async function downloadReportAsset(path: string): Promise<Blob> {
  const { data } = await axios.get(`${baseUrl}/assets/download/`, {
    params: { path },
    responseType: "blob",
  });
  return data;
}

// data query JSON schema for the editor
export async function fetchQuerySchema(): Promise<Record<string, unknown>> {
  const { data } = await axios.get(`${baseUrl}/queryschema/`);
  return data;
}

// base templates

export async function fetchReportHTMLTemplates(): Promise<
  ReportHTMLTemplate[]
> {
  const { data } = await axios.get(`${baseUrl}/htmltemplates/`);
  return data;
}

export async function saveReportHTMLTemplate(
  template: ReportHTMLTemplateBody,
): Promise<ReportHTMLTemplate> {
  const { data } = await axios.post(`${baseUrl}/htmltemplates/`, {
    name: template.name,
    html: template.html,
  });
  return data;
}

export async function editReportHTMLTemplate(
  id: number,
  template: Partial<ReportHTMLTemplateBody>,
): Promise<ReportHTMLTemplate> {
  const { data } = await axios.put(`${baseUrl}/htmltemplates/${id}/`, template);
  return data;
}

export async function removeReportHTMLTemplate(id: number) {
  const { data } = await axios.delete(`${baseUrl}/htmltemplates/${id}/`);
  return data;
}

// data queries

export async function fetchReportDataQueries(): Promise<ReportDataQuery[]> {
  const { data } = await axios.get(`${baseUrl}/dataqueries/`);
  return data;
}

export async function saveReportDataQuery(
  query: ReportDataQueryBody,
): Promise<ReportDataQuery> {
  const { data } = await axios.post(`${baseUrl}/dataqueries/`, {
    name: query.name,
    json_query: query.json_query,
  });
  return data;
}

export async function editReportDataQuery(
  id: number,
  query: Partial<ReportDataQueryBody>,
): Promise<ReportDataQuery> {
  const { data } = await axios.put(`${baseUrl}/dataqueries/${id}/`, query);
  return data;
}

export async function removeReportDataQuery(id: number) {
  const { data } = await axios.delete(`${baseUrl}/dataqueries/${id}/`);
  return data;
}

// schedules

export async function fetchReportSchedules(): Promise<ReportSchedule[]> {
  const { data } = await axios.get(`${baseUrl}/schedules/`);
  return data;
}

export async function saveReportSchedule(
  schedule: ReportScheduleBody,
): Promise<ReportSchedule> {
  const body = { ...schedule };
  delete body.id;
  const { data } = await axios.post(`${baseUrl}/schedules/`, body);
  return data;
}

export async function editReportSchedule(
  id: number,
  schedule: Partial<ReportScheduleBody>,
): Promise<ReportSchedule> {
  const { data } = await axios.put(`${baseUrl}/schedules/${id}/`, schedule);
  return data;
}

export async function removeReportSchedule(id: number) {
  const { data } = await axios.delete(`${baseUrl}/schedules/${id}/`);
  return data;
}

export async function runReportSchedule(id: number) {
  const { data } = await axios.post(`${baseUrl}/schedules/${id}/run/`);
  return data;
}

// history

export async function fetchReportHistory(): Promise<ReportHistory[]> {
  const { data } = await axios.get(`${baseUrl}/history/`);
  return data;
}

export async function removeReportHistory(id: number) {
  const { data } = await axios.delete(`${baseUrl}/history/${id}/`);
  return data;
}

// the stored output; a pdf is rendered from it on the fly
export function runReportHistory(
  id: number,
  format: ReportFormat,
): Promise<ReportOutput> {
  return postForOutput(`${baseUrl}/history/${id}/run/`, format, { format });
}
