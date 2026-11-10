/**
 * lib/pdf/templates/inventory — Typst source for the Inventory Valuation
 * Report (A4 portrait): org header + generated-at stamp, per-category
 * subtotal tables (SKU / name / stock / unit / avg cost / value), grand
 * total, running page footer.
 *
 * Convention: every dynamic string reaches typst through sys.inputs.data
 * (JSON) — nothing user/org-controlled is interpolated into the source.
 * All display formatting (money, quantities) is done here in TS so the
 * .typ body only lays out pre-formatted strings.
 */

import { renderTypstPdf } from '../compiler';

export interface ValuationRowInput {
  sku: string;
  name: string;
  /** On-hand quantity — fractional stocks are supported. */
  stock: number;
  /** Unit of measure label (e.g. "each", "L"). */
  unit: string;
  /** Weighted average unit cost. */
  avgCost: number;
  /** stock × avgCost line value. */
  value: number;
}

export interface ValuationCategoryInput {
  /** Display label, e.g. "Consumables". */
  name: string;
  subtotal: number;
  rows: ValuationRowInput[];
}

export interface InventoryValuationInput {
  /** Org/site name shown in the header band and page footer. */
  orgName: string;
  /** Pre-formatted render timestamp. */
  generatedAt: string;
  categories: ValuationCategoryInput[];
  grandTotal: number;
}

const fmtMoney = (v: number): string =>
  '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtQty = (v: number): string =>
  v.toLocaleString('en-US', { maximumFractionDigits: 4 });

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
  margin: (x: 15mm, top: 14mm, bottom: 17mm),
  footer: context [
    #v(2pt)
    #line(length: 100%, stroke: 0.4pt + hairline)
    #v(3pt)
    #set text(size: 7.5pt, fill: faint)
    #text(weight: 600)[#data.orgName]
    #h(1fr)
    Inventory Valuation · Generated #data.generatedAt
    #h(1fr)
    Page #counter(page).display() of #counter(page).final().at(0)
  ],
)
#set text(font: "Inter", size: 9.5pt, fill: ink)
#set par(leading: 0.55em, justify: false)

// Per-category valuation table — fixed 6-column skin.
#let vtable(rows) = table(
  columns: (auto, 1fr, auto, auto, auto, auto),
  inset: (x: 5pt, y: 5.5pt),
  stroke: (x, y) => if y == 0 { (bottom: 0.8pt + brand) } else { (bottom: 0.3pt + hairline) },
  fill: (x, y) => if y == 0 { wash } else { none },
  table.header(
    ..("SKU", "Item", "Stock", "Unit", "Avg cost", "Value")
      .map(h => text(size: 8pt, weight: 700, fill: ink)[#h])
  ),
  ..rows.flatten(),
)

// ── Header band ────────────────────────────────────────────────────────────
#rect(width: 100%, height: 4.5pt, fill: brand, radius: 2.5pt)
#v(11pt)
#grid(columns: (1fr, auto), column-gutter: 10pt,
  [
    #text(size: 9.5pt, weight: 700, fill: brand)[#upper(data.orgName)]
    #v(2pt)
    #text(size: 16pt, weight: 700)[Inventory Valuation Report]
    #v(1pt)
    #text(size: 9pt, fill: muted)[Stock on hand valued at weighted average cost]
  ],
  align(horizon, align(right, stack(spacing: 1.5pt,
    text(size: 7.5pt, fill: muted)[Generated],
    text(size: 8.5pt, weight: 600)[#data.generatedAt]))))
#v(9pt)
#line(length: 100%, stroke: 0.6pt + hairline)

// ── Summary metric cards ───────────────────────────────────────────────────
#v(9pt)
#grid(columns: (1fr, 1fr, 1fr), column-gutter: 7pt,
  ..((str(data.totalSkus), "SKUs valued"),
     (str(data.categoryCount), "Categories"),
     (data.grandTotal, "Total value"))
    .map(m => box(
      width: 100%, radius: 6pt, inset: (x: 5pt, y: 7pt),
      stroke: 0.7pt + hairline,
      align(center)[
        #text(size: 13pt, weight: 700)[#m.at(0)]
        #v(2pt)
        #text(size: 6.6pt, weight: 600, fill: muted)[#upper(m.at(1))]
      ])))

// ── Per-category sections ──────────────────────────────────────────────────
#for cat in data.categories [
  #v(11pt)
  #grid(columns: (1fr, auto), column-gutter: 10pt, align: bottom,
    text(size: 10.5pt, weight: 700, fill: ink)[#upper(cat.name)],
    align(right)[#text(size: 8.5pt, fill: muted)[Subtotal] #text(size: 9.5pt, weight: 700)[#cat.subtotal]])
  #v(1.5pt)
  #line(length: 100%, stroke: 0.8pt + brand)
  #v(2pt)
  #vtable(cat.rows.map(r => (
    text(size: 8.5pt)[#r.sku],
    text(size: 8.5pt)[#r.name],
    align(right, text(size: 8.5pt)[#r.stock]),
    text(size: 8.5pt)[#r.unit],
    align(right, text(size: 8.5pt)[#r.avgCost]),
    align(right, text(size: 8.5pt, weight: 600)[#r.value]),
  )))
]

#if data.categories.len() == 0 [
  #v(24pt)
  #align(center, text(size: 9pt, fill: muted)[No inventory on record.])
]

// ── Grand total ────────────────────────────────────────────────────────────
#if data.categories.len() > 0 [
  #v(11pt)
  #box(width: 100%, radius: 6pt, fill: wash, stroke: 0.8pt + brand, inset: (x: 10pt, y: 8pt))[
    #grid(columns: (1fr, auto), align: horizon,
      text(size: 10pt, weight: 700)[Grand total · #data.totalSkus SKUs],
      text(size: 13pt, weight: 700, fill: brand)[#data.grandTotal])
  ]
]
`;

/** Render the Inventory Valuation Report to PDF bytes. */
export async function renderInventoryValuationPdf(
  input: InventoryValuationInput,
): Promise<Buffer> {
  const data = {
    orgName: input.orgName,
    generatedAt: input.generatedAt,
    totalSkus: input.categories.reduce((n, c) => n + c.rows.length, 0),
    categoryCount: input.categories.length,
    grandTotal: fmtMoney(input.grandTotal),
    categories: input.categories.map((c) => ({
      name: c.name,
      subtotal: fmtMoney(c.subtotal),
      rows: c.rows.map((r) => ({
        sku: r.sku,
        name: r.name,
        stock: fmtQty(r.stock),
        unit: r.unit,
        avgCost: fmtMoney(r.avgCost),
        value: fmtMoney(r.value),
      })),
    })),
  };

  return renderTypstPdf({
    source: SOURCE,
    inputs: { data: JSON.stringify(data) },
  });
}
