/**
 * GET /api/reports/inventory-valuation — Typst-rendered "Inventory
 * Valuation Report" PDF, compiled in-process (no Chromium).
 *
 * Session-auth: manager and above (a valuation exposes cost data). Errors
 * use the shared { error: { code, message } } envelope from lib/api/http.
 *
 * Dataset: same product snapshot as lib/actions/reports.ts getReportData —
 * every product with its bin location, ordered by SKU — grouped by
 * item_type into per-category subtotal tables with a grand total of
 * stock × average_cost.
 */

import { NextResponse } from 'next/server';
import { asc, eq } from 'drizzle-orm';
import { format } from 'date-fns';
import { db } from '@/lib/db';
import { binLocations, products, systemSettings } from '@/drizzle/schema';
import { requireRole } from '@/lib/auth/session';
import { ITEM_TYPES } from '@/lib/auth/roles';
import { AuthError } from '@/lib/result';
import { apiError, apiErrorResponse } from '@/lib/api/http';
import {
  renderInventoryValuationPdf,
  type ValuationCategoryInput,
} from '@/lib/pdf/templates/inventory';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CATEGORY_LABELS: Record<string, string> = {
  consumable: 'Consumables',
  fluid: 'Fluids',
  tool: 'Tools',
  tire: 'Tires',
};

/** item_type ordering — enum order first, anything unexpected last. */
const categoryOrder = (t: string): number => {
  const i = (ITEM_TYPES as readonly string[]).indexOf(t);
  return i === -1 ? ITEM_TYPES.length : i;
};

export async function GET() {
  try {
    await requireRole(['super_admin', 'admin', 'manager']);

    // Same product-snapshot query shape as getReportData (reports.ts).
    const [productRows, settingsRows] = await Promise.all([
      db
        .select({
          id: products.id,
          sku: products.sku,
          name: products.name,
          item_type: products.itemType,
          current_stock: products.currentStock,
          min_threshold: products.minThreshold,
          average_cost: products.averageCost,
          unit_of_measure: products.unitOfMeasure,
          issuing_unit: products.issuingUnit,
          zone: binLocations.zone,
          bin_location: binLocations.binLocation,
        })
        .from(products)
        .leftJoin(binLocations, eq(products.binLocationId, binLocations.id))
        .orderBy(asc(products.sku)),
      db
        .select({ value: systemSettings.value })
        .from(systemSettings)
        .where(eq(systemSettings.key, 'company_name'))
        .limit(1),
    ]);
    const orgName = settingsRows[0]?.value?.trim() || 'VMS Inventory';

    const groups = new Map<string, ValuationCategoryInput>();
    let grandTotal = 0;
    for (const p of productRows) {
      let cat = groups.get(p.item_type);
      if (!cat) {
        cat = {
          name: CATEGORY_LABELS[p.item_type] ?? p.item_type,
          subtotal: 0,
          rows: [],
        };
        groups.set(p.item_type, cat);
      }
      const stock = Number(p.current_stock);
      const avgCost = Number(p.average_cost);
      const value = stock * avgCost;
      cat.subtotal += value;
      grandTotal += value;
      cat.rows.push({
        sku: p.sku,
        name: p.name,
        stock,
        unit: p.unit_of_measure,
        avgCost,
        value,
      });
    }
    const categories = [...groups.entries()]
      .sort(([a], [b]) => categoryOrder(a) - categoryOrder(b))
      .map(([, cat]) => cat);

    const pdf = await renderInventoryValuationPdf({
      orgName,
      generatedAt: format(new Date(), 'd MMM yyyy, HH:mm'),
      categories,
      grandTotal,
    });

    const filename = `inventory-valuation-${new Date().toISOString().slice(0, 10)}.pdf`;
    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(pdf.length),
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return apiError(
        err.code === 'UNAUTHENTICATED' ? 'unauthenticated' : 'forbidden',
        err.code === 'UNAUTHENTICATED' ? 'Not authenticated' : 'Forbidden',
      );
    }
    return apiErrorResponse(err);
  }
}
