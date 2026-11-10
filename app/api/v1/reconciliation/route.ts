/**
 * GET /api/v1/reconciliation — per-product ledger reconciliation.
 *
 *   expected_closing = opening + Σ stock_movements.quantity (per type)
 *   drift            = products.current_stock − expected_closing
 *
 * `opening` is the signed sum of movements strictly before `from`
 * (0 when `from` is unset). drift != 0 means current stock is not fully
 * explained by the movement ledger (seed/direct edits that bypassed it).
 * Note `drift` compares against stock *now*: passing a past `to` counts
 * later movements as unexplained.
 *
 * Manager+ roles only (stock_movements:read:all) — a reconciliation is
 * meaningless under the staff/fleet_dispatch own-rows scoping. Same math
 * as lib/actions/kardex.ts and scripts/verify-ledger.ts.
 *
 * Filters: ?product_id=, ?sku=, ?from=, ?to=, ?only_drift=1
 */
import { and, asc, eq, gte, inArray, lt, lte, sql, type SQL } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { products, stockMovements } from '@/drizzle/schema';
import { withApi } from '@/lib/api/handler';
import { apiJson, ApiError } from '@/lib/api/http';
import { boolParam, uuidSchema } from '@/lib/api/schemas';
import { can } from '@/lib/auth/permissions';
import type { ReconciliationDTO } from '@/lib/types';

export const dynamic = 'force-dynamic';

const reconQuery = z.object({
  product_id: uuidSchema.optional(),
  sku: z.string().trim().min(1).max(100).optional(),
  from: z.string().trim().min(4).max(40).optional(),
  to: z.string().trim().min(4).max(40).optional(),
  only_drift: boolParam,
});

/** Round to the numeric(15,4) column's precision — kills float noise. */
const r4 = (n: number) => Math.round(n * 1e4) / 1e4;

/**
 * Accept 'YYYY-MM-DD' or an ISO 8601 datetime; a date-only value means
 * the start of that day for `from` and the end of it for `to` (UTC).
 * Same semantics as lib/actions/kardex.ts — kept local because the two
 * surfaces cannot share a module under the repo's file layout.
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

export const GET = withApi('read', async (req, principal) => {
  if (!can(principal.role, 'stock_movements:read:all')) {
    throw new ApiError(
      'forbidden',
      `Role '${principal.role}' lacks permission 'stock_movements:read:all' — reconciliation requires manager or above`,
    );
  }

  const query = reconQuery.parse({
    product_id: req.nextUrl.searchParams.get('product_id') ?? undefined,
    sku: req.nextUrl.searchParams.get('sku') ?? undefined,
    from: req.nextUrl.searchParams.get('from') ?? undefined,
    to: req.nextUrl.searchParams.get('to') ?? undefined,
    only_drift: req.nextUrl.searchParams.get('only_drift') ?? undefined,
  });

  const fromDate = parseDateParam(query.from, false);
  const toDate = parseDateParam(query.to, true);
  if ((query.from && !fromDate) || (query.to && !toDate)) {
    throw new ApiError('validation', 'Invalid date — use YYYY-MM-DD or ISO 8601');
  }
  if (fromDate && toDate && fromDate > toDate) {
    throw new ApiError('validation', '`from` must be on or before `to`');
  }

  const productConds: SQL[] = [];
  if (query.product_id) productConds.push(eq(products.id, query.product_id));
  if (query.sku) productConds.push(eq(products.sku, query.sku));
  const productWhere = productConds.length ? and(...productConds) : undefined;

  const productRows = await db
    .select({
      id: products.id,
      sku: products.sku,
      name: products.name,
      unit: products.unitOfMeasure,
      current: products.currentStock,
    })
    .from(products)
    .where(productWhere)
    .orderBy(asc(products.sku));

  if (productRows.length === 0) {
    return apiJson({
      data: [],
      meta: {
        products: 0,
        drifted: 0,
        from: fromDate?.toISOString() ?? null,
        to: toDate?.toISOString() ?? null,
      },
    });
  }

  // Window condition applied inside each FILTER so the same grouped scan
  // also yields `opening` (Σ movements strictly before `from`).
  const movementConds: SQL[] = [];
  if (productConds.length) {
    movementConds.push(
      inArray(
        stockMovements.productId,
        productRows.map((p) => p.id),
      ),
    );
  }
  const movementWhere = movementConds.length ? and(...movementConds) : undefined;

  const winConds: SQL[] = [];
  if (fromDate) winConds.push(gte(stockMovements.createdAt, fromDate));
  if (toDate) winConds.push(lte(stockMovements.createdAt, toDate));
  const windowSql = winConds.length ? and(...winConds) : undefined;

  const qty = stockMovements.quantity;
  const type = stockMovements.type;
  const typeSum = (t: string) =>
    windowSql
      ? sql<string>`COALESCE(SUM(${qty}) FILTER (WHERE ${type} = ${t} AND ${windowSql}), 0)`
      : sql<string>`COALESCE(SUM(${qty}) FILTER (WHERE ${type} = ${t}), 0)`;
  const kitSql = windowSql
    ? sql<string>`COALESCE(SUM(${qty}) FILTER (WHERE ${type} IN ('kit_consume','kit_produce') AND ${windowSql}), 0)`
    : sql<string>`COALESCE(SUM(${qty}) FILTER (WHERE ${type} IN ('kit_consume','kit_produce')), 0)`;

  const aggRows = await db
    .select({
      product_id: stockMovements.productId,
      opening: fromDate
        ? sql<string>`COALESCE(SUM(${qty}) FILTER (WHERE ${lt(stockMovements.createdAt, fromDate)}), 0)`
        : sql<string>`0`,
      inbound: typeSum('inbound'),
      outbound: typeSum('outbound'),
      scrap: typeSum('scrap'),
      adjustment: typeSum('adjustment'),
      receiving: typeSum('receiving'),
      tool_checkout: typeSum('tool_checkout'),
      kit: kitSql,
      movements_total: windowSql
        ? sql<string>`COALESCE(SUM(${qty}) FILTER (WHERE ${windowSql}), 0)`
        : sql<string>`COALESCE(SUM(${qty}), 0)`,
    })
    .from(stockMovements)
    .where(movementWhere)
    .groupBy(stockMovements.productId);

  const byProduct = new Map(aggRows.map((r) => [r.product_id, r]));

  let data: ReconciliationDTO[] = productRows.map((p) => {
    const a = byProduct.get(p.id);
    const opening = r4(Number(a?.opening ?? 0));
    const movements = r4(Number(a?.movements_total ?? 0));
    const actual = r4(Number(p.current));
    const expected = r4(opening + movements);
    const drift = r4(actual - expected);
    return {
      product_id: p.id,
      sku: p.sku,
      name: p.name,
      unit_of_measure: p.unit,
      opening,
      inbound: r4(Number(a?.inbound ?? 0)),
      outbound: r4(Number(a?.outbound ?? 0)),
      scrap: r4(Number(a?.scrap ?? 0)),
      adjustment: r4(Number(a?.adjustment ?? 0)),
      receiving: r4(Number(a?.receiving ?? 0)),
      tool_checkout: r4(Number(a?.tool_checkout ?? 0)),
      kit: r4(Number(a?.kit ?? 0)),
      movements_total: movements,
      expected_closing: expected,
      actual_stock: actual,
      drift,
      reconciles: drift === 0,
    };
  });

  if (query.only_drift) data = data.filter((r) => !r.reconciles);

  return apiJson({
    data,
    meta: {
      products: data.length,
      drifted: data.filter((r) => !r.reconciles).length,
      from: fromDate?.toISOString() ?? null,
      to: toDate?.toISOString() ?? null,
    },
  });
});
