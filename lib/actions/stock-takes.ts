'use server';

import { and, desc, eq, inArray, isNotNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { products, profiles, stockTakeItems, stockTakes } from '@/drizzle/schema';
import { setAuditContext, type Tx } from '@/lib/db/context';
import { requirePermission } from '@/lib/auth/session';
import { actionError, fail, ok, type Result } from '@/lib/result';
import type { StockTakeDTO, StockTakeItemDTO } from '@/lib/types';

/** List stock takes with starter name + live progress (counted/total). */
export async function listStockTakes(): Promise<Result<StockTakeDTO[]>> {
  try {
    await requirePermission('stock_takes:read');
    const rows = await db
      .select({
        id: stockTakes.id,
        started_by: stockTakes.startedBy,
        started_by_name: profiles.fullName,
        status: stockTakes.status,
        started_at: stockTakes.startedAt,
        completed_at: stockTakes.completedAt,
        notes: stockTakes.notes,
        items_total: sql<number>`(
          SELECT count(*) FROM stock_take_items sti
          WHERE sti.stock_take_id = ${stockTakes.id}
        )`,
        items_counted: sql<number>`(
          SELECT count(*) FROM stock_take_items sti
          WHERE sti.stock_take_id = ${stockTakes.id}
          AND sti.physical_qty IS NOT NULL
        )`,
      })
      .from(stockTakes)
      .leftJoin(profiles, eq(stockTakes.startedBy, profiles.id))
      .orderBy(desc(stockTakes.startedAt))
      .limit(100);

    return ok(
      rows.map((r) => ({
        ...r,
        started_at: r.started_at?.toISOString() ?? null,
        completed_at: r.completed_at?.toISOString() ?? null,
        items_total: Number(r.items_total),
        items_counted: Number(r.items_counted),
      })),
    );
  } catch (err) {
    return actionError(err);
  }
}

export async function getStockTakeItems(
  stockTakeId: string,
): Promise<Result<StockTakeItemDTO[]>> {
  try {
    await requirePermission('stock_takes:read');
    const id = z.string().uuid().parse(stockTakeId);
    const rows = await db
      .select({
        id: stockTakeItems.id,
        stock_take_id: stockTakeItems.stockTakeId,
        product_id: stockTakeItems.productId,
        system_qty: stockTakeItems.systemQty,
        physical_qty: stockTakeItems.physicalQty,
        variance: stockTakeItems.variance,
        counted_by: stockTakeItems.countedBy,
        counted_at: stockTakeItems.countedAt,
      })
      .from(stockTakeItems)
      .where(eq(stockTakeItems.stockTakeId, id));

    return ok(
      rows.map((r) => ({
        ...r,
        system_qty: Number(r.system_qty),
        physical_qty: r.physical_qty === null ? null : Number(r.physical_qty),
        variance: r.variance === null ? null : Number(r.variance),
        counted_at: r.counted_at?.toISOString() ?? null,
      })),
    );
  } catch (err) {
    return actionError(err);
  }
}

const startSchema = z.object({ notes: z.string().max(1000).nullable().optional() });

export async function startStockTake(input: unknown): Promise<Result<{ id: string }>> {
  try {
    const ctx = await requirePermission('stock_takes:write');
    const data = startSchema.parse(input ?? {});

    const created = await db.transaction(async (tx) => {
      await setAuditContext(tx, {
        userId: ctx.user.id,
        impersonatorId: ctx.impersonating ? ctx.actor.id : null,
      });
      const [row] = await tx
        .insert(stockTakes)
        .values({ startedBy: ctx.user.id, notes: data.notes ?? null })
        .returning({ id: stockTakes.id });
      return row;
    });

    return ok({ id: created.id });
  } catch (err) {
    return actionError(err);
  }
}

const countEntrySchema = z.object({
  product_id: z.string().uuid(),
  physical_qty: z.number().min(0).nullable(),
});

const saveSchema = z.object({
  stock_take_id: z.string().uuid(),
  counts: z.array(countEntrySchema).max(10000),
  notes: z.string().max(1000).nullable().optional(),
});

type CountEntry = z.infer<typeof countEntrySchema>;

/** Upsert the counted items for an open stock take inside `tx`. */
async function upsertCounts(
  tx: Tx,
  stockTakeId: string,
  counts: CountEntry[],
  countedBy: string,
) {
  if (counts.length === 0) return;
  const ids = counts.map((c) => c.product_id);
  const productRows = await tx
    .select({ id: products.id, current_stock: products.currentStock })
    .from(products)
    .where(inArray(products.id, ids));
  const stockById = new Map(productRows.map((p) => [p.id, Number(p.current_stock)]));

  const now = new Date();
  const rows = counts.flatMap((c) => {
    const systemQty = stockById.get(c.product_id);
    if (systemQty === undefined) return []; // skip unknown products
    const variance = c.physical_qty === null ? null : c.physical_qty - systemQty;
    return [
      {
        stockTakeId,
        productId: c.product_id,
        systemQty: String(systemQty),
        physicalQty: c.physical_qty === null ? null : String(c.physical_qty),
        variance: variance === null ? null : String(variance),
        countedBy,
        countedAt: now,
      },
    ];
  });
  if (rows.length === 0) return;

  await tx
    .insert(stockTakeItems)
    .values(rows)
    .onConflictDoUpdate({
      target: [stockTakeItems.stockTakeId, stockTakeItems.productId],
      set: {
        systemQty: sql`excluded.system_qty`,
        physicalQty: sql`excluded.physical_qty`,
        variance: sql`excluded.variance`,
        countedBy: sql`excluded.counted_by`,
        countedAt: sql`excluded.counted_at`,
      },
    });
}

async function assertOpen(tx: Tx, id: string) {
  const [st] = await tx
    .select({ id: stockTakes.id, status: stockTakes.status })
    .from(stockTakes)
    .where(eq(stockTakes.id, id))
    .limit(1);
  if (!st) throw new Error('Stock take not found');
  if (st.status !== 'open') throw new Error('Stock take is not open');
}

export async function saveStockTakeCounts(input: unknown): Promise<Result<null>> {
  try {
    const ctx = await requirePermission('stock_takes:write');
    const data = saveSchema.parse(input);

    await db.transaction(async (tx) => {
      await setAuditContext(tx, {
        userId: ctx.user.id,
        impersonatorId: ctx.impersonating ? ctx.actor.id : null,
      });
      await assertOpen(tx, data.stock_take_id);
      await upsertCounts(tx, data.stock_take_id, data.counts, ctx.user.id);
      if (data.notes !== undefined) {
        await tx
          .update(stockTakes)
          .set({ notes: data.notes })
          .where(eq(stockTakes.id, data.stock_take_id));
      }
    });

    return ok(null);
  } catch (err) {
    return actionError(err);
  }
}

/**
 * Complete a stock take — ports complete_stock_take (007): saves remaining
 * counts, marks completed, returns total variance.
 */
export async function completeStockTake(input: unknown): Promise<
  Result<{ total_variance: number }>
> {
  try {
    const ctx = await requirePermission('stock_takes:write');
    const data = saveSchema.parse(input);

    const result = await db.transaction(async (tx) => {
      await setAuditContext(tx, {
        userId: ctx.user.id,
        impersonatorId: ctx.impersonating ? ctx.actor.id : null,
      });
      await assertOpen(tx, data.stock_take_id);
      await upsertCounts(tx, data.stock_take_id, data.counts, ctx.user.id);

      await tx
        .update(stockTakes)
        .set({
          status: 'completed',
          completedAt: new Date(),
          ...(data.notes !== undefined ? { notes: data.notes } : {}),
        })
        .where(eq(stockTakes.id, data.stock_take_id));

      const [agg] = await tx
        .select({ total: sql<string>`COALESCE(SUM(${stockTakeItems.variance}), 0)` })
        .from(stockTakeItems)
        .where(
          and(
            eq(stockTakeItems.stockTakeId, data.stock_take_id),
            isNotNull(stockTakeItems.variance),
          ),
        );
      return { total_variance: Number(agg?.total ?? 0) };
    });

    if (!result) return fail('Stock take not found', 'NOT_FOUND');
    return ok(result);
  } catch (err) {
    return actionError(err);
  }
}
