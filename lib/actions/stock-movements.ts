'use server';

import { and, desc, eq } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { products, profiles, stockMovements } from '@/drizzle/schema';
import { setAuditContext } from '@/lib/db/context';
import { requireUser, can } from '@/lib/auth/session';
import { canCreateMovement } from '@/lib/auth/permissions';
import { actionError, fail, ok, type Result } from '@/lib/result';
import { MOVEMENT_TYPES } from '@/lib/auth/roles';
import type { StockMovementDTO } from '@/lib/types';

/**
 * Stock movements — ports record_stock_movement (007) into an explicit
 * transaction: insert movement + update products.current_stock atomically.
 * The legacy double-counting trigger is dropped by migration 010.
 *
 * Scope: roles without `stock_movements:read:all` see only their own rows
 * (RLS parity for staff/fleet_dispatch).
 */
export async function listStockMovements(
  limit = 50,
): Promise<Result<StockMovementDTO[]>> {
  try {
    const ctx = await requireUser();
    const seeAll = can(ctx.user.role, 'stock_movements:read:all');

    const rows = await db
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
      .where(seeAll ? undefined : eq(stockMovements.userId, ctx.user.id))
      .orderBy(desc(stockMovements.createdAt))
      .limit(Math.min(Math.max(limit, 1), 200));

    return ok(
      rows.map((r) => ({
        ...r,
        quantity: Number(r.quantity),
        created_at: r.created_at?.toISOString() ?? null,
      })),
    );
  } catch (err) {
    return actionError(err);
  }
}

const recordSchema = z.object({
  product_id: z.string().uuid(),
  type: z.enum(MOVEMENT_TYPES),
  quantity: z.number().positive('Quantity must be positive'),
  reason: z.string().max(1000).nullable().optional(),
  scrap_image_url: z.string().max(1000).nullable().optional(),
});

export async function recordStockMovement(input: unknown): Promise<
  Result<{ movement_id: string; new_stock: number }>
> {
  try {
    const ctx = await requireUser();
    const data = recordSchema.parse(input);

    if (!canCreateMovement(ctx.user.role, data.type)) {
      return fail(`Your role cannot record ${data.type} movements`, 'FORBIDDEN');
    }

    const signedQty =
      data.type === 'inbound' || data.type === 'receiving' || data.type === 'adjustment'
        ? Math.abs(data.quantity)
        : -Math.abs(data.quantity);
    // tool_checkout is a custody audit record (custody lives on tool_loans):
    // it never changes owned stock — same semantics as scanToolToggle.
    const isCustody = data.type === 'tool_checkout';

    const result = await db.transaction(async (tx) => {
      await setAuditContext(tx, {
        userId: ctx.user.id,
        impersonatorId: ctx.impersonating ? ctx.actor.id : null,
      });

      const [product] = await tx
        .select({
          id: products.id,
          current_stock: products.currentStock,
          bin_location_id: products.binLocationId,
        })
        .from(products)
        .where(eq(products.id, data.product_id))
        .for('update')
        .limit(1);
      if (!product) throw new Error('Product not found');

      const newStock = Number(product.current_stock) + signedQty;
      if (!isCustody && newStock < 0) throw new Error('Insufficient stock');

      const [movement] = await tx
        .insert(stockMovements)
        .values({
          productId: data.product_id,
          userId: ctx.user.id,
          impersonatedByUserId: ctx.impersonating ? ctx.actor.id : null,
          type: data.type,
          quantity: String(signedQty),
          reason: data.reason || null,
          scrapImageUrl: data.scrap_image_url || null,
          // Home bin keeps the per-bin projection (product_stock) truthful.
          binLocationId: product.bin_location_id,
        })
        .returning({ id: stockMovements.id });

      if (!isCustody) {
        await tx
          .update(products)
          .set({
            currentStock: String(newStock),
            lastMovementDate: new Date(),
          })
          .where(eq(products.id, data.product_id));
      }

      return { movement_id: movement.id, new_stock: isCustody ? Number(product.current_stock) : newStock };
    });

    return ok(result);
  } catch (err) {
    return actionError(err);
  }
}

/** Product movement history — ports get_product_movement_history (007). */
export async function getProductMovementHistory(
  productId: string,
  days = 30,
): Promise<Result<StockMovementDTO[]>> {
  try {
    const ctx = await requireUser();
    const seeAll = can(ctx.user.role, 'stock_movements:read:all');
    const pid = z.string().uuid().parse(productId);
    const since = new Date(Date.now() - Math.min(Math.max(days, 1), 365) * 864e5);

    const rows = await db
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
      .where(
        and(
          eq(stockMovements.productId, pid),
          sql`${stockMovements.createdAt} >= ${since}`,
          seeAll ? undefined : eq(stockMovements.userId, ctx.user.id),
        ),
      )
      .orderBy(desc(stockMovements.createdAt))
      .limit(200);

    return ok(
      rows.map((r) => ({
        ...r,
        quantity: Number(r.quantity),
        created_at: r.created_at?.toISOString() ?? null,
      })),
    );
  } catch (err) {
    return actionError(err);
  }
}
