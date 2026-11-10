/**
 * scripts/render-sample-pdf — offline smoke check for the Typst inventory
 * valuation template.
 *
 *   npx tsx scripts/render-sample-pdf.ts
 *
 * Renders lib/pdf/templates/inventory.ts with fixture data and writes
 * ./sample-inventory.pdf next to package.json. No database or auth needed
 * — the template's only input is the sys.inputs JSON payload.
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { format } from 'date-fns';
import {
  renderInventoryValuationPdf,
  type InventoryValuationInput,
} from '../lib/pdf/templates/inventory';

const fixture: InventoryValuationInput = {
  orgName: 'VMS Demo Fleet Services',
  generatedAt: format(new Date(), 'd MMM yyyy, HH:mm'),
  grandTotal: 0, // recomputed below
  categories: [
    {
      name: 'Consumables',
      subtotal: 0,
      rows: [
        { sku: 'FLT-OIL-5W30', name: 'Engine Oil 5W-30 (1L)', stock: 48, unit: 'bottle', avgCost: 8.75, value: 0 },
        { sku: 'FLT-AIR-STD', name: 'Air Filter — Standard', stock: 12, unit: 'each', avgCost: 14.2, value: 0 },
        { sku: 'BRK-PAD-F', name: 'Brake Pads — Front Axle Set', stock: 6, unit: 'set', avgCost: 42.5, value: 0 },
      ],
    },
    {
      name: 'Fluids',
      subtotal: 0,
      rows: [
        { sku: 'FLD-COOLANT', name: 'Coolant Concentrate (5L)', stock: 9.5, unit: 'L', avgCost: 11.3, value: 0 },
        { sku: 'FLD-HYD-68', name: 'Hydraulic Fluid ISO 68', stock: 120, unit: 'L', avgCost: 6.4, value: 0 },
      ],
    },
    {
      name: 'Tools',
      subtotal: 0,
      rows: [
        { sku: 'TLS-TQWR-12', name: 'Torque Wrench 1/2" 40–200Nm', stock: 4, unit: 'each', avgCost: 189.0, value: 0 },
      ],
    },
    {
      name: 'Tires',
      subtotal: 0,
      rows: [
        { sku: 'TRE-225-45R17', name: 'Tyre 225/45R17 91V', stock: 16, unit: 'each', avgCost: 96.5, value: 0 },
        { sku: 'TRE-315-80R225', name: 'Truck Tyre 315/80R22.5', stock: 8, unit: 'each', avgCost: 412.0, value: 0 },
      ],
    },
  ],
};

for (const cat of fixture.categories) {
  for (const r of cat.rows) r.value = r.stock * r.avgCost;
  cat.subtotal = cat.rows.reduce((s, r) => s + r.value, 0);
  fixture.grandTotal += cat.subtotal;
}

async function main() {
  const pdf = await renderInventoryValuationPdf(fixture);
  const out = join(__dirname, '..', 'sample-inventory.pdf');
  writeFileSync(out, pdf);
  console.log(`Wrote ${out} (${pdf.length} bytes)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
