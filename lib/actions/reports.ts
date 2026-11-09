'use server';

import { and, asc, desc, eq, gte } from 'drizzle-orm';
import { db } from '@/lib/db';
import { binLocations, products, profiles, stockMovements } from '@/drizzle/schema';
import { requirePermission } from '@/lib/auth/session';
import { actionError, ok, type Result } from '@/lib/result';
import type { ReportDataDTO } from '@/lib/types';

/**
 * Reports page data: full product snapshot (with bin location labels) +
 * movements within the window. `reports:read` gated.
 */
export async function getReportData(days = 30): Promise<Result<ReportDataDTO>> {
  try {
    await requirePermission('reports:read');
    const since = new Date(Date.now() - Math.min(Math.max(days, 1), 365) * 864e5);

    const productRows = await db
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
      .orderBy(asc(products.sku));

    const movementRows = await db
      .select({
        id: stockMovements.id,
        type: stockMovements.type,
        quantity: stockMovements.quantity,
        reason: stockMovements.reason,
        created_at: stockMovements.createdAt,
        product_id: stockMovements.productId,
        product_sku: products.sku,
        product_name: products.name,
        user_name: profiles.fullName,
      })
      .from(stockMovements)
      .leftJoin(products, eq(stockMovements.productId, products.id))
      .leftJoin(profiles, eq(stockMovements.userId, profiles.id))
      .where(and(gte(stockMovements.createdAt, since)))
      .orderBy(desc(stockMovements.createdAt))
      .limit(2000);

    return ok({
      products: productRows.map((p) => ({
        ...p,
        current_stock: Number(p.current_stock),
        min_threshold: Number(p.min_threshold),
        average_cost: Number(p.average_cost),
      })),
      movements: movementRows.map((m) => ({
        ...m,
        quantity: Number(m.quantity),
        created_at: m.created_at?.toISOString() ?? null,
      })),
    });
  } catch (err) {
    return actionError(err);
  }
}
