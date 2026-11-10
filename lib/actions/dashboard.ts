'use server';

import { and, desc, eq, gte, isNull, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  products,
  profiles,
  stockMovements,
  toolLoans,
} from '@/drizzle/schema';
import { requireUser } from '@/lib/auth/session';
import { actionError, ok, type Result } from '@/lib/result';
import type { StockMovementDTO } from '@/lib/types';

export interface DashboardStats {
  total_products: number;
  low_stock_count: number;
  movements_this_month: number;
  active_tool_loans: number;
  overdue_tool_loans: number;
  recent_movements: StockMovementDTO[];
}

/** Aggregate stats + recent activity for the dashboard home page. */
export async function getDashboardStats(): Promise<Result<DashboardStats>> {
  try {
    await requireUser();
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const overdueCutoff = new Date(Date.now() - 7 * 864e5); // matches UI's 7-day rule

    const [[productStats], [movementStats], [loanStats], recent] = await Promise.all([
      db
        .select({
          total: sql<number>`count(*)`,
          low: sql<number>`count(*) filter (where ${products.currentStock} <= ${products.minThreshold})`,
        })
        .from(products),
      db
        .select({ total: sql<number>`count(*)` })
        .from(stockMovements)
        .where(gte(stockMovements.createdAt, monthStart)),
      db
        .select({
          active: sql<number>`count(*)`,
          overdue: sql<number>`count(*) filter (where ${toolLoans.checkedOutAt} < ${overdueCutoff})`,
        })
        .from(toolLoans)
        .where(and(isNull(toolLoans.returnedAt))),
      db
      .select({
        id: stockMovements.id,
        product_id: stockMovements.productId,
        product_sku: products.sku,
        product_name: products.name,
        product_unit: products.unitOfMeasure,
        user_id: stockMovements.userId,
        user_name: profiles.fullName,
        type: stockMovements.type,
        quantity: stockMovements.quantity,
        reason: stockMovements.reason,
        scrap_image_url: stockMovements.scrapImageUrl,
        created_at: stockMovements.createdAt,
      })
      .from(stockMovements)
      .leftJoin(products, eq(stockMovements.productId, products.id))
      .leftJoin(profiles, eq(stockMovements.userId, profiles.id))
        .orderBy(desc(stockMovements.createdAt))
        .limit(5),
    ]);

    return ok({
      total_products: Number(productStats?.total ?? 0),
      low_stock_count: Number(productStats?.low ?? 0),
      movements_this_month: Number(movementStats?.total ?? 0),
      active_tool_loans: Number(loanStats?.active ?? 0),
      overdue_tool_loans: Number(loanStats?.overdue ?? 0),
      recent_movements: recent.map((r) => ({
        ...r,
        quantity: Number(r.quantity),
        created_at: r.created_at?.toISOString() ?? null,
      })),
    });
  } catch (err) {
    return actionError(err);
  }
}
