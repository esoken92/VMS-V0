/**
 * lib/pdf/templates/generic-table — Typst source for the custom report
 * builder (roadmap 2o): an A4 landscape table with dynamic columns, org
 * header, generated-at stamp, and a row-count line.
 *
 * Same convention as inventory.ts: all dynamic content reaches typst
 * through sys.inputs.data as pre-formatted strings — nothing is
 * interpolated into the source itself.
 */

import { renderTypstPdf } from '../compiler';

export interface GenericTableInput {
  orgName: string;
  title: string;
  subtitle: string;
  generatedAt: string;
  columns: string[];
  /** rows[i][j] aligns with columns[j]; values are pre-formatted strings. */
  rows: string[][];
}

const SOURCE = String.raw`
#let data = json.decode(sys.inputs.data)
#let brand = rgb("2563eb")
#let ink = rgb("111827")
#let muted = rgb("6b7280")
#let faint = rgb("9ca3af")
#let hairline = rgb("e5e7eb")
#let wash = rgb("f9fafb")

#set page(
  paper: "a4",
  flipped: true,
  margin: (x: 14mm, top: 13mm, bottom: 16mm),
  footer: context [
    #v(2pt)
    #line(length: 100%, stroke: 0.4pt + hairline)
    #v(3pt)
    #set text(size: 7.5pt, fill: faint)
    #text(weight: 600)[#data.orgName]
    #h(1fr)
    #data.title · Generated #data.generatedAt
    #h(1fr)
    Page #counter(page).display() of #counter(page).final().at(0)
  ],
)
#set text(font: "Inter", size: 9pt, fill: ink)
#set par(leading: 0.55em, justify: false)

// ── Header band ────────────────────────────────────────────────────────────
#rect(width: 100%, height: 4.5pt, fill: brand, radius: 2.5pt)
#v(10pt)
#grid(columns: (1fr, auto), column-gutter: 10pt,
  [
    #text(size: 9.5pt, weight: 700, fill: brand)[#upper(data.orgName)]
    #v(2pt)
    #text(size: 15pt, weight: 700)[#data.title]
    #v(1pt)
    #text(size: 8.5pt, fill: muted)[#data.subtitle]
  ],
  align(horizon, align(right, stack(spacing: 1.5pt,
    text(size: 7.5pt, fill: muted)[Generated],
    text(size: 8.5pt, weight: 600)[#data.generatedAt]))))
#v(8pt)
#line(length: 100%, stroke: 0.6pt + hairline)
#v(8pt)

#if data.rows.len() == 0 [
  #v(24pt)
  #align(center, text(size: 9pt, fill: muted)[No rows match this report's filters.])
] else [
  #table(
    columns: data.columns.map(_ => 1fr),
    inset: (x: 4.5pt, y: 5pt),
    stroke: (x, y) => if y == 0 { (bottom: 0.8pt + brand) } else { (bottom: 0.3pt + hairline) },
    fill: (x, y) => if y == 0 { wash } else { none },
    table.header(
      ..data.columns.map(h => text(size: 7.5pt, weight: 700, fill: ink)[#h])
    ),
    ..data.rows.flatten().map(c => text(size: 8pt)[#c]),
  )
  #v(8pt)
  #text(size: 8pt, fill: muted)[#data.rows.len() row#if data.rows.len() != 1 [s] — capped exports truncate at the report row limit.]
]
`;

/** Render a custom builder report to PDF bytes. */
export async function renderGenericTablePdf(
  input: GenericTableInput,
): Promise<Buffer> {
  return renderTypstPdf({
    source: SOURCE,
    inputs: {
      data: JSON.stringify({
        orgName: input.orgName,
        title: input.title,
        subtitle: input.subtitle,
        generatedAt: input.generatedAt,
        columns: input.columns,
        rows: input.rows,
      }),
    },
  });
}
