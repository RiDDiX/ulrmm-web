// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

import { isMap, parseDocument } from "yaml";

import type { ReportTemplateType, VariableAnalysis } from "@/reporting/types";

// text helpers for the template editor; kept free of Monaco so they can be
// checked on their own

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Markdown line prefixes (headings, lists, quotes). A line that already has
// exactly `count` units is switched off; any other run of the unit is
// replaced by the requested one.
export function togglePrefix(line: string, unit: string, count = 1) {
  const trimmed = line.replace(/^\s+/, "");
  const u = escapeRegExp(unit);
  const exact = new RegExp(`^(?:${u}){${count}}(?!${u})\\s+`);
  if (exact.test(trimmed)) return trimmed.replace(exact, "");
  const rest = trimmed.replace(new RegExp(`^(?:${u})+\\s+`), "");
  return `${unit.repeat(count)} ${rest}`;
}

export function togglePrefixLines(text: string, unit: string, count = 1) {
  return text
    .split("\n")
    .map((line) => togglePrefix(line, unit, count))
    .join("\n");
}

export const SECTION_KINDS = [
  "Section",
  "Chapter",
  "Header",
  "Footer",
  "Nav",
  "Div",
  "Article",
] as const;

export type SectionKind = (typeof SECTION_KINDS)[number];

// markdown uses the ~~X~~ markers of the server's section extension
export function sectionMarkers(kind: SectionKind, type: ReportTemplateType) {
  if (type === "markdown") {
    const letter = kind[0].toUpperCase();
    return [`~~${letter}~~\n`, `\n~~/${letter}~~`];
  }
  const tag = kind.toLowerCase();
  return [`<${tag}>`, `</${tag}>`];
}

// YAML reads an unquoted value with braces as a flow mapping, so values
// with a template tag such as {{ client.name }} are wrapped in single
// quotes. Flow mappings and lists ({a: b}, - {name: x}) and values that
// already hold a quote are left alone.
const BRACE_VALUE =
  /^(\s*(?:- )?[^\s#:'"{[-][^:'"]*:[ \t]+)([^'"\n]*\{[{%#][^'"\n]*?)([ \t]*)$/;

export function quoteBraceValues(text: string) {
  return text
    .split("\n")
    .map((line) => line.replace(BRACE_VALUE, "$1'$2'$3"))
    .join("\n");
}

// Writes a query into data_sources.<key>, keeping comments and layout of
// the rest of the document. Throws on YAML the parser rejects.
export function setDataSource(variables: string, key: string, query: unknown) {
  const doc = parseDocument(variables || "");
  if (doc.errors.length > 0) throw doc.errors[0];
  // an empty document gets a block map; the parsed-node typing does not
  // cover nodes created afterwards
  if (doc.contents === null || doc.contents === undefined)
    doc.contents = doc.createNode({}) as unknown as typeof doc.contents;
  if (!isMap(doc.contents))
    throw new Error("The variables must be a YAML map to add a data source");
  if (!isMap(doc.get("data_sources")))
    doc.set("data_sources", doc.createNode({}));
  doc.setIn(["data_sources", key], doc.createNode(query));
  return doc.toString();
}

// null when there is no data_sources map
export function getDataSources(
  variables: string,
): Record<string, Record<string, unknown>> | null {
  const doc = parseDocument(variables || "");
  if (doc.errors.length > 0) return null;
  const value = doc.toJS()?.data_sources;
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value;
}

// first YAML error message, or null when the text parses
export function yamlError(text: string): string | null {
  const doc = parseDocument(text || "");
  return doc.errors.length > 0 ? doc.errors[0].message : null;
}

// base template blocks

const BLOCK_TAG = /\{%-?\s*block\s+([A-Za-z0-9_ ]*?[A-Za-z0-9_])\s*-?%\}/g;

export interface BaseTemplateBlock {
  name: string;
  tag: string;
  used: boolean;
}

export function baseTemplateBlocks(
  html: string,
  body: string,
): BaseTemplateBlock[] {
  const seen = new Set<string>();
  const blocks: BaseTemplateBlock[] = [];
  for (const match of html.matchAll(BLOCK_TAG)) {
    if (seen.has(match[0])) continue;
    seen.add(match[0]);
    blocks.push({
      name: match[1],
      tag: match[0],
      used: body.includes(match[0]),
    });
  }
  return blocks;
}

export function emptyBlock(name: string) {
  return `{% block ${name} %}{% endblock %}`;
}

// variable analysis

export function isArrayType(type: string) {
  return type.toLowerCase().startsWith("array");
}

export function variableSnippet(path: string, type: string) {
  return isArrayType(type)
    ? `{% for item in ${path} %}{% endfor %}`
    : `{{ ${path} }}`;
}

// table maker

export const BLANK_TABLE = `<table>
  <thead>
    <tr>
      <th></th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td></td>
    </tr>
  </tbody>
</table>`;

// site__client__name -> "Client Name"
export function columnLabel(column: string) {
  return column
    .split("__")
    .slice(-2)
    .join("_")
    .split("_")
    .filter((word) => word !== "")
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}

export function tableColumns(analysis: VariableAnalysis, source: string) {
  const prefix = `${source}[0].`;
  return Object.entries(analysis)
    .filter(([path, type]) => path.startsWith(prefix) && type !== "Object")
    .map(([path]) => path.slice(prefix.length));
}

// cells are tab indented and followed by a blank line, as the dialog has
// always inserted them
export function tableFromSource(analysis: VariableAnalysis, source: string) {
  const columns = tableColumns(analysis, source);
  const headers = columns.length
    ? columns.map((column) => `\t<th>${columnLabel(column)}</th>\n`)
    : ["\t<th>Column Name</th>\n"];
  const cells = columns.length
    ? columns.map((column) => `\t<td>{{ item.${column} }}</td>\n`)
    : ["\t<td>{{ item }}</td>\n"];
  return [
    "<table>",
    "  <thead>",
    "    <tr>",
    headers.join(""),
    "    </tr>",
    "  </thead>",
    "  <tbody>",
    `    {% for item in ${source} %}`,
    "    <tr>",
    cells.join(""),
    "    </tr>",
    "    {% endfor %}",
    "  </tbody>",
    "</table>",
    "",
  ].join("\n");
}
