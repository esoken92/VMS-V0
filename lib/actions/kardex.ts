'use server';

/**
 * Kardex — per-product movement ledger with a server-computed running
 * balance, plus a per-product reconciliation summary (the same math as
 * GET /api/v1/reconciliation and scripts/verify-ledger.ts):
 *
 *   expected_closing = opening + Σ stock_movements.quantity
 *   drift            = products.current_stock − expected_closing
 *
 * `opening` is the signed sum of movements strictly before `from`
 * (0 when `from` is unset). drift != 0 means current stock is not fully
 * explained by the ledger (e.g. seed/direct edits bypassing movements).
 *
 * Gated to roles with `stock_movements:read:all` (manager and up): a
 * correct running balance requires the full movement history, so the
 * staff/fleet_dispatch own-rows scoping cannot apply here.
 */

import { and, asc, eq, gte, lt, lte, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { products, profiles, stockMovements } from '@/drizzle/schema';
import { requirePermission } from '@/lib/auth/session';
import { actionError, fail, ok, type Result } from '@/lib/result';
import type {
  KardexDTO,
  KardexEntryDTO,
  ReconciliationDTO,
} from '@/lib/types';

const ENTRY_LIMIT = 500;

/** Round to the numeric(15,4) column's precision — kills float noise. */
const r4 = (n: number) => Math.round(n * 1e4) / 1e4;

/**
 * Accept 'YYYY-MM-DD' or an ISO 8601 datetime; a date-only value means
 * the start of that day for `from` and the end of it for `to` (UTC).
 * Returns undefined when unset, null when unparseable.
 */
function parseDateParam(
  value: string | undefined,
  endOfDay: boolean,
): Date | null | undefined {
  if (!value) return undefined;
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? `${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`
    : value;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Per-product reconciliation over full movement history (opening = 0). */
async function buildSummaries(productId?: string): Promise<ReconciliationDTO[]> {
  const productRows = await db
    .select({
      id: products.id,
      sku: products.sku,
      name: products.name,
      unit: products.unitOfMeasure,
      current: products.currentStock,
    })
    .from(products)
    .where(productId ? eq(products.id, productId) : undefined)
    .orderBy(asc(products.sku));

  const qty = stockMovements.quantity;
  const type = stockMovements.type;
  const aggRows = await db
    .select({
      product_id: stockMovements.productId,
      inbound: sql<string>`COALESCE(SUM(${qty}) FILTER (WHERE ${type} = 'inbound'), 0)`,
      outbound: sql<string>`COALESCE(SUM(${qty}) FILTER (WHERE ${type} = 'outbound'), 0)`,
      scrap: sql<string>`COALESCE(SUM(${qty}) FILTER (WHERE ${type} = 'scrap'), 0)`,
      adjustment: sql<string>`COALESCE(SUM(${qty}) FILTER (WHERE ${type} = 'adjustment'), 0)`,
      receiving: sql<string>`COALESCE(SUM(${qty}) FILTER (WHERE ${type} = 'receiving'), 0)`,
      tool_checkout: sql<string>`COALESCE(SUM(${qty}) FILTER (WHERE ${type} = 'tool_checkout'), 0)`,
      kit: sql<string>`COALESCE(SUM(${qty}) FILTER (WHERE ${type} IN ('kit_consume','kit_produce')), 0)`,
      total: sql<string>`COALESCE(SUM(${qty}), 0)`,
    })
    .from(stockMovements)
    .where(productId ? eq(stockMovements.productId, productId) : undefined)
    .groupBy(stockMovements.productId);

  const byProduct = new Map(aggRows.map((r) => [r.product_id, r]));

  return productRows.map((p) => {
    const a = byProduct.get(p.id);
    const actual = r4(Number(p.current));
    const expected = r4(Number(a?.total ?? 0));
    const drift = r4(actual - expected);
    return {
      product_id: p.id,
      sku: p.sku,
      name: p.name,
      unit_of_measure: p.unit,
      opening: 0,
      inbound: r4(Number(a?.inbound ?? 0)),
      outbound: r4(Number(a?.outbound ?? 0)),
      scrap: r4(Number(a?.scrap ?? 0)),
      adjustment: r4(Number(a?.adjustment ?? 0)),
      receiving: r4(Number(a?.receiving ?? 0)),
      tool_checkout: r4(Number(a?.tool_checkout ?? 0)),
      kit: r4(Number(a?.kit ?? 0)),
      movements_total: expected,
      expected_closing: expected,
      actual_stock: actual,
      drift,
      reconciles: drift === 0,
    };
  });
}

/**
 * Per-product movement ledger.
 *
 *   productId — optional uuid; omit for a cross-product view (running
 *               balances are still computed per product).
 *   from / to — optional 'YYYY-MM-DD' or ISO datetime bounds.
 *
 * Returns the windowed ledger rows (chronological, with running balance)
 * plus a per-product reconciliation summary over the full history.
 */
export async function getKardex(
  productId?: string,
  from?: string,
  to?: string,
): Promise<Result<KardexDTO>> {
  try {
    await requirePermission('stock_movements:read:all');

    if (productId && !z.string().uuid().safeParse(productId).success) {
      return fail('Invalid product_id', 'VALIDATION');
    }

    const fromDate = parseDateParam(from, false);
    const toDate = parseDateParam(to, true);
    if ((from && !fromDate) || (to && !toDate)) {
      return fail('Invalid date — use YYYY-MM-DD or ISO 8601', 'VALIDATION');
    }
    if (fromDate && toDate && fromDate > toDate) {
      return fail('`from` must be on or before `to`', 'VALIDATION');
    }

    // --- windowed ledger entries (chronological) -----------------------
    const entryConds = [];
    if (productId) entryConds.push(eq(stockMovements.productId, productId));
    if (fromDate) entryConds.push(gte(stockMovements.createdAt, fromDate));
    if (toDate) entryConds.push(lte(stockMovements.createdAt, toDate));

    // --- opening balances: signed sum of movements before `from` -------
    const openConds = fromDate ? [lt(stockMovements.createdAt, fromDate)] : null;
    if (openConds && productId) openConds.push(eq(stockMovements.productId, productId));

    const [movementRows, openingRows, summaries] = await Promise.all([
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
          created_at: stockMovements.createdAt,
        })
        .from(stockMovements)
        .leftJoin(products, eq(stockMovements.productId, products.id))
        .leftJoin(profiles, eq(stockMovements.userId, profiles.id))
        .where(entryConds.length ? and(...entryConds) : undefined)
        .orderBy(asc(stockMovements.createdAt), asc(stockMovements.id))
        .limit(ENTRY_LIMIT + 1),
      openConds
        ? db
            .select({
              product_id: stockMovements.productId,
              total: sql<string>`COALESCE(SUM(${stockMovements.quantity}), 0)`,
            })
            .from(stockMovements)
            .where(and(...openConds))
            .groupBy(stockMovements.productId)
        : Promise.resolve([]),
      buildSummaries(productId),
    ]);

    const truncated = movementRows.length > ENTRY_LIMIT;
    if (truncated) movementRows.length = ENTRY_LIMIT;

    const openingByProduct = new Map<string, number>();
    for (const r of openingRows) openingByProduct.set(r.product_id, Number(r.total));

    // --- running balance, per product ----------------------------------
    const balances = new Map<string, number>();
    const entries: KardexEntryDTO[] = movementRows.map((r) => {
      const prev =
        balances.get(r.product_id) ?? openingByProduct.get(r.product_id) ?? 0;
      const balance = r4(prev + Number(r.quantity));
      balances.set(r.product_id, balance);
      return {
        id: r.id,
        product_id: r.product_id,
        product_sku: r.product_sku,
        product_name: r.product_name,
        product_unit: r.product_unit,
        user_id: r.user_id,
        user_name: r.user_name,
        type: r.type,
        quantity: Number(r.quantity),
        running_balance: balance,
        reason: r.reason,
        created_at: r.created_at?.toISOString() ?? null,
      };
    });

    const opening_balance = productId
      ? r4(openingByProduct.get(productId) ?? 0)
      : 0;

    return ok({
      opening_balance,
      entries,
      entries_truncated: truncated,
      summaries,
    });
  } catch (err) {
    return actionError(err);
  }
}
