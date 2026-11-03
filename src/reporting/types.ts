// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

export type ReportTemplateType = "markdown" | "html" | "plaintext";

export type ReportFormat = "pdf" | "html" | "plaintext";

// client, site: numeric ids; agent: agent_id; any other key is free text
export type ReportDependencies = Record<string, string | number>;

// dotted variable path -> type name ("Object", "Array (N Results)", "str", ...)
export type VariableAnalysis = Record<string, string>;

export interface ReportTemplate {
  id: number;
  name: string;
  // the template body for every type
  template_md: string;
  template_css: string | null;
  template_html: number | null;
  type: ReportTemplateType;
  template_variables: string;
  depends_on: string[];
}

export type ReportTemplateBody = Omit<ReportTemplate, "id"> & { id?: number };

export interface ReportHTMLTemplate {
  id: number;
  name: string;
  html: string;
}

export type ReportHTMLTemplateBody = Omit<ReportHTMLTemplate, "id"> & {
  id?: number;
};

export interface ReportDataQuery {
  id: number;
  name: string;
  json_query: Record<string, unknown>;
}

export type ReportDataQueryBody = Omit<ReportDataQuery, "id"> & {
  id?: number;
};

export interface EmailSettings {
  subject: string;
  body: string;
  attachment_name: string;
  attachment_extension: string;
  include_report_link: boolean;
}

export interface ReportSchedule {
  id: number;
  enabled: boolean;
  name: string;
  schedule: number;
  schedule_name?: string;
  report_template: number;
  report_template_name?: string;
  format: ReportFormat;
  email_recipients: Array<string>;
  send_report_email: boolean;
  last_run?: string | null;
  dependencies: ReportDependencies;
  email_settings: Partial<EmailSettings>;
  timezone: string | null;
  // read only: the user whose role scope the runs use; null on schedules
  // saved before owners existed, which run unscoped until saved again
  owner?: number | null;
  owner_name?: string | null;
}

export type ReportScheduleBody = Omit<
  ReportSchedule,
  | "id"
  | "owner_name"
  | "owner"
  | "last_run"
  | "schedule_name"
  | "report_template_name"
> & { id?: number };

export interface ReportHistory {
  id: number;
  date_created: string;
  run_by: string;
  error_data: null | string;
  report_template_type: ReportTemplateType;
  report_template_name: string;
  report_template: number;
}

export type RunReportRequest = {
  dependencies: ReportDependencies;
  format: ReportFormat;
};

export interface RunReportPreviewRequest extends ReportTemplateBody {
  format: ReportFormat;
  dependencies: ReportDependencies;
  debug: boolean;
}

export interface ReportPreviewDebug {
  template: string;
  variables: Record<string, unknown>;
}

export interface EmailReportRequest {
  format: ReportFormat;
  email_recipients: string[];
  dependencies: ReportDependencies;
  email_settings: Partial<EmailSettings>;
}

export interface ImportReportTemplateRequest {
  overwrite: boolean;
  // raw text of the export file
  template: string;
}

export interface ReportTemplateExport {
  base_template: { name: string; html: string } | null;
  template: Pick<
    ReportTemplate,
    | "name"
    | "template_css"
    | "template_md"
    | "type"
    | "depends_on"
    | "template_variables"
  >;
  assets: { id: string; name: string; file: string }[];
}

// html and plaintext arrive as text, pdf as a Blob typed application/pdf
export type ReportOutput = string | Blob;

// GET assets/: one folder level
export interface AssetNode {
  name: string;
  path: string;
  type: "folder" | "file";
  size: string | null;
  url: string;
}

// GET assets/all/: one root folder with nested children
export interface AssetTreeNode {
  type: "folder" | "file";
  name: string;
  path: string;
  id?: string;
  children?: AssetTreeNode[];
  selectable?: boolean;
  icon?: string;
  iconColor?: string;
}

// keyed by the uploaded file name; filename is the stored relative path
export type UploadAssetsResponse = Record<
  string,
  { id: string; filename: string }
>;
