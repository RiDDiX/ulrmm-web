// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

import { date } from "quasar";
import { escapeHtml } from "@/utils/patchStatus";

import type { QTableColumn } from "quasar";
import type { LocationQuery, RouteLocationNormalized } from "vue-router";
import type { ReportDependencies, ReportFormat } from "@/reporting/types";

const REPORT_FORMATS: readonly ReportFormat[] = ["pdf", "html", "plaintext"];

function isReportFormat(value: unknown): value is ReportFormat {
  return REPORT_FORMATS.includes(value as ReportFormat);
}

const TYPE_LABELS = new Map<string, string>([
  ["markdown", "Markdown"],
  ["html", "HTML"],
  ["plaintext", "Plain text"],
]);

// unknown values are shown as they are
export function templateTypeLabel(type: string) {
  return TYPE_LABELS.get(type) ?? type;
}

// q-table search over the shown cell values and the extra raw values a row
// also matches on, such as a type key or an error text
export function searchWithRaw<T>(raw: (row: T) => unknown[]) {
  return (
    rows: readonly T[],
    terms: string,
    cols: readonly QTableColumn[],
    cellValue: (col: QTableColumn, row: T) => unknown,
  ) => {
    const term = terms.toLowerCase();
    const hit = (value: unknown) =>
      value !== null &&
      value !== undefined &&
      String(value).toLowerCase().includes(term);
    return rows.filter(
      (row) =>
        cols.some((col) => hit(cellValue(col, row))) || raw(row).some(hit),
    );
  };
}

// plaintext reports are usually csv
function reportFileExtension(format: ReportFormat) {
  return format === "plaintext" ? "csv" : format;
}

function hasValue(values: ReportDependencies, name: string) {
  if (!Object.prototype.hasOwnProperty.call(values, name)) return false;
  const value = values[name];
  return value !== null && value !== undefined && String(value).trim() !== "";
}

// names from depends_on that still need a value before a run
export function missingDependencies(
  dependsOn: string[],
  values: ReportDependencies,
): string[] {
  return dependsOn.filter((name) => !hasValue(values, name));
}

// file names

export function cleanFileName(name: string) {
  const cleaned = name.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, "_").trim();
  return cleaned || "report";
}

export function templateFileName(name: string, format: ReportFormat) {
  return `${name}.${reportFileExtension(format)}`;
}

export function historyFileName(
  templateName: string,
  format: ReportFormat,
  when: Date = new Date(),
) {
  const stamp = date.formatDate(when, "YYYYMMDD-HHmmss");
  return `report-${cleanFileName(templateName)}-${stamp}.${reportFileExtension(format)}`;
}

// Asset names typed by the user. The server rejects traversal on its own;
// this keeps obvious mistakes from reaching it.
export function assetNameRule(name: string): true | string {
  if (!name || !name.trim()) return "A name is required";
  if (/[\\/]/.test(name)) return "A name cannot contain / or \\";
  return true;
}

// report output

// plaintext goes into the frame as literal text, never as markup
export function plaintextDocument(text: string) {
  return `<pre>${escapeHtml(text)}</pre>`;
}

// report routes

// The Report route carries dependsOn and dependencies as JSON text. The
// router encodes every query value, so &, #, + and % survive the round trip.
export function reportLocation(
  id: number,
  format: ReportFormat,
  dependsOn: string[] = [],
  dependencies: ReportDependencies = {},
) {
  const query: Record<string, string> = { format };
  if (dependsOn.length > 0) {
    query.dependsOn = JSON.stringify(dependsOn);
    query.dependencies = JSON.stringify(dependencies);
  }
  return { name: "Report", params: { id: String(id) }, query };
}

export function reportHistoryLocation(id: number, format: ReportFormat) {
  return {
    name: "ReportHistory",
    params: { id: String(id) },
    query: { format },
  };
}

export interface ReportRouteProps {
  id: number;
  format: ReportFormat;
  dependsOn: string[];
  dependencies: ReportDependencies;
  // set when the link cannot be used; the view shows it instead of running
  error: string | null;
}

export type ReportHistoryRouteProps = Pick<
  ReportRouteProps,
  "id" | "format" | "error"
>;

const INVALID_LINK = "This report link is not valid.";

class InvalidLink extends Error {}

function parseId(value: unknown): number {
  if (typeof value !== "string" || !/^[1-9]\d{0,17}$/.test(value))
    throw new InvalidLink();
  return Number(value);
}

// a repeated key arrives as an array, which no field accepts
function queryText(query: LocationQuery, key: string): string | undefined {
  const value = query[key];
  if (value === undefined) return undefined;
  if (typeof value !== "string") throw new InvalidLink();
  return value;
}

function parseFormat(query: LocationQuery): ReportFormat {
  const format = queryText(query, "format");
  if (!isReportFormat(format)) throw new InvalidLink();
  return format;
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new InvalidLink();
  }
}

function parseDependsOn(text: string | undefined): string[] {
  if (text === undefined) return [];
  const value = parseJson(text);
  if (
    !Array.isArray(value) ||
    !value.every((name) => typeof name === "string" && name !== "")
  )
    throw new InvalidLink();
  return [...new Set(value as string[])];
}

// a flat object of strings and finite numbers
function parseDependencies(text: string | undefined): ReportDependencies {
  if (text === undefined) return {};
  const value = parseJson(text);
  if (value === null || typeof value !== "object" || Array.isArray(value))
    throw new InvalidLink();
  const entries = Object.entries(value as Record<string, unknown>);
  if (
    !entries.every(
      ([, v]) =>
        typeof v === "string" || (typeof v === "number" && Number.isFinite(v)),
    )
  )
    throw new InvalidLink();
  // fromEntries defines own properties, so a "__proto__" key stays a key
  return Object.fromEntries(entries) as ReportDependencies;
}

function withLinkCheck<T extends { error: string | null }>(
  parse: () => Omit<T, "error">,
  fallback: Omit<T, "error">,
): T {
  try {
    return { ...parse(), error: null } as T;
  } catch (e) {
    if (!(e instanceof InvalidLink)) throw e;
    return { ...fallback, error: INVALID_LINK } as T;
  }
}

// route props factories: a malformed link becomes an error state, never a
// router exception
export function reportRouteProps(
  route: RouteLocationNormalized,
): ReportRouteProps {
  return withLinkCheck<ReportRouteProps>(
    () => ({
      id: parseId(route.params.id),
      format: parseFormat(route.query),
      dependsOn: parseDependsOn(queryText(route.query, "dependsOn")),
      dependencies: parseDependencies(queryText(route.query, "dependencies")),
    }),
    { id: 0, format: "html", dependsOn: [], dependencies: {} },
  );
}

export function reportHistoryRouteProps(
  route: RouteLocationNormalized,
): ReportHistoryRouteProps {
  return withLinkCheck<ReportHistoryRouteProps>(
    () => ({
      id: parseId(route.params.id),
      format: parseFormat(route.query),
    }),
    { id: 0, format: "html" },
  );
}
